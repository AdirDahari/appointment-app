import enum
from datetime import datetime, timedelta

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class AppointmentStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    appointment_type = Column(String, nullable=True)
    appointment_datetime = Column(DateTime, nullable=False, index=True)
    # NULL on appointments booked before end times existed; read those through
    # end_datetime_of(), which falls back to a one-hour appointment.
    appointment_end_datetime = Column(DateTime, nullable=True)
    status = Column(Enum(AppointmentStatus), nullable=False, default=AppointmentStatus.pending)
    reminder_sent_at = Column(DateTime, nullable=True)
    google_event_id = Column(String, nullable=True)
    # When the owner got the "starts soon" push; NULL until it is sent.
    owner_notified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="appointments")


DEFAULT_DURATION = timedelta(hours=1)


def end_datetime_of(appointment: "Appointment") -> datetime:
    return appointment.appointment_end_datetime or appointment.appointment_datetime + DEFAULT_DURATION
