'use client'
/**
 * useRpgStats
 * ────────────────────────────────────────────────────────────────
 * Streams live RPG stats from the userProfile singleton via
 * useLiveQuery and derives display-ready values for the
 * RpgStatusWidget banner.
 *
 * Also detects level-up events by comparing consecutive
 * `currentLevel` values via a ref — sets `justLeveledUp` for
 * one animation cycle (1200 ms) when a level-up is observed.
 *
 * Import only from `'use client'` components.
 */

import { useLiveQuery }        from 'dexie-react-hooks'
import { useRef, useState, useEffect } from 'react'
import { db, type UserProfile } from '@/lib/db'
import { expRequired, HP_MAX }  from '@/utils/rpgEngine'

/* ── Return shape ─────────────────────────────────────────────── */

export interface RpgStats {
  /** Raw profile row — undefined while IDB resolves on first load. */
  profile:       UserProfile | undefined
  /** EXP threshold for the current level (EXP_Required = 100 × Level^1.5). */
  expReq:        number
  /** Fill percentage (0–100) for the EXP progress bar. */
  expPct:        number
  /** Fill percentage (0–100) for the HP / vitality bar. */
  hpPct:         number
  /** True for exactly one 1200 ms window after a level-up is detected. */
  justLeveledUp: boolean
}

/* ── Hook ─────────────────────────────────────────────────────── */

export function useRpgStats(): RpgStats {
  const profile = useLiveQuery(
    (): Promise<UserProfile | undefined> => {
      if (!db) return Promise.resolve(undefined)
      return db.userProfile.get(1)
    },
    [],
  )

  /* ── Level-up detection ──────────────────────────────────────── */
  const prevLevelRef              = useRef<number | undefined>(undefined)
  const [justLeveledUp, setLeveledUp] = useState(false)

  useEffect(() => {
    if (profile == null) return

    const prev = prevLevelRef.current
    prevLevelRef.current = profile.currentLevel

    if (prev !== undefined && profile.currentLevel > prev) {
      setLeveledUp(true)
      const t = setTimeout(() => setLeveledUp(false), 1_200)
      return () => clearTimeout(t)
    }
  }, [profile?.currentLevel])  // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Derived display values ─────────────────────────────────── */
  if (!profile) {
    return {
      profile:       undefined,
      expReq:        expRequired(1),
      expPct:        0,
      hpPct:         100,
      justLeveledUp: false,
    }
  }

  const expReq = expRequired(profile.currentLevel)
  const expPct = Math.min(100, Math.max(0, (profile.expPoints / expReq) * 100))
  const hpPct  = Math.min(100, Math.max(0, (profile.healthPoints / HP_MAX) * 100))

  return { profile, expReq, expPct, hpPct, justLeveledUp }
}
