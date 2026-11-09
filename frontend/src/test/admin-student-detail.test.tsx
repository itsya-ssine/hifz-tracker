import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { adminUser, makeAdminStudent, makeOverview, makeRecord, mockApi, pageOf, timeline } from './mock-api'
import { renderApp } from './render-app'

const student = makeAdminStudent({ notes: 'Memorizes best in the morning' })

const auditEntries = [
  {
    id: 3, actor_id: 99, actor_name: 'Club Admin', action: 'ATTENDANCE_UPDATED', entity: 'attendance_record',
    entity_id: 5, student_id: 1, created_at: '2026-02-06 10:00:00',
    old_value: { session_date: '2026-02-05', status: 'PASSED' },
    new_value: { session_date: '2026-02-05', status: 'NOT_PASSED' },
  },
  {
    id: 2, actor_id: 99, actor_name: 'Club Admin', action: 'STUDENT_UPDATED', entity: 'student',
    entity_id: 1, student_id: 1, created_at: '2026-02-05 09:00:00',
    old_value: { status: 'ACTIVE' }, new_value: { status: 'PAUSED' },
  },
  {
    id: 1, actor_id: 99, actor_name: null, action: 'STUDENT_CREATED', entity: 'student',
    entity_id: 1, student_id: 1, created_at: '2026-01-01 08:00:00', old_value: null, new_value: { login: 'student01' },
  },
]

function routes(overrides: Record<string, unknown> = {}) {
  return {
    'GET /auth/me': { body: adminUser },
    'GET /admin/students/1': { body: { student, overview: makeOverview() } },
    'GET /admin/students/1/progress-timeline': { body: timeline },
    'GET /admin/students/1/history': pageOf([makeRecord({ id: 5, admin_note: 'Fluent' })], 1, 1, 10),
    'GET /admin/students/1/audit': pageOf(auditEntries, 3, 1, 8),
    ...overrides,
  } as Parameters<typeof mockApi>[0]
}

describe('admin student detail', () => {
  it('shows progress, profile, history and the readable audit trail', async () => {
    mockApi(routes())
    renderApp('/admin/students/1')

    expect(await screen.findByRole('heading', { name: 'Youssef El Amrani', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hizb 2 · Part 5' })).toBeInTheDocument()
    expect(screen.getByText('Parts passed since joining: 4')).toBeInTheDocument()
    expect(screen.getByText('Memorizes best in the morning')).toBeInTheDocument()
    expect(screen.getByText('student01@example.com')).toBeInTheDocument()

    expect(await screen.findAllByText('Fluent')).not.toHaveLength(0)
    expect(await screen.findByText('Changed the session of 5 Feb 2026 from Passed to Not passed')).toBeInTheDocument()
    expect(screen.getByText('Profile updated — Status: Active → Paused')).toBeInTheDocument()
    expect(screen.getByText('Student account created')).toBeInTheDocument()
    expect(screen.getAllByText(/Club Admin ·/)).toHaveLength(2)
    expect(screen.getByText(/System ·/)).toBeInTheDocument()
  })

  it('shows a friendly message for an unknown student', async () => {
    mockApi({
      'GET /auth/me': { body: adminUser },
      'GET /admin/students/9': { status: 404, body: { detail: 'nope', code: 'STUDENT_NOT_FOUND' } },
    })
    renderApp('/admin/students/9')
    expect(await screen.findByText('This student does not exist.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to students' })).toBeInTheDocument()
  })

  it('renders in Arabic', async () => {
    await i18n.changeLanguage('ar')
    mockApi(routes({ 'GET /auth/me': { body: { ...adminUser, preferred_lang: 'ar' } } }))
    renderApp('/admin/students/1')
    expect(await screen.findByRole('heading', { name: 'الحزب 2 · الثمن 5' })).toBeInTheDocument()
    expect(await screen.findByText('سجلّ التغييرات')).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('rtl')
  })
})

describe('editing a student', () => {
  async function openEdit(overrides: Record<string, unknown> = {}) {
    const user = userEvent.setup()
    const api = mockApi(routes({ 'PATCH /admin/students/1': { body: student }, ...overrides }))
    renderApp('/admin/students/1')
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    return { user, ...api, dialog: await screen.findByRole('dialog') }
  }

  it('sends only the fields that changed', async () => {
    const { user, bodies, dialog } = await openEdit()
    const name = within(dialog).getByLabelText('Full name')
    await user.clear(name)
    await user.type(name, 'Youssef Amrani')
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'PAUSED')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(bodies['PATCH /admin/students/1']).toHaveLength(1))
    expect(bodies['PATCH /admin/students/1'][0]).toEqual({ full_name: 'Youssef Amrani', status: 'PAUSED' })
    expect(await screen.findByText('Student updated')).toBeInTheDocument()
  })

  it('does nothing when nothing changed', async () => {
    const { user, calls, dialog } = await openEdit()
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).not.toContain('PATCH /admin/students/1')
  })

  it('corrects the current position', async () => {
    const { user, bodies, dialog } = await openEdit()
    await user.selectOptions(within(dialog).getByLabelText('Hizb'), '7')
    await user.selectOptions(within(dialog).getByLabelText('Part'), '3')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(bodies['PATCH /admin/students/1']).toHaveLength(1))
    expect(bodies['PATCH /admin/students/1'][0]).toEqual({ position: { hizb: 7, part: 3 } })
  })

  it('explains why a position cannot be applied', async () => {
    const { user, dialog } = await openEdit({
      'PATCH /admin/students/1': { status: 400, body: { detail: 'x', code: 'INVALID_POSITION' } },
    })
    await user.selectOptions(within(dialog).getByLabelText('Hizb'), '1')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('behind the passes already recorded')
  })

  it('validates the name', async () => {
    const { user, calls, dialog } = await openEdit()
    await user.clear(within(dialog).getByLabelText('Full name'))
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await within(dialog).findByText("Enter the student's full name.")).toBeInTheDocument()
    expect(calls).not.toContain('PATCH /admin/students/1')
  })

  it('locks the status of a student who completed the Quran', async () => {
    const done = makeAdminStudent({ status: 'COMPLETED', position: null, current_index: 481 })
    const user = userEvent.setup()
    mockApi(routes({
      'GET /admin/students/1': { body: { student: done, overview: makeOverview({ completed: true, position: null }) } },
    }))
    renderApp('/admin/students/1')
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Status')).toBeDisabled()
    expect(within(dialog).queryByText('Correct current position')).not.toBeInTheDocument()
  })
})

