from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerDetail, CustomerOut, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["customers"])


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(Customer)
        .filter(
            or_(
                Customer.full_name == payload.full_name,
                Customer.phone_number == payload.phone_number,
            )
        )
        .first()
    )
    if existing:
        if existing.full_name == payload.full_name:
            raise HTTPException(status_code=400, detail="שם הלקוח כבר קיים במערכת")
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

    if "phone_number" in data:
        conflict = (
            db.query(Customer)
            .filter(Customer.phone_number == data["phone_number"], Customer.id != customer_id)
            .first()
        )
        if conflict:
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
        has_future_appointment = (
            db.query(Appointment)
            .filter(
                Appointment.customer_id == customer_id,
                Appointment.appointment_datetime > datetime.utcnow(),
                Appointment.status != AppointmentStatus.cancelled,
            )
            .first()
        )
        if has_future_appointment:
            raise HTTPException(
                status_code=409,
                detail="ללקוח יש תורים עתידיים. שלחו force=true כדי למחוק בכל זאת",
            )

    db.delete(customer)
    db.commit()
    return None
