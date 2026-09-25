import logging
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.config import BUSINESS_HOURS, settings
from app.database import SessionLocal
from app.models.appointment import Appointment, AppointmentStatus
from app.services import whatsapp_service

logger = logging.getLogger(__name__)

# Safety net for the day-walking loops; with a single closed day per week they
# never need more than two steps, but this keeps a bad BUSINESS_HOURS table from looping.
MAX_ROLLBACK_DAYS = 14

# Business hours only govern when WhatsApp reminders go out. Appointments
# themselves can be booked at any hour.


def is_within_business_hours(moment: datetime) -> bool:
    window = BUSINESS_HOURS.get(moment.weekday())
    if not window:
        return False
    opens_at, closes_at = window
    return opens_at <= moment.time() <= closes_at


def _last_send_slot(day: date) -> datetime:
    """The latest reminder time on `day` that a scheduler run is sure to catch
    before closing. Runs are `scheduler_interval_minutes` apart, so a reminder
    stamped exactly at closing could otherwise be first seen after closing."""
    closes_at = BUSINESS_HOURS[day.weekday()][1]
    return datetime.combine(day, closes_at) - timedelta(minutes=settings.scheduler_interval_minutes)


def _previous_business_day_closing(day: date) -> datetime:
    """Last send slot of the most recent business day strictly before `day`."""
    cursor = day - timedelta(days=1)
    for _ in range(MAX_ROLLBACK_DAYS):
        if cursor.weekday() in BUSINESS_HOURS:
            return _last_send_slot(cursor)
        cursor -= timedelta(days=1)
    raise ValueError(f"No business day found within {MAX_ROLLBACK_DAYS} days before {day}")


def next_opening(moment: datetime) -> datetime:
    """The first opening time strictly after `moment`."""
    cursor = moment.date()
    for _ in range(MAX_ROLLBACK_DAYS):
        window = BUSINESS_HOURS.get(cursor.weekday())
        if window:
            opening = datetime.combine(cursor, window[0])
            if opening > moment:
                return opening
        cursor += timedelta(days=1)
    raise ValueError(f"No business day found within {MAX_ROLLBACK_DAYS} days after {moment}")


def adjust_to_business_hours(target: datetime, appointment_datetime: datetime) -> datetime:
    """Move a reminder time into business hours.

    - inside the day's window            -> unchanged
    - before that day's opening          -> that day's opening time
      (e.g. a 07:00 appointment is reminded at 08:00 the day before)
    - after that day's closing           -> shortly before that day's closing
    - on a fully closed day (Saturday)   -> shortly before the previous business day's closing

    If moving forward to the opening would land at or after the appointment
    itself, the reminder goes back to the previous business day instead.
    """
    window = BUSINESS_HOURS.get(target.weekday())

    if window:
        opens_at, closes_at = window
        if opens_at <= target.time() <= closes_at:
            return target
        if target.time() > closes_at:
            return max(_last_send_slot(target.date()), datetime.combine(target.date(), opens_at))
        opening = datetime.combine(target.date(), opens_at)
        if opening < appointment_datetime:
            return opening
        # opening is too late for this appointment — fall through

    return _previous_business_day_closing(target.date())


def compute_reminder_time(appointment_datetime: datetime) -> datetime:
    """When the reminder for this appointment should actually be sent."""
    target = appointment_datetime - timedelta(hours=settings.reminder_hours_before)
    return adjust_to_business_hours(target, appointment_datetime)


def is_due(appointment: Appointment, now: datetime) -> bool:
    """Whether this appointment's reminder should go out right now."""
    if appointment.reminder_sent_at is not None:
        return False
    if appointment.status == AppointmentStatus.cancelled:
        return False
    # Never chase appointments that already happened — otherwise the first run
    # after a quiet period would blast reminders for every past appointment.
    if appointment.appointment_datetime <= now:
        return False
    if compute_reminder_time(appointment.appointment_datetime) > now:
        return False
    # Due, but only sent inside business hours. The one exception: the
    # appointment starts before the business opens again (e.g. booked at 21:00
    # for 07:00 tomorrow), where waiting would mean no reminder at all.
    return is_within_business_hours(now) or next_opening(now) >= appointment.appointment_datetime


def send_reminder(appointment: Appointment, db: Session) -> bool:
    """Send one reminder and stamp reminder_sent_at. Returns whether it went out."""
    try:
        message_id = whatsapp_service.send_appointment_reminder(
            customer_name=appointment.customer.full_name,
            phone_number=appointment.customer.phone_number,
            appointment_datetime=appointment.appointment_datetime,
        )
    except whatsapp_service.WhatsAppError as error:
        # Leave reminder_sent_at empty so the next scheduler cycle retries.
        logger.error("Reminder for appointment %s failed: %s", appointment.id, error)
        return False

    appointment.reminder_sent_at = datetime.now()
    db.commit()
    logger.info(
        "Reminder sent for appointment %s (%s) — message_id=%s",
        appointment.id,
        appointment.customer.full_name,
        message_id,
    )
    return True


def send_if_due(appointment: Appointment, db: Session) -> bool:
    """Used right after create/reschedule so a near-term appointment doesn't wait
    for the next scheduler cycle."""
    if not is_due(appointment, datetime.now()):
        return False
    return send_reminder(appointment, db)


def run_once() -> int:
    """One scheduler pass: send every reminder that has come due. Returns the count sent."""
    if not settings.whatsapp_enabled:
        logger.warning("Scheduler: WhatsApp not configured — reminders are not being sent")
        return 0

    db = SessionLocal()
    try:
        now = datetime.now()
        candidates = (
            db.query(Appointment)
            .filter(
                Appointment.reminder_sent_at.is_(None),
                Appointment.status != AppointmentStatus.cancelled,
                Appointment.appointment_datetime > now,
            )
            .all()
        )
        due = [appointment for appointment in candidates if is_due(appointment, now)]
        if due:
            logger.info("Scheduler: %s reminder(s) due", len(due))

        return sum(1 for appointment in due if send_reminder(appointment, db))
    except Exception:
        logger.exception("Scheduler run failed")
        return 0
    finally:
        db.close()
