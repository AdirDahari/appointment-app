import logging
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from app.config import BASE_DIR, settings
from app.database import Base, engine
from app.models import owner_preferences, push_subscription  # noqa: F401 — registers the tables with Base
from app.routers import appointments, auth, customers, push, webhook
from app.services import owner_reminder, reminder_scheduler
from app.services.auth_service import require_owner

# uvicorn only configures its own loggers; without this the app's own INFO logs
# (WhatsApp message ids, calendar failures) never reach the console.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

Base.metadata.create_all(bind=engine)

# Dev-only additive migration: create_all() only creates missing tables, so a
# column added to an existing table needs to be added manually here.
inspector = inspect(engine)
if "appointments" in inspector.get_table_names():
    existing_columns = {col["name"] for col in inspector.get_columns("appointments")}
    if "google_event_id" not in existing_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE appointments ADD COLUMN google_event_id VARCHAR"))
    if "owner_notified_at" not in existing_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE appointments ADD COLUMN owner_notified_at DATETIME"))

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        reminder_scheduler.run_once,
        trigger="interval",
        minutes=settings.scheduler_interval_minutes,
        id="reminder-scheduler",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        owner_reminder.run_once,
        trigger="interval",
        minutes=1,
        id="owner-reminder",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info(
        "Reminder scheduler started (every %s min, %s hours before appointment)",
        settings.scheduler_interval_minutes,
        settings.reminder_hours_before,
    )
    if not settings.calendar_enabled:
        logger.warning("Google Calendar sync disabled — set GOOGLE_CALENDAR_ID and a valid GOOGLE_SERVICE_ACCOUNT_FILE")
    if not settings.whatsapp_enabled:
        logger.warning("WhatsApp reminders disabled — set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID")
    if not settings.whatsapp_verify_token:
        logger.warning("WHATSAPP_VERIFY_TOKEN is empty — Meta's webhook verification will fail until it is set")
    if not settings.push_enabled:
        logger.warning("Web Push disabled — VAPID keys missing (run `python -m app.scripts.generate_vapid`)")
    else:
        logger.info("Owner push reminders on: %s minutes before each appointment", settings.owner_reminder_minutes_before)
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        logger.info("Reminder scheduler stopped")


app = FastAPI(title="Appointment App API", lifespan=lifespan)

# Only needed when the frontend is served from another origin (e.g. Vercel).
if settings.frontend_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origin_list,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Public: login, Meta's webhook, health. Everything about customers and
# appointments requires the owner's token.
app.include_router(auth.router)
app.include_router(webhook.router)
app.include_router(customers.router, dependencies=[Depends(require_owner)])
app.include_router(appointments.router, dependencies=[Depends(require_owner)])
app.include_router(push.router)


@app.get("/health")
def health():
    return {"status": "ok"}


# Production, single-server layout: if the frontend has been built
# (`npm run build` -> frontend/dist), serve it from here so the app and the API
# share one origin — no CORS, and the PWA's service worker scope covers both.
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
API_PREFIXES = {"auth", "customers", "appointments", "push", "webhook", "health", "docs", "openapi.json", "redoc"}
if (FRONTEND_DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        # API paths never fall through to index.html (a wrong-method call
        # should look like an API 404, not a page). Real files (manifest,
        # icons, service worker) are served as-is; anything else is a
        # client-side route and gets index.html.
        if full_path.split("/", 1)[0] in API_PREFIXES:
            raise HTTPException(status_code=404, detail="Not found")
        candidate = (FRONTEND_DIST / full_path).resolve()
        if full_path and candidate.is_file() and FRONTEND_DIST.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")

    logger.info("Serving frontend from %s", FRONTEND_DIST)
