from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.appointment import AppointmentStatus


class AppointmentBase(BaseModel):
    customer_id: int
    appointment_type: Optional[str] = None
    appointment_datetime: datetime


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    appointment_type: Optional[str] = None
    appointment_datetime: Optional[datetime] = None
    status: Optional[AppointmentStatus] = None


class AppointmentOut(AppointmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: AppointmentStatus
    reminder_sent_at: Optional[datetime] = None
    created_at: datetime
    customer_name: str
    google_event_id: Optional[str] = None
    calendar_warning: Optional[str] = None
