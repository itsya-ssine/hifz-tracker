from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.deps import AdminUser, DbDep
from app.schemas.common import Page
from app.schemas.sessions import (
    AttendanceBulk,
    AttendanceRecordOut,
    AttendanceResult,
    RecordUpdate,
    SessionCreate,
    SessionDetail,
    SessionOut,
    SessionUpdate,
)
from app.services import attendance as service

router = APIRouter(prefix="/admin", tags=["admin: sessions & attendance"])


@router.get("/sessions", response_model=Page[SessionOut])
async def list_sessions(
    db: DbDep,
    _: AdminUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    items, total = await service.list_sessions(db, page=page, page_size=page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/sessions", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(payload: SessionCreate, db: DbDep, admin: AdminUser):
    session_id = await service.create_session(
        db, actor_id=admin["id"], session_date=payload.session_date.isoformat(),
        title=payload.title, notes=payload.notes,
    )
    return await service.get_session_out(db, session_id)


@router.get("/sessions/{session_id}", response_model=SessionDetail)
async def session_detail(session_id: int, db: DbDep, _: AdminUser):
    return await service.session_detail(db, session_id)


@router.patch("/sessions/{session_id}", response_model=SessionOut)
async def update_session(session_id: int, payload: SessionUpdate, db: DbDep, _: AdminUser):
    await service.update_session(
        db, session_id=session_id, changes=payload.model_dump(exclude_unset=True, mode="json")
    )
    return await service.get_session_out(db, session_id)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: int, db: DbDep, _: AdminUser):
    await service.delete_session(db, session_id=session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/sessions/{session_id}/attendance", response_model=AttendanceResult)
async def save_attendance(session_id: int, payload: AttendanceBulk, db: DbDep, admin: AdminUser):
    """Bulk upsert of the attendance sheet. Safe to call repeatedly with the same data."""
    result = await service.apply_entries(
        db, session_id=session_id, entries=[r.model_dump() for r in payload.records], actor_id=admin["id"]
    )
    return {**result, "detail": await service.session_detail(db, session_id)}


@router.patch("/attendance/{record_id}", response_model=AttendanceRecordOut)
async def correct_record(record_id: int, payload: RecordUpdate, db: DbDep, admin: AdminUser):
    return await service.update_record(
        db, record_id=record_id, changes=payload.model_dump(exclude_unset=True), actor_id=admin["id"]
    )


@router.delete("/attendance/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(record_id: int, db: DbDep, admin: AdminUser):
    await service.delete_record(db, record_id=record_id, actor_id=admin["id"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)
