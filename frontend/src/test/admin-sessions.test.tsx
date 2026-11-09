import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { adminUser, makeSession, mockApi, pageOf } from './mock-api'
import { renderApp } from './render-app'

const me = { 'GET /auth/me': { body: adminUser } }

const sessions = [
  makeSession({ id: 3, session_date: '2099-03-05', title: 'Future week' }),
  makeSession({
    id: 2, session_date: '2026-02-12', title: 'Week 2',
    counts: { marked: 4, passed: 2, not_passed: 1, absent: 1, absent_excused: 0 },
  }),
  makeSession({ id: 1, session_date: '2026-02-05', title: null, is_cancelled: true }),
]

describe('sessions page', () => {
  it('lists sessions with their state and results', async () => {
    mockApi({ ...me, 'GET /admin/sessions': pageOf(sessions) })
    renderApp('/admin/sessions')

    const table = await screen.findByRole('table')
    const future = within(table).getByText('Future week').closest('tr')!
    expect(within(future).getByText('Upcoming')).toBeInTheDocument()
    expect(within(future).getByText('No attendance recorded yet')).toBeInTheDocument()

    const week2 = within(table).getByText('Week 2').closest('tr')!
    expect(within(week2).getByText('Past')).toBeInTheDocument()
    expect(within(week2).getByText('Passed')).toBeInTheDocument()
    expect(within(week2).getByText('Absent')).toBeInTheDocument()
    expect(within(week2).queryByText('Excused absence')).not.toBeInTheDocument() // zero counts are hidden

    expect(within(table).getByText('Cancelled')).toBeInTheDocument()
    expect(within(table).getByRole('link', { name: 'Open the attendance sheet of 12 Feb 2026' })).toHaveAttribute(
      'href',
      '/admin/sessions/2',
    )
  })

  it('shows the empty state', async () => {
    mockApi({ ...me, 'GET /admin/sessions': pageOf([]) })
    renderApp('/admin/sessions')
    expect(await screen.findByText(/No sessions yet/)).toBeInTheDocument()
  })

  it('creates a session and opens its attendance sheet', async () => {
    const user = userEvent.setup()
    const { bodies } = mockApi({
      ...me,
      'GET /admin/sessions': pageOf(sessions),
      'POST /admin/sessions': { status: 201, body: makeSession({ id: 7, session_date: '2026-03-12' }) },
      'GET /admin/sessions/7': { body: { session: makeSession({ id: 7, session_date: '2026-03-12' }), students: [], unmarked: 0 } },
    })
    const { router } = renderApp('/admin/sessions')

    await user.click(await screen.findByRole('button', { name: 'New session' }))
    const dialog = await screen.findByRole('dialog')
    const date = within(dialog).getByLabelText('Date')
    await user.clear(date)
    await user.type(date, '2026-03-12')
    await user.type(within(dialog).getByLabelText('Title (optional)'), '  Week 6 ')
    await user.click(within(dialog).getByRole('button', { name: 'Create session' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/sessions/7'))
    expect(bodies['POST /admin/sessions'][0]).toEqual({ session_date: '2026-03-12', title: 'Week 6', notes: null })
  })

  it('reports a date that is already taken next to the field', async () => {
    const user = userEvent.setup()
    mockApi({
      ...me,
      'GET /admin/sessions': pageOf(sessions),
      'POST /admin/sessions': { status: 409, body: { detail: 'x', code: 'SESSION_DATE_TAKEN' } },
    })
    renderApp('/admin/sessions')
    await user.click(await screen.findByRole('button', { name: 'New session' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Create session' }))
    expect(await within(dialog).findByText('A session already exists on this date.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Date')).toBeInvalid()
  })
})
