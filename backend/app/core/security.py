import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import Settings
from app.core.errors import AppError

TokenType = Literal["access", "refresh"]

_hasher = PasswordHasher()
# Used to keep login timing similar when the account does not exist.
DUMMY_HASH = _hasher.hash("dummy-password-for-timing")


def utc_now() -> datetime:
    return datetime.now(UTC)


def to_iso(value: datetime) -> str:
    """Fixed-width UTC format so string comparison in SQL is chronological."""
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user_id: int, role: str, settings: Settings) -> str:
    now = utc_now()
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: int, settings: Settings) -> tuple[str, str, datetime]:
    """Returns ``(token, jti, expires_at)``."""
    now = utc_now()
    jti = uuid.uuid4().hex
    expires_at = now + timedelta(days=settings.refresh_token_days)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "jti": jti,
        "type": "refresh",
        "iat": now,
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, jti, expires_at


def decode_token(token: str, expected_type: TokenType, settings: Settings) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise AppError(401, "TOKEN_EXPIRED", "Session expired") from None
    except jwt.InvalidTokenError:
        raise AppError(401, "TOKEN_INVALID", "Invalid token") from None
    if payload.get("type") != expected_type:
        raise AppError(401, "TOKEN_INVALID", "Invalid token")
    return payload
