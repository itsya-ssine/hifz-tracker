import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { makeOverview, makeRecord, makeUser, mockApi, timeline } from './mock-api'
import { renderApp } from './render-app'

const me = { 'GET /auth/me': { body: makeUser() } }

describe('student dashboard', () => {
  it('shows the current position, progress and stats', async () => {
    mockApi({ ...me, 'GET /me/overview': { body: makeOverview() }, 'GET /me/progress-timeline': { body: timeline } })
    renderApp('/student')

    expect(await screen.findByRole('heading', { name: 'Hizb 2 · Part 5' })).toBeInTheDocument()
    expect(screen.getByText('12 of 480 parts memorized')).toBeInTheDocument()
    expect(screen.getByText('Parts passed since you joined: 4')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '2.5%' })).toBeInTheDocument()

    const attendance = screen.getByText('Attendance rate').closest('div')!.parentElement!
    expect(within(attendance).getByText('83%')).toBeInTheDocument()
    expect(within(attendance).getByText('Excluding excused absences: 100%')).toBeInTheDocument()
    expect(screen.getByText('Current streak').closest('div')!.parentElement).toHaveTextContent('2')
    expect(screen.getByText('Weekly session')).toBeInTheDocument()
  })

  it('draws the Quran map with the right number of memorized parts per hizb', async () => {
    mockApi({ ...me, 'GET /me/overview': { body: makeOverview() }, 'GET /me/progress-timeline': { body: timeline } })
    renderApp('/student')

    // current_index 13 -> hizb 1 fully memorized (8/8), hizb 2 has 4 done and is the current one.
    expect(await screen.findByLabelText('Hizb 1: 8 of 8 parts memorized')).toBeInTheDocument()
    expect(screen.getByLabelText('Hizb 2: 4 of 8 parts memorized')).toBeInTheDocument()
    expect(screen.getByLabelText('Hizb 3: 0 of 8 parts memorized')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').filter((li) => li.getAttribute('aria-label')?.startsWith('Hizb'))).toHaveLength(60)
  })

  it('celebrates a completed Quran', async () => {
    mockApi({
      ...me,
      'GET /me/overview': {
        body: makeOverview({
          completed: true,
          position: null,
          student: { id: 1, status: 'COMPLETED', start_index: 478, current_index: 481, joined_at: '2026-01-01' },
          progress: { completed_parts: 480, total_parts: 480, percent: 100, parts_gained: 3 },
        }),
      },
      'GET /me/progress-timeline': { body: timeline },
    })
    renderApp('/student')
    expect(await screen.findByText('Alhamdulillah, you completed the whole Quran!')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '100%' })).toBeInTheDocument()
  })

  it('shows an encouraging empty state before the first session', async () => {
    mockApi({
      ...me,
      'GET /me/overview': {
        body: makeOverview({
          stats: {
            total_sessions: 0, passed: 0, not_passed: 0, absent: 0, absent_excused: 0,
            attendance_rate: null, adjusted_attendance_rate: null, current_streak: 0,
          },
          next_session: null,
        }),
      },
    })
    renderApp('/student')
    expect(await screen.findByText('Your first session is coming up')).toBeInTheDocument()
    expect(screen.getByText('No session scheduled yet')).toBeInTheDocument()
    expect(screen.queryByText('Progress over time')).not.toBeInTheDocument()
  })

  it('offers a retry when loading fails', async () => {
    const user = userEvent.setup()
    let calls = 0
    mockApi({
      ...me,
      'GET /me/overview': () =>
        ++calls === 1 ? { status: 500, body: { detail: 'boom', code: 'HTTP_500' } } : { body: makeOverview() },
      'GET /me/progress-timeline': { body: timeline },
    })
    renderApp('/student')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your progress.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Hizb 2 · Part 5' })).toBeInTheDocument()
  })

  it('renders in Arabic with the eighth-of-a-hizb wording', async () => {
    await i18n.changeLanguage('ar')
    mockApi({
      'GET /auth/me': { body: makeUser({ preferred_lang: 'ar' }) },
      'GET /me/overview': { body: makeOverview() },
      'GET /me/progress-timeline': { body: timeline },
    })
    renderApp('/student')
    expect(await screen.findByRole('heading', { name: 'الحزب 2 · الثمن 5' })).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('rtl')
    expect(screen.getByText('تحفظ حاليًا')).toBeInTheDocument()
  })
})

describe('student history', () => {
  const page = (items: ReturnType<typeof makeRecord>[], total = items.length, pageNumber = 1) => ({
    body: { items, total, page: pageNumber, page_size: 10 },
  })

  it('lists sessions with status, part and notes', async () => {
    mockApi({
      ...me,
      'GET /me/history': page([
        makeRecord({ id: 2, session_date: '2026-02-12', status: 'ABSENT_EXCUSED', excuse_note: 'Sick' }),
        makeRecord({ id: 1, admin_note: 'Excellent tajweed' }),
      ]),
    })
    renderApp('/student/history')

    expect(await screen.findByRole('heading', { name: 'Session history' })).toBeInTheDocument()
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Excused absence')).toBeInTheDocument()
    expect(within(table).getByText('Passed')).toBeInTheDocument()
    expect(within(table).getByText('Sick')).toBeInTheDocument()
    expect(within(table).getByText('Excellent tajweed')).toBeInTheDocument()
    expect(within(table).getAllByText('Hizb 2 · Part 1')).toHaveLength(2)
    expect(within(table).getByText('12 Feb 2026')).toBeInTheDocument()
  })

  it('filters by status and goes back to page 1', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi({ ...me, 'GET /me/history': page([makeRecord()]) })
    renderApp('/student/history')

    await screen.findByRole('table')
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'ABSENT')
    await waitFor(() => expect(calls).toContain('GET /me/history?page=1&page_size=10&status=ABSENT'))
  })

  it('paginates', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi({
      ...me,
      'GET /me/history?page=1&page_size=10': page([makeRecord()], 25, 1),
      'GET /me/history?page=2&page_size=10': page([makeRecord({ id: 2, title: 'Week 11' })], 25, 2),
    })
    renderApp('/student/history')

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(calls).toContain('GET /me/history?page=2&page_size=10'))
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()
  })

  it('shows empty states', async () => {
    mockApi({ ...me, 'GET /me/history': page([]) })
    renderApp('/student/history')
    expect(await screen.findByText('No sessions recorded yet.')).toBeInTheDocument()
  })

  it('is reachable from the navigation bar', async () => {
    const user = userEvent.setup()
    mockApi({
      ...me,
      'GET /me/overview': { body: makeOverview() },
      'GET /me/progress-timeline': { body: timeline },
      'GET /me/history': page([makeRecord()]),
    })
    renderApp('/student')
    await user.click(await screen.findByRole('link', { name: 'History' }))
    expect(await screen.findByRole('heading', { name: 'Session history' })).toBeInTheDocument()
  })
})
