import { api } from './client'
import type { Language, User } from './types'

export const authApi = {
  login: (login: string, password: string) =>
    api<User>('/auth/login', { method: 'POST', body: { login, password } }),
  logout: () => api('/auth/logout', { method: 'POST' }),
  me: () => api<User>('/auth/me'),
  updateProfile: (data: { full_name?: string; preferred_lang?: Language }) =>
    api<User>('/auth/me', { method: 'PATCH', body: data }),
  changePassword: (current_password: string, new_password: string) =>
    api<User>('/auth/change-password', { method: 'POST', body: { current_password, new_password } }),
}
