from datetime import date

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import AttendanceStatus, StudentStatus


class SessionCreate(BaseModel):
    session_date: date
    title: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=1000)


class SessionUpdate(BaseModel):
    session_date: date | None = None
    title: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=1000)
    is_cancelled: bool | None = None


class SessionCounts(BaseModel):
    marked: int
    passed: int
    not_passed: int
    absent: int
    absent_excused: int


class SessionOut(BaseModel):
    id: int
    session_date: str
    title: str | None
    notes: str | None
    is_cancelled: bool
    created_at: str
    counts: SessionCounts


class RecordInfo(BaseModel):
    id: int
    status: AttendanceStatus
    excuse_note: str | None
    admin_note: str | None
    updated_at: str


class SessionStudent(BaseModel):
    student_id: int
    user_id: int
    login: str
    full_name: str
    student_status: StudentStatus
    current_index: int
    part_index: int  # the part to evaluate (or that was evaluated) in this session
    hizb: int
    part: int
    record: RecordInfo | None


class SessionDetail(BaseModel):
    session: SessionOut
    students: list[SessionStudent]
    unmarked: int


class AttendanceEntry(BaseModel):
    student_id: int
    status: AttendanceStatus
    excuse_note: str | None = Field(default=None, max_length=500)
    admin_note: str | None = Field(default=None, max_length=500)


class AttendanceBulk(BaseModel):
    records: list[AttendanceEntry] = Field(min_length=1, max_length=500)

    @field_validator("records")
    @classmethod
    def _unique_students(cls, records: list[AttendanceEntry]) -> list[AttendanceEntry]:
        ids = [r.student_id for r in records]
        if len(ids) != len(set(ids)):
            raise ValueError("Each student can appear only once")
        return records


class AttendanceResult(BaseModel):
    created: int
    updated: int
    unchanged: int
    detail: SessionDetail


class RecordUpdate(BaseModel):
    status: AttendanceStatus | None = None
    excuse_note: str | None = Field(default=None, max_length=500)
    admin_note: str | None = Field(default=None, max_length=500)


class AttendanceRecordOut(BaseModel):
    id: int
    session_id: int
    student_id: int
    status: AttendanceStatus
    part_index: int
    excuse_note: str | None
    admin_note: str | None
    updated_at: str
