import os
from collections.abc import AsyncIterator

import pytest

from app.core.config import get_settings
from app.core.db import Database
from app.core.migrations import run_migrations

TEST_ENV = {
    "JWT_SECRET": "test-secret-test-secret-test-secret",
    "ACCESS_TOKEN_MINUTES": "15",
    "REFRESH_TOKEN_DAYS": "7",
    "COOKIE_SECURE": "false",
    "COOKIE_SAMESITE": "lax",
    "CORS_ORIGINS": "http://localhost:5173",
    "TURSO_AUTH_TOKEN": "",
}


@pytest.fixture
def db_url(tmp_path, monkeypatch) -> str:
    """Point the app settings at a fresh temporary SQLite file."""
    url = f"file:{tmp_path / 'test.db'}"
    for key, value in {**TEST_ENV, "TURSO_DATABASE_URL": url}.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    yield url
    get_settings.cache_clear()


@pytest.fixture
async def db(db_url) -> AsyncIterator[Database]:
    database = Database.connect(db_url)
    await run_migrations(database)
    yield database
    await database.close()


# --- API fixtures -------------------------------------------------------------

import asyncio  # noqa: E402

from fastapi import Depends  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.deps import require_admin, require_student  # noqa: E402
from app.models import users as users_model  # noqa: E402


@pytest.fixture
def make_user(db_url):
    """Create a user in the test database (works with or without a running app)."""

    def _make(login: str, password: str = "password123", role: str = "STUDENT", **kwargs) -> int:
        async def run() -> int:
            database = Database.connect(db_url)
            try:
                await run_migrations(database)
                return await users_model.create(
                    database,
                    login=login,
                    full_name=kwargs.pop("full_name", login.title()),
                    password_hash=hash_password(password),
                    role=role,
                    **kwargs,
                )
            finally:
                await database.close()

        return asyncio.run(run())

    return _make


@pytest.fixture
def client(db_url):
    from app.main import create_app

    asyncio.run(_migrate(db_url))
    app = create_app()

    # Tiny routes used only to exercise the role guards.
    @app.get("/_test/admin", dependencies=[Depends(require_admin)])
    def _admin_only() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/_test/student", dependencies=[Depends(require_student)])
    def _student_only() -> dict[str, bool]:
        return {"ok": True}

    with TestClient(app) as test_client:
        yield test_client


async def _migrate(url: str) -> None:
    database = Database.connect(url)
    try:
        await run_migrations(database)
    finally:
        await database.close()
