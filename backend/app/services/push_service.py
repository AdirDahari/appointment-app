"""Web Push notifications to the owner's installed app.

Sent when a customer answers the WhatsApp reminder. Uses VAPID keys from
settings; when they are missing, sending is a no-op so the rest of the app
keeps working.
"""
import json
import logging
from datetime import datetime

from pywebpush import WebPushException, webpush
from sqlalchemy.orm import Session

from app.config import settings
from app.models.appointment import Appointment, AppointmentStatus
from app.models.customer import Customer
from app.models.owner_preferences import get_preferences
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)

# Push services answer 404/410 for subscriptions the browser has dropped.
GONE_STATUSES = {404, 410}


def _subscription_info(subscription: PushSubscription) -> dict:
    return {
        "endpoint": subscription.endpoint,
        "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
    }


def send_to_all(db: Session, title: str, body: str, url: str = "/") -> int:
    """Send one notification to every registered device. Returns how many went out."""
    if not settings.push_enabled:
        logger.info("Push disabled (no VAPID keys) — skipping: %s", title)
        return 0

    subscriptions = db.query(PushSubscription).all()
    if not subscriptions:
        return 0

    payload = json.dumps({"title": title, "body": body, "url": url}, ensure_ascii=False)
    sent = 0
    for subscription in subscriptions:
        try:
            webpush(
                subscription_info=_subscription_info(subscription),
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_subject},
                ttl=60 * 60 * 24,
            )
            sent += 1
        except WebPushException as error:
            status = getattr(error.response, "status_code", None)
            if status in GONE_STATUSES:
                logger.info("Push subscription %s is gone — removing", subscription.id)
                db.delete(subscription)
                db.commit()
            else:
                logger.error("Push to subscription %s failed: %s", subscription.id, error)
        except Exception:
            logger.exception("Push to subscription %s failed", subscription.id)
    return sent


def _format_when(moment: datetime) -> str:
    return moment.strftime("%d/%m/%Y בשעה %H:%M")


def notify_upcoming_appointment(db: Session, appointment: Appointment) -> int:
    """Heads-up to the owner shortly before an appointment starts."""
    if not get_preferences(db).notify_upcoming:
        return 0
    title = f"תזכורת: תור ל{appointment.customer.full_name} בשעה: {appointment.appointment_datetime.strftime('%H:%M')}"
    body = appointment.appointment_type or f"בעוד {settings.owner_reminder_minutes_before} דקות"
    return send_to_all(db, title=title, body=body, url="/")


def notify_status_change(
    db: Session, customer: Customer, appointment: Appointment, new_status: AppointmentStatus
) -> int:
    """Tell the owner that a customer tapped מגיעה / לא מגיעה."""
    if not get_preferences(db).notify_status_change:
        return 0
    when = _format_when(appointment.appointment_datetime)
    if new_status == AppointmentStatus.confirmed:
        title = f"{customer.full_name} אישרה את התור"
        body = f"התור ב-{when} אושר ✅"
    else:
        title = f"{customer.full_name} ביטלה את התור"
        body = f"התור ב-{when} בוטל ❌"
    return send_to_all(db, title=title, body=body, url="/")
