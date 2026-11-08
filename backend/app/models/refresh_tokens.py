from datetime import datetime
from typing import Any

from app.core.db import Database, Statement
from app.core.security import to_iso, utc_now


def insert_statement(jti: str, user_id: int, expires_at: datetime) -> Statement:
    return (
        "INSERT INTO refresh_tokens (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
        [jti, user_id, to_iso(expires_at), to_iso(utc_now())],
    )


def revoke_statement(jti: str) -> Statement:
    return (
        "UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
        [to_iso(utc_now()), jti],
    )


def revoke_all_statement(user_id: int) -> Statement:
    return (
        "UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
        [to_iso(utc_now()), user_id],
    )


def purge_expired_statement(user_id: int) -> Statement:
    return (
        "DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < ?",
        [user_id, to_iso(utc_now())],
    )


async def get(db: Database, jti: str) -> dict[str, Any] | None:
    return await db.fetch_one("SELECT * FROM refresh_tokens WHERE id = ?", [jti])
