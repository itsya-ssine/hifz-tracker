"""Minimal SQL migration runner.

Migrations are ``NNNN_name.sql`` files in ``backend/migrations`` applied in
filename order. Each file runs in a single transaction together with the
bookkeeping insert, so a failing migration leaves the database untouched.
"""

import sqlite3
from pathlib import Path

from app.core.config import BACKEND_DIR
from app.core.db import Database

MIGRATIONS_DIR = BACKEND_DIR / "migrations"


def split_statements(sql: str) -> list[str]:
    """Split a SQL script into individual statements (handles triggers, strings, comments)."""
    statements: list[str] = []
    buffer = ""
    for line in sql.splitlines(keepends=True):
        buffer += line
        if sqlite3.complete_statement(buffer):
            statements.append(buffer.strip())
            buffer = ""
    leftover = "\n".join(
        l for l in buffer.splitlines() if l.strip() and not l.strip().startswith("--")
    )
    if leftover:
        raise ValueError(f"Incomplete SQL statement at end of migration: {leftover!r}")
    return statements


async def run_migrations(db: Database, directory: Path = MIGRATIONS_DIR) -> list[str]:
    """Apply pending migrations. Returns the list of versions applied."""
    await db.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations ("
        " version TEXT PRIMARY KEY,"
        " applied_at TEXT NOT NULL DEFAULT (datetime('now')))"
    )
    done = {row["version"] for row in await db.fetch_all("SELECT version FROM schema_migrations")}

    applied: list[str] = []
    for path in sorted(directory.glob("*.sql")):
        version = path.stem
        if version in done:
            continue
        statements: list = split_statements(path.read_text(encoding="utf-8"))
        statements.append(("INSERT INTO schema_migrations (version) VALUES (?)", [version]))
        await db.batch(statements)
        applied.append(version)
    return applied
