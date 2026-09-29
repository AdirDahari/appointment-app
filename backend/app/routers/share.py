"""Public "add to calendar" page the owner shares with a customer over WhatsApp.

Reached only through an appointment's unguessable share_token; no login. It shows
the appointment's current time (so a rescheduled appointment's link stays right)
and offers Google Calendar or an .ics file (Apple Calendar and everything else).
"""

from datetime import datetime, timezone
from html import escape
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.appointment import Appointment, AppointmentStatus, end_datetime_of

router = APIRouter(prefix="/c", tags=["share"], include_in_schema=False)

# Appointment times are stored as naive Israel local time.
LOCAL_TZ = ZoneInfo("Asia/Jerusalem")

HEBREW_WEEKDAYS = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"]  # datetime.weekday()
HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"]


def _get_by_token(token: str, db: Session) -> Appointment | None:
    return db.query(Appointment).filter(Appointment.share_token == token).first()


def _event_title(appointment: Appointment) -> str:
    if appointment.appointment_type:
        return f"{appointment.appointment_type} אצל {settings.business_name}"
    return f"תור אצל {settings.business_name}"


def _hebrew_date(value: datetime) -> str:
    return f"יום {HEBREW_WEEKDAYS[value.weekday()]}, {value.day} ב{HEBREW_MONTHS[value.month - 1]}"


def _google_calendar_url(appointment: Appointment) -> str:
    start = appointment.appointment_datetime
    end = end_datetime_of(appointment)
    params = {
        "action": "TEMPLATE",
        "text": _event_title(appointment),
        "dates": f"{start:%Y%m%dT%H%M%S}/{end:%Y%m%dT%H%M%S}",
        "ctz": "Asia/Jerusalem",
    }
    if settings.business_address:
        params["location"] = settings.business_address
    return "https://calendar.google.com/calendar/render?" + urlencode(params)


def _ics_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _ics_utc(value: datetime) -> str:
    return value.replace(tzinfo=LOCAL_TZ).astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _ics(appointment: Appointment) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//appointment-app//share//HE",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        # Same UID on every download: re-adding after a reschedule updates the
        # existing event instead of duplicating it (where the calendar supports it).
        f"UID:appointment-{appointment.share_token}@appointment-app",
        f"DTSTAMP:{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}",
        f"DTSTART:{_ics_utc(appointment.appointment_datetime)}",
        f"DTEND:{_ics_utc(end_datetime_of(appointment))}",
        f"SUMMARY:{_ics_text(_event_title(appointment))}",
    ]
    if settings.business_address:
        lines.append(f"LOCATION:{_ics_text(settings.business_address)}")
    lines += [
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        f"DESCRIPTION:{_ics_text(_event_title(appointment))}",
        "TRIGGER:-PT2H",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return "\r\n".join(lines) + "\r\n"


PAGE_STYLE = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 24px 16px;
  font: 400 16px/1.5 'Rubik', system-ui, 'Segoe UI', Arial, sans-serif; color: #1b1614;
  background: linear-gradient(180deg, #f9f0ed 0%, #f2e2dd 100%);
}
.card {
  width: 100%; max-width: 400px; background: #fff; border-radius: 22px; padding: 28px 22px;
  box-shadow: 0 12px 30px rgba(60, 38, 32, 0.08); text-align: center;
}
.logo { width: 72px; height: 72px; border-radius: 50%; }
h1 { font-size: 20px; font-weight: 600; margin: 12px 0 4px; }
.sub { color: #6f625d; font-size: 14px; margin: 0 0 20px; }
.details { background: #fbf3f0; border-radius: 16px; padding: 14px 16px; margin-bottom: 20px; text-align: right; }
.details div { padding: 4px 0; }
.label { color: #6f625d; font-size: 13px; display: block; }
.value { font-weight: 500; }
.btn {
  display: flex; align-items: center; justify-content: center; min-height: 50px; border-radius: 999px;
  font-size: 15px; font-weight: 600; text-decoration: none; margin-top: 10px;
}
.btn-primary { background: #e7b5ac; color: #1b1614; }
.btn-ghost { border: 1px solid #efe1dc; color: #1b1614; }
.note { color: #6f625d; font-size: 14px; }
"""


def _page(request: Request, title: str, body: str, status_code: int = 200) -> HTMLResponse:
    # WhatsApp builds the link's preview card from these og: tags; the image
    # URL must be absolute.
    logo_url = f"{str(request.base_url).rstrip('/')}/logo.png"
    html = f"""<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta property="og:title" content="{escape(title)}">
<meta property="og:description" content="לחצי כאן להוספת התור ליומן">
<meta property="og:image" content="{escape(logo_url)}">
<title>{escape(title)}</title>
<link rel="icon" href="/favicon-64.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600&display=swap" rel="stylesheet">
<style>{PAGE_STYLE}</style>
</head>
<body><main class="card">
<img class="logo" src="/logo.png" alt="{escape(settings.business_name)}" width="72" height="72">
{body}
</main></body>
</html>"""
    return HTMLResponse(html, status_code=status_code, headers={"Cache-Control": "no-store"})


@router.get("/{token}", response_class=HTMLResponse)
def share_page(token: str, request: Request, db: Session = Depends(get_db)):
    appointment = _get_by_token(token, db)
    if not appointment:
        return _page(
            request,
            settings.business_name,
            '<h1>התור לא נמצא</h1><p class="note">ייתכן שהתור בוטל. לפרטים אפשר לפנות ישירות לעסק.</p>',
            status_code=404,
        )

    start = appointment.appointment_datetime
    end = end_datetime_of(appointment)
    rows = [("מתי", _hebrew_date(start)), ("שעה", f"{start:%H:%M}–{end:%H:%M}")]
    if appointment.appointment_type:
        rows.append(("טיפול", appointment.appointment_type))
    if settings.business_address:
        rows.append(("איפה", settings.business_address))
    details = "".join(
        f'<div><span class="label">{escape(label)}</span><span class="value">{escape(value)}</span></div>'
        for label, value in rows
    )

    if appointment.status == AppointmentStatus.cancelled:
        actions = '<p class="note">התור הזה בוטל.</p>'
    elif end < datetime.now():
        actions = '<p class="note">התור הזה כבר עבר. תודה שבאת!</p>'
    else:
        actions = (
            f'<a class="btn btn-primary" href="{escape(_google_calendar_url(appointment))}" target="_blank" rel="noopener">'
            "הוספה ליומן Google</a>"
            f'<a class="btn btn-ghost" href="/c/{escape(token)}/event.ics">הוספה ליומן אחר (אייפון)</a>'
        )

    body = (
        f"<h1>{escape(_event_title(appointment))}</h1>"
        f'<p class="sub">היי {escape(appointment.customer.full_name.split()[0])}, אלה פרטי התור שלך</p>'
        f'<div class="details">{details}</div>'
        f"{actions}"
    )
    return _page(request, _event_title(appointment), body)


@router.get("/{token}/event.ics")
def share_ics(token: str, db: Session = Depends(get_db)):
    appointment = _get_by_token(token, db)
    if not appointment or appointment.status == AppointmentStatus.cancelled:
        raise HTTPException(status_code=404, detail="התור לא נמצא")
    return Response(
        _ics(appointment),
        media_type="text/calendar; charset=utf-8",
        # inline, not attachment: iOS Safari then offers "Add to Calendar"
        # instead of saving a file.
        headers={"Content-Disposition": 'inline; filename="appointment.ics"', "Cache-Control": "no-store"},
    )
