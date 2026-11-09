import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AdminDashboard } from './features/admin/AdminDashboard'
import { ChangePasswordPage } from './features/auth/ChangePasswordPage'
import { LoginPage } from './features/auth/LoginPage'
import { StudentDashboard } from './features/student/StudentDashboard'
import { StudentHistoryPage } from './features/student/StudentHistoryPage'
import { HomeRedirect, RequireAuth, RequireRole } from './routes/guards'
import { NotFound } from './routes/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />

        <Route element={<AppShell />}>
          <Route element={<RequireRole role="STUDENT" />}>
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/history" element={<StudentHistoryPage />} />
          </Route>
          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
