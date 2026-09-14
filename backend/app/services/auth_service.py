"""Owner login: one account, a signed bearer token, a sliding one-year session.

The token is `<base64url(json payload)>.<hmac-sha256>` signed with SECRET_KEY.
No database row is needed — the signature is the proof. Rotating SECRET_KEY
invalidates every token at once.
"""
import base64
import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

# Brute-force guard: after this many failed logins from one IP, that IP has to
# wait. In-memory — good enough for a single-owner app on one server.
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_SECONDS = 60
_failed_logins: dict[str, list[float]] = {}


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _b64decode(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + padding)


def _sign(payload_b64: str) -> str:
    digest = hmac.new(settings.secret_key.encode(), payload_b64.encode(), hashlib.sha256).digest()
    return _b64encode(digest)


def create_token(username: str) -> tuple[str, datetime]:
    expires_at = datetime.now() + timedelta(days=settings.session_days)
    payload = {"sub": username, "exp": int(expires_at.timestamp())}
    payload_b64 = _b64encode(json.dumps(payload, separators=(",", ":")).encode())
    return f"{payload_b64}.{_sign(payload_b64)}", expires_at


def verify_token(token: str) -> Optional[str]:
    """Returns the username for a valid, unexpired token; None otherwise."""
    try:
        payload_b64, signature = token.split(".", 1)
    except ValueError:
        return None
    if not hmac.compare_digest(signature, _sign(payload_b64)):
        return None
    try:
        payload = json.loads(_b64decode(payload_b64))
    except (ValueError, json.JSONDecodeError):
        return None
    if payload.get("exp", 0) < time.time():
        return None
    username = payload.get("sub")
    if username != settings.owner_username:
        return None
    return username


def check_credentials(username: str, password: str) -> bool:
    # compare_digest on both so timing doesn't leak which half was wrong.
    user_ok = hmac.compare_digest(username.encode(), settings.owner_username.encode())
    pass_ok = hmac.compare_digest(password.encode(), settings.owner_password.encode())
    return user_ok and pass_ok


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def is_locked_out(request: Request) -> bool:
    ip = _client_ip(request)
    now = time.time()
    recent = [t for t in _failed_logins.get(ip, []) if now - t < LOCKOUT_SECONDS]
    _failed_logins[ip] = recent
    return len(recent) >= MAX_FAILED_ATTEMPTS


def record_failed_login(request: Request) -> None:
    ip = _client_ip(request)
    _failed_logins.setdefault(ip, []).append(time.time())
    logger.warning("Failed login from %s", ip)


def clear_failed_logins(request: Request) -> None:
    _failed_logins.pop(_client_ip(request), None)


def require_owner(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> str:
    """FastAPI dependency: the request must carry a valid owner token."""
    if credentials is None or verify_token(credentials.credentials) is None:
        raise HTTPException(status_code=401, detail="נדרשת התחברות")
    return settings.owner_username
