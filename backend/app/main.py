import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, engine
from app.routers import appointments, customers, webhook
from app.services import reminder_scheduler

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
    scheduler.start()
    logger.info(
        "Reminder scheduler started (every %s min, %s hours before appointment)",
        settings.scheduler_interval_minutes,
        settings.reminder_hours_before,
    )
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        logger.info("Reminder scheduler stopped")


app = FastAPI(title="Appointment App API", lifespan=lifespan)

app.include_router(customers.router)
app.include_router(appointments.router)
app.include_router(webhook.router)


@app.get("/health")
def health():
    return {"status": "ok"}
