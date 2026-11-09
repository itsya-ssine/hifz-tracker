import { CircleAlert, CircleCheck } from 'lucide-react'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/utils'
import { ToastContext, type ToastOptions } from './toast-context'

interface ActiveToast extends ToastOptions {
  id: number
}

const DURATION_MS = 4500

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ActiveToast[]>([])
  const nextId = useRef(1)

  const show = useCallback((toast: ToastOptions) => {
    const id = nextId.current++
    setToasts((current) => [...current, { ...toast, id }])
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), DURATION_MS)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:end-4 sm:items-end"
      >
        {toasts.map((toast) => {
          const Icon = toast.kind === 'error' ? CircleAlert : CircleCheck
          return (
            <div
              key={toast.id}
              role={toast.kind === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl border bg-card px-4 py-3 text-sm shadow-lg',
                toast.kind === 'error' ? 'border-destructive/40' : 'border-success/40',
              )}
            >
              <Icon
                className={cn('size-4 shrink-0', toast.kind === 'error' ? 'text-destructive' : 'text-success')}
                aria-hidden="true"
              />
              {toast.message}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
