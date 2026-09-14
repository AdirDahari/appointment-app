import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


def _clean_name(value: str) -> str:
    cleaned = " ".join(value.split())
    if not cleaned:
        raise ValueError("יש להזין שם לקוח")
    return cleaned


def _clean_phone(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("יש להזין מספר טלפון")
    if len(re.sub(r"\D", "", cleaned)) < 7:
        raise ValueError("מספר הטלפון אינו תקין")
    return cleaned


class CustomerBase(BaseModel):
    full_name: str
    phone_number: str

    @field_validator("full_name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        return _clean_name(value)

    @field_validator("phone_number")
    @classmethod
    def _validate_phone(cls, value: str) -> str:
        return _clean_phone(value)


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def _validate_name(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else _clean_name(value)

    @field_validator("phone_number")
    @classmethod
    def _validate_phone(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else _clean_phone(value)


class CustomerOut(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class CustomerDetail(CustomerOut):
    last_appointment_date: Optional[datetime] = None
