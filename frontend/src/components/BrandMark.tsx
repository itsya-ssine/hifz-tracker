import { BookOpen } from 'lucide-react'
import { cn } from '../lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground',
        className,
      )}
    >
      <BookOpen className="size-1/2" aria-hidden="true" />
    </span>
  )
}
