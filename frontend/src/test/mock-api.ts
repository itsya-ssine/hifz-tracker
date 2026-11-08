import { vi } from 'vitest'
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
    const route = routes[key]
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
