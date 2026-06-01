'use client'

/* ════════════════════════════════════════════════════════════
   ToastContext — Phase 0 · Step 0.5
   Lightweight ephemeral notification queue.
   ════════════════════════════════════════════════════════════ */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type ToastType = 'info' | 'success' | 'error'

export interface ToastEntry {
  id:      string
  message: string
  type:    ToastType
  exiting: boolean
}

interface ToastState {
  toasts: ToastEntry[]
  toast:  (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastState>({ toasts: [], toast: () => {} })

const HOLD_MS = 3400   // how long the toast is fully visible
const EXIT_MS = 380    // CSS exit-animation duration

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    setToasts(prev => [...prev, { id, message, type, exiting: false }])

    // Begin exit animation after hold period
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))

      // Remove from DOM after animation completes
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, EXIT_MS)
    }, HOLD_MS)
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast }}>
      {children}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
