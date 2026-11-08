import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { authApi } from '../../api/auth'
import { ApiError } from '../../api/client'
import type { User } from '../../api/types'
import { AuthContext, type AuthState } from './auth-context'

const ME_KEY = ['me'] as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { i18n } = useTranslation()

  const { data: user = null, isPending } = useQuery({
    queryKey: ME_KEY,
    queryFn: async (): Promise<User | null> => {
      try {
        return await authApi.me()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  // Use the language saved on the account (e.g. after signing in on a new device).
  const preferredLang = user?.preferred_lang
  useEffect(() => {
    if (preferredLang && preferredLang !== i18n.resolvedLanguage) {
      void i18n.changeLanguage(preferredLang)
    }
    // Only react to the account's saved language, not to the switcher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredLang])

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading: isPending,
      login: async (login, password) => {
        const loggedIn = await authApi.login(login, password)
        queryClient.setQueryData(ME_KEY, loggedIn)
        return loggedIn
      },
      logout: async () => {
        try {
          await authApi.logout()
        } finally {
          // Drop cached data of the previous user, but keep the active 'me' query attached.
          queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_KEY[0] })
          queryClient.setQueryData(ME_KEY, null)
        }
      },
      setUser: (updated) => queryClient.setQueryData(ME_KEY, updated),
    }),
    [user, isPending, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
