import type { AttendanceEntryInput, SheetStudent } from '../../../api/admin'
import type { AttendanceStatus } from '../../../api/student'

/** What the admin has chosen for one student on the sheet, before saving. */
export interface Draft {
  status: AttendanceStatus | null
  excuse: string
  note: string
}

export function baseline(student: SheetStudent): Draft {
  const record = student.record
  return { status: record?.status ?? null, excuse: record?.excuse_note ?? '', note: record?.admin_note ?? '' }
}

export function effective(student: SheetStudent, drafts: Record<number, Draft>): Draft {
  return drafts[student.student_id] ?? baseline(student)
}

/** True when the draft would change what is stored on the server. */
export function isDirty(student: SheetStudent, draft: Draft): boolean {
  if (draft.status === null) return false
  const saved = baseline(student)
  if (saved.status === null) return true
  return (
    draft.status !== saved.status ||
    (draft.status === 'ABSENT_EXCUSED' && draft.excuse.trim() !== saved.excuse) ||
    draft.note.trim() !== saved.note
  )
}

export function toEntry(student: SheetStudent, draft: Draft): AttendanceEntryInput {
  return {
    student_id: student.student_id,
    status: draft.status as AttendanceStatus,
    excuse_note: draft.status === 'ABSENT_EXCUSED' ? draft.excuse.trim() || null : null,
    admin_note: draft.note.trim() || null,
  }
}

export function tally(students: SheetStudent[], drafts: Record<number, Draft>) {
  const counts = { PASSED: 0, NOT_PASSED: 0, ABSENT: 0, ABSENT_EXCUSED: 0, unmarked: 0 }
  for (const student of students) {
    const { status } = effective(student, drafts)
    if (status) counts[status] += 1
    else counts.unmarked += 1
  }
  return counts
}
