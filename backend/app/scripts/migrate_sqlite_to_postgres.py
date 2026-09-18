r"""One-off copy of the local SQLite data into the Postgres pointed at by DATABASE_URL.

    venv\Scripts\python -m app.scripts.migrate_sqlite_to_postgres [path/to/appointment_app.db]

Creates the tables in Postgres if missing, refuses to run if they already hold
rows (so it can't double-insert), copies every table in dependency order with
the original ids, then resets the id sequences.
"""
import sys
from pathlib import Path

from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base
from app.models import owner_preferences, push_subscription  # noqa: F401 — register tables
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.owner_preferences import OwnerPreferences
from app.models.push_subscription import PushSubscription

# Parents before children so foreign keys resolve.
TABLES = [Customer, Appointment, PushSubscription, OwnerPreferences]


def main() -> int:
    if settings.database_url.startswith("sqlite"):
        print("DATABASE_URL still points at SQLite — set it to the Postgres URL first.")
        return 1

    sqlite_path = Path(sys.argv[1] if len(sys.argv) > 1 else "appointment_app.db")
    if not sqlite_path.is_file():
        print(f"SQLite file not found: {sqlite_path}")
        return 1

    source = create_engine(f"sqlite:///{sqlite_path}")
    target = create_engine(settings.database_url, pool_pre_ping=True)
    Base.metadata.create_all(bind=target)

    with Session(source) as src, Session(target) as dst:
        for model in TABLES:
            if dst.scalar(select(func.count()).select_from(model)) > 0:
                print(f"Target table '{model.__tablename__}' already has rows — aborting, nothing written.")
                return 1

        for model in TABLES:
            columns = [c.name for c in model.__table__.columns]
            rows = src.execute(select(model.__table__)).mappings().all()
            if rows:
                dst.execute(model.__table__.insert(), [dict(r) for r in rows])
            print(f"{model.__tablename__}: {len(rows)} rows copied ({', '.join(columns)})")

        # Ids were copied verbatim; move each serial sequence past them.
        for model in TABLES:
            table = model.__tablename__
            dst.execute(
                text(
                    f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM {table}), 0) + 1, false)"
                )
            )
        dst.commit()

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
