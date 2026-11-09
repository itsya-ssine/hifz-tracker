import { vi } from 'vitest'
import type { HistoryRecord, Overview } from '../api/student'
import type { User } from '../api/types'

interface MockResponse {
  status?: number
  body?: unknown
}

/** Stub `fetch` with routes keyed as "METHOD /path" (path without the /api/v1 prefix). */
export function mockApi(routes: Record<string, MockResponse | (() => MockResponse)>) {
  const calls: string[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^.*\/api\/v1/, '')
    const key = `${init?.method ?? 'GET'} ${url}`
    calls.push(key)
    // Exact match (with query string) first, then the bare path.
    const route = routes[key] ?? routes[`${init?.method ?? 'GET'} ${url.split('?')[0]}`]
    const { status = 200, body } = typeof route === 'function' ? route() : (route ?? { status: 404 })
    return new Response(status === 204 ? null : JSON.stringify(body ?? {}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock }
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
