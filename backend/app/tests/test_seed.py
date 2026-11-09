import pytest

from app.core.db import Database
from app.services import progress
from scripts.seed_demo import seed


async def test_seed_creates_consistent_demo_data(db: Database):
    summary = await seed(db)
    assert summary["students"] == 20 and summary["sessions"] == 10

    assert await db.fetch_value("SELECT COUNT(*) FROM sessions") == 11  # 10 past + 1 upcoming
    assert await db.fetch_value("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'") == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM students") == 20

    students = await db.fetch_all("SELECT * FROM students")
    for s in students:
        passed = await db.fetch_value(
            "SELECT COUNT(*) FROM attendance_records WHERE student_id = ? AND status = 'PASSED'",
            [s["id"]],
        )
        assert s["current_index"] == min(progress.COMPLETED_INDEX, s["start_index"] + passed)

        # part_index follows the chain of passes: it equals start + passes made before that record.
        records = await db.fetch_all(
            "SELECT ar.status, ar.part_index FROM attendance_records ar"
            " JOIN sessions se ON se.id = ar.session_id WHERE ar.student_id = ?"
            " ORDER BY se.session_date",
            [s["id"]],
        )
        expected = s["start_index"]
        for r in records:
            assert r["part_index"] == expected
            if r["status"] == "PASSED":
                expected += 1

    completed = await db.fetch_all("SELECT * FROM students WHERE status = 'COMPLETED'")
    assert len(completed) == 1 and completed[0]["current_index"] == progress.COMPLETED_INDEX


async def test_seed_refuses_to_run_twice(db: Database):
    await seed(db)
    with pytest.raises(RuntimeError):
        await seed(db)


async def test_seed_reuses_an_existing_admin(db: Database):
    from app.core.security import hash_password
    from app.models import users

    admin_id = await users.create(db, login="admin", full_name="Real Admin",
                                  password_hash=hash_password("my-own-password"), role="ADMIN")
    await seed(db)
    assert await db.fetch_value("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'") == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM attendance_records WHERE marked_by = ?", [admin_id]) > 0
