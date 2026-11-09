from typing import Annotated, Any

from fastapi import APIRouter, Query

from app.core.errors import AppError
from app.deps import DbDep, StudentUser
from app.models import students
from app.schemas.common import AttendanceStatus, Page
from app.schemas.progress import OverviewOut, RecordOut, TimelineOut
from app.services import stats

router = APIRouter(prefix="/me", tags=["student"])


async def _my_student(db: DbDep, user: StudentUser) -> dict[str, Any]:
    student = await students.get_by_user_id(db, user["id"])
    if student is None:
        raise AppError(404, "STUDENT_PROFILE_MISSING", "No student profile for this account")
    return student


@router.get("/overview", response_model=OverviewOut)
async def my_overview(db: DbDep, user: StudentUser):
    return await stats.overview(db, await _my_student(db, user))


@router.get("/history", response_model=Page[RecordOut])
async def my_history(
    db: DbDep,
    user: StudentUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    status: AttendanceStatus | None = None,
):
    student = await _my_student(db, user)
    items, total = await stats.history(db, student["id"], page=page, page_size=page_size, status=status)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/progress-timeline", response_model=TimelineOut)
async def my_timeline(db: DbDep, user: StudentUser):
    return await stats.timeline(db, await _my_student(db, user))
