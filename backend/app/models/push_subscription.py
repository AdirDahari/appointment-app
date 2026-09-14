from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class PushSubscription(Base):
    """One installed device that asked for owner notifications.

    Mirrors the browser's PushSubscription JSON: the endpoint URL plus the two
    encryption keys. The owner may have the app on more than one device.
    """

    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    endpoint = Column(Text, nullable=False, unique=True)
    p256dh = Column(String, nullable=False)
    auth = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
