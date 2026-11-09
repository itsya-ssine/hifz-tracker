from typing import Any

from app.core.db import Database

STUDENT_SELECT = (
    "SELECT st.id, st.user_id, u.login, u.full_name, u.email, u.preferred_lang, u.is_active,"
    " st.status, st.start_index, st.current_index, st.joined_at, st.notes"
    " FROM students st JOIN users u ON u.id = st.user_id"
)


async def get(db: Database, student_id: int) -> dict[str, Any] | None:
    return await db.fetch_one(f"{STUDENT_SELECT} WHERE st.id = ?", [student_id])


async def get_by_user_id(db: Database, user_id: int) -> dict[str, Any] | None:
    return await db.fetch_one(f"{STUDENT_SELECT} WHERE st.user_id = ?", [user_id])
