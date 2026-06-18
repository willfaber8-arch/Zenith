'use client'

/**
 * components/HabitSyncToaster.tsx — zero-render listener.
 *
 * Surfaces a single celebratory toast when a habit is auto-completed by
 * cross-tab sync (cardio / study / vocab / mood). Centralising it here
 * means the logging surfaces (Workouts, Pomodoro FSM, Vocab, Wellness)
 * stay decoupled from the Toast context — they just fire the
 * `zenith:habit-complete` CustomEvent via syncHabitSource().
 */

import { useEffect } from 'react'
import { useToast }  from '@/lib/ToastContext'

interface HabitCompleteDetail {
  names:  string[]
  source: string
}

export default function HabitSyncToaster() {
  const { toast } = useToast()

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<HabitCompleteDetail>).detail
      const names  = detail?.names ?? []
      if (names.length === 0) return
      const label = names.length === 1
        ? `${names[0]} — auto-completed! 🎉`
        : `${names.length} habits auto-completed! 🎉`
      toast(label, 'success')
    }
    window.addEventListener('zenith:habit-complete', handler)
    return () => window.removeEventListener('zenith:habit-complete', handler)
  }, [toast])

  return null
}
