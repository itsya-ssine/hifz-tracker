import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { makeUser, mockApi, unauthenticated } from './mock-api'
import { renderApp } from './render-app'

describe('authentication flow', () => {
  it('redirects anonymous visitors to the login page', async () => {
    mockApi(unauthenticated)
    renderApp('/')
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('signs a student in and shows their dashboard', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi({
      ...unauthenticated,
      'POST /auth/login': { body: makeUser() },
    })
    renderApp('/')

    await user.type(await screen.findByLabelText('Username or email'), 'student01')
    await user.type(screen.getByLabelText('Password'), 'Student1234!')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Hello, Youssef El Amrani')).toBeInTheDocument()
    expect(calls).toContain('POST /auth/login')
  })

  it('shows a translated error for wrong credentials', async () => {
    const user = userEvent.setup()
    mockApi({
      ...unauthenticated,
      'POST /auth/login': {
        status: 401,
        body: { detail: 'Invalid login or password', code: 'INVALID_CREDENTIALS' },
      },
    })
    renderApp('/login')

    await user.type(await screen.findByLabelText('Username or email'), 'student01')
    await user.type(screen.getByLabelText('Password'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password.')
  })

  it('refreshes the session silently when the access token expired', async () => {
    let meCalls = 0
    const { calls } = mockApi({
      'GET /auth/me': () =>
        ++meCalls === 1
          ? { status: 401, body: { detail: 'expired', code: 'NOT_AUTHENTICATED' } }
          : { body: makeUser() },
      'POST /auth/refresh': { body: makeUser() },
    })
    renderApp('/')

    expect(await screen.findByText('Hello, Youssef El Amrani')).toBeInTheDocument()
    expect(calls).toEqual(['GET /auth/me', 'POST /auth/refresh', 'GET /auth/me'])
  })

  it('logs out and returns to the login page', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /auth/me': { body: makeUser() }, 'POST /auth/logout': { status: 204 } })
    renderApp('/student')

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})

describe('route guards', () => {
  it('keeps a student out of the admin area', async () => {
    mockApi({ 'GET /auth/me': { body: makeUser() } })
    renderApp('/admin')
    expect(await screen.findByText('Hello, Youssef El Amrani')).toBeInTheDocument()
    expect(screen.queryByText('Club overview')).not.toBeInTheDocument()
  })

  it('keeps an admin out of the student area', async () => {
    mockApi({ 'GET /auth/me': { body: makeUser({ role: 'ADMIN', full_name: 'Club Admin' }) } })
    renderApp('/student')
    expect(await screen.findByText('Club overview')).toBeInTheDocument()
  })

  it('forces a password change before anything else', async () => {
    mockApi({ 'GET /auth/me': { body: makeUser({ must_change_password: true }) } })
    renderApp('/student')
    expect(await screen.findByText(/choose a new password before continuing/i)).toBeInTheDocument()
    expect(screen.queryByText('Hello, Youssef El Amrani')).not.toBeInTheDocument()
  })

  it('validates and submits the new password', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi({
      'GET /auth/me': { body: makeUser({ must_change_password: true }) },
      'POST /auth/change-password': { body: makeUser({ must_change_password: false }) },
    })
    renderApp('/change-password')

    await user.type(await screen.findByLabelText('Current password'), 'old-password')
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.type(screen.getByLabelText('Confirm new password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 8 characters')
    expect(calls).not.toContain('POST /auth/change-password')

    await user.clear(screen.getByLabelText('New password'))
    await user.clear(screen.getByLabelText('Confirm new password'))
    await user.type(screen.getByLabelText('New password'), 'a-better-password')
    await user.type(screen.getByLabelText('Confirm new password'), 'a-better-password')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() => expect(calls).toContain('POST /auth/change-password'))
    expect(await screen.findByText('Hello, Youssef El Amrani')).toBeInTheDocument()
  })
})

describe('language switching', () => {
  it('switches to Arabic with RTL and saves it on the account', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi({
      'GET /auth/me': { body: makeUser() },
      'PATCH /auth/me': { body: makeUser({ preferred_lang: 'ar' }) },
    })
    renderApp('/student')

    await user.click(await screen.findByRole('button', { name: 'Language' }))
    expect(await screen.findByText('مرحبًا، Youssef El Amrani')).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('rtl')
    await waitFor(() => expect(calls).toContain('PATCH /auth/me'))
  })
})
