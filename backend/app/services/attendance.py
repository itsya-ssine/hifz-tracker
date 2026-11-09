"""Sessions and attendance.

Every write is one atomic batch: the attendance rows, the audit entries and the
recomputation of progress / evaluated parts for the affected students.
"""

from typing import Any

from app.core.db import Database, Statement
from app.core.errors import AppError
from app.models import audit
from app.services import progress

_COUNTS_JOIN = """
LEFT JOIN (
  SELECT session_id, COUNT(*) AS marked,
         SUM(status = 'PASSED') AS passed, SUM(status = 'NOT_PASSED') AS not_passed,
         SUM(status = 'ABSENT') AS absent, SUM(status = 'ABSENT_EXCUSED') AS absent_excused
    FROM attendance_records GROUP BY session_id
) c ON c.session_id = se.id
"""

_SESSION_SELECT = (
    "SELECT se.id, se.session_date, se.title, se.notes, se.is_cancelled, se.created_at,"
    " COALESCE(c.marked, 0) AS marked, COALESCE(c.passed, 0) AS passed,"
    " COALESCE(c.not_passed, 0) AS not_passed, COALESCE(c.absent, 0) AS absent,"
    " COALESCE(c.absent_excused, 0) AS absent_excused"
    f" FROM sessions se {_COUNTS_JOIN}"
)


def _session_out(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "session_date": row["session_date"],
        "title": row["title"],
        "notes": row["notes"],
        "is_cancelled": bool(row["is_cancelled"]),
        "created_at": row["created_at"],
        "counts": {k: int(row[k]) for k in ("marked", "passed", "not_passed", "absent", "absent_excused")},
    }


def clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


# --- sessions ----------------------------------------------------------------


async def get_session(db: Database, session_id: int) -> dict[str, Any]:
    row = await db.fetch_one(f"{_SESSION_SELECT} WHERE se.id = ?", [session_id])
    if row is None:
        raise AppError(404, "SESSION_NOT_FOUND", "Session not found")
    return row


async def get_session_out(db: Database, session_id: int) -> dict[str, Any]:
    return _session_out(await get_session(db, session_id))


async def list_sessions(db: Database, *, page: int, page_size: int) -> tuple[list[dict[str, Any]], int]:
    total = await db.fetch_value("SELECT COUNT(*) FROM sessions")
    rows = await db.fetch_all(
        f"{_SESSION_SELECT} ORDER BY se.session_date DESC LIMIT ? OFFSET ?",
        [page_size, (page - 1) * page_size],
    )
    return [_session_out(r) for r in rows], int(total or 0)


async def create_session(
    db: Database, *, actor_id: int, session_date: str, title: str | None, notes: str | None
) -> int:
    if await db.fetch_value("SELECT 1 FROM sessions WHERE session_date = ?", [session_date]):
        raise AppError(409, "SESSION_DATE_TAKEN", "A session already exists on this date")
    result = await db.execute(
        "INSERT INTO sessions (session_date, title, notes, created_by) VALUES (?, ?, ?, ?)",
        [session_date, clean(title), clean(notes), actor_id],
    )
    return int(result.last_insert_rowid)


async def update_session(db: Database, *, session_id: int, changes: dict[str, Any]) -> None:
    session = await get_session(db, session_id)
    has_records = session["marked"] > 0
    sets, args = [], []

    new_date = changes.get("session_date")
    if new_date is not None and new_date != session["session_date"]:
        if has_records:
            raise AppError(409, "SESSION_HAS_RECORDS", "Cannot move a session that has attendance records")
        if await db.fetch_value("SELECT 1 FROM sessions WHERE session_date = ? AND id != ?", [new_date, session_id]):
            raise AppError(409, "SESSION_DATE_TAKEN", "A session already exists on this date")
        sets.append("session_date = ?")
        args.append(new_date)
    if "title" in changes:
        sets.append("title = ?")
        args.append(clean(changes["title"]))
    if "notes" in changes:
        sets.append("notes = ?")
        args.append(clean(changes["notes"]))
    if changes.get("is_cancelled") is not None:
        if changes["is_cancelled"] and has_records:
            raise AppError(409, "SESSION_HAS_RECORDS", "Cannot cancel a session that has attendance records")
        sets.append("is_cancelled = ?")
        args.append(int(changes["is_cancelled"]))
    if sets:
        await db.execute(f"UPDATE sessions SET {', '.join(sets)} WHERE id = ?", [*args, session_id])


async def delete_session(db: Database, *, session_id: int) -> None:
    session = await get_session(db, session_id)
    if session["marked"] > 0:
        raise AppError(409, "SESSION_HAS_RECORDS", "Cannot delete a session that has attendance records")
    await db.execute("DELETE FROM sessions WHERE id = ?", [session_id])


# --- attendance sheet -------------------------------------------------------------


async def _sheet_rows(db: Database, session: dict[str, Any]) -> list[dict[str, Any]]:
    """Students on this session's sheet: everyone already marked, plus active students who had joined."""
    date = session["session_date"]
    return await db.fetch_all(
        "SELECT st.id AS student_id, st.user_id, u.login, u.full_name, st.status AS student_status,"
        " st.current_index,"
        " COALESCE(ar.part_index, MIN(480, st.start_index + (SELECT COUNT(*) FROM attendance_records p"
        "   JOIN sessions ps ON ps.id = p.session_id WHERE p.student_id = st.id AND p.status = 'PASSED'"
        "   AND ps.session_date < ?))) AS part_index,"
        " ar.id AS record_id, ar.status AS record_status, ar.excuse_note, ar.admin_note, ar.updated_at"
        " FROM students st JOIN users u ON u.id = st.user_id"
        " LEFT JOIN attendance_records ar ON ar.session_id = ? AND ar.student_id = st.id"
        " WHERE ar.id IS NOT NULL OR (st.status = 'ACTIVE' AND st.joined_at <= ?)"
        " ORDER BY lower(u.full_name), st.id",
        [date, session["id"], date],
    )


