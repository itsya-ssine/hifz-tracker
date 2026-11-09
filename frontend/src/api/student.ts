import { api } from './client'

export type AttendanceStatus = 'PASSED' | 'NOT_PASSED' | 'ABSENT' | 'ABSENT_EXCUSED'
export type StudentStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'LEFT'

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['PASSED', 'NOT_PASSED', 'ABSENT', 'ABSENT_EXCUSED']

export interface Position {
  hizb: number
  part: number
}

export interface Overview {
  student: {
    id: number
    status: StudentStatus
    start_index: number
    current_index: number
    joined_at: string
  }
  position: Position | null // null once the whole Quran is completed
  completed: boolean
  progress: { completed_parts: number; total_parts: number; percent: number; parts_gained: number }
  stats: {
    total_sessions: number
    passed: number
    not_passed: number
    absent: number
    absent_excused: number
    attendance_rate: number | null
    adjusted_attendance_rate: number | null
    current_streak: number
  }
  next_session: { id: number; session_date: string; title: string | null } | null
  last_record: HistoryRecord | null
}

export interface HistoryRecord {
  id: number
  session_id: number
  session_date: string
  title: string | null
  status: AttendanceStatus
  part_index: number
  hizb: number
  part: number
  excuse_note: string | null
  admin_note: string | null
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface Timeline {
  start_index: number
  points: { session_date: string; current_index: number; status: AttendanceStatus | null }[]
}

export const studentApi = {
  overview: () => api<Overview>('/me/overview'),
  timeline: () => api<Timeline>('/me/progress-timeline'),
  history: (params: { page: number; pageSize: number; status?: AttendanceStatus }) => {
    const query = new URLSearchParams({ page: String(params.page), page_size: String(params.pageSize) })
    if (params.status) query.set('status', params.status)
    return api<Page<HistoryRecord>>(`/me/history?${query}`)
  },
}
