# גלי לק ג'יל — Appointment App

A small appointment-management app built for a single nail-studio owner. It
keeps the customer directory and the appointment book, mirrors every appointment
into Google Calendar, and sends WhatsApp reminders with **מגיעה / לא מגיעה**
quick-reply buttons that update the appointment status automatically.

The UI is Hebrew, RTL and mobile-first, and installable as a PWA.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite (PWA, no router library) |
| Backend | FastAPI (Python) |
| Database | SQLite (dev) via SQLAlchemy — swappable for Postgres |
| Calendar | Google Calendar API (service account) |
| Messaging | WhatsApp Cloud API (Meta), approved template with reply buttons |
| Scheduling | APScheduler background job |

Single user by design: the business owner. There is no customer login and no
permission levels.

## Features

- **Home** — greeting, today's appointment count, today's and upcoming appointments
- **Appointments** — list view grouped by day, plus a dependency-free monthly calendar view
- **Customers** — alphabetical directory with search, unique name/phone enforcement
- **Google Calendar sync** — create / reschedule / delete keeps the calendar in step
- **WhatsApp reminders** — sent automatically ahead of the appointment
- **Automatic status updates** — the customer's button tap sets `confirmed` / `cancelled`

## Reminder timing

A reminder is scheduled for `appointment_datetime - REMINDER_HOURS_BEFORE`
(default 24h). If that moment falls outside business hours it is rolled
**backwards** — never forwards, and never to an opening time:

| Business hours | |
|---|---|
| Sunday–Thursday | 08:00–19:00 |
| Friday | 08:00–14:00 |
| Saturday | closed |

- inside the window → unchanged
- after closing → that day's closing time
- before opening → the previous business day's closing time
- on Saturday → Friday 14:00

So a **Sunday 18:00** appointment computes to Saturday 18:00, which is closed,
and rolls back to **Friday 14:00** — going out ~52 hours ahead rather than 24.
That is intended behaviour, not a bug.

An appointment booked (or rescheduled) already inside the window is reminded
immediately instead of waiting for the next scheduler cycle. Cancelled
appointments and appointments in the past are never reminded.

## Getting started

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\python -m pip install -r requirements.txt   # Windows
cp .env.example .env                                     # then fill in the values
venv\Scripts\python -m uvicorn app.main:app --port 8000
```

API docs: <http://localhost:8000/docs>

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: <http://localhost:5173> — the Vite dev server proxies `/customers` and
`/appointments` to the backend on port 8000.

## Configuration

All backend configuration lives in `backend/.env` (gitignored). See
[`backend/.env.example`](backend/.env.example) for the full list.

| Variable | Purpose |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_FILE` | Path to the service-account JSON (relative paths resolve from the repo root) |
| `GOOGLE_CALENDAR_ID` | Calendar that appointments sync into |
| `WHATSAPP_ACCESS_TOKEN` | Meta access token — use a permanent System User token |
| `WHATSAPP_PHONE_NUMBER_ID` | ID of the WhatsApp sender number |
| `WHATSAPP_TEMPLATE_NAME` | Approved template name |
| `WHATSAPP_VERIFY_TOKEN` | Secret echoed back during Meta's webhook verification |
| `REMINDER_HOURS_BEFORE` | Lead time in hours (default `24`) |
| `SCHEDULER_INTERVAL_MINUTES` | How often the scheduler checks (default `10`) |

The Google service account must be granted **"Make changes to events"** on the
target calendar, otherwise every sync fails with `403`.

### WhatsApp template

The approved template uses **named** parameters — `{{customer_name}}`,
`{{appointment_date}}`, `{{appointment_time}}` — so the API request sends each
one with a `parameter_name`, not by position. Two quick-reply buttons:
**מגיעה** / **לא מגיעה**.

### Webhook

Point Meta's callback URL at `POST /webhook` on a public HTTPS address and
subscribe to the **`messages`** field. Note that while the Meta app is
unpublished, Meta delivers **no** production events — including taps from
admins and testers — so real replies only arrive once the app is published.

## API

| Method | Path | Notes |
|---|---|---|
| `GET/POST` | `/customers` | `?search=` filters by name |
| `GET/PATCH/DELETE` | `/customers/{id}` | detail includes computed `last_appointment_date` (past appointments only) |
| `GET/POST` | `/appointments` | `?reminder_sent=true` filters to reminded ones |
| `PATCH/DELETE` | `/appointments/{id}` | changing the date resets `reminder_sent_at` and `status` |
| `POST` | `/appointments/{id}/send-reminder` | manual send, for testing |
| `GET/POST` | `/webhook` | Meta verification + incoming replies |

## Project layout

```
backend/
  app/
    models/       SQLAlchemy models (customer, appointment)
    schemas/      Pydantic request/response models
    routers/      customers, appointments, webhook
    services/     calendar_service, whatsapp_service, reminder_scheduler
    config.py     settings + business hours
frontend/
  src/
    pages/        Home, Appointments, Customers, PrivacyPolicy
    components/   forms, rows, calendar view, icons
    api/          fetch wrappers
```

`/privacy-policy` renders a standalone page that is intentionally unlinked from
the app's navigation — it exists to satisfy Meta's privacy-policy requirement.

## Security notes

`backend/.env` and `secret/service-account.json` hold live credentials and are
gitignored. Never commit them. If a token is ever pushed by accident, revoke it
in Meta / Google Cloud rather than only deleting the commit.
