from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerDetail, CustomerOut, CustomerUpdate
from app.services import calendar_service
from app.services.whatsapp_service import normalize_phone_number

router = APIRouter(prefix="/customers", tags=["customers"])


def _find_phone_conflict(db: Session, phone_number: str, exclude_id: Optional[int] = None) -> Optional[Customer]:
    """A customer whose number is the same once formatting is stripped.

    "050-777-7777" and "0507777777" are one phone; the webhook matches replies by
    the normalized number, so two customers sharing it would swallow each other's
    replies.
    """
    target = normalize_phone_number(phone_number)
    for customer in db.query(Customer).all():
        if customer.id == exclude_id:
            continue
        if normalize_phone_number(customer.phone_number) == target:
            return customer
    return None


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    if db.query(Customer).filter(Customer.full_name == payload.full_name).first():
        raise HTTPException(status_code=400, detail="שם הלקוח כבר קיים במערכת")
    if _find_phone_conflict(db, payload.phone_number):
        raise HTTPException(status_code=400, detail="מספר הטלפון כבר קיים במערכת")

    customer = Customer(full_name=payload.full_name, phone_number=payload.phone_number)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("", response_model=List[CustomerOut])
def list_customers(search: Optional[str] = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(Customer)
    if search:
        query = query.filter(Customer.full_name.ilike(f"%{search}%"))
    return query.order_by(Customer.full_name).all()


@router.get("/{customer_id}", response_model=CustomerDetail)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="הלקוח לא נמצא")

    last_appointment = (
        db.query(Appointment)
        .filter(
            Appointment.customer_id == customer_id,
            Appointment.appointment_datetime <= datetime.now(),
        )
        .order_by(Appointment.appointment_datetime.desc())
        .first()
    )

    return CustomerDetail(
        **CustomerOut.model_validate(customer).model_dump(),
        last_appointment_date=last_appointment.appointment_datetime if last_appointment else None,
    )


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="הלקוח לא נמצא")

    data = payload.model_dump(exclude_unset=True)

    if "full_name" in data:
        conflict = (
            db.query(Customer)
            .filter(Customer.full_name == data["full_name"], Customer.id != customer_id)
            .first()
        )
        if conflict:
            raise HTTPException(status_code=400, detail="שם הלקוח כבר קיים במערכת")

    if "phone_number" in data and _find_phone_conflict(db, data["phone_number"], exclude_id=customer_id):
        raise HTTPException(status_code=400, detail="מספר הטלפון כבר קיים במערכת")

    for field, value in data.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: int, force: bool = False, db: Session = Depends(get_db)):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="הלקוח לא נמצא")

    if not force:
        # Local time, like everywhere else in the app — appointment_datetime is
        # stored as naive local time.
        has_future_appointment = (
            db.query(Appointment)
            .filter(
                Appointment.customer_id == customer_id,
                Appointment.appointment_datetime > datetime.now(),
                Appointment.status != AppointmentStatus.cancelled,
            )
            .first()
        )
        if has_future_appointment:
            raise HTTPException(
                status_code=409,
                detail="ללקוח יש תורים עתידיים. שלחו force=true כדי למחוק בכל זאת",
            )

    # The DB cascade removes the appointments; their calendar events must go too,
    # otherwise they linger in Google Calendar with no appointment behind them.
    for appointment in customer.appointments:
        if appointment.google_event_id:
            calendar_service.delete_event(appointment.google_event_id)

    db.delete(customer)
    db.commit()
    return None
