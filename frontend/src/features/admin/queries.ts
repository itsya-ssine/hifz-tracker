import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminApi,
  type RecordUpdatePayload,
  type SessionCreatePayload,
  type SessionUpdatePayload,
  type StudentCreatePayload,
  type StudentListParams,
  type StudentUpdatePayload,
  type AttendanceEntryInput,
} from '../../api/admin'

// Root key is 'admin' so everything is dropped on logout.
const ROOT = 'admin'

export const useStudents = (params: StudentListParams) =>
  useQuery({
    queryKey: [ROOT, 'students', params],
    queryFn: () => adminApi.listStudents(params),
    placeholderData: keepPreviousData,
  })

export const useStudentDetail = (id: number) =>
  useQuery({ queryKey: [ROOT, 'student', id], queryFn: () => adminApi.getStudent(id), enabled: id > 0 })

export const useStudentHistory = (id: number, page: number, pageSize: number) =>
  useQuery({
    queryKey: [ROOT, 'student', id, 'history', page, pageSize],
    queryFn: () => adminApi.studentHistory(id, page, pageSize),
    placeholderData: keepPreviousData,
  })

export const useStudentTimeline = (id: number) =>
  useQuery({
    queryKey: [ROOT, 'student', id, 'timeline'],
    queryFn: () => adminApi.studentTimeline(id),
    enabled: id > 0,
  })

export const useStudentAudit = (id: number, page: number, pageSize: number) =>
  useQuery({
    queryKey: [ROOT, 'student', id, 'audit', page, pageSize],
    queryFn: () => adminApi.studentAudit(id, page, pageSize),
    placeholderData: keepPreviousData,
  })

export const useSessions = (page: number, pageSize: number) =>
  useQuery({
    queryKey: [ROOT, 'sessions', page, pageSize],
    queryFn: () => adminApi.listSessions(page, pageSize),
    placeholderData: keepPreviousData,
  })

export const useSessionDetail = (id: number) =>
  useQuery({ queryKey: [ROOT, 'session', id], queryFn: () => adminApi.getSession(id), enabled: id > 0 })

/** Any write can change progress, counts or audit trails: refresh everything admin-side. */
function useAdminMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ROOT] }),
  })
}

export const useCreateStudent = () =>
  useAdminMutation((payload: StudentCreatePayload) => adminApi.createStudent(payload))

export const useUpdateStudent = (id: number) =>
  useAdminMutation((payload: StudentUpdatePayload) => adminApi.updateStudent(id, payload))

export const useResetPassword = (id: number) => useAdminMutation(() => adminApi.resetPassword(id))

export const useCreateSession = () =>
  useAdminMutation((payload: SessionCreatePayload) => adminApi.createSession(payload))

export const useUpdateSession = (id: number) =>
  useAdminMutation((payload: SessionUpdatePayload) => adminApi.updateSession(id, payload))

export const useDeleteSession = (id: number) => useAdminMutation(() => adminApi.deleteSession(id))

export const useSaveAttendance = (sessionId: number) =>
  useAdminMutation((records: AttendanceEntryInput[]) => adminApi.saveAttendance(sessionId, records))

export const useCorrectRecord = () =>
  useAdminMutation((v: { recordId: number; changes: RecordUpdatePayload }) =>
    adminApi.correctRecord(v.recordId, v.changes),
  )

export const useDeleteRecord = () => useAdminMutation((recordId: number) => adminApi.deleteRecord(recordId))