def _sheet_student(row: dict[str, Any]) -> dict[str, Any]:
    pos = progress.index_to_position(min(max(row["part_index"], 1), progress.TOTAL_PARTS))
    record = None
    if row["record_id"] is not None:
        record = {
            "id": row["record_id"],
            "status": row["record_status"],
            "excuse_note": row["excuse_note"],
            "admin_note": row["admin_note"],
            "updated_at": row["updated_at"],
        }
    return {
        "student_id": row["student_id"],
        "user_id": row["user_id"],
        "login": row["login"],
        "full_name": row["full_name"],
        "student_status": row["student_status"],
        "current_index": row["current_index"],
        "part_index": row["part_index"],
        "hizb": pos.hizb,
        "part": pos.part,
        "record": record,
    }


async def session_detail(db: Database, session_id: int) -> dict[str, Any]:
    session = await get_session(db, session_id)
    students = [_sheet_student(r) for r in await _sheet_rows(db, session)]
    return {
        "session": _session_out(session),
        "students": students,
        "unmarked": sum(1 for s in students if s["record"] is None),
    }


async def apply_entries(
    db: Database, *, session_id: int, entries: list[dict[str, Any]], actor_id: int
) -> dict[str, Any]:
    """Create or update attendance records for one session (idempotent)."""
    session = await get_session(db, session_id)
    if session["is_cancelled"]:
        raise AppError(400, "SESSION_CANCELLED", "This session was cancelled")

    sheet = {r["student_id"]: r for r in await _sheet_rows(db, session)}
    unknown = sorted(e["student_id"] for e in entries if e["student_id"] not in sheet)
    if unknown:
        raise AppError(400, "STUDENT_NOT_ELIGIBLE", f"Students not on this session's sheet: {unknown}")

    statements: list[Statement] = []
    affected: set[int] = set()
    created = updated = unchanged = 0

    for entry in entries:
        sid, status = entry["student_id"], entry["status"]
        excuse = clean(entry.get("excuse_note")) if status == "ABSENT_EXCUSED" else None
        note = clean(entry.get("admin_note"))
        row = sheet[sid]
        old = None
        if row["record_id"] is not None:
            old = {"status": row["record_status"], "excuse_note": row["excuse_note"],
                   "admin_note": row["admin_note"]}
            if old == {"status": status, "excuse_note": excuse, "admin_note": note}:
                unchanged += 1
                continue

        # part_index is a placeholder here: recompute_student_statements() derives the real value.
        statements.append((
            "INSERT INTO attendance_records (session_id, student_id, status, part_index, excuse_note,"
            " admin_note, marked_by) VALUES (?, ?, ?, 1, ?, ?, ?)"
            " ON CONFLICT(session_id, student_id) DO UPDATE SET status = excluded.status,"
            " excuse_note = excluded.excuse_note, admin_note = excluded.admin_note,"
            " marked_by = excluded.marked_by, updated_at = datetime('now')",
            [session_id, sid, status, excuse, note, actor_id],
        ))
        new = {"session_date": session["session_date"], "status": status,
               "excuse_note": excuse, "admin_note": note}
        statements.append(audit.insert_for_record_statement(
            actor_id=actor_id, action="ATTENDANCE_CREATED" if old is None else "ATTENDANCE_UPDATED",
            session_id=session_id, student_id=sid,
            old={"session_date": session["session_date"], **old} if old else None, new=new,
        ))
        affected.add(sid)
        created, updated = (created + 1, updated) if old is None else (created, updated + 1)

    for sid in sorted(affected):
        statements.extend(progress.recompute_student_statements(sid))
    if statements:
        await db.batch(statements)
    return {"created": created, "updated": updated, "unchanged": unchanged}


# --- single records ---------------------------------------------------------------


async def get_record(db: Database, record_id: int) -> dict[str, Any]:
    row = await db.fetch_one(
        "SELECT id, session_id, student_id, status, part_index, excuse_note, admin_note, updated_at"
        " FROM attendance_records WHERE id = ?",
        [record_id],
    )
    if row is None:
        raise AppError(404, "RECORD_NOT_FOUND", "Attendance record not found")
    return row


async def update_record(
    db: Database, *, record_id: int, changes: dict[str, Any], actor_id: int
) -> dict[str, Any]:
    record = await get_record(db, record_id)
    entry = {
        "student_id": record["student_id"],
        "status": changes.get("status") or record["status"],
        "excuse_note": changes["excuse_note"] if "excuse_note" in changes else record["excuse_note"],
        "admin_note": changes["admin_note"] if "admin_note" in changes else record["admin_note"],
    }
    await apply_entries(db, session_id=record["session_id"], entries=[entry], actor_id=actor_id)
    return await get_record(db, record_id)


async def delete_record(db: Database, *, record_id: int, actor_id: int) -> None:
    record = await get_record(db, record_id)
    session = await get_session(db, record["session_id"])
    await db.batch([
        audit.insert_statement(
            actor_id=actor_id, action="ATTENDANCE_DELETED", entity="attendance_record",
            entity_id=record_id, student_id=record["student_id"],
            old={"session_date": session["session_date"], "status": record["status"],
                 "excuse_note": record["excuse_note"], "admin_note": record["admin_note"]},
        ),
        ("DELETE FROM attendance_records WHERE id = ?", [record_id]),
        *progress.recompute_student_statements(record["student_id"]),
    ])
