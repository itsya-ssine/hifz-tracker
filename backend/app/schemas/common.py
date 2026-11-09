from typing import Generic, Literal, TypeVar

from pydantic import BaseModel

T = TypeVar("T")

AttendanceStatus = Literal["PASSED", "NOT_PASSED", "ABSENT", "ABSENT_EXCUSED"]
StudentStatus = Literal["ACTIVE", "PAUSED", "COMPLETED", "LEFT"]


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
