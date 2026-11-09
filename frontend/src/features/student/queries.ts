import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { studentApi, type AttendanceStatus } from '../../api/student'

// Root key is 'student' so everything is dropped on logout (the auth user lives under 'me').
export const useOverview = () =>
  useQuery({ queryKey: ['student', 'overview'], queryFn: studentApi.overview })

export const useTimeline = () =>
  useQuery({ queryKey: ['student', 'timeline'], queryFn: studentApi.timeline })

export const useHistory = (page: number, pageSize: number, status?: AttendanceStatus) =>
  useQuery({
    queryKey: ['student', 'history', page, pageSize, status ?? 'all'],
    queryFn: () => studentApi.history({ page, pageSize, status }),
    placeholderData: keepPreviousData,
  })
