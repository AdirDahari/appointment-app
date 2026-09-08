from datetime import time
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Business hours per weekday, keyed by datetime.weekday(): Monday=0 ... Sunday=6.
# Saturday (5) is deliberately absent — a fully closed day with no window at all.
BUSINESS_HOURS = {
    6: (time(8, 0), time(19, 0)),  # ראשון
    0: (time(8, 0), time(19, 0)),  # שני
    1: (time(8, 0), time(19, 0)),  # שלישי
    2: (time(8, 0), time(19, 0)),  # רביעי
    3: (time(8, 0), time(19, 0)),  # חמישי
    4: (time(8, 0), time(14, 0)),  # שישי
}


class Settings(BaseSettings):
    """App settings. Fields are added stage by stage as integrations are introduced."""

    app_name: str = "Appointment App"

    google_service_account_file: str
    google_calendar_id: str

    whatsapp_access_token: str
    whatsapp_phone_number_id: str
    whatsapp_template_name: str
    # Shared secret echoed back to Meta when it verifies the webhook URL.
    whatsapp_verify_token: str
    # The approved template is Hebrew; country code is used to turn a local
    # number like 0501234567 into the E.164 form WhatsApp expects.
    whatsapp_template_language: str = "he"
    whatsapp_country_code: str = "972"

    # How long before the appointment the reminder should go out, and how often
    # the background scheduler looks for reminders that came due.
    reminder_hours_before: int = 24
    scheduler_interval_minutes: int = 10

    @field_validator("google_service_account_file")
    @classmethod
    def _resolve_service_account_path(cls, value: str) -> str:
        path = Path(value)
        if not path.is_absolute():
            path = (BASE_DIR / path).resolve()
        return str(path)

    class Config:
        env_file = ".env"


settings = Settings()
