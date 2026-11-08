"""Create an admin account.

Usage (from backend/):
    python -m scripts.create_admin --login admin --name "Club Admin" --email admin@example.com
The password is asked interactively (or pass --password, e.g. in CI).
"""

import argparse
import asyncio
import getpass
import sys

from app.core.config import get_settings
from app.core.db import Database
from app.core.migrations import run_migrations
from app.core.security import hash_password
from app.models import users


def read_password(provided: str | None) -> str:
    if provided:
        return provided
    first = getpass.getpass("Password: ")
    if first != getpass.getpass("Confirm password: "):
        sys.exit("Passwords do not match.")
    return first


async def main() -> None:
    parser = argparse.ArgumentParser(description="Create an admin account")
    parser.add_argument("--login", required=True)
    parser.add_argument("--name", required=True, help="Full name")
    parser.add_argument("--email")
    parser.add_argument("--password")
    parser.add_argument("--lang", choices=["en", "ar"], default="en")
    parser.add_argument(
        "--must-change-password", action="store_true", help="Force a password change on first login"
    )
    args = parser.parse_args()

    password = read_password(args.password)
    if len(password) < 8:
        sys.exit("Password must be at least 8 characters.")

    settings = get_settings()
    db = Database.connect(settings.turso_database_url, settings.turso_auth_token)
    try:
        await run_migrations(db)  # no-op when already up to date
        existing = await users.get_for_login(db, args.login)
        if existing:
            sys.exit(f"A user with login '{args.login}' already exists.")
        user_id = await users.create(
            db,
            login=args.login,
            full_name=args.name,
            email=args.email,
            password_hash=hash_password(password),
            role="ADMIN",
            preferred_lang=args.lang,
            must_change_password=args.must_change_password,
        )
    finally:
        await db.close()
    print(f"Admin '{args.login}' created (id={user_id}).")


if __name__ == "__main__":
    asyncio.run(main())
