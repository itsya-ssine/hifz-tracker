import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { adminUser, makeSession, makeSheet, makeSheetStudent, mockApi, pageOf } from './mock-api'
import { renderApp } from './render-app'

const me = { 'GET /auth/me': { body: adminUser } }

function group(name: string) {
  return screen.getByRole('group', { name: `Result for ${name}` })
}

async function setup(extra: Record<string, unknown> = {}, sheet = makeSheet()) {
  const user = userEvent.setup()
  const api = mockApi({
    ...me,
    'GET /admin/sessions/1': { body: sheet },
    'GET /admin/students': pageOf([]),
    'PUT /admin/sessions/1/attendance': {
      body: { created: 1, updated: 0, unchanged: 0, detail: sheet },
    },
    ...extra,
  } as Parameters<typeof mockApi>[0])
  const view = renderApp('/admin/sessions/1')
  await screen.findByRole('heading', { name: 'Week 1' })
  return { user, ...api, ...view }
}

describe('attendance sheet', () => {
  it('shows each student with the part to evaluate and the saved result', async () => {
    await setup()
    expect(screen.getByText('Amine Zahiri')).toBeInTheDocument()
    expect(screen.getAllByText('Hizb 2 · Part 1')).not.toHaveLength(0)
    expect(screen.getByText('Hizb 3 · Part 4')).toBeInTheDocument()

    expect(within(group('Bilal Alami')).getByRole('radio', { name: 'Passed' })).toBeChecked()
    expect(within(group('Chaima Benjelloun')).getByRole('radio', { name: 'Excused absence' })).toBeChecked()
    expect(within(group('Amine Zahiri')).getAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true)
    expect(screen.getByDisplayValue('Sick')).toBeInTheDocument() // saved excuse reason
    expect(screen.getByDisplayValue('Great')).toBeInTheDocument() // saved note

    const summary = screen.getByRole('list', { name: 'Attendance summary' })
    expect(within(summary).getByText('Unmarked').parentElement).toHaveTextContent('Unmarked1')
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save attendance' })).toBeDisabled()
  })

  it('marks a student and saves only what changed', async () => {
    const { user, bodies } = await setup()
    await user.click(within(group('Amine Zahiri')).getByRole('radio', { name: 'Passed' }))

    expect(screen.getByText('Unsaved changes: 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save attendance' }))

    await waitFor(() => expect(bodies['PUT /admin/sessions/1/attendance']).toHaveLength(1))
    expect(bodies['PUT /admin/sessions/1/attendance'][0]).toEqual({
      records: [{ student_id: 11, status: 'PASSED', excuse_note: null, admin_note: null }],
    })
    expect(await screen.findByText('Attendance saved: 1 new, 0 updated')).toBeInTheDocument()
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
  })

  it('records an excuse reason and a note', async () => {
    const { user, bodies } = await setup()
    await user.click(within(group('Amine Zahiri')).getByRole('radio', { name: 'Excused absence' }))
    await user.type(screen.getByLabelText('Reason for the absence — Amine Zahiri'), ' Exam ')
    await user.click(screen.getByRole('button', { name: 'Add a note — Amine Zahiri' }))
    await user.type(screen.getByLabelText('Note — Amine Zahiri'), 'Call his father')
    await user.click(screen.getByRole('button', { name: 'Save attendance' }))

    await waitFor(() => expect(bodies['PUT /admin/sessions/1/attendance']).toHaveLength(1))
    expect(bodies['PUT /admin/sessions/1/attendance'][0]).toEqual({
      records: [{ student_id: 11, status: 'ABSENT_EXCUSED', excuse_note: 'Exam', admin_note: 'Call his father' }],
    })
  })

  it('corrects an existing result, and going back to the saved value is not a change', async () => {
    const { user, bodies } = await setup()
    const bilal = group('Bilal Alami')
    await user.click(within(bilal).getByRole('radio', { name: 'Not passed' }))
    expect(screen.getByText('Unsaved changes: 1')).toBeInTheDocument()

    await user.click(within(bilal).getByRole('radio', { name: 'Passed' }))
    expect(screen.getByText('All changes saved')).toBeInTheDocument()

    await user.click(within(bilal).getByRole('radio', { name: 'Absent' }))
    await user.click(screen.getByRole('button', { name: 'Save attendance' }))
    await waitFor(() => expect(bodies['PUT /admin/sessions/1/attendance']).toHaveLength(1))
    expect(bodies['PUT /admin/sessions/1/attendance'][0]).toEqual({
      records: [{ student_id: 12, status: 'ABSENT', excuse_note: null, admin_note: 'Great' }],
    })
  })

  it('clears a new mark and discards all changes', async () => {
    const { user, calls } = await setup()
    await user.click(within(group('Amine Zahiri')).getByRole('radio', { name: 'Passed' }))
    await user.click(screen.getByRole('button', { name: 'Clear — Amine Zahiri' }))
    expect(screen.getByText('All changes saved')).toBeInTheDocument()

    await user.click(within(group('Amine Zahiri')).getByRole('radio', { name: 'Absent' }))
    await user.click(within(group('Bilal Alami')).getByRole('radio', { name: 'Absent' }))
    expect(screen.getByText('Unsaved changes: 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
    expect(within(group('Bilal Alami')).getByRole('radio', { name: 'Passed' })).toBeChecked()
    expect(calls).not.toContain('PUT /admin/sessions/1/attendance')
  })

  it('marks all unmarked students that are shown', async () => {
    const students = [
      makeSheetStudent({ student_id: 11, login: 'amine', full_name: 'Amine Zahiri' }),
      makeSheetStudent({ student_id: 14, login: 'driss', full_name: 'Driss Fassi' }),
      makeSheetStudent({
        student_id: 12, login: 'bilal', full_name: 'Bilal Alami',
        record: { id: 101, status: 'PASSED', excuse_note: null, admin_note: null, updated_at: '2026-02-05 12:00:00' },
      }),
    ]
    const { user, bodies } = await setup({}, makeSheet({ students, unmarked: 2 }))

    // Only the students matching the search are affected.
    await user.type(screen.getByLabelText('Search'), 'amine')
    await user.selectOptions(screen.getByLabelText('Mark the unmarked students shown as…'), 'ABSENT')
    await user.clear(screen.getByLabelText('Search'))
    expect(screen.getByText('Unsaved changes: 1')).toBeInTheDocument()
    expect(within(group('Amine Zahiri')).getByRole('radio', { name: 'Absent' })).toBeChecked()
    expect(within(group('Driss Fassi')).getAllByRole('radio').some((r) => (r as HTMLInputElement).checked)).toBe(false)
    expect(within(group('Bilal Alami')).getByRole('radio', { name: 'Passed' })).toBeChecked() // saved result untouched

    await user.selectOptions(screen.getByLabelText('Mark the unmarked students shown as…'), 'PASSED')
    expect(screen.getByText('Unsaved changes: 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save attendance' }))
    await waitFor(() => expect(bodies['PUT /admin/sessions/1/attendance']).toHaveLength(1))
    const sent = (bodies['PUT /admin/sessions/1/attendance'][0] as { records: { student_id: number; status: string }[] }).records
    expect(sent.map((r) => [r.student_id, r.status]).sort()).toEqual([[11, 'ABSENT'], [14, 'PASSED']])
  })

  it('filters by name and by marked state', async () => {
    const { user } = await setup()
    await user.selectOptions(screen.getByLabelText('Show'), 'Unmarked')
    expect(screen.getByText('Amine Zahiri')).toBeInTheDocument()
    expect(screen.queryByText('Bilal Alami')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Show'), 'Marked')
    expect(screen.queryByText('Amine Zahiri')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Search'), 'zzz')
    expect(await screen.findByText('No students match your search.')).toBeInTheDocument()
  })

  it('keeps the draft and explains the problem when saving fails', async () => {
    const { user } = await setup({
      'PUT /admin/sessions/1/attendance': {
        status: 400, body: { detail: 'x', code: 'STUDENT_NOT_ELIGIBLE' },
      },
    })
    await user.click(within(group('Amine Zahiri')).getByRole('radio', { name: 'Passed' }))
    await user.click(screen.getByRole('button', { name: 'Save attendance' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Some students are not on this session')
    expect(screen.getByText('Unsaved changes: 1')).toBeInTheDocument()
    expect(within(group('Amine Zahiri')).getByRole('radio', { name: 'Passed' })).toBeChecked()
  })

  it('blocks attendance on a cancelled session', async () => {
    await setup({}, makeSheet({ session: makeSession({ is_cancelled: true }) }))
    expect(screen.getByText(/This session was cancelled/)).toBeInTheDocument()
    // The radios are disabled through their <fieldset>, which toBeDisabled() understands.
    for (const radio of within(group('Amine Zahiri')).getAllByRole('radio')) expect(radio).toBeDisabled()
    expect(screen.getByLabelText('Mark the unmarked students shown as…')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save attendance' })).toBeDisabled()
  })

  it('shows an empty state when nobody is on the sheet', async () => {
    await setup({}, makeSheet({ students: [], unmarked: 0 }))
    expect(screen.getByText(/No students are on this session's sheet yet/)).toBeInTheDocument()
  })

  it('shows a friendly message for an unknown session', async () => {
    mockApi({ ...me, 'GET /admin/sessions/9': { status: 404, body: { detail: 'x', code: 'SESSION_NOT_FOUND' } } })
    renderApp('/admin/sessions/9')
    expect(await screen.findByText('This session does not exist.')).toBeInTheDocument()
  })

  it('renders in Arabic with the right wording', async () => {
    await i18n.changeLanguage('ar')
    mockApi({
      'GET /auth/me': { body: { ...adminUser, preferred_lang: 'ar' } },
      'GET /admin/sessions/1': { body: makeSheet() },
    })
    renderApp('/admin/sessions/1')
    expect((await screen.findAllByText(/الثمن المطلوب تسميعه/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'حفظ الحضور' })).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('rtl')
  })
})

describe('leaving with unsaved changes', () => {
  it('asks for confirmation and lets the admin stay', async () => {
    const { user, router } = await setup()
    await user.click(within(group('Amine Zahiri')).getByRole('radio', { name: 'Passed' }))
    await user.click(screen.getByRole('link', { name: 'Students' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Leave without saving?')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/admin/sessions/1')
    expect(screen.getByText('Unsaved changes: 1')).toBeInTheDocument()
  })

  it('discards the changes when the admin confirms leaving', async () => {
    const { user, router } = await setup()
    await user.click(within(group('Amine Zahiri')).getByRole('radio', { name: 'Passed' }))
    await user.click(screen.getByRole('link', { name: 'Students' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Leave' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/students'))
  })

  it('does not ask when everything is saved', async () => {
    const { user, router } = await setup()
    await user.click(screen.getByRole('link', { name: 'Students' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/students'))
    expect(screen.queryByText('Leave without saving?')).not.toBeInTheDocument()
  })
})

describe('session settings', () => {
  it('edits the title and notes', async () => {
    const { user, bodies } = await setup({ 'PATCH /admin/sessions/1': { body: makeSession() } })
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const dialog = await screen.findByRole('dialog')
    const title = within(dialog).getByLabelText('Title (optional)')
    await user.clear(title)
    await user.type(title, 'Week 1 (exams)')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(bodies['PATCH /admin/sessions/1']).toHaveLength(1))
    expect(bodies['PATCH /admin/sessions/1'][0]).toEqual({ title: 'Week 1 (exams)' })
  })

  it('cannot move, cancel or delete a session that has records', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Date')).toBeDisabled()
    expect(within(dialog).getByLabelText('Cancel this session')).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Delete session' })).toBeDisabled()
  })

  it('deletes an empty session after confirmation and returns to the list', async () => {
    const empty = makeSheet({ students: [makeSheetStudent()], unmarked: 1, session: makeSession() })
    const { user, calls, router } = await setup(
      { 'DELETE /admin/sessions/1': { status: 204 }, 'GET /admin/sessions': pageOf([]) },
      empty,
    )
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete session' }))
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!
    expect(calls).not.toContain('DELETE /admin/sessions/1')
    await user.click(within(confirm).getByRole('button', { name: 'Delete session' }))

    await waitFor(() => expect(calls).toContain('DELETE /admin/sessions/1'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/sessions'))
  })
})
