import type { LucideIcon } from 'lucide-react'
import { Card } from './ui/card'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
}

export function StatCard({ icon: Icon, label, value, hint }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-accent" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}
