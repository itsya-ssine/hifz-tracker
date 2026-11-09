import json
from typing import Any

from app.core.db import Database, Statement


def _dump(value: dict[str, Any] | None) -> str | None:
    return json.dumps(value, ensure_ascii=False, default=str) if value is not None else None


def insert_statement(
    *,
    actor_id: int | None,
    action: str,
    entity: str,
    entity_id: int | None,
    student_id: int | None,
    old: dict[str, Any] | None = None,
    new: dict[str, Any] | None = None,
) -> Statement:
    return (
        "INSERT INTO audit_log (actor_id, action, entity, entity_id, student_id, old_value, new_value)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        [actor_id, action, entity, entity_id, student_id, _dump(old), _dump(new)],
    )


def insert_for_record_statement(
    *,
    actor_id: int | None,
    action: str,
    session_id: int,
    student_id: int,
    old: dict[str, Any] | None,
    new: dict[str, Any] | None,
) -> Statement:
    """Audit entry for an attendance record, resolving its id inside the same transaction."""
    return (
        "INSERT INTO audit_log (actor_id, action, entity, entity_id, student_id, old_value, new_value)"
        " VALUES (?, ?, 'attendance_record',"
        " (SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?), ?, ?, ?)",
        [actor_id, action, session_id, student_id, student_id, _dump(old), _dump(new)],
    )


async def list_entries(
    db: Database,
    *,
    student_id: int | None = None,
    entity: str | None = None,
    entity_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict[str, Any]], int]:
    where, args = ["1 = 1"], []
    if student_id is not None:
        where.append("a.student_id = ?")
        args.append(student_id)
    if entity:
        where.append("a.entity = ?")
        args.append(entity)
    if entity_id is not None:
        where.append("a.entity_id = ?")
        args.append(entity_id)
    clause = " AND ".join(where)

    total = await db.fetch_value(f"SELECT COUNT(*) FROM audit_log a WHERE {clause}", args)
    rows = await db.fetch_all(
        "SELECT a.id, a.actor_id, u.full_name AS actor_name, a.action, a.entity, a.entity_id,"
        " a.student_id, a.old_value, a.new_value, a.created_at"
        f" FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id WHERE {clause}"
        " ORDER BY a.id DESC LIMIT ? OFFSET ?",
        [*args, page_size, (page - 1) * page_size],
    )
    for row in rows:
        row["old_value"] = json.loads(row["old_value"]) if row["old_value"] else None
        row["new_value"] = json.loads(row["new_value"]) if row["new_value"] else None
    return rows, int(total or 0)
