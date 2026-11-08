import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '../api/types'
import { FullScreenLoader } from '../components/Spinner'
import { useAuth } from '../features/auth/auth-context'
import { homePathFor } from '../lib/paths'

/** Requires a signed-in user; forces the password change screen when needed. */
export function RequireAuth() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return <Outlet />
}

/** Requires a specific role; other roles are sent to their own home page. */
export function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={homePathFor(user.role)} replace />
  return <Outlet />
}

export function HomeRedirect() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <FullScreenLoader />
  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />
}
