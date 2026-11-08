import pytest

from app.core.db import Database, normalize_url
from app.core.migrations import MIGRATIONS_DIR, run_migrations, split_statements


def test_split_statements_handles_comments_and_multiple_statements():
    sql = """
    -- a comment; with a semicolon
    CREATE TABLE a (id INTEGER);
    INSERT INTO a VALUES (1);  -- trailing
    INSERT INTO a VALUES (2);
    """
    statements = split_statements(sql)
    assert len(statements) == 3
    assert statements[0].endswith("CREATE TABLE a (id INTEGER);")


def test_split_statements_rejects_incomplete_sql():
    with pytest.raises(ValueError):
        split_statements("CREATE TABLE a (id INTEGER)")


def test_normalize_url():
    assert normalize_url("libsql://db-org.turso.io") == "https://db-org.turso.io"
    assert normalize_url("file:./local.db") == "file:./local.db"


async def test_migrations_create_schema_and_are_idempotent(db: Database):
    tables = {
        r["name"]
        for r in await db.fetch_all("SELECT name FROM sqlite_master WHERE type = 'table'")
    }
    assert {"users", "students", "sessions", "attendance_records", "audit_log"} <= tables
    assert "schema_migrations" in tables

    assert await run_migrations(db) == []  # second run applies nothing
    versions = [r["version"] for r in await db.fetch_all("SELECT version FROM schema_migrations")]
    assert versions == sorted(p.stem for p in MIGRATIONS_DIR.glob("*.sql"))


async def test_failed_migration_is_rolled_back(db: Database, tmp_path):
    (tmp_path / "0001_bad.sql").write_text(
        "CREATE TABLE ok_table (id INTEGER);\nINSERT INTO missing_table VALUES (1);\n"
    )
    with pytest.raises(Exception):
        await run_migrations(db, tmp_path)
    tables = {
        r["name"]
        for r in await db.fetch_all("SELECT name FROM sqlite_master WHERE type = 'table'")
    }
    assert "ok_table" not in tables
    versions = [r["version"] for r in await db.fetch_all("SELECT version FROM schema_migrations")]
    assert "0001_bad" not in versions
