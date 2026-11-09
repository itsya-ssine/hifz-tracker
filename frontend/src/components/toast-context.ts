import { createContext, useContext } from 'react'

export interface ToastOptions {
  kind?: 'success' | 'error'
  message: string
}

export const ToastContext = createContext<((toast: ToastOptions) => void) | null>(null)

export function useToast() {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside <ToastProvider>')
  return show
}
