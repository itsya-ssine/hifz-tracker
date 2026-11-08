from typing import Any

from app.core.db import Database, Statement

PUBLIC_COLUMNS = "id, login, full_name, email, role, preferred_lang, is_active, must_change_password"


def public_user(row: dict[str, Any]) -> dict[str, Any]:
    """Row -> API-safe dict (no password hash, proper booleans)."""
    return {
        "id": row["id"],
        "login": row["login"],
        "full_name": row["full_name"],
        "email": row["email"],
        "role": row["role"],
        "preferred_lang": row["preferred_lang"],
        "is_active": bool(row["is_active"]),
        "must_change_password": bool(row["must_change_password"]),
    }


async def get_by_id(db: Database, user_id: int) -> dict[str, Any] | None:
    return await db.fetch_one(f"SELECT {PUBLIC_COLUMNS} FROM users WHERE id = ?", [user_id])


async def get_for_login(db: Database, identifier: str) -> dict[str, Any] | None:
    """Find a user by login or email (case-insensitive). Includes ``password_hash``."""
    ident = identifier.strip().lower()
    return await db.fetch_one(
        f"SELECT {PUBLIC_COLUMNS}, password_hash FROM users"
        " WHERE lower(login) = ? OR lower(email) = ?",
        [ident, ident],
    )


async def get_password_hash(db: Database, user_id: int) -> str | None:
    return await db.fetch_value("SELECT password_hash FROM users WHERE id = ?", [user_id])


async def create(
    db: Database,
    *,
    login: str,
    full_name: str,
    password_hash: str,
    role: str,
    email: str | None = None,
    preferred_lang: str = "en",
    must_change_password: bool = False,
) -> int:
    result = await db.execute(
        "INSERT INTO users (login, full_name, email, password_hash, role, preferred_lang,"
        " must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            login.strip().lower(),
            full_name.strip(),
            email.strip().lower() if email else None,
            password_hash,
            role,
            preferred_lang,
            int(must_change_password),
        ],
    )
    return int(result.last_insert_rowid)


async def update_profile(
    db: Database, user_id: int, *, full_name: str | None, preferred_lang: str | None
) -> None:
    await db.execute(
        "UPDATE users SET full_name = COALESCE(?, full_name),"
        " preferred_lang = COALESCE(?, preferred_lang) WHERE id = ?",
        [full_name.strip() if full_name else None, preferred_lang, user_id],
    )


def set_password_statement(user_id: int, password_hash: str) -> Statement:
    return (
        "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?",
        [password_hash, user_id],
    )
