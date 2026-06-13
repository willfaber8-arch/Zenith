'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith Games Tab — useProductivityMultiplier
 * Step 6.3 — Path D: Nexus Synergy · Global Subscriber Hook
 *
 * Registers the application-wide listener on the 'zenith_action'
 * CustomEvent bus and translates incoming productivity triggers into
 * games-economy mutations, gated by the player's skill tree state.
 *
 * Wiring contract
 * ───────────────
 * Mount this hook exactly once at the application root (e.g. inside
 * AppContent or a dedicated provider).  A single registration is all
 * that is needed — duplicate mounts would result in double rewards.
 *
 * Skill gate logic (delegated to ProductivityEventBroker)
 * ──────────────────────────────────────────────────────
 *   d1_synthesis + 'task_completed' | 'study_shield_complete'
 *     → applyD1FlatReward()  (+5 × three raw resources, cap-safe)
 *
 *   d2_resonance + 'habit_streak_achieved'
 *     → activateBoon()  (60-min 2× harvest multiplier via localStorage)
 *       Reactive state is updated so consumers of this hook can display
 *       a countdown or badge without polling localStorage themselves.
 *
 * Cleanup contract
 * ───────────────
 * Every useEffect that touches window or setInterval returns its own
 * cleanup function.  React calls these on unmount (and on every
 * re-render for effects that have deps — only the listener registration
 * effect has a non-empty deps array).
 *
 * Return value
 * ────────────
 * The hook exposes read-only boon state so UI panels (e.g. the Arcade
 * Hub resource ticker or the Topbar badge) can reactively display the
 * remaining boon window without subscribing to localStorage directly.
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react'
import {
  ZENITH_ACTION_EVENT_NAME,
  BOON_DURATION_MS,
  isBoonCurrentlyActive,
  getBoonExpiresAt,
  getBoonMultiplier,
  activateBoon,
  deactivateBoon,
  applyD1FlatReward,
  isD1Active,
  isD2Active,
  type ZenithActionEventDetail,
} from '@/lib/events/ProductivityEventBroker'

/* ════════════════════════════════════════════════════════════════
   §1  PUBLIC RETURN TYPE
   ════════════════════════════════════════════════════════════════ */

/**
 * Read-only snapshot of the current D2 Nexus Boon state.
 * All fields are derived from localStorage and update reactively via
 * the internal countdown interval.
 */
export interface ProductivityMultiplierState {
  /**
   * True when a D2 boon record is stored in localStorage and has not
   * yet expired.  Flips to false the moment the expiry epoch is passed.
   */
  readonly isBoonActive: boolean
  /**
   * Seconds remaining on the active boon.
   * Counts down in 1-second steps.  Zero when no boon is running.
   */
  readonly boonRemainingSeconds: number
  /**
   * Current harvest multiplier: 2 while a boon is active, 1 otherwise.
   * Mirrors getBoonMultiplier() from the broker but kept in React state
   * so dependent components receive a re-render when it changes.
   */
  readonly boonMultiplier: 1 | 2
}

/* ════════════════════════════════════════════════════════════════
   §2  HOOK IMPLEMENTATION
   ════════════════════════════════════════════════════════════════ */

export function useProductivityMultiplier(): ProductivityMultiplierState {

  /* ── §2a  Reactive boon state ──────────────────────────────────
     Seeded synchronously from localStorage during the first render
     via useEffect so the initial render is always SSR-safe (the lazy
     init path runs in the browser only).                             */

  const [isBoonActive, setIsBoonActive]               = useState<boolean>(false)
  const [boonRemainingSeconds, setBoonRemainingSeconds] = useState<number>(0)

  /* Sync localStorage → React state once on mount. */
  useEffect(() => {
    const active    = isBoonCurrentlyActive()
    const expiresAt = getBoonExpiresAt()

    setIsBoonActive(active)

    if (active && expiresAt !== null) {
      setBoonRemainingSeconds(
        Math.max(0, Math.floor((expiresAt - Date.now()) / 1_000)),
      )
    }
  }, [])   // runs exactly once — localStorage does not change between renders

  /* ── §2b  Boon countdown interval ─────────────────────────────
     Only running while isBoonActive is true, so there is zero
     overhead when no boon is in flight.  The effect is re-registered
     whenever isBoonActive changes: the old interval is cleaned up
     first, then the new one is started (or skipped if false).       */

  useEffect(() => {
    if (!isBoonActive) return

    const intervalId = setInterval(() => {
      const expiresAt = getBoonExpiresAt()

      if (expiresAt === null || Date.now() >= expiresAt) {
        // The window has elapsed — purge localStorage and reset state.
        deactivateBoon()
        setIsBoonActive(false)
        setBoonRemainingSeconds(0)
      } else {
        setBoonRemainingSeconds(
          Math.max(0, Math.floor((expiresAt - Date.now()) / 1_000)),
        )
      }
    }, 1_000)

    return () => clearInterval(intervalId)
  }, [isBoonActive])

  /* ── §2c  Incoming action handler (async, stable) ─────────────
     All business logic is delegated to the pure broker functions so
     this hook owns only React state management.

     Handler flow:
       1. D1 path — if type is task/study and d1_synthesis is unlocked,
          apply flat +5 raw reward across three resources atomically.

       2. D2 path — if type is habit_streak and d2_resonance is unlocked,
          activate the boon (or refresh its window), then update state
          so the countdown renders immediately.

     Both paths run independently: a single event can trigger both D1
     and D2 rewards if both nodes are unlocked.                       */

  const handleIncomingAction = useCallback(
    async (event: CustomEvent<ZenithActionEventDetail>): Promise<void> => {
      const type = event.detail?.type
      if (!type) return

      /* D1 — flat raw resource reward on task / study completion */
      if (type === 'task_completed' || type === 'study_shield_complete') {
        const d1Active = await isD1Active()
        if (d1Active) {
          await applyD1FlatReward()
        }
      }

      /* D2 — harvest multiplier boon on habit streak achievement */
      if (type === 'habit_streak_achieved') {
        const d2Active = await isD2Active()
        if (d2Active) {
          activateBoon()
          // Seed state immediately — don't wait for next countdown tick.
          setIsBoonActive(true)
          setBoonRemainingSeconds(Math.floor(BOON_DURATION_MS / 1_000))
        }
      }
    },
    [],   // stable — all deps are module-level functions or useState setters
  )

  /* ── §2d  Window event listener registration + teardown ────────
     A single listener binding covers the entire component lifetime.
     handleIncomingAction is a stable useCallback([]) so this effect
     runs exactly once on mount and registers one removal on unmount.

     The listener wrapper casts Event → CustomEvent so TypeScript can
     narrow the detail payload, then fires the async handler in a
     void expression (fire-and-forget is safe here because the event
     bus does not await listener completion).                        */

  useEffect(() => {
    if (typeof window === 'undefined') return

    const listener = (event: Event): void => {
      void handleIncomingAction(event as CustomEvent<ZenithActionEventDetail>)
    }

    window.addEventListener(ZENITH_ACTION_EVENT_NAME, listener)
    return () => window.removeEventListener(ZENITH_ACTION_EVENT_NAME, listener)
  }, [handleIncomingAction])

  /* ── §2e  Return surface ─────────────────────────────────────── */

  return {
    isBoonActive,
    boonRemainingSeconds,
    boonMultiplier: (isBoonActive ? 2 : 1) as 1 | 2,
  }
}
