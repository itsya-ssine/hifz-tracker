"""Apply pending database migrations.  Usage (from backend/):  python -m scripts.migrate"""

import asyncio

from app.core.config import get_settings
from app.core.db import Database
from app.core.migrations import run_migrations


async def main() -> None:
    settings = get_settings()
    db = Database.connect(settings.turso_database_url, settings.turso_auth_token)
    try:
        applied = await run_migrations(db)
    finally:
        await db.close()
    if applied:
        print("Applied migrations:")
        for version in applied:
            print(f"  - {version}")
    else:
        print("Database is up to date.")


if __name__ == "__main__":
    asyncio.run(main())
