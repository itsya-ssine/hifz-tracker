import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { adminUser, makeAdminStudent, mockApi, pageOf } from './mock-api'
import { renderApp } from './render-app'

const me = { 'GET /auth/me': { body: adminUser } }

const students = [
  makeAdminStudent(),
  makeAdminStudent({
    id: 2, login: 'student02', full_name: 'Fatima Zahra Benali', status: 'PAUSED',
    position: { hizb: 5, part: 1 }, progress_percent: 6.5, attendance_rate: 0.5, last_status: 'ABSENT',
  }),
  makeAdminStudent({
    id: 3, login: 'student03', full_name: 'Omar Idrissi', status: 'COMPLETED', position: null,
    progress_percent: 100, attendance_rate: 1, last_status: null, is_active: false,
  }),
]

describe('admin students page', () => {
  it('lists students with position, progress, attendance and status', async () => {
    mockApi({ ...me, 'GET /admin/students': pageOf(students) })
    renderApp('/admin/students')

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Youssef El Amrani')).toBeInTheDocument()
    expect(within(table).getByText('Hizb 2 · Part 5')).toBeInTheDocument()
    expect(within(table).getByText('83%')).toBeInTheDocument()
    expect(within(table).getByText('Paused')).toBeInTheDocument()
    expect(within(table).getByText('Absent')).toBeInTheDocument()
    // The completed student has no current position and a disabled account.
    const row = within(table).getByText('Omar Idrissi').closest('tr')!
    expect(within(row).getByText('Finished the Quran')).toBeInTheDocument()
    expect(within(row).getByText('Completed')).toBeInTheDocument()
    expect(within(row).getByText(/account disabled/)).toBeInTheDocument()
    expect(screen.getByText('Total: 3')).toBeInTheDocument()
    expect(within(table).getByRole('link', { name: 'Youssef El Amrani' })).toHaveAttribute(
      'href',
      '/admin/students/1',
    )
  })

  it('filters, sorts and keeps the state in the URL', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi({ ...me, 'GET /admin/students': pageOf(students) })
    const view = renderApp('/admin/students')
    await screen.findByRole('table')

    await user.selectOptions(screen.getByLabelText('Status'), 'PAUSED')
    await waitFor(() => expect(calls.at(-1)).toContain('status=PAUSED'))
    await user.selectOptions(screen.getByLabelText('Current hizb'), '5')
    await waitFor(() => expect(calls.at(-1)).toContain('hizb=5'))
    await user.selectOptions(screen.getByLabelText('Sort by'), 'attendance')
    await user.click(screen.getByRole('button', { name: /Ascending/ }))
    await waitFor(() => {
      const last = calls.at(-1)!
      expect(last).toContain('sort=attendance')
      expect(last).toContain('order=desc')
    })
    expect(view.router.state.location.search).toContain('status=PAUSED')
    expect(view.router.state.location.search).toContain('hizb=5')
  })

  it('restores filters from the URL on load', async () => {
    const { calls } = mockApi({ ...me, 'GET /admin/students': pageOf(students) })
    renderApp('/admin/students?status=COMPLETED&sort=position&order=desc&page=2&q=omar')
    await screen.findByRole('table')
    const request = calls.find((c) => c.startsWith('GET /admin/students?'))!
    for (const part of ['status=COMPLETED', 'sort=position', 'order=desc', 'page=2', 'search=omar']) {
      expect(request).toContain(part)
    }
    expect(screen.getByLabelText('Status')).toHaveValue('COMPLETED')
    expect(screen.getByLabelText('Search')).toHaveValue('omar')
  })

  it('searches after a short pause', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi({ ...me, 'GET /admin/students': pageOf(students) })
    renderApp('/admin/students')
    await screen.findByRole('table')

    await user.type(screen.getByLabelText('Search'), 'fatima')
    await waitFor(() => expect(calls.at(-1)).toContain('search=fatima'), { timeout: 2000 })
    expect(calls.filter((c) => c.includes('search=')).every((c) => c.includes('search=fatima'))).toBe(true)
  })

  it('paginates', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi({ ...me, 'GET /admin/students': pageOf(students, 40) })
    renderApp('/admin/students')

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(calls.at(-1)).toContain('page=2'))
  })

  it('shows empty states', async () => {
    mockApi({ ...me, 'GET /admin/students': pageOf([]) })
    renderApp('/admin/students')
    expect(await screen.findByText(/No students yet/)).toBeInTheDocument()
  })

  it('shows an empty filtered state', async () => {
    mockApi({ ...me, 'GET /admin/students': pageOf([]) })
    renderApp('/admin/students?status=LEFT')
    expect(await screen.findByText('No students match your filters.')).toBeInTheDocument()
  })

  it('is reachable from the navigation bar', async () => {
    const user = userEvent.setup()
    mockApi({ ...me, 'GET /admin/students': pageOf(students), 'GET /admin/sessions': pageOf([]) })
    renderApp('/admin')
    await user.click(await screen.findByRole('link', { name: 'Students' }))
    expect(await screen.findByRole('heading', { name: 'Students' })).toBeInTheDocument()
  })
})

