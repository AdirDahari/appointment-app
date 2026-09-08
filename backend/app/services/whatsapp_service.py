import logging
import re
from datetime import datetime

import requests

from app.config import settings

logger = logging.getLogger(__name__)

GRAPH_API_VERSION = "v21.0"
REQUEST_TIMEOUT_SECONDS = 20


class WhatsAppError(Exception):
    """Raised when the WhatsApp Cloud API rejects a send request."""


def normalize_phone_number(phone_number: str) -> str:
    """Turn a locally written number (050-123-4567) into E.164 digits (972501234567)."""
    digits = re.sub(r"\D", "", phone_number)
    country_code = settings.whatsapp_country_code

    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith(country_code):
        return digits
    if digits.startswith("0"):
        return country_code + digits[1:]
    return digits


def build_template_payload(to: str, parameters: dict[str, str]) -> dict:
    """Build the send-message body.

    The approved template uses NAMED variables ({{customer_name}} etc.), so every
    body parameter carries a `parameter_name`. This is not the older positional
    format where parameters were matched by their index ({{1}}, {{2}}, ...).
    """
    return {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "template",
        "template": {
            "name": settings.whatsapp_template_name,
            "language": {"code": settings.whatsapp_template_language},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "parameter_name": name, "text": value}
                        for name, value in parameters.items()
                    ],
                }
            ],
        },
    }


def _extract_api_error(response: requests.Response) -> str:
    try:
        error = response.json().get("error", {})
    except ValueError:
        return f"HTTP {response.status_code}: {response.text[:300]}"

    message = error.get("message") or "שגיאה לא ידועה"
    details = (error.get("error_data") or {}).get("details")
    return f"{message} ({details})" if details else message


def send_appointment_reminder(
    customer_name: str, phone_number: str, appointment_datetime: datetime
) -> str:
    """Send the approved reminder template. Returns the WhatsApp message_id.

    Raises WhatsAppError if the API rejects the request.
    """
    to = normalize_phone_number(phone_number)
    parameters = {
        "customer_name": customer_name,
        "appointment_date": appointment_datetime.strftime("%d/%m/%Y"),
        "appointment_time": appointment_datetime.strftime("%H:%M"),
    }

    url = f"https://graph.facebook.com/{GRAPH_API_VERSION}/{settings.whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {settings.whatsapp_access_token}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            url,
            headers=headers,
            json=build_template_payload(to, parameters),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as error:
        logger.exception("WhatsApp request failed")
        raise WhatsAppError(f"לא ניתן להתחבר ל-WhatsApp: {error}") from error

    if not response.ok:
        detail = _extract_api_error(response)
        logger.error("WhatsApp API error (%s): %s", response.status_code, detail)
        raise WhatsAppError(detail)

    messages = response.json().get("messages") or []
    if not messages:
        raise WhatsAppError("התגובה מ-WhatsApp לא כללה מזהה הודעה")

    message_id = messages[0].get("id")
    logger.info("Sent WhatsApp reminder to %s (message_id=%s)", to, message_id)
    return message_id
