from typing import Annotated, Literal

from fastapi import APIRouter, Query, status

from app.deps import AdminUser, DbDep
from app.models import audit
from app.schemas.audit import AuditEntry
from app.schemas.common import AttendanceStatus, Page, StudentStatus
from app.schemas.progress import RecordOut, TimelineOut
from app.schemas.students import (
    PasswordReset,
    StudentCreate,
    StudentCreated,
    StudentDetail,
    StudentOut,
    StudentUpdate,
)
from app.services import stats
from app.services import students as service

router = APIRouter(prefix="/admin/students", tags=["admin: students"])


@router.get("", response_model=Page[StudentOut])
async def list_students(
    db: DbDep,
    _: AdminUser,
    search: Annotated[str | None, Query(max_length=100)] = None,
    status: StudentStatus | None = None,
    hizb: Annotated[int | None, Query(ge=1, le=60)] = None,
    sort: Literal["name", "login", "position", "attendance", "joined"] = "name",
    order: Literal["asc", "desc"] = "asc",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    items, total = await service.list_students(
        db, search=search, status=status, hizb=hizb, sort=sort,
        descending=order == "desc", page=page, page_size=page_size,
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=StudentCreated, status_code=status.HTTP_201_CREATED)
async def create_student(payload: StudentCreate, db: DbDep, admin: AdminUser):
    student_id, temporary = await service.create_student(
        db,
        actor_id=admin["id"],
        login=payload.login,
        full_name=payload.full_name,
        email=payload.email,
        password=payload.password,
        start_hizb=payload.start_hizb,
        start_part=payload.start_part,
        preferred_lang=payload.preferred_lang,
        notes=payload.notes,
        joined_at=payload.joined_at.isoformat() if payload.joined_at else None,
    )
    out = await service.get_student_out(db, student_id)
    return {**out, "temporary_password": temporary}


@router.get("/{student_id}", response_model=StudentDetail)
async def student_detail(student_id: int, db: DbDep, _: AdminUser):
    out = await service.get_student_out(db, student_id)
    student = await service.require_student(db, student_id)
    overview = await stats.overview(db, student)
    return {"student": out, "overview": overview, "progress": overview["progress"]}


@router.patch("/{student_id}", response_model=StudentOut)
async def update_student(student_id: int, payload: StudentUpdate, db: DbDep, admin: AdminUser):
    changes = payload.model_dump(exclude_unset=True, mode="json")
    await service.update_student(db, actor_id=admin["id"], student_id=student_id, changes=changes)
    return await service.get_student_out(db, student_id)


@router.post("/{student_id}/reset-password", response_model=PasswordReset)
async def reset_password(student_id: int, db: DbDep, admin: AdminUser):
    temporary = await service.reset_password(db, actor_id=admin["id"], student_id=student_id)
    return {"temporary_password": temporary}


@router.get("/{student_id}/history", response_model=Page[RecordOut])
async def student_history(
    student_id: int,
    db: DbDep,
    _: AdminUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    status: AttendanceStatus | None = None,
):
    await service.require_student(db, student_id)
    items, total = await stats.history(db, student_id, page=page, page_size=page_size, status=status)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{student_id}/progress-timeline", response_model=TimelineOut)
async def student_timeline(student_id: int, db: DbDep, _: AdminUser):
    return await stats.timeline(db, await service.require_student(db, student_id))


@router.get("/{student_id}/audit", response_model=Page[AuditEntry])
async def student_audit(
    student_id: int,
    db: DbDep,
    _: AdminUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    await service.require_student(db, student_id)
    items, total = await audit.list_entries(db, student_id=student_id, page=page, page_size=page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}
