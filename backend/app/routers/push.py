import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.push_subscription import PushSubscription
from app.services import push_service
from app.services.auth_service import require_owner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/push", tags=["push"], dependencies=[Depends(require_owner)])


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class SubscriptionIn(BaseModel):
    """The browser's PushSubscription.toJSON()."""

    endpoint: str
    keys: SubscriptionKeys


class UnsubscribeIn(BaseModel):
    endpoint: str


@router.get("/config")
def push_config():
    return {"enabled": settings.push_enabled, "public_key": settings.vapid_public_key or None}


@router.post("/subscribe", status_code=201)
def subscribe(payload: SubscriptionIn, db: Session = Depends(get_db)):
    if not settings.push_enabled:
        raise HTTPException(status_code=503, detail="התראות אינן מוגדרות בשרת")

    existing = db.query(PushSubscription).filter(PushSubscription.endpoint == payload.endpoint).first()
    if existing:
        existing.p256dh = payload.keys.p256dh
        existing.auth = payload.keys.auth
    else:
        db.add(PushSubscription(endpoint=payload.endpoint, p256dh=payload.keys.p256dh, auth=payload.keys.auth))
    db.commit()
    return {"status": "subscribed"}


@router.post("/unsubscribe")
def unsubscribe(payload: UnsubscribeIn, db: Session = Depends(get_db)):
    db.query(PushSubscription).filter(PushSubscription.endpoint == payload.endpoint).delete()
    db.commit()
    return {"status": "unsubscribed"}


@router.post("/test")
def send_test(db: Session = Depends(get_db)):
    """Lets the owner confirm notifications reach this device."""
    sent = push_service.send_to_all(db, title="ההתראות פועלות", body="כך תיראה הודעה כשלקוחה מגיבה לתזכורת")
    if sent == 0:
        raise HTTPException(status_code=404, detail="לא נמצא מכשיר רשום להתראות")
    return {"sent": sent}
