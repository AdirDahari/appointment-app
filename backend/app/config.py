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

    # SQLite for development; point at Supabase/Postgres in production, e.g.
    # postgresql+psycopg://user:pass@host:5432/postgres?sslmode=require
    database_url: str = "sqlite:///./appointment_app.db"

    # Owner login (Stage 4). One account — the business owner.
    owner_username: str
    owner_password: str
    # Signs session tokens. Rotating it logs the owner out everywhere.
    secret_key: str
    # How long a session lasts without the app being opened. Every open
    # refreshes it, so in practice the owner logs in once.
    session_days: int = 365

    # Browser origins allowed to call the API when the frontend is hosted
    # elsewhere (e.g. Vercel). Comma-separated. Empty when served same-origin.
    frontend_origins: str = ""

    # Web Push (Stage 4) — VAPID keys, generated with
    # `python -m app.scripts.generate_vapid`. Empty disables push.
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:owner@example.com"

    # Google Calendar. Both empty -> sync is off (appointments still save,
    # the UI shows a warning), so the app can go live before these exist.
    google_service_account_file: str = ""
    google_calendar_id: str = ""

    # WhatsApp Cloud API. Empty token / phone id -> reminders are off.
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_template_name: str = "appointment_reminder"
    # Shared secret echoed back to Meta when it verifies the webhook URL.
    whatsapp_verify_token: str = ""
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
        if not value:
            return ""
        path = Path(value)
        if not path.is_absolute():
            path = (BASE_DIR / path).resolve()
        return str(path)

    @property
    def calendar_enabled(self) -> bool:
        return bool(self.google_calendar_id and self.google_service_account_file and Path(self.google_service_account_file).is_file())

    @property
    def whatsapp_enabled(self) -> bool:
        return bool(self.whatsapp_access_token and self.whatsapp_phone_number_id and self.whatsapp_template_name)

    @property
    def frontend_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    @property
    def push_enabled(self) -> bool:
        return bool(self.vapid_public_key and self.vapid_private_key)

    class Config:
        env_file = ".env"


settings = Settings()
