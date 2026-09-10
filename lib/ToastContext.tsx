'use client'

/* ════════════════════════════════════════════════════════════
   ToastContext — Phase 0 · Step 0.5
   Lightweight ephemeral notification queue.
   ════════════════════════════════════════════════════════════ */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type ToastType = 'info' | 'success' | 'error'

/**
 * A single thing a toast can offer to do — in practice, "Undo".
 *
 * A toast that only reports is fine for a success. For something
 * destructive it is the wrong shape: the moment you realise you did not
 * mean it is the moment the message is on screen, and the way back
 * should be there rather than somewhere you have to go looking.
 */
export interface ToastAction {
  label: string
  run:   () => void | Promise<void>
}

export interface ToastEntry {
  id:      string
  message: string
  type:    ToastType
  exiting: boolean
  action?: ToastAction
}

interface ToastState {
  toasts: ToastEntry[]
  toast:  (message: string, type?: ToastType, action?: ToastAction) => void
  /** Dismisses one immediately — used after its action is taken. */
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastState>({
  toasts: [], toast: () => {}, dismiss: () => {},
})

const HOLD_MS = 3400   // how long the toast is fully visible
/**
 * Longer for a toast carrying an action.
 *
 * 3.4s is enough to read a confirmation and too short to notice a
 * mistake, decide, move the mouse and press. An offer to undo that
 * expires before it can be taken is worse than no offer, because you
 * saw it and now cannot reach it.
 */
const ACTION_HOLD_MS = 9000
const EXIT_MS = 380    // CSS exit-animation duration

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), EXIT_MS)
  }, [])

  const toast = useCallback((
    message: string, type: ToastType = 'info', action?: ToastAction,
  ) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    setToasts(prev => [...prev, { id, message, type, exiting: false, action }])

    // Begin exit animation after hold period
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))

      // Remove from DOM after animation completes
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, EXIT_MS)
    }, action ? ACTION_HOLD_MS : HOLD_MS)
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
