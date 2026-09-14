from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class SessionOut(BaseModel):
    token: str
    expires_at: datetime
    username: str


@router.post("/login", response_model=SessionOut)
def login(payload: LoginRequest, request: Request):
    if auth_service.is_locked_out(request):
        raise HTTPException(status_code=429, detail="יותר מדי ניסיונות. נסי שוב בעוד דקה")

    if not auth_service.check_credentials(payload.username.strip(), payload.password):
        auth_service.record_failed_login(request)
        raise HTTPException(status_code=401, detail="שם משתמש או סיסמה שגויים")

    auth_service.clear_failed_logins(request)
    token, expires_at = auth_service.create_token(payload.username.strip())
    return SessionOut(token=token, expires_at=expires_at, username=payload.username.strip())


@router.get("/me", response_model=SessionOut)
def me(username: str = Depends(auth_service.require_owner)):
    """Validates the stored token and hands back a fresh one — this is what
    keeps the session sliding, so the owner never has to log in again while
    she keeps using the app."""
    token, expires_at = auth_service.create_token(username)
    return SessionOut(token=token, expires_at=expires_at, username=username)
