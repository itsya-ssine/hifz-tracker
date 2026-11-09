import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.auth import Language
from app.schemas.common import StudentStatus
from app.schemas.progress import OverviewOut, PositionOut, ProgressOut

_LOGIN_RE = re.compile(r"^[a-z0-9._-]{3,32}$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean_email(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    value = value.strip().lower()
    if not _EMAIL_RE.match(value) or len(value) > 254:
        raise ValueError("Invalid email address")
    return value


class StudentCreate(BaseModel):
    login: str
    full_name: str = Field(min_length=1, max_length=120)
    email: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    start_hizb: int = Field(default=1, ge=1, le=60)
    start_part: int = Field(default=1, ge=1, le=8)
    preferred_lang: Language = "en"
    notes: str | None = Field(default=None, max_length=1000)
    joined_at: date | None = None  # defaults to today; sets which past sessions they appear in

    @field_validator("login")
    @classmethod
    def _login(cls, value: str) -> str:
        value = value.strip().lower()
        if not _LOGIN_RE.match(value):
            raise ValueError("Login must be 3-32 characters: letters, digits, '.', '_' or '-'")
        return value

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        return _clean_email(value)


class StudentUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = None
    preferred_lang: Language | None = None
    notes: str | None = Field(default=None, max_length=1000)
    status: Literal["ACTIVE", "PAUSED", "LEFT"] | None = None
    is_active: bool | None = None
    joined_at: date | None = None
    # Manually set the part the student is currently working on.
    position: PositionOut | None = None

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        return _clean_email(value)

    @model_validator(mode="after")
    def _position_range(self):
        if self.position and not (1 <= self.position.hizb <= 60 and 1 <= self.position.part <= 8):
            raise ValueError("position out of range")
        return self


class StudentOut(BaseModel):
    id: int
    user_id: int
    login: str
    full_name: str
    email: str | None
    preferred_lang: Language
    is_active: bool
    status: StudentStatus
    start_index: int
    current_index: int
    joined_at: str
    notes: str | None
    position: PositionOut | None
    progress_percent: float
    total_sessions: int
    passed: int
    attendance_rate: float | None
    last_status: str | None


class StudentCreated(StudentOut):
    temporary_password: str | None  # shown once; None when the admin chose the password


class StudentDetail(BaseModel):
    student: StudentOut
    overview: OverviewOut
    progress: ProgressOut


class PasswordReset(BaseModel):
    temporary_password: str
