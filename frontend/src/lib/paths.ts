import type { Role } from '../api/types'

export function homePathFor(role: Role): string {
  return role === 'ADMIN' ? '/admin' : '/student'
}