describe('resetting a password', () => {
  it('asks for confirmation, then shows the new temporary password once', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi(routes({
      'POST /admin/students/1/reset-password': { body: { temporary_password: 'Fresh-Temp-42' } },
    }))
    renderApp('/admin/students/1')

    await user.click(await screen.findByRole('button', { name: 'Reset password' }))
    const confirm = await screen.findByRole('dialog')
    expect(within(confirm).getByText(/current password stops working/)).toBeInTheDocument()
    expect(calls).not.toContain('POST /admin/students/1/reset-password')
    await user.click(within(confirm).getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('Fresh-Temp-42')).toBeInTheDocument()
    expect(screen.getByText('New temporary password')).toBeInTheDocument()
  })
})

describe('correcting attendance records', () => {
  it('edits the status and notes of a record', async () => {
    const user = userEvent.setup()
    const { bodies } = mockApi(routes({ 'PATCH /admin/attendance/5': { body: {} } }))
    renderApp('/admin/students/1')

    await user.click((await screen.findAllByRole('button', { name: 'Edit the record of 5 Feb 2026' }))[0])
    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'ABSENT_EXCUSED')
    await user.type(within(dialog).getByLabelText('Reason for the absence'), 'Sick')
    await user.click(within(dialog).getByRole('button', { name: 'Save correction' }))

    await waitFor(() => expect(bodies['PATCH /admin/attendance/5']).toHaveLength(1))
    expect(bodies['PATCH /admin/attendance/5'][0]).toEqual({
      status: 'ABSENT_EXCUSED', excuse_note: 'Sick', admin_note: 'Fluent',
    })
    expect(await screen.findByText('Attendance record updated')).toBeInTheDocument()
  })

  it('deletes a record after confirmation', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi(routes({ 'DELETE /admin/attendance/5': { status: 204 } }))
    renderApp('/admin/students/1')

    await user.click((await screen.findAllByRole('button', { name: 'Delete the record of 5 Feb 2026' }))[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/progress is recalculated/)).toBeInTheDocument()
    expect(calls).not.toContain('DELETE /admin/attendance/5')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(calls).toContain('DELETE /admin/attendance/5'))
    expect(await screen.findByText('Attendance record deleted')).toBeInTheDocument()
  })

  it('keeps the dialog open and explains a failed deletion', async () => {
    const user = userEvent.setup()
    mockApi(routes({
      'DELETE /admin/attendance/5': { status: 404, body: { detail: 'x', code: 'RECORD_NOT_FOUND' } },
    }))
    renderApp('/admin/students/1')
    await user.click((await screen.findAllByRole('button', { name: 'Delete the record of 5 Feb 2026' }))[0])
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Attendance record not found.')
  })
})
