"""Small helpers shared by API tests."""

import asyncio
from typing import Any

from app.core.db import Database
from app.core.security import hash_password


def login(client, who: str, password: str = "password123"):
    return client.post("/api/v1/auth/login", json={"login": who, "password": password})


def logout(client) -> None:
    client.post("/api/v1/auth/logout")


def sql(db_url: str, statement: str, args: list[Any] | None = None) -> list[dict[str, Any]]:
    """Run a statement against the test database from sync test code."""

    async def run():
        database = Database.connect(db_url)
        try:
            return await database.fetch_all(statement, args)
        finally:
            await database.close()

    return asyncio.run(run())


def add_student_direct(db_url: str, login_name: str, *, start_index: int = 1, password: str = "password123",
                       full_name: str | None = None, joined_at: str = "2026-01-01") -> int:
    """Insert a user + student row directly; returns the student id."""

    async def run() -> int:
        database = Database.connect(db_url)
        try:
            user = await database.execute(
                "INSERT INTO users (login, full_name, password_hash, role) VALUES (?, ?, ?, 'STUDENT')",
                [login_name, full_name or login_name.title(), hash_password(password)],
            )
            student = await database.execute(
                "INSERT INTO students (user_id, start_index, current_index, joined_at) VALUES (?, ?, ?, ?)",
                [user.last_insert_rowid, start_index, start_index, joined_at],
            )
            return int(student.last_insert_rowid)
        finally:
            await database.close()

    return asyncio.run(run())


def add_session_direct(db_url: str, session_date: str, title: str | None = None) -> int:
    async def run() -> int:
        database = Database.connect(db_url)
        try:
            result = await database.execute(
                "INSERT INTO sessions (session_date, title) VALUES (?, ?)", [session_date, title]
            )
            return int(result.last_insert_rowid)
        finally:
            await database.close()

    return asyncio.run(run())
