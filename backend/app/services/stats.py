"""Statistics, history and timeline for one student (used by /me and the admin API)."""

from datetime import UTC, datetime
from typing import Any

from app.core.db import Database
from app.services import progress


def _position(index: int) -> tuple[int, int]:
    pos = progress.index_to_position(min(max(index, 1), progress.TOTAL_PARTS))
    return pos.hizb, pos.part


def current_streak(statuses_newest_first: list[str]) -> int:
    """Consecutive PASSED sessions, most recent first.

    Excused absences are neutral (they neither extend nor break the streak);
    NOT_PASSED and unexcused ABSENT break it.
    """
    streak = 0
    for status in statuses_newest_first:
        if status == "PASSED":
            streak += 1
        elif status == "ABSENT_EXCUSED":
            continue
        else:
            break
    return streak


def attendance_rates(passed: int, not_passed: int, absent: int, excused: int) -> tuple[float | None, float | None]:
    total = passed + not_passed + absent + excused
    attended = passed + not_passed
    rate = round(attended / total, 4) if total else None
    countable = total - excused
    adjusted = round(attended / countable, 4) if countable else None
    return rate, adjusted


async def student_stats(db: Database, student_id: int) -> dict[str, Any]:
    rows = await db.fetch_all(
        "SELECT ar.status FROM attendance_records ar JOIN sessions se ON se.id = ar.session_id"
        " WHERE ar.student_id = ? ORDER BY se.session_date DESC",
        [student_id],
    )
    statuses = [r["status"] for r in rows]
    passed = statuses.count("PASSED")
    not_passed = statuses.count("NOT_PASSED")
    absent = statuses.count("ABSENT")
    excused = statuses.count("ABSENT_EXCUSED")
    rate, adjusted = attendance_rates(passed, not_passed, absent, excused)
    return {
        "total_sessions": len(statuses),
        "passed": passed,
        "not_passed": not_passed,
        "absent": absent,
        "absent_excused": excused,
        "attendance_rate": rate,
        "adjusted_attendance_rate": adjusted,
        "current_streak": current_streak(statuses),
    }


def progress_summary(student: dict[str, Any]) -> dict[str, Any]:
    current = student["current_index"]
    return {
        "completed_parts": progress.completed_parts(current),
        "total_parts": progress.TOTAL_PARTS,
        "percent": progress.progress_percent(current),
        "parts_gained": progress.parts_gained(student["start_index"], current),
    }


def position_summary(student: dict[str, Any]) -> dict[str, int] | None:
    pos = progress.current_position(student["current_index"])
    return {"hizb": pos.hizb, "part": pos.part} if pos else None


def _record(row: dict[str, Any]) -> dict[str, Any]:
    hizb, part = _position(row["part_index"])
    return {**row, "hizb": hizb, "part": part}


async def history(
    db: Database, student_id: int, *, page: int, page_size: int, status: str | None = None
) -> tuple[list[dict[str, Any]], int]:
    where, args = "ar.student_id = ?", [student_id]
    if status:
        where += " AND ar.status = ?"
        args.append(status)
    total = await db.fetch_value(f"SELECT COUNT(*) FROM attendance_records ar WHERE {where}", args)
    rows = await db.fetch_all(
        "SELECT ar.id, ar.session_id, se.session_date, se.title, ar.status, ar.part_index,"
        " ar.excuse_note, ar.admin_note"
        " FROM attendance_records ar JOIN sessions se ON se.id = ar.session_id"
        f" WHERE {where} ORDER BY se.session_date DESC LIMIT ? OFFSET ?",
        [*args, page_size, (page - 1) * page_size],
    )
    return [_record(r) for r in rows], int(total or 0)


async def timeline(db: Database, student: dict[str, Any]) -> dict[str, Any]:
    rows = await db.fetch_all(
        "SELECT se.session_date, ar.status FROM attendance_records ar"
        " JOIN sessions se ON se.id = ar.session_id WHERE ar.student_id = ?"
        " ORDER BY se.session_date ASC",
        [student["id"]],
    )
    index = student["start_index"]
    points: list[dict[str, Any]] = [
        {"session_date": student["joined_at"], "current_index": index, "status": None}
    ]
    for row in rows:
        if row["status"] == "PASSED":
            index = progress.advance(index)
        points.append(
            {"session_date": row["session_date"], "current_index": index, "status": row["status"]}
        )
    return {"start_index": student["start_index"], "points": points}


async def next_session(db: Database) -> dict[str, Any] | None:
    today = datetime.now(UTC).date().isoformat()
    return await db.fetch_one(
        "SELECT id, session_date, title FROM sessions"
        " WHERE session_date >= ? AND is_cancelled = 0 ORDER BY session_date ASC LIMIT 1",
        [today],
    )


async def overview(db: Database, student: dict[str, Any]) -> dict[str, Any]:
    last_rows, _ = await history(db, student["id"], page=1, page_size=1)
    return {
        "student": {
            "id": student["id"],
            "status": student["status"],
            "start_index": student["start_index"],
            "current_index": student["current_index"],
            "joined_at": student["joined_at"],
        },
        "position": position_summary(student),
        "completed": progress.is_completed(student["current_index"]),
        "progress": progress_summary(student),
        "stats": await student_stats(db, student["id"]),
        "next_session": await next_session(db),
        "last_record": last_rows[0] if last_rows else None,
    }
