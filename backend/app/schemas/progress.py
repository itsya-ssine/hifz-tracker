"""Response models shared by the student (/me) and admin endpoints."""

from pydantic import BaseModel

from app.schemas.common import AttendanceStatus, StudentStatus


class PositionOut(BaseModel):
    hizb: int
    part: int


class StudentSummary(BaseModel):
    id: int
    status: StudentStatus
    start_index: int
    current_index: int
    joined_at: str


class ProgressOut(BaseModel):
    completed_parts: int
    total_parts: int
    percent: float
    parts_gained: int


class StatsOut(BaseModel):
    total_sessions: int
    passed: int
    not_passed: int
    absent: int
    absent_excused: int
    attendance_rate: float | None  # (passed + not_passed) / all recorded sessions
    adjusted_attendance_rate: float | None  # same, ignoring excused absences
    current_streak: int


class NextSessionOut(BaseModel):
    id: int
    session_date: str
    title: str | None


class RecordOut(BaseModel):
    id: int
    session_id: int
    session_date: str
    title: str | None
    status: AttendanceStatus
    part_index: int
    hizb: int
    part: int
    excuse_note: str | None
    admin_note: str | None


class OverviewOut(BaseModel):
    student: StudentSummary
    position: PositionOut | None  # None once the whole Quran is completed
    completed: bool
    progress: ProgressOut
    stats: StatsOut
    next_session: NextSessionOut | None
    last_record: RecordOut | None


class TimelinePoint(BaseModel):
    session_date: str
    current_index: int  # position after this session (481 = completed)
    status: AttendanceStatus | None  # None for the starting point


class TimelineOut(BaseModel):
    start_index: int
    points: list[TimelinePoint]
