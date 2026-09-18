from sqlalchemy import Boolean, Column, Integer

from app.database import Base


class OwnerPreferences(Base):
    """The owner's notification switches. A single row (id=1), created on first read."""

    __tablename__ = "owner_preferences"

    id = Column(Integer, primary_key=True)
    # Push shortly before each appointment ("תזכורת: תור ל... בשעה ...").
    notify_upcoming = Column(Boolean, nullable=False, default=True)
    # Push when a customer taps מגיעה / לא מגיעה on the WhatsApp reminder.
    notify_status_change = Column(Boolean, nullable=False, default=True)


def get_preferences(db) -> "OwnerPreferences":
    prefs = db.get(OwnerPreferences, 1)
    if prefs is None:
        prefs = OwnerPreferences(id=1)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs
