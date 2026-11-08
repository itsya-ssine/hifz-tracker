"""Quran progress logic.

The Quran is split into 60 hizb, each split into 8 parts (480 parts in total).
A position is stored as a single *global index* in ``1..480``:

    index = (hizb - 1) * 8 + part

A student's ``current_index`` is the part they are working on. The value ``481``
means they have completed the whole Quran.

A student's position is always *derived* from their history:

    current_index = min(481, start_index + number_of_PASSED_records)

so correcting a past attendance record can never leave progress inconsistent.
"""

from dataclasses import dataclass

from app.core.db import Database, Statement

HIZB_COUNT = 60
PARTS_PER_HIZB = 8
TOTAL_PARTS = HIZB_COUNT * PARTS_PER_HIZB  # 480
COMPLETED_INDEX = TOTAL_PARTS + 1  # 481


@dataclass(frozen=True)
class Position:
    hizb: int
    part: int


def position_to_index(hizb: int, part: int) -> int:
    if not 1 <= hizb <= HIZB_COUNT:
        raise ValueError(f"hizb must be between 1 and {HIZB_COUNT}, got {hizb}")
    if not 1 <= part <= PARTS_PER_HIZB:
        raise ValueError(f"part must be between 1 and {PARTS_PER_HIZB}, got {part}")
    return (hizb - 1) * PARTS_PER_HIZB + part


def index_to_position(index: int) -> Position:
    if not 1 <= index <= TOTAL_PARTS:
        raise ValueError(f"index must be between 1 and {TOTAL_PARTS}, got {index}")
    return Position(hizb=(index - 1) // PARTS_PER_HIZB + 1, part=(index - 1) % PARTS_PER_HIZB + 1)


def is_completed(current_index: int) -> bool:
    return current_index >= COMPLETED_INDEX


def advance(current_index: int, steps: int = 1) -> int:
    """Move forward by ``steps`` parts. Never goes past ``COMPLETED_INDEX``."""
    if steps < 0:
        raise ValueError("steps must be >= 0")
    if not 1 <= current_index <= COMPLETED_INDEX:
        raise ValueError(f"current_index must be between 1 and {COMPLETED_INDEX}")
    return min(current_index + steps, COMPLETED_INDEX)


def current_position(current_index: int) -> Position | None:
    """The part being worked on, or ``None`` when the whole Quran is completed."""
    return None if is_completed(current_index) else index_to_position(current_index)


def completed_parts(current_index: int) -> int:
    """Number of parts behind the student (everything before the current part)."""
    return min(max(current_index - 1, 0), TOTAL_PARTS)


def progress_percent(current_index: int) -> float:
    return round(completed_parts(current_index) / TOTAL_PARTS * 100, 1)


def parts_gained(start_index: int, current_index: int) -> int:
    """Parts passed since the student joined the club."""
    return max(current_index - start_index, 0)


# --- Database helpers ------------------------------------------------------

_PASSED_COUNT = (
    "(SELECT COUNT(*) FROM attendance_records ar "
    "WHERE ar.student_id = students.id AND ar.status = 'PASSED')"
)

_RECOMPUTE_SET = f"""
UPDATE students SET
  current_index = MIN({COMPLETED_INDEX}, start_index + {_PASSED_COUNT}),
  status = CASE
    WHEN start_index + {_PASSED_COUNT} > {TOTAL_PARTS} THEN 'COMPLETED'
    WHEN status = 'COMPLETED' THEN 'ACTIVE'
    ELSE status
  END
"""


def recompute_statement(student_id: int) -> Statement:
    """Statement that recomputes one student's progress.

    Append it to the same ``Database.batch`` as the attendance write so both
    happen in one transaction.
    """
    return (_RECOMPUTE_SET + " WHERE id = ?", [student_id])


def recompute_all_statement() -> Statement:
    return _RECOMPUTE_SET


async def recompute_student_progress(db: Database, student_id: int) -> int:
    """Recompute and return the student's ``current_index``."""
    await db.batch([recompute_statement(student_id)])
    value = await db.fetch_value("SELECT current_index FROM students WHERE id = ?", [student_id])
    if value is None:
        raise LookupError(f"Student {student_id} not found")
    return int(value)
