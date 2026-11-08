"""Fill the database with demo data: 1 admin, 20 students and 10 weekly sessions.

Usage (from backend/):  python -m scripts.seed_demo [--yes]

Demo credentials:
    admin     / Admin1234!
    student01 ... student20 / Student1234!
NEVER run this against a production database.
"""

import argparse
import asyncio
import random
from datetime import date, timedelta

from app.core.config import get_settings
from app.core.db import Database
from app.core.migrations import run_migrations
from app.core.security import hash_password
from app.models import users
from app.services import progress

ADMIN_PASSWORD = "Admin1234!"
STUDENT_PASSWORD = "Student1234!"

NAMES = [
    "Youssef El Amrani", "Fatima Zahra Benali", "Omar Idrissi", "Khadija Alaoui",
    "Hamza Tazi", "Meryem Bennani", "Anas Chraibi", "Salma Lahlou",
    "Ayoub Berrada", "Imane Fassi", "يوسف العمراني", "فاطمة الزهراء بنعلي",
    "عمر الإدريسي", "خديجة العلوي", "حمزة التازي", "مريم بناني",
    "أنس الشرايبي", "سلمى لحلو", "أيوب برادة", "إيمان الفاسي",
]
STATUSES = ["PASSED", "NOT_PASSED", "ABSENT", "ABSENT_EXCUSED"]
WEIGHTS = [60, 15, 10, 15]
EXCUSES = ["Sick", "Family emergency", "Exam at school", "Travel"]
NOTES = ["Very good recitation", "Needs more revision of tajweed", "Hesitated in a few verses"]


async def seed(db: Database, *, weeks: int = 10, rng_seed: int = 1337, today: date | None = None) -> dict:
    if await db.fetch_value("SELECT COUNT(*) FROM users WHERE login LIKE 'student%'"):
        raise RuntimeError("Demo data already present (users named 'student..' exist).")

    rng = random.Random(rng_seed)
    today = today or date.today()
    session_dates = [today - timedelta(weeks=weeks - i) for i in range(weeks)]

    admin_hash = hash_password(ADMIN_PASSWORD)
    student_hash = hash_password(STUDENT_PASSWORD)  # one hash shared by all demo students (fast)

    admin_id = None
    if not await users.get_for_login(db, "admin"):
        admin_id = await users.create(
            db, login="admin", full_name="Club Admin", email="admin@example.com",
            password_hash=admin_hash, role="ADMIN",
        )

    session_ids = []
    for d in session_dates:
        result = await db.execute(
            "INSERT INTO sessions (session_date, title, created_by) VALUES (?, ?, ?)",
            [d.isoformat(), "Weekly session", admin_id],
        )
        session_ids.append(int(result.last_insert_rowid))

    statements = []
    for n, name in enumerate(NAMES, start=1):
        login = f"student{n:02d}"
        user_id = await users.create(
            db, login=login, full_name=name, email=f"{login}@example.com",
            password_hash=student_hash, role="STUDENT",
            preferred_lang="ar" if n % 2 == 0 else "en",
        )
        # Student 20 starts at the very end so the "completed the Quran" state is visible.
        start_index = 478 if n == len(NAMES) else rng.randint(1, 300)
        result = await db.execute(
            "INSERT INTO students (user_id, start_index, current_index, joined_at) VALUES (?, ?, ?, ?)",
            [user_id, start_index, start_index, session_dates[0].isoformat()],
        )
        student_id = int(result.last_insert_rowid)

        current = start_index
        for session_id in session_ids:
            if progress.is_completed(current):
                break
            status = "PASSED" if n == len(NAMES) else rng.choices(STATUSES, WEIGHTS)[0]
            excuse = rng.choice(EXCUSES) if status == "ABSENT_EXCUSED" else None
            note = rng.choice(NOTES) if status in ("PASSED", "NOT_PASSED") and rng.random() < 0.3 else None
            statements.append((
                "INSERT INTO attendance_records"
                " (session_id, student_id, status, part_index, excuse_note, admin_note, marked_by)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                [session_id, student_id, status, current, excuse, note, admin_id],
            ))
            if status == "PASSED":
                current = progress.advance(current)

    statements.append(progress.recompute_all_statement())
    await db.batch(statements)
    return {"students": len(NAMES), "sessions": weeks, "records": len(statements) - 1}


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo data")
    parser.add_argument("--yes", action="store_true", help="Do not ask for confirmation")
    args = parser.parse_args()

    settings = get_settings()
    if not args.yes:
        answer = input(f"Seed demo data into {settings.turso_database_url} ? [y/N] ")
        if answer.strip().lower() != "y":
            print("Aborted.")
            return

    db = Database.connect(settings.turso_database_url, settings.turso_auth_token)
    try:
        await run_migrations(db)
        summary = await seed(db)
    finally:
        await db.close()
    print(f"Seeded {summary['students']} students, {summary['sessions']} sessions, "
          f"{summary['records']} attendance records.")
    print(f"Logins: admin / {ADMIN_PASSWORD}   student01..student20 / {STUDENT_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
