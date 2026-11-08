import pytest

from app.core.db import Database
from app.services import progress as p


# --- pure logic -------------------------------------------------------------


@pytest.mark.parametrize(
    ("hizb", "part", "index"),
    [(1, 1, 1), (1, 8, 8), (2, 1, 9), (12, 5, 93), (60, 1, 473), (60, 8, 480)],
)
def test_position_index_round_trip(hizb, part, index):
    assert p.position_to_index(hizb, part) == index
    assert p.index_to_position(index) == p.Position(hizb, part)


@pytest.mark.parametrize("hizb,part", [(0, 1), (61, 1), (1, 0), (1, 9), (-1, 3)])
def test_position_to_index_rejects_invalid_input(hizb, part):
    with pytest.raises(ValueError):
        p.position_to_index(hizb, part)


@pytest.mark.parametrize("index", [0, -5, 481, 1000])
def test_index_to_position_rejects_invalid_input(index):
    with pytest.raises(ValueError):
        p.index_to_position(index)


def test_every_index_round_trips():
    for index in range(1, p.TOTAL_PARTS + 1):
        pos = p.index_to_position(index)
        assert p.position_to_index(pos.hizb, pos.part) == index


def test_advance_within_hizb():
    assert p.index_to_position(p.advance(p.position_to_index(3, 4))) == p.Position(3, 5)


def test_advance_rolls_over_to_next_hizb():
    assert p.index_to_position(p.advance(p.position_to_index(3, 8))) == p.Position(4, 1)


def test_advance_past_last_part_completes_the_quran():
    last = p.position_to_index(60, 8)
    assert not p.is_completed(last)
    assert p.advance(last) == p.COMPLETED_INDEX
    assert p.is_completed(p.advance(last))
    assert p.current_position(p.COMPLETED_INDEX) is None


def test_advance_is_capped_at_completed():
    assert p.advance(p.COMPLETED_INDEX) == p.COMPLETED_INDEX
    assert p.advance(470, steps=100) == p.COMPLETED_INDEX


def test_advance_rejects_bad_input():
    with pytest.raises(ValueError):
        p.advance(10, steps=-1)
    with pytest.raises(ValueError):
        p.advance(0)


def test_progress_numbers():
    assert p.completed_parts(1) == 0
    assert p.progress_percent(1) == 0.0
    assert p.completed_parts(241) == 240
    assert p.progress_percent(241) == 50.0
    assert p.completed_parts(p.COMPLETED_INDEX) == 480
    assert p.progress_percent(p.COMPLETED_INDEX) == 100.0
    assert p.parts_gained(start_index=100, current_index=107) == 7
    assert p.parts_gained(start_index=100, current_index=90) == 0


# --- database recompute -----------------------------------------------------


async def _make_student(db: Database, login: str, start_index: int = 1) -> int:
    result = await db.execute(
        "INSERT INTO users (login, full_name, password_hash, role) VALUES (?, ?, 'x', 'STUDENT')",
        [login, login],
    )
    user_id = result.last_insert_rowid
    result = await db.execute(
        "INSERT INTO students (user_id, start_index, current_index) VALUES (?, ?, ?)",
        [user_id, start_index, start_index],
    )
    return int(result.last_insert_rowid)


async def _make_session(db: Database, date: str) -> int:
    result = await db.execute("INSERT INTO sessions (session_date) VALUES (?)", [date])
    return int(result.last_insert_rowid)


async def _mark(db: Database, session_id: int, student_id: int, status: str, part_index: int = 1):
    result = await db.execute(
        "INSERT INTO attendance_records (session_id, student_id, status, part_index)"
        " VALUES (?, ?, ?, ?)",
        [session_id, student_id, status, part_index],
    )
    return int(result.last_insert_rowid)


async def test_only_passed_sessions_advance_the_student(db: Database):
    student = await _make_student(db, "alice", start_index=1)
    for i, status in enumerate(["PASSED", "NOT_PASSED", "ABSENT", "ABSENT_EXCUSED", "PASSED"]):
        session = await _make_session(db, f"2026-01-{i + 1:02d}")
        await _mark(db, session, student, status)

    assert await p.recompute_student_progress(db, student) == 3  # 1 + 2 PASSED


async def test_progress_rolls_over_hizb_boundary(db: Database):
    student = await _make_student(db, "bob", start_index=p.position_to_index(1, 8))
    session = await _make_session(db, "2026-01-01")
    await _mark(db, session, student, "PASSED", part_index=8)

    index = await p.recompute_student_progress(db, student)
    assert p.index_to_position(index) == p.Position(2, 1)


async def test_completion_after_last_part_and_status(db: Database):
    student = await _make_student(db, "carol", start_index=p.TOTAL_PARTS)
    session = await _make_session(db, "2026-01-01")
    await _mark(db, session, student, "PASSED", part_index=p.TOTAL_PARTS)

    assert await p.recompute_student_progress(db, student) == p.COMPLETED_INDEX
    row = await db.fetch_one("SELECT status FROM students WHERE id = ?", [student])
    assert row["status"] == "COMPLETED"


async def test_correcting_a_record_recomputes_position_and_reopens_completed(db: Database):
    student = await _make_student(db, "dave", start_index=p.TOTAL_PARTS)
    session = await _make_session(db, "2026-01-01")
    record = await _mark(db, session, student, "PASSED", part_index=p.TOTAL_PARTS)
    await p.recompute_student_progress(db, student)

    # Admin corrects the mistake: the student did not actually pass.
    await db.batch(
        [
            ("UPDATE attendance_records SET status = 'NOT_PASSED' WHERE id = ?", [record]),
            p.recompute_statement(student),
        ]
    )
    row = await db.fetch_one("SELECT current_index, status FROM students WHERE id = ?", [student])
    assert row == {"current_index": p.TOTAL_PARTS, "status": "ACTIVE"}

    # Deleting the record keeps things consistent too.
    await db.batch([("DELETE FROM attendance_records WHERE id = ?", [record]), p.recompute_statement(student)])
    assert await db.fetch_value("SELECT current_index FROM students WHERE id = ?", [student]) == p.TOTAL_PARTS


async def test_recompute_keeps_paused_status(db: Database):
    student = await _make_student(db, "erin")
    await db.execute("UPDATE students SET status = 'PAUSED' WHERE id = ?", [student])
    session = await _make_session(db, "2026-01-01")
    await _mark(db, session, student, "PASSED")

    assert await p.recompute_student_progress(db, student) == 2
    assert await db.fetch_value("SELECT status FROM students WHERE id = ?", [student]) == "PAUSED"


async def test_recompute_all_only_touches_derived_values(db: Database):
    a = await _make_student(db, "a1", start_index=10)
    b = await _make_student(db, "b1", start_index=20)
    s1 = await _make_session(db, "2026-01-01")
    s2 = await _make_session(db, "2026-01-08")
    await _mark(db, s1, a, "PASSED")
    await _mark(db, s2, a, "PASSED")
    await _mark(db, s1, b, "ABSENT")

    await db.batch([p.recompute_all_statement()])
    assert await db.fetch_value("SELECT current_index FROM students WHERE id = ?", [a]) == 12
    assert await db.fetch_value("SELECT current_index FROM students WHERE id = ?", [b]) == 20


async def test_recompute_unknown_student_raises(db: Database):
    with pytest.raises(LookupError):
        await p.recompute_student_progress(db, 999)
