import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { pickFocusSession } from '../features/admin/sessions/session-state'
import { adminUser, makeSession, mockApi, pageOf } from './mock-api'
import { renderApp } from './render-app'

const iso = (offsetDays: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

const counts = (marked: number) => ({ marked, passed: marked, not_passed: 0, absent: 0, absent_excused: 0 })

describe('pickFocusSession', () => {
  const today = makeSession({ id: 1, session_date: iso(0) })
  const pastUnmarked = makeSession({ id: 2, session_date: iso(-7) })
  const pastDone = makeSession({ id: 3, session_date: iso(-14), counts: counts(5) })
  const soon = makeSession({ id: 4, session_date: iso(3) })
  const later = makeSession({ id: 5, session_date: iso(10) })

  it("prefers today's session", () => {
    expect(pickFocusSession([later, soon, today, pastUnmarked])?.id).toBe(1)
  })
  it('then the latest past session that still has no attendance', () => {
    expect(pickFocusSession([later, soon, pastUnmarked, pastDone])?.id).toBe(2)
  })
  it('then the nearest upcoming session', () => {
    expect(pickFocusSession([later, soon, pastDone])?.id).toBe(4)
  })
  it('ignores cancelled sessions and returns null when nothing is left', () => {
    expect(pickFocusSession([makeSession({ id: 9, session_date: iso(0), is_cancelled: true })])).toBeNull()
    expect(pickFocusSession([pastDone])).toBeNull()
    expect(pickFocusSession([])).toBeNull()
  })
})

describe('admin dashboard', () => {
  const baseRoutes = {
    'GET /auth/me': { body: adminUser },
    'GET /admin/students?page=1&page_size=1': pageOf([], 24, 1, 1),
    'GET /admin/students?status=ACTIVE&page=1&page_size=1': pageOf([], 19, 1, 1),
    'GET /admin/students?status=COMPLETED&page=1&page_size=1': pageOf([], 3, 1, 1),
  }

  it('shows club numbers, the session needing attendance and recent sessions', async () => {
    mockApi({
      ...baseRoutes,
      'GET /admin/sessions': pageOf(
        [
          makeSession({ id: 8, session_date: iso(-7), title: 'Last week' }),
          makeSession({ id: 7, session_date: iso(-14), title: 'Two weeks ago', counts: counts(12) }),
        ],
        2, 1, 10,
      ),
    })
    renderApp('/admin')

    expect(await screen.findByRole('heading', { name: /Hello, Club Admin/ })).toBeInTheDocument()
    const students = (await screen.findByText('Students', { selector: 'div' })).closest('div')!.parentElement!
    await within(students).findByText('24')
    expect(screen.getByText('Active').closest('div')!.parentElement).toHaveTextContent('19')
    expect(screen.getByText('Completed the Quran').closest('div')!.parentElement).toHaveTextContent('3')

    expect(await screen.findByText('Attendance still to record')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open attendance sheet' })).toHaveAttribute('href', '/admin/sessions/8')
    const recent = screen.getByText('Recent sessions').closest('div')!.parentElement!
    expect(within(recent).getByText('Two weeks ago')).toBeInTheDocument()
    expect(within(recent).getByText('Passed')).toBeInTheDocument()
  })

  it('suggests creating a session when none needs attendance', async () => {
    mockApi({ ...baseRoutes, 'GET /admin/sessions': pageOf([], 0, 1, 10) })
    renderApp('/admin')
    expect(await screen.findByText(/No session needs attendance right now/)).toBeInTheDocument()
    expect(screen.getByText('No sessions yet. Create the first one to start taking attendance.')).toBeInTheDocument()
  })

  it('offers a retry when sessions fail to load', async () => {
    const user = userEvent.setup()
    let calls = 0
    mockApi({
      ...baseRoutes,
      'GET /admin/sessions': () =>
        ++calls === 1 ? { status: 500, body: { detail: 'x', code: 'HTTP_500' } } : pageOf([], 0, 1, 10),
    })
    renderApp('/admin')
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the sessions.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/No session needs attendance right now/)).toBeInTheDocument()
  })

  it('creates a session from the dashboard', async () => {
    const user = userEvent.setup()
    mockApi({ ...baseRoutes, 'GET /admin/sessions': pageOf([], 0, 1, 10) })
    renderApp('/admin')
    await user.click(await screen.findByRole('button', { name: 'New session' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
