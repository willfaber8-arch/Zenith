'use client'
/**
 * RpgSyncEffect — Phase 5 · Step 5.1
 * ────────────────────────────────────────────────────────────────
 * Zero-render side-effect component mounted inside the authenticated
 * workspace (alongside BadgeSyncEffect in AppShell). Responsibilities:
 *
 *   1. Initialises the ZenithRpgEngine singleton (idempotent).
 *      Registers Dexie updating hooks on `habits` and `assignments`
 *      and schedules the background overdue penalty scan.
 *
 *   2. Subscribes to RPG lifecycle events and bridges them into
 *      the toast notification system:
 *        level_up  →  success toast "Level up!"
 *        defeat    →  error toast with XP-penalty warning
 *
 * Returns null — produces no DOM output.
 */

import { useEffect }        from 'react'
import { useToast }         from '@/lib/ToastContext'
import { getRpgEngine }     from '@/services/rpgEngineService'

export default function RpgSyncEffect() {
  const { toast } = useToast()

  useEffect(() => {
    const engine = getRpgEngine()
    engine.init()

    return engine.subscribe((event) => {
      switch (event.type) {
        case 'level_up':
          toast(
            `Level up! You reached Level ${event.level}. HP fully restored.`,
            'success',
          )
          break
        case 'defeat':
          toast(
            `Defeated at Level ${event.level}. HP restored to 50. XP penalised.`,
            'error',
          )
          break
        // xp_gain and hp_damage are silent — the widget updates reactively
      }
    })
  }, [toast])

  return null
}
