"""Push a heads-up to the owner's phone shortly before each appointment.

Runs every minute from the background scheduler. Independent of the WhatsApp
customer reminder: it only needs Web Push (VAPID keys) to be configured.
"""
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.appointment import Appointment, AppointmentStatus
from app.models.owner_preferences import get_preferences
from app.services import push_service

logger = logging.getLogger(__name__)


def is_due(appointment: Appointment, now: datetime) -> bool:
    """Whether the owner's reminder for this appointment should go out right now."""
    if appointment.owner_notified_at is not None:
        return False
    if appointment.status == AppointmentStatus.cancelled:
        return False
    # Never chase appointments that already started — the first run after a
    # quiet period must not blast reminders for every past appointment.
    if appointment.appointment_datetime <= now:
        return False
    return appointment.appointment_datetime - timedelta(minutes=settings.owner_reminder_minutes_before) <= now


def notify(appointment: Appointment, db: Session) -> bool:
    """Send one reminder and stamp owner_notified_at. Returns whether it went out."""
    sent = push_service.notify_upcoming_appointment(db, appointment)
    # Stamp even when no device is registered: retrying every minute would not
    # help, and a device registered later should not get a stale burst.
    appointment.owner_notified_at = datetime.now()
    db.commit()
    logger.info(
        "Owner reminder for appointment %s (%s at %s) — %s device(s)",
        appointment.id,
        appointment.customer.full_name,
        appointment.appointment_datetime.strftime("%H:%M"),
        sent,
    )
    return sent > 0


def run_once() -> int:
    """One pass: notify the owner about every appointment that came due. Returns the count sent."""
    if not settings.push_enabled:
        return 0

    db = SessionLocal()
    try:
        if not get_preferences(db).notify_upcoming:
            return 0
        now = datetime.now()
        candidates = (
            db.query(Appointment)
            .filter(
                Appointment.owner_notified_at.is_(None),
                Appointment.status != AppointmentStatus.cancelled,
                Appointment.appointment_datetime > now,
                Appointment.appointment_datetime
                <= now + timedelta(minutes=settings.owner_reminder_minutes_before),
            )
            .all()
        )
        return sum(1 for appointment in candidates if is_due(appointment, now) and notify(appointment, db))
    except Exception:
        logger.exception("Owner reminder run failed")
        return 0
    finally:
        db.close()
