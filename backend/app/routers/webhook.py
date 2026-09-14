import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.customer import Customer
from app.services import push_service
from app.services.whatsapp_service import normalize_phone_number

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook", tags=["webhook"])

# Exact matches only — "לא מגיעה" contains "מגיעה", so substring checks would
# silently confirm a cancellation.
CONFIRM_REPLIES = {"מגיעה"}
CANCEL_REPLIES = {"לא מגיעה"}


@router.get("", response_class=PlainTextResponse)
def verify_webhook(
    hub_mode: str = Query(default="", alias="hub.mode"),
    hub_verify_token: str = Query(default="", alias="hub.verify_token"),
    hub_challenge: str = Query(default="", alias="hub.challenge"),
):
    """Meta calls this once when you save the callback URL."""
    if hub_mode == "subscribe" and settings.whatsapp_verify_token and hub_verify_token == settings.whatsapp_verify_token:
        logger.info("Webhook verified by Meta")
        return PlainTextResponse(hub_challenge)

    logger.warning("Webhook verification failed (mode=%s)", hub_mode)
    raise HTTPException(status_code=403, detail="Verification failed")


def describe_payload(payload: dict) -> str:
    """One-line summary of an incoming callback, for diagnosing what Meta sent."""
    parts = []
    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            field = change.get("field")
            for message in value.get("messages") or []:
                parts.append(f"{field}:message(type={message.get('type')})")
            for status in value.get("statuses") or []:
                parts.append(f"{field}:status({status.get('status')})")
            if not value.get("messages") and not value.get("statuses"):
                parts.append(f"{field}:{sorted(value.keys())}")
    return ", ".join(parts) or "empty payload"


def extract_reply(payload: dict) -> tuple[Optional[str], Optional[str]]:
    """Pull (sender_phone, reply_text) out of a Meta webhook payload.

    Returns (None, None) for anything that isn't a button reply — delivery
    statuses, plain messages, etc.
    """
    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            for message in value.get("messages") or []:
                sender = message.get("from")
                message_type = message.get("type")

                # Quick-reply buttons on a template message arrive as type "button".
                if message_type == "button":
                    button = message.get("button") or {}
                    return sender, button.get("text") or button.get("payload")

                # Interactive reply buttons (not used by our template, but cheap to support).
                if message_type == "interactive":
                    interactive = message.get("interactive") or {}
                    button_reply = interactive.get("button_reply") or {}
                    if button_reply:
                        return sender, button_reply.get("title") or button_reply.get("id")

    return None, None


def status_for_reply(reply_text: Optional[str]) -> Optional[AppointmentStatus]:
    cleaned = (reply_text or "").strip()
    if cleaned in CANCEL_REPLIES:
        return AppointmentStatus.cancelled
    if cleaned in CONFIRM_REPLIES:
        return AppointmentStatus.confirmed
    return None


def find_customer_by_phone(db: Session, sender_phone: str) -> Optional[Customer]:
    """Match Meta's E.164 sender (972501234567) against locally stored numbers (0501234567)."""
    target = normalize_phone_number(sender_phone)
    for customer in db.query(Customer).all():
        if normalize_phone_number(customer.phone_number) == target:
            return customer
    return None


def find_awaiting_appointment(db: Session, customer_id: int) -> Optional[Appointment]:
    """The appointment this reply is about: reminder sent, still awaiting an answer.

    If several qualify, the most recently reminded one is the one they just replied to.
    """
    return (
        db.query(Appointment)
        .filter(
            Appointment.customer_id == customer_id,
            Appointment.status == AppointmentStatus.pending,
            Appointment.reminder_sent_at.isnot(None),
        )
        .order_by(Appointment.reminder_sent_at.desc())
        .first()
    )


@router.post("")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    """Receive customer replies. Always answers 200 — Meta retries and can disable
    a webhook that returns errors."""
    try:
        payload = await request.json()
    except Exception:
        logger.warning("Webhook received a non-JSON body")
        return {"status": "ignored"}

    try:
        sender_phone, reply_text = extract_reply(payload)
        if not sender_phone:
            # Delivery statuses, plain text messages, template status updates, ...
            logger.info("Webhook ignored — %s", describe_payload(payload))
            return {"status": "ignored"}

        new_status = status_for_reply(reply_text)
        if new_status is None:
            logger.info("Reply from %s was not a known button: %r", sender_phone, reply_text)
            return {"status": "ignored"}

        customer = find_customer_by_phone(db, sender_phone)
        if not customer:
            logger.warning("Reply from unknown number %s", sender_phone)
            return {"status": "unknown_customer"}

        appointment = find_awaiting_appointment(db, customer.id)
        if not appointment:
            logger.warning("No appointment awaiting a reply for %s", customer.full_name)
            return {"status": "no_pending_appointment"}

        appointment.status = new_status
        db.commit()

        logger.info(
            "%s replied %r -> appointment %s is now %s",
            customer.full_name,
            reply_text,
            appointment.id,
            new_status.value,
        )

        # Tell the owner's phone. A push failure must never turn into a webhook
        # error — the status is already saved.
        try:
            push_service.notify_status_change(db, customer, appointment, new_status)
        except Exception:
            logger.exception("Owner notification failed")

        return {"status": "updated", "appointment_id": appointment.id, "new_status": new_status.value}
    except Exception:
        logger.exception("Webhook processing failed")
        return {"status": "error"}
