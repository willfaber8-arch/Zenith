'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith Games Tab — useBiospherePinning
 * Step 5.3 — Cross-Pillar Component Pinning · Pin State Hook
 *
 * Provides reactive read access to the two exclusive display-pin
 * flags across all three biosphere environments, plus stable
 * mutation callbacks that enforce the single-active constraint via
 * `setExclusivePinnedDisplay` (BiosphereStateManager §11b).
 *
 * Architecture:
 *   Composes `useBiosphereState` rather than opening a second
 *   useLiveQuery subscription, so pin data and full environment
 *   records share one reactive stream — no extra IDB round-trip.
 *
 * Usage:
 *   const {
 *     activeHomeEnv, activeStudyEnv,
 *     isLoading,
 *     pinForHome, pinForStudy,
 *     unpinHome,  unpinStudy,
 *   } = useBiospherePinning()
 * ════════════════════════════════════════════════════════════════
 */

import { useMemo, useCallback } from 'react'
import { gamesDb }             from '@/lib/gamesDb'
import type { BiosphereType }  from '@/lib/gamesDb'
import {
  setExclusivePinnedDisplay,
} from '@/lib/engines/BiosphereStateManager'
import { useBiosphereState }   from '@/hooks/useBiosphereState'

/* ════════════════════════════════════════════════════════════════
   §1  PUBLIC INTERFACE
   ════════════════════════════════════════════════════════════════ */

export interface BiospherePinState {
  /**
   * The environment currently pinned as the home-screen display.
   * `null` when no environment has `isActiveHomeDisplay = true`,
   * or during the IDB boot frame while the query resolves.
   */
  activeHomeEnv: BiosphereType | null

  /**
   * The environment currently pinned for the Study Shield cockpit.
   * `null` when no environment has `isActiveStudyDisplay = true`,
   * or during the IDB boot frame.
   */
  activeStudyEnv: BiosphereType | null

  /**
   * True for exactly one event-loop tick while useLiveQuery resolves
   * the IndexedDB query on initial mount.
   */
  isLoading: boolean

  /**
   * Atomically sets `env` as the sole `isActiveHomeDisplay = true`
   * environment, clearing the flag on all others in one transaction.
   * Stable across renders — safe as a useEffect / useCallback dep.
   */
  pinForHome: (env: BiosphereType) => Promise<void>

  /**
   * Atomically sets `env` as the sole `isActiveStudyDisplay = true`
   * environment, clearing the flag on all others in one transaction.
   * Stable across renders.
   */
  pinForStudy: (env: BiosphereType) => Promise<void>

  /**
   * Clears `isActiveHomeDisplay` on the currently pinned environment.
   * No-op when nothing is pinned.
   * Stable across renders.
   */
  unpinHome: () => Promise<void>

  /**
   * Clears `isActiveStudyDisplay` on the currently pinned environment.
   * No-op when nothing is pinned.
   * Stable across renders.
   */
  unpinStudy: () => Promise<void>
}

/* ════════════════════════════════════════════════════════════════
   §2  HOOK
   ════════════════════════════════════════════════════════════════ */

export function useBiospherePinning(): BiospherePinState {

  /* ── Shared reactive stream — reuses useBiosphereState so the
     biosphere seeder runs and there is only one IDB subscription. */
  const { isLoading, states } = useBiosphereState()

  /* ── Derive the currently pinned environment for each slot ───── */
  const activeHomeEnv = useMemo<BiosphereType | null>(() => {
    if (!states) return null
    const match = [states.terminal, states.aquarium, states.zoo]
      .find(r => r.isActiveHomeDisplay)
    return match?.environmentId ?? null
  }, [states])

  const activeStudyEnv = useMemo<BiosphereType | null>(() => {
    if (!states) return null
    const match = [states.terminal, states.aquarium, states.zoo]
      .find(r => r.isActiveStudyDisplay)
    return match?.environmentId ?? null
  }, [states])

  /* ── Exclusive pin callbacks ────────────────────────────────── */

  const pinForHome = useCallback(
    async (env: BiosphereType): Promise<void> => {
      if (!gamesDb) return
      await setExclusivePinnedDisplay(env, 'isActiveHomeDisplay', true)
    },
    [],
  )

  const pinForStudy = useCallback(
    async (env: BiosphereType): Promise<void> => {
      if (!gamesDb) return
      await setExclusivePinnedDisplay(env, 'isActiveStudyDisplay', true)
    },
    [],
  )

  /* ── Unpin callbacks — clears only the currently active pin ─── */

  const unpinHome = useCallback(
    async (): Promise<void> => {
      if (!gamesDb || !activeHomeEnv) return
      await setExclusivePinnedDisplay(activeHomeEnv, 'isActiveHomeDisplay', false)
    },
    [activeHomeEnv],
  )

  const unpinStudy = useCallback(
    async (): Promise<void> => {
      if (!gamesDb || !activeStudyEnv) return
      await setExclusivePinnedDisplay(activeStudyEnv, 'isActiveStudyDisplay', false)
    },
    [activeStudyEnv],
  )

  return {
    activeHomeEnv,
    activeStudyEnv,
    isLoading,
    pinForHome,
    pinForStudy,
    unpinHome,
    unpinStudy,
  }
}
