from typing import Any

from pydantic import BaseModel


class AuditEntry(BaseModel):
    id: int
    actor_id: int | None
    actor_name: str | None
    action: str
    entity: str
    entity_id: int | None
    student_id: int | None
    old_value: dict[str, Any] | None
    new_value: dict[str, Any] | None
    created_at: str
