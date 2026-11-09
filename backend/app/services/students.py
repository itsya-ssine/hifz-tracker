"""Admin-side student management: listing, creation, updates and position correction."""

import json
import secrets
from typing import Any

from app.core.db import Database
from app.core.errors import AppError
from app.core.security import hash_password
from app.models import audit, refresh_tokens, students
from app.services import progress

SORTS = {
    "name": "lower(u.full_name)",
    "login": "u.login",
    "position": "st.current_index",
    "attendance": "attendance_rate",
    "joined": "st.joined_at",
}

_LIST_SELECT = f"""
SELECT st.id, st.user_id, u.login, u.full_name, u.email, u.preferred_lang, u.is_active,
       st.status, st.start_index, st.current_index, st.joined_at, st.notes,
       COALESCE(a.total, 0) AS total_sessions, COALESCE(a.passed, 0) AS passed,
       CASE WHEN COALESCE(a.total, 0) = 0 THEN NULL
            ELSE 1.0 * (a.passed + a.not_passed) / a.total END AS attendance_rate,
       (SELECT ar.status FROM attendance_records ar JOIN sessions se ON se.id = ar.session_id
         WHERE ar.student_id = st.id ORDER BY se.session_date DESC LIMIT 1) AS last_status
  FROM students st
  JOIN users u ON u.id = st.user_id
  LEFT JOIN (
    SELECT student_id, COUNT(*) AS total,
           SUM(status = 'PASSED') AS passed, SUM(status = 'NOT_PASSED') AS not_passed
      FROM attendance_records GROUP BY student_id
  ) a ON a.student_id = st.id
"""


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def to_out(row: dict[str, Any]) -> dict[str, Any]:
    pos = progress.current_position(row["current_index"])
    rate = row.get("attendance_rate")
    return {
        **row,
        "is_active": bool(row["is_active"]),
        "position": {"hizb": pos.hizb, "part": pos.part} if pos else None,
        "progress_percent": progress.progress_percent(row["current_index"]),
        "attendance_rate": round(rate, 4) if rate is not None else None,
    }


async def list_students(
    db: Database,
    *,
    search: str | None,
    status: str | None,
    hizb: int | None,
    sort: str,
    descending: bool,
    page: int,
    page_size: int,
) -> tuple[list[dict[str, Any]], int]:
    where, args = ["1 = 1"], []
    if search and search.strip():
        like = f"%{_escape_like(search.strip().lower())}%"
        where.append("(lower(u.full_name) LIKE ? ESCAPE '\\' OR u.login LIKE ? ESCAPE '\\')")
        args += [like, like]
    if status:
        where.append("st.status = ?")
        args.append(status)
    if hizb:
        where.append("(st.current_index - 1) / 8 + 1 = ? AND st.current_index <= 480")
        args.append(hizb)
    clause = " AND ".join(where)

    total = await db.fetch_value(
        f"SELECT COUNT(*) FROM students st JOIN users u ON u.id = st.user_id WHERE {clause}", args
    )
    direction = "DESC" if descending else "ASC"
    order = SORTS[sort]
    # NULL rates sort last in both directions; id keeps pagination stable.
    nulls = "(attendance_rate IS NULL), " if sort == "attendance" else ""
    rows = await db.fetch_all(
        f"{_LIST_SELECT} WHERE {clause} ORDER BY {nulls}{order} {direction}, st.id ASC LIMIT ? OFFSET ?",
        [*args, page_size, (page - 1) * page_size],
    )
    return [to_out(r) for r in rows], int(total or 0)


async def get_student_out(db: Database, student_id: int) -> dict[str, Any]:
    row = await db.fetch_one(f"{_LIST_SELECT} WHERE st.id = ?", [student_id])
    if row is None:
        raise AppError(404, "STUDENT_NOT_FOUND", "Student not found")
    return to_out(row)


async def require_student(db: Database, student_id: int) -> dict[str, Any]:
    student = await students.get(db, student_id)
    if student is None:
        raise AppError(404, "STUDENT_NOT_FOUND", "Student not found")
    return student


def generate_temporary_password() -> str:
    return secrets.token_urlsafe(9)


