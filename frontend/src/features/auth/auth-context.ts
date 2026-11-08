import { createContext, useContext } from 'react'
import type { User } from '../../api/types'

export interface AuthState {
  user: User | null
  isLoading: boolean
  login: (login: string, password: string) => Promise<User>
  logout: () => Promise<void>
  setUser: (user: User) => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
