import { CircleCheck, CircleX, RotateCcw, ShieldCheck, type LucideIcon } from 'lucide-react'
import type { AttendanceStatus } from '../api/student'

// Never rely on color alone: every status has its own icon and label.
export const STATUS_ICONS: Record<AttendanceStatus, LucideIcon> = {
  PASSED: CircleCheck,
  NOT_PASSED: RotateCcw,
  ABSENT: CircleX,
  ABSENT_EXCUSED: ShieldCheck,
}

export const STATUS_TONES: Record<AttendanceStatus, string> = {
  PASSED: 'bg-success/10 text-success border-success/30',
  NOT_PASSED: 'bg-warning/10 text-warning border-warning/30',
  ABSENT: 'bg-destructive/10 text-destructive border-destructive/30',
  ABSENT_EXCUSED: 'bg-info/10 text-info border-info/30',
}
