import { api } from './client'
import type {
  AttendanceStatus,
  HistoryRecord,
  Overview,
  Page,
  Position,
  StudentStatus,
  Timeline,
} from './student'
import type { Language } from './types'

// ---- students -----------------------------------------------------------------

export interface AdminStudent {
  id: number
  user_id: number
  login: string
  full_name: string
  email: string | null
  preferred_lang: Language
  is_active: boolean
  status: StudentStatus
  start_index: number
  current_index: number
  joined_at: string
  notes: string | null
  position: Position | null
  progress_percent: number
  total_sessions: number
  passed: number
  attendance_rate: number | null
  last_status: AttendanceStatus | null
}

export type StudentSort = 'name' | 'login' | 'position' | 'attendance' | 'joined'

export interface StudentListParams {
  search?: string
  status?: StudentStatus
  hizb?: number
  sort?: StudentSort
  order?: 'asc' | 'desc'
  page: number
  pageSize: number
}

export interface StudentCreatePayload {
  login: string
  full_name: string
  email?: string | null
  password?: string | null
  start_hizb: number
  start_part: number
  preferred_lang: Language
  notes?: string | null
  joined_at?: string | null
}

export interface StudentCreated extends AdminStudent {
  temporary_password: string | null
}

export interface StudentDetail {
  student: AdminStudent
  overview: Overview
}

export interface StudentUpdatePayload {
  full_name?: string
  email?: string | null
  preferred_lang?: Language
  notes?: string | null
  status?: 'ACTIVE' | 'PAUSED' | 'LEFT'
  is_active?: boolean
  joined_at?: string
  position?: Position
}

export interface AuditEntry {
  id: number
  actor_id: number | null
  actor_name: string | null
  action: string
  entity: string
  entity_id: number | null
  student_id: number | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}

// ---- sessions & attendance ------------------------------------------------------

export interface SessionCounts {
  marked: number
  passed: number
  not_passed: number
  absent: number
  absent_excused: number
}

export interface AdminSession {
  id: number
  session_date: string
  title: string | null
  notes: string | null
  is_cancelled: boolean
  created_at: string
  counts: SessionCounts
}

export interface SheetRecord {
  id: number
  status: AttendanceStatus
  excuse_note: string | null
  admin_note: string | null
  updated_at: string
}

export interface SheetStudent {
  student_id: number
  user_id: number
  login: string
  full_name: string
  student_status: StudentStatus
  current_index: number
  part_index: number
  hizb: number
  part: number
  record: SheetRecord | null
}

export interface SessionDetail {
  session: AdminSession
  students: SheetStudent[]
  unmarked: number
}

export interface AttendanceEntryInput {
  student_id: number
  status: AttendanceStatus
  excuse_note?: string | null
  admin_note?: string | null
}

export interface AttendanceResult {
  created: number
  updated: number
  unchanged: number
  detail: SessionDetail
}

export interface SessionCreatePayload {
  session_date: string
  title?: string | null
  notes?: string | null
}

export interface SessionUpdatePayload {
  session_date?: string
  title?: string | null
  notes?: string | null
  is_cancelled?: boolean
}

export interface RecordUpdatePayload {
  status?: AttendanceStatus
  excuse_note?: string | null
  admin_note?: string | null
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const adminApi = {
  listStudents: (p: StudentListParams) =>
    api<Page<AdminStudent>>(
      `/admin/students${query({
        search: p.search,
        status: p.status,
        hizb: p.hizb,
        sort: p.sort,
        order: p.order,
        page: p.page,
        page_size: p.pageSize,
      })}`,
    ),
  createStudent: (payload: StudentCreatePayload) =>
    api<StudentCreated>('/admin/students', { method: 'POST', body: payload }),
  getStudent: (id: number) => api<StudentDetail>(`/admin/students/${id}`),
  updateStudent: (id: number, payload: StudentUpdatePayload) =>
    api<AdminStudent>(`/admin/students/${id}`, { method: 'PATCH', body: payload }),
  resetPassword: (id: number) =>
    api<{ temporary_password: string }>(`/admin/students/${id}/reset-password`, { method: 'POST' }),
  studentHistory: (id: number, page: number, pageSize: number) =>
    api<Page<HistoryRecord>>(`/admin/students/${id}/history${query({ page, page_size: pageSize })}`),
  studentTimeline: (id: number) => api<Timeline>(`/admin/students/${id}/progress-timeline`),
  studentAudit: (id: number, page: number, pageSize: number) =>
    api<Page<AuditEntry>>(`/admin/students/${id}/audit${query({ page, page_size: pageSize })}`),

  listSessions: (page: number, pageSize: number) =>
    api<Page<AdminSession>>(`/admin/sessions${query({ page, page_size: pageSize })}`),
  createSession: (payload: SessionCreatePayload) =>
    api<AdminSession>('/admin/sessions', { method: 'POST', body: payload }),
  getSession: (id: number) => api<SessionDetail>(`/admin/sessions/${id}`),
  updateSession: (id: number, payload: SessionUpdatePayload) =>
    api<AdminSession>(`/admin/sessions/${id}`, { method: 'PATCH', body: payload }),
  deleteSession: (id: number) => api(`/admin/sessions/${id}`, { method: 'DELETE' }),
  saveAttendance: (sessionId: number, records: AttendanceEntryInput[]) =>
    api<AttendanceResult>(`/admin/sessions/${sessionId}/attendance`, { method: 'PUT', body: { records } }),
  correctRecord: (recordId: number, payload: RecordUpdatePayload) =>
    api(`/admin/attendance/${recordId}`, { method: 'PATCH', body: payload }),
  deleteRecord: (recordId: number) => api(`/admin/attendance/${recordId}`, { method: 'DELETE' }),
}
