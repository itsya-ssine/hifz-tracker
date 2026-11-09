import { vi } from 'vitest'
import type { AdminSession, AdminStudent, SessionDetail, SheetStudent } from '../api/admin'
import type { HistoryRecord, Overview } from '../api/student'
import type { User } from '../api/types'

interface MockResponse {
  status?: number
  body?: unknown
}

/** Stub `fetch` with routes keyed as "METHOD /path" (path without the /api/v1 prefix). */
export function mockApi(routes: Record<string, MockResponse | (() => MockResponse)>) {
  const calls: string[] = []
  const bodies: Record<string, unknown[]> = {}
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^.*\/api\/v1/, '')
    const key = `${init?.method ?? 'GET'} ${url}`
    calls.push(key)
    if (typeof init?.body === 'string') (bodies[key] ??= []).push(JSON.parse(init.body))
    // Exact match (with query string) first, then the bare path.
    const route = routes[key] ?? routes[`${init?.method ?? 'GET'} ${url.split('?')[0]}`]
    const { status = 200, body } = typeof route === 'function' ? route() : (route ?? { status: 404 })
    return new Response(status === 204 ? null : JSON.stringify(body ?? {}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, bodies, fetchMock }
}

export const unauthenticated = {
  'GET /auth/me': { status: 401, body: { detail: 'Not authenticated', code: 'NOT_AUTHENTICATED' } },
  'POST /auth/refresh': { status: 401, body: { detail: 'Not authenticated', code: 'NOT_AUTHENTICATED' } },
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    login: 'student01',
    full_name: 'Youssef El Amrani',
    email: null,
    role: 'STUDENT',
    preferred_lang: 'en',
    is_active: true,
    must_change_password: false,
    ...overrides,
  }
}

export function makeOverview(overrides: Partial<Overview> = {}): Overview {
  return {
    student: { id: 1, status: 'ACTIVE', start_index: 9, current_index: 13, joined_at: '2026-01-01' },
    position: { hizb: 2, part: 5 },
    completed: false,
    progress: { completed_parts: 12, total_parts: 480, percent: 2.5, parts_gained: 4 },
    stats: {
      total_sessions: 6,
      passed: 4,
      not_passed: 1,
      absent: 0,
      absent_excused: 1,
      attendance_rate: 0.8333,
      adjusted_attendance_rate: 1,
      current_streak: 2,
    },
    next_session: { id: 9, session_date: '2099-01-15', title: 'Weekly session' },
    last_record: null,
    ...overrides,
  }
}

export function makeRecord(overrides: Partial<HistoryRecord> = {}): HistoryRecord {
  return {
    id: 1,
    session_id: 1,
    session_date: '2026-02-05',
    title: 'Week 1',
    status: 'PASSED',
    part_index: 9,
    hizb: 2,
    part: 1,
    excuse_note: null,
    admin_note: null,
    ...overrides,
  }
}

export const timeline = {
  start_index: 9,
  points: [
    { session_date: '2026-01-01', current_index: 9, status: null },
    { session_date: '2026-02-05', current_index: 10, status: 'PASSED' },
  ],
}

export const adminUser = makeUser({ id: 99, login: 'boss', role: 'ADMIN', full_name: 'Club Admin' })

export function makeAdminStudent(overrides: Partial<AdminStudent> = {}): AdminStudent {
  return {
    id: 1,
    user_id: 2,
    login: 'student01',
    full_name: 'Youssef El Amrani',
    email: 'student01@example.com',
    preferred_lang: 'en',
    is_active: true,
    status: 'ACTIVE',
    start_index: 9,
    current_index: 13,
    joined_at: '2026-01-01',
    notes: null,
    position: { hizb: 2, part: 5 },
    progress_percent: 2.5,
    total_sessions: 6,
    passed: 4,
    attendance_rate: 0.8333,
    last_status: 'PASSED',
    ...overrides,
  }
}

export function pageOf<T>(items: T[], total = items.length, page = 1, pageSize = 15) {
  return { body: { items, total, page, page_size: pageSize } }
}

export function makeSession(overrides: Partial<AdminSession> = {}): AdminSession {
  return {
    id: 1,
    session_date: '2026-02-05',
    title: 'Week 1',
    notes: null,
    is_cancelled: false,
    created_at: '2026-01-30 10:00:00',
    counts: { marked: 0, passed: 0, not_passed: 0, absent: 0, absent_excused: 0 },
    ...overrides,
  }
}

export function makeSheetStudent(overrides: Partial<SheetStudent> = {}): SheetStudent {
  return {
    student_id: 11,
    user_id: 21,
    login: 'amine',
    full_name: 'Amine Zahiri',
    student_status: 'ACTIVE',
    current_index: 9,
    part_index: 9,
    hizb: 2,
    part: 1,
    record: null,
    ...overrides,
  }
}

export function makeSheet(overrides: Partial<SessionDetail> = {}): SessionDetail {
  const students = overrides.students ?? [
    makeSheetStudent(),
    makeSheetStudent({
      student_id: 12, login: 'bilal', full_name: 'Bilal Alami', part_index: 12, hizb: 2, part: 4,
      record: { id: 101, status: 'PASSED', excuse_note: null, admin_note: 'Great', updated_at: '2026-02-05 12:00:00' },
    }),
    makeSheetStudent({
      student_id: 13, login: 'chaima', full_name: 'Chaima Benjelloun', part_index: 20, hizb: 3, part: 4,
      record: { id: 102, status: 'ABSENT_EXCUSED', excuse_note: 'Sick', admin_note: null, updated_at: '2026-02-05 12:00:00' },
    }),
  ]
  return {
    session: makeSession({ counts: { marked: 2, passed: 1, not_passed: 0, absent: 0, absent_excused: 1 } }),
    students,
    unmarked: students.filter((st) => st.record === null).length,
    ...overrides,
  }
}