async def create_student(
    db: Database,
    *,
    actor_id: int,
    login: str,
    full_name: str,
    email: str | None,
    password: str | None,
    start_hizb: int,
    start_part: int,
    preferred_lang: str,
    notes: str | None,
    joined_at: str | None = None,
) -> tuple[int, str | None]:
    if await db.fetch_value("SELECT 1 FROM users WHERE lower(login) = ?", [login]):
        raise AppError(409, "LOGIN_TAKEN", "This login is already used")
    if email and await db.fetch_value("SELECT 1 FROM users WHERE lower(email) = ?", [email]):
        raise AppError(409, "EMAIL_TAKEN", "This email is already used")

    temporary = None if password else generate_temporary_password()
    start_index = progress.position_to_index(start_hizb, start_part)
    # One transaction: the student row finds its user through the unique login.
    await db.batch(
        [
            (
                "INSERT INTO users (login, full_name, email, password_hash, role, preferred_lang,"
                " must_change_password) VALUES (?, ?, ?, ?, 'STUDENT', ?, 1)",
                [login, full_name.strip(), email, hash_password(password or temporary or ""), preferred_lang],
            ),
            (
                "INSERT INTO students (user_id, start_index, current_index, notes, joined_at)"
                " VALUES ((SELECT id FROM users WHERE login = ?), ?, ?, ?, COALESCE(?, date('now')))",
                [login, start_index, start_index, (notes or "").strip() or None, joined_at],
            ),
            (
                "INSERT INTO audit_log (actor_id, action, entity, entity_id, student_id, new_value)"
                " VALUES (?, 'STUDENT_CREATED', 'student',"
                " (SELECT st.id FROM students st JOIN users u ON u.id = st.user_id WHERE u.login = ?),"
                " (SELECT st.id FROM students st JOIN users u ON u.id = st.user_id WHERE u.login = ?), ?)",
                [actor_id, login, login,
                 json.dumps({"login": login, "full_name": full_name.strip(), "start_index": start_index},
                            ensure_ascii=False)],
            ),
        ]
    )
    student_id = await db.fetch_value(
        "SELECT st.id FROM students st JOIN users u ON u.id = st.user_id WHERE u.login = ?", [login]
    )
    return int(student_id), temporary


async def update_student(
    db: Database, *, actor_id: int, student_id: int, changes: dict[str, Any]
) -> None:
    """Apply a partial update. ``changes`` holds only the fields the client sent."""
    student = await require_student(db, student_id)
    statements = []
    old: dict[str, Any] = {}
    new: dict[str, Any] = {}

    def record(key: str, before: Any, after: Any) -> bool:
        if before == after:
            return False
        old[key], new[key] = before, after
        return True

    if changes.get("email") and changes["email"] != student["email"]:
        taken = await db.fetch_value(
            "SELECT 1 FROM users WHERE lower(email) = ? AND id != ?", [changes["email"], student["user_id"]]
        )
        if taken:
            raise AppError(409, "EMAIL_TAKEN", "This email is already used")

    user_sets, user_args = [], []
    for field in ("full_name", "email", "preferred_lang"):
        if field in changes and record(field, student[field], changes[field]):
            user_sets.append(f"{field} = ?")
            user_args.append(changes[field])
    if "is_active" in changes and record("is_active", bool(student["is_active"]), changes["is_active"]):
        user_sets.append("is_active = ?")
        user_args.append(int(changes["is_active"]))

    if user_sets:
        statements.append((f"UPDATE users SET {', '.join(user_sets)} WHERE id = ?", [*user_args, student["user_id"]]))
        if "is_active" in new and not changes["is_active"]:
            statements.append(refresh_tokens.revoke_all_statement(student["user_id"]))

    student_sets, student_args = [], []
    if "notes" in changes:
        notes = (changes["notes"] or "").strip() or None
        if record("notes", student["notes"], notes):
            student_sets.append("notes = ?")
            student_args.append(notes)
    if changes.get("joined_at") is not None:
        joined = changes["joined_at"]
        if record("joined_at", student["joined_at"], joined):
            student_sets.append("joined_at = ?")
            student_args.append(joined)
    if "status" in changes and changes["status"] is not None:
        if progress.is_completed(student["current_index"]):
            raise AppError(400, "STUDENT_COMPLETED", "This student has completed the Quran")
        if record("status", student["status"], changes["status"]):
            student_sets.append("status = ?")
            student_args.append(changes["status"])

    recompute = False
    if changes.get("position") is not None:
        pos = changes["position"]
        target = progress.position_to_index(pos["hizb"], pos["part"])
        passed = await db.fetch_value(
            "SELECT COUNT(*) FROM attendance_records WHERE student_id = ? AND status = 'PASSED'", [student_id]
        )
        new_start = target - int(passed or 0)
        if new_start < 1:
            raise AppError(
                400, "INVALID_POSITION",
                "That position is behind the passes already recorded. Correct the attendance records instead.",
            )
        if record("position", {"index": student["current_index"]}, {"index": target}):
            student_sets.append("start_index = ?")
            student_args.append(new_start)
            recompute = True

    if student_sets:
        statements.append((f"UPDATE students SET {', '.join(student_sets)} WHERE id = ?", [*student_args, student_id]))
    if recompute:
        statements.extend(progress.recompute_student_statements(student_id))
    if not statements:
        return
    statements.append(
        audit.insert_statement(
            actor_id=actor_id, action="STUDENT_UPDATED", entity="student", entity_id=student_id,
            student_id=student_id, old=old, new=new,
        )
    )
    await db.batch(statements)


async def reset_password(db: Database, *, actor_id: int, student_id: int) -> str:
    student = await require_student(db, student_id)
    temporary = generate_temporary_password()
    await db.batch(
        [
            (
                "UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?",
                [hash_password(temporary), student["user_id"]],
            ),
            refresh_tokens.revoke_all_statement(student["user_id"]),
            audit.insert_statement(
                actor_id=actor_id, action="PASSWORD_RESET", entity="student", entity_id=student_id,
                student_id=student_id,
            ),
        ]
    )
    return temporary