describe('creating a student', () => {
  async function openDialog() {
    const user = userEvent.setup()
    const api = mockApi({
      ...me,
      'GET /admin/students': pageOf(students),
      'POST /admin/students': {
        status: 201,
        body: { ...makeAdminStudent({ id: 9, login: 'sara', full_name: 'Sara Ait' }), temporary_password: 'Tmp-Secret-123' },
      },
    })
    renderApp('/admin/students')
    await user.click(await screen.findByRole('button', { name: 'Add student' }))
    return { user, ...api, dialog: await screen.findByRole('dialog') }
  }

  it('creates the student and shows the temporary password once', async () => {
    const { user, bodies, dialog } = await openDialog()
    await user.type(within(dialog).getByLabelText('Login'), 'Sara')
    await user.type(within(dialog).getByLabelText('Full name'), 'Sara Ait')
    await user.selectOptions(within(dialog).getByLabelText('Hizb'), '3')
    await user.selectOptions(within(dialog).getByLabelText('Part'), '2')
    await user.click(within(dialog).getByRole('button', { name: 'Create student' }))

    expect(await screen.findByText('Student created')).toBeInTheDocument()
    expect(screen.getByText('Tmp-Secret-123')).toBeInTheDocument()
    expect(bodies['POST /admin/students'][0]).toMatchObject({
      login: 'sara', full_name: 'Sara Ait', start_hizb: 3, start_part: 2, preferred_lang: 'en', password: null,
    })

    // Two buttons are named "Close" (the footer button and the corner X): use the footer one.
    await user.click(screen.getAllByRole('button', { name: 'Close' })[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('copies the temporary password', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const { user, dialog } = await openDialog()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await user.type(within(dialog).getByLabelText('Login'), 'sara')
    await user.type(within(dialog).getByLabelText('Full name'), 'Sara Ait')
    await user.click(within(dialog).getByRole('button', { name: 'Create student' }))
    await user.click(await screen.findByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith('Tmp-Secret-123')
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('validates the form before sending anything', async () => {
    const { user, calls, dialog } = await openDialog()
    await user.type(within(dialog).getByLabelText('Login'), 'ab')
    await user.type(within(dialog).getByLabelText('Email (optional)'), 'nope')
    await user.type(within(dialog).getByLabelText('Password (optional)'), 'short')
    await user.click(within(dialog).getByRole('button', { name: 'Create student' }))

    expect(await within(dialog).findByText(/Use 3 to 32 letters/)).toBeInTheDocument()
    expect(within(dialog).getByText("Enter the student's full name.")).toBeInTheDocument()
    expect(within(dialog).getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(within(dialog).getByText(/at least 8 characters/)).toBeInTheDocument()
    expect(calls).not.toContain('POST /admin/students')
  })

  it('shows a taken login next to the field', async () => {
    const user = userEvent.setup()
    mockApi({
      ...me,
      'GET /admin/students': pageOf(students),
      'POST /admin/students': { status: 409, body: { detail: 'taken', code: 'LOGIN_TAKEN' } },
    })
    renderApp('/admin/students')
    await user.click(await screen.findByRole('button', { name: 'Add student' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Login'), 'student01')
    await user.type(within(dialog).getByLabelText('Full name'), 'Someone')
    await user.click(within(dialog).getByRole('button', { name: 'Create student' }))

    expect(await within(dialog).findByText('This login is already used by another account.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Login')).toBeInvalid()
  })
})
