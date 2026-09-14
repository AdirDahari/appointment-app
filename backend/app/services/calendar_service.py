import logging
from datetime import datetime, timedelta
from typing import Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.config import settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar"]
TIME_ZONE = "Asia/Jerusalem"
EVENT_DURATION = timedelta(hours=1)


def _event_title(customer_full_name: str) -> str:
    return f"גלי לק ג'יל - {customer_full_name}"


def _event_body(customer_full_name: str, start: datetime) -> dict:
    end = start + EVENT_DURATION
    return {
        "summary": _event_title(customer_full_name),
        "start": {"dateTime": start.isoformat(), "timeZone": TIME_ZONE},
        "end": {"dateTime": end.isoformat(), "timeZone": TIME_ZONE},
    }


def _get_service():
    credentials = service_account.Credentials.from_service_account_file(
        settings.google_service_account_file, scopes=SCOPES
    )
    return build("calendar", "v3", credentials=credentials, cache_discovery=False)


def create_event(customer_full_name: str, start: datetime) -> Optional[str]:
    """Creates a calendar event. Returns the google_event_id, or None on failure."""
    if not settings.calendar_enabled:
        logger.warning("Google Calendar not configured — event for %s not created", customer_full_name)
        return None
    try:
        service = _get_service()
        created = (
            service.events()
            .insert(calendarId=settings.google_calendar_id, body=_event_body(customer_full_name, start))
            .execute()
        )
        return created.get("id")
    except Exception:
        logger.exception("Failed to create Google Calendar event")
        return None


def update_event(google_event_id: str, customer_full_name: str, start: datetime) -> bool:
    """Updates an existing calendar event's title/time. Returns whether it succeeded."""
    if not settings.calendar_enabled:
        logger.warning("Google Calendar not configured — event %s not updated", google_event_id)
        return False
    try:
        service = _get_service()
        service.events().update(
            calendarId=settings.google_calendar_id,
            eventId=google_event_id,
            body=_event_body(customer_full_name, start),
        ).execute()
        return True
    except Exception:
        logger.exception("Failed to update Google Calendar event")
        return False


def delete_event(google_event_id: str) -> bool:
    """Deletes a calendar event. Returns whether it succeeded (a 404 counts as success)."""
    if not settings.calendar_enabled:
        logger.warning("Google Calendar not configured — event %s not deleted", google_event_id)
        return False
    try:
        service = _get_service()
        service.events().delete(calendarId=settings.google_calendar_id, eventId=google_event_id).execute()
        return True
    except HttpError as error:
        if error.resp.status == 404:
            return True
        logger.exception("Failed to delete Google Calendar event")
        return False
    except Exception:
        logger.exception("Failed to delete Google Calendar event")
        return False
