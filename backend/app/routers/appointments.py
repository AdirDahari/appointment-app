import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.customer import Customer
from app.schemas.appointment import AppointmentCreate, AppointmentOut, AppointmentUpdate
from app.services import calendar_service, reminder_scheduler, whatsapp_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _to_out(appointment: Appointment, calendar_warning: Optional[str] = None) -> AppointmentOut:
    return AppointmentOut(
        id=appointment.id,
        customer_id=appointment.customer_id,
        appointment_type=appointment.appointment_type,
        appointment_datetime=appointment.appointment_datetime,
        status=appointment.status,
        reminder_sent_at=appointment.reminder_sent_at,
        created_at=appointment.created_at,
        customer_name=appointment.customer.full_name,
        google_event_id=appointment.google_event_id,
        calendar_warning=calendar_warning,
    )


@router.post("", response_model=AppointmentOut, status_code=201)
def create_appointment(payload: AppointmentCreate, db: Session = Depends(get_db)):
    customer = db.get(Customer, payload.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="הלקוח לא נמצא")

    appointment = Appointment(
        customer_id=payload.customer_id,
        appointment_type=payload.appointment_type,
        appointment_datetime=payload.appointment_datetime,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    calendar_warning = None
    google_event_id = calendar_service.create_event(customer.full_name, appointment.appointment_datetime)
    if google_event_id:
        appointment.google_event_id = google_event_id
        db.commit()
        db.refresh(appointment)
    else:
        calendar_warning = "התור נשמר במערכת, אך יצירת האירוע ביומן Google נכשלה"

    # Booked inside the reminder window — send now instead of waiting for the
    # next scheduler cycle. A failure here is logged and retried by the scheduler.
    reminder_scheduler.send_if_due(appointment, db)
    db.refresh(appointment)

    return _to_out(appointment, calendar_warning=calendar_warning)


@router.get("", response_model=List[AppointmentOut])
def list_appointments(
    reminder_sent: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(Appointment).options(joinedload(Appointment.customer))
    if reminder_sent is True:
        query = query.filter(Appointment.reminder_sent_at.isnot(None))
    elif reminder_sent is False:
        query = query.filter(Appointment.reminder_sent_at.is_(None))
    appointments = query.order_by(Appointment.appointment_datetime).all()
    return [_to_out(a) for a in appointments]


@router.patch("/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: int, payload: AppointmentUpdate, db: Session = Depends(get_db)
):
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="התור לא נמצא")

    data = payload.model_dump(exclude_unset=True)

    reschedule = (
        "appointment_datetime" in data
        and data["appointment_datetime"] != appointment.appointment_datetime
    )

    for field, value in data.items():
        setattr(appointment, field, value)

    if reschedule:
        appointment.reminder_sent_at = None
        appointment.status = AppointmentStatus.pending

    db.commit()
    db.refresh(appointment)

    calendar_warning = None
    if reschedule and appointment.google_event_id:
        success = calendar_service.update_event(
            appointment.google_event_id, appointment.customer.full_name, appointment.appointment_datetime
        )
        if not success:
            calendar_warning = "התור עודכן במערכת, אך עדכון האירוע ביומן Google נכשל"

    # A reschedule clears reminder_sent_at; if the new time is already inside the
    # reminder window the reminder goes out immediately.
    if reschedule:
        reminder_scheduler.send_if_due(appointment, db)
        db.refresh(appointment)

    return _to_out(appointment, calendar_warning=calendar_warning)


@router.post("/{appointment_id}/send-reminder", response_model=AppointmentOut)
def send_reminder(appointment_id: int, db: Session = Depends(get_db)):
    """Temporary test endpoint (Stage 3) — sends the reminder for one appointment now."""
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="התור לא נמצא")

    try:
        message_id = whatsapp_service.send_appointment_reminder(
            customer_name=appointment.customer.full_name,
            phone_number=appointment.customer.phone_number,
            appointment_datetime=appointment.appointment_datetime,
        )
    except whatsapp_service.WhatsAppError as error:
        raise HTTPException(status_code=502, detail=f"שליחת התזכורת נכשלה: {error}") from error

    appointment.reminder_sent_at = datetime.now()
    db.commit()
    db.refresh(appointment)

    logger.info("Reminder sent for appointment %s (message_id=%s)", appointment_id, message_id)
    return _to_out(appointment)


@router.delete("/{appointment_id}", status_code=204)
def delete_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="התור לא נמצא")

    if appointment.google_event_id:
        calendar_service.delete_event(appointment.google_event_id)

    db.delete(appointment)
    db.commit()
    return None
