from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.appointment import AppointmentStatus


def _clean_type(value: Optional[str]) -> Optional[str]:
    """Whitespace-only type means 'no type'."""
    if value is None:
        return None
    cleaned = " ".join(value.split())
    return cleaned or None


class AppointmentBase(BaseModel):
    customer_id: int
    appointment_type: Optional[str] = None
    appointment_datetime: datetime

    @field_validator("appointment_type")
    @classmethod
    def _validate_type(cls, value: Optional[str]) -> Optional[str]:
        return _clean_type(value)


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    appointment_type: Optional[str] = None
    appointment_datetime: Optional[datetime] = None
    status: Optional[AppointmentStatus] = None

    @field_validator("appointment_type")
    @classmethod
    def _validate_type(cls, value: Optional[str]) -> Optional[str]:
        return _clean_type(value)


class AppointmentOut(AppointmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: AppointmentStatus
    reminder_sent_at: Optional[datetime] = None
    created_at: datetime
    customer_name: str
    google_event_id: Optional[str] = None
    calendar_warning: Optional[str] = None
