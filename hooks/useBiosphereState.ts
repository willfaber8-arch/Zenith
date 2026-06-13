'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith Games Tab — useBiosphereState
 * Step 5.1 — Ecosystem Viewport State Matrix · React Controller
 *
 * Bridges the pure BiosphereStateManager engine into the React
 * lifecycle, providing:
 *
 *   • Reactive live data — useLiveQuery streams the biosphere_states
 *     table so every component consuming this hook re-renders the
 *     instant any environment record changes in IndexedDB.
 *
 *   • Typed loading boundary — `isLoading` is true for exactly one
 *     event-loop tick (the useLiveQuery boot frame where the async
 *     query has not yet resolved). Components must not render
 *     environment data until `isLoading === false && states !== null`.
 *
 *   • Zero-arg mount seeder — seeds the three skeleton profiles on
 *     first render if the table is empty, preventing null-reference
 *     panics in child panels before the seeder has run.
 *
 *   • Stable mutation callbacks — every engine function is wrapped
 *     in a `useCallback(fn, [])` so referential equality is
 *     guaranteed across re-renders. Game components that list these
 *     callbacks in their own useCallback / useEffect deps will not
 *     trigger spurious re-subscriptions.
 *
 *   • Synchronous threshold evaluator — `checkStageThreshold(env)`
 *     reads from the already-loaded reactive data, enabling UI
 *     elements to show / hide an "Advance Stage" button with no
 *     async round-trip.
 *
 * Usage:
 *   const {
 *     isLoading, states,
 *     terminalState, aquariumState, zooState,
 *     unlockAsset, advanceStage, updateMetadata,
 *     setHomeDisplay, setStudyDisplay, touchInteraction,
 *     checkStageThreshold,
 *   } = useBiosphereState()
 * ════════════════════════════════════════════════════════════════
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { gamesDb }      from '@/lib/gamesDb'
import type {
  BiosphereType,
  EnvironmentalAsset,
  BiosphereStateRecord,
} from '@/lib/gamesDb'
import {
  seedBiosphereStates,
  unlockAssetNode,
  advanceEnvironmentStage,
  updateBiosphereMetadata,
  setPinnedDisplay,
  touchInteractionTimestamp,
  evaluateStageThreshold,
  type BiosphereMutationResult,
} from '@/lib/engines/BiosphereStateManager'

/* ════════════════════════════════════════════════════════════════
   §1  PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

/**
 * Keyed dictionary giving O(1) access to each environment record.
 * All three keys are always present after seeding completes.
 */
export type BiosphereStateMap = {
  readonly [K in BiosphereType]: BiosphereStateRecord
}

/**
 * Full public surface returned by `useBiosphereState`.
 *
 * Loading lifecycle:
 *   Phase 1 → `isLoading: true`, all environment fields: `null`
 *              (useLiveQuery boot frame — IndexedDB not yet resolved)
 *   Phase 2 → `isLoading: false`, `states: null`
 *              (query resolved but table empty — seeder running)
 *   Phase 3 → `isLoading: false`, all fields populated
 *              (normal operating state)
 *
 * Components should gate on `!isLoading && states !== null` before
 * rendering environment content to avoid a one-frame white flash.
 */
export interface BiosphereStateHookResult {
  /**
   * True for exactly one event-loop tick while useLiveQuery resolves
   * the IndexedDB query. Gates the loading skeleton in panel UIs.
   */
  isLoading: boolean

  /**
   * Keyed dictionary of all three environment records.
   * `null` during the boot frame or while the seeder is running.
   * Populated and reactive once all three rows exist in the table.
   */
  states: BiosphereStateMap | null

  /**
   * Convenience accessor for the terminal environment record.
   * `null` during the loading phase or before seeding completes.
   */
  terminalState: BiosphereStateRecord | null

  /**
   * Convenience accessor for the aquarium environment record.
   * `null` during the loading phase or before seeding completes.
   */
  aquariumState: BiosphereStateRecord | null

  /**
   * Convenience accessor for the zoo environment record.
   * `null` during the loading phase or before seeding completes.
   */
  zooState: BiosphereStateRecord | null

  /**
   * Unlocks a new `EnvironmentalAsset` in the specified environment.
   * Stable across renders — safe to use as a useCallback / useEffect dep.
   *
   * Returns `{ ok: false, reason: 'asset_already_unlocked' }` for
   * duplicate submissions — callers do not need to pre-check.
   */
  unlockAsset: (
    environmentId: BiosphereType,
    asset: EnvironmentalAsset,
  ) => Promise<BiosphereMutationResult>

  /**
   * Attempts to advance the environment to its next ecosystem stage.
   * Fails with `stage_threshold_not_met` if asset count or evolution
   * depth requirements for the next tier are not yet satisfied.
   * Stable across renders.
   */
  advanceStage: (
    environmentId: BiosphereType,
  ) => Promise<BiosphereMutationResult>

  /**
   * Shallow-merges `patch` into the environment's metadata bucket.
   * Existing keys not in `patch` are preserved.
   * Stable across renders.
   *
   * @example
   * await updateMetadata('aquarium', { pH: 7.2, tempCelsius: 25 })
   */
  updateMetadata: (
    environmentId: BiosphereType,
    patch: Record<string, unknown>,
  ) => Promise<BiosphereMutationResult>

  /**
   * Pins or unpins the environment as the active home-screen display.
   * Does not enforce exclusivity — the caller must manually unpin the
   * previously active environment if single-active semantics are needed.
   * Stable across renders.
   */
  setHomeDisplay: (
    environmentId: BiosphereType,
    active: boolean,
  ) => Promise<BiosphereMutationResult>

  /**
   * Pins or unpins the environment as the active Study Shield cockpit display.
   * Same exclusivity note as `setHomeDisplay`.
   * Stable across renders.
   */
  setStudyDisplay: (
    environmentId: BiosphereType,
    active: boolean,
  ) => Promise<BiosphereMutationResult>

  /**
   * Stamps `lastInteractionTimestamp` for an environment to `Date.now()`.
   * Lightweight — does not return a mutation result payload.
   * Stable across renders.
   */
  touchInteraction: (environmentId: BiosphereType) => Promise<void>

  /**
   * Synchronous check — returns true when the named environment's
   * current asset portfolio satisfies the threshold for advancing to
   * its next stage.
   *
   * Reads from the already-loaded reactive `states` dict — no async
   * round-trip. Safe to call during render for conditional rendering
   * of the "Advance Stage" control. Reference changes whenever
   * `states` updates (i.e., whenever any asset is unlocked or evolved).
   */
  checkStageThreshold: (environmentId: BiosphereType) => boolean
}

/* ════════════════════════════════════════════════════════════════
   §2  BOOT-FRAME FALLBACK STRUCTURES
   ────────────────────────────────────────────────────────────────
   useLiveQuery returns `undefined` for one event-loop tick while
   IndexedDB warms up. These constants fill the gap so that every
   destructured property from the hook has a valid, typed default.
   ════════════════════════════════════════════════════════════════ */

/**
 * Stable no-op promise for callbacks that fire before the DB has
 * initialised. Returned by the hook's mutation wrappers during the
 * boot frame so callers receive a consistent return shape.
 */
const BOOT_FRAME_RESULT: BiosphereMutationResult = {
  ok:     false,
  reason: 'environment_not_found',
}

/* ════════════════════════════════════════════════════════════════
   §3  HOOK IMPLEMENTATION
   ════════════════════════════════════════════════════════════════ */

export function useBiosphereState(): BiosphereStateHookResult {

  /* ── 3a. Seeder flag ────────────────────────────────────────────
     Tracks whether we have already dispatched the seed call for this
     component's lifetime. Using useState (not useRef) means the flag
     is preserved across React StrictMode double-invocations.         */

  const [seederFired, setSeederFired] = useState(false)

  /* ── 3b. Reactive database stream ──────────────────────────────
     useLiveQuery max 2 arguments (dexie-react-hooks v4 rule).
     Returns `undefined` during the boot frame, then the live array
     on every subsequent IndexedDB change event.                     */

  const rawRecords = useLiveQuery<BiosphereStateRecord[]>(
    () => gamesDb?.biosphere_states.toArray() ?? Promise.resolve([]),
    [],
  )

  /* ── 3c. Loading boundary ───────────────────────────────────────
     `undefined` = query not yet resolved (boot frame).
     `[]`        = query resolved, table empty (need seeder).
     Populated array = normal operating state.                       */

  const isLoading = rawRecords === undefined

  /* ── 3d. Idempotent seed on first resolved empty query ──────────
     Fires once when rawRecords first resolves to an empty array.
     The `seederFired` flag prevents a re-trigger after seeding
     writes cause rawRecords to update (which would otherwise create
     an infinite loop).                                              */

  useEffect(() => {
    if (isLoading)       return   // query not yet resolved — wait
    if (seederFired)     return   // seeder already dispatched this session
    if ((rawRecords?.length ?? 0) > 0) return  // table already populated

    setSeederFired(true)
    void seedBiosphereStates()
  }, [isLoading, rawRecords, seederFired])

  /* ── 3e. Keyed state dictionary ─────────────────────────────────
     Convert the reactive array into a fully-typed BiosphereStateMap.
     Returns null if the array is undefined (boot frame) or contains
     fewer than three rows (seed in progress).                       */

  const states = useMemo<BiosphereStateMap | null>(() => {
    if (!rawRecords || rawRecords.length < 3) return null

    // Use explicit let bindings rather than a Partial<BiosphereStateMap>
    // assignment because BiosphereStateMap has `readonly` keys which
    // TypeScript 5 refuses to narrow via bracket-assignment on a Partial.
    let terminal: BiosphereStateRecord | undefined
    let aquarium: BiosphereStateRecord | undefined
    let zoo:      BiosphereStateRecord | undefined

    for (const record of rawRecords) {
      if      (record.environmentId === 'terminal') terminal = record
      else if (record.environmentId === 'aquarium') aquarium = record
      else if (record.environmentId === 'zoo')      zoo      = record
    }

    if (!terminal || !aquarium || !zoo) return null

    return { terminal, aquarium, zoo }
  }, [rawRecords])

  /* ── 3f. Convenience individual accessors ───────────────────────
     Computed from the memoised states map — no extra DB reads.      */

  const terminalState: BiosphereStateRecord | null = states?.terminal ?? null
  const aquariumState: BiosphereStateRecord | null = states?.aquarium ?? null
  const zooState:      BiosphereStateRecord | null = states?.zoo      ?? null

  /* ── 3g. Stable mutation callbacks ─────────────────────────────
     All engine functions are called via thin useCallback wrappers.
     Empty dependency arrays guarantee stable references — callers
     that list these in their own deps never re-subscribe spuriously.
     The callbacks return the boot-frame result synchronously when
     gamesDb is unavailable (SSR safety), otherwise delegate fully
     to the engine functions which own all business logic.           */

  const unlockAsset = useCallback(
    async (
      environmentId: BiosphereType,
      asset: EnvironmentalAsset,
    ): Promise<BiosphereMutationResult> => {
      if (!gamesDb) return BOOT_FRAME_RESULT
      return unlockAssetNode(environmentId, asset)
    },
    [],
  )

  const advanceStage = useCallback(
    async (
      environmentId: BiosphereType,
    ): Promise<BiosphereMutationResult> => {
      if (!gamesDb) return BOOT_FRAME_RESULT
      return advanceEnvironmentStage(environmentId)
    },
    [],
  )

  const updateMetadata = useCallback(
    async (
      environmentId: BiosphereType,
      patch: Record<string, unknown>,
    ): Promise<BiosphereMutationResult> => {
      if (!gamesDb) return BOOT_FRAME_RESULT
      return updateBiosphereMetadata(environmentId, patch)
    },
    [],
  )

  const setHomeDisplay = useCallback(
    async (
      environmentId: BiosphereType,
      active: boolean,
    ): Promise<BiosphereMutationResult> => {
      if (!gamesDb) return BOOT_FRAME_RESULT
      return setPinnedDisplay(environmentId, 'isActiveHomeDisplay', active)
    },
    [],
  )

  const setStudyDisplay = useCallback(
    async (
      environmentId: BiosphereType,
      active: boolean,
    ): Promise<BiosphereMutationResult> => {
      if (!gamesDb) return BOOT_FRAME_RESULT
      return setPinnedDisplay(environmentId, 'isActiveStudyDisplay', active)
    },
    [],
  )

  const touchInteraction = useCallback(
    async (environmentId: BiosphereType): Promise<void> => {
      if (!gamesDb) return
      return touchInteractionTimestamp(environmentId)
    },
    [],
  )

  /* ── 3h. Synchronous threshold evaluator ───────────────────────
     Reads from the already-loaded `states` dict — no async path.
     The [states] dep ensures the reference updates whenever any
     balance or asset change causes a useLiveQuery re-emission, so
     conditional rendering that calls this is always current.        */

  const checkStageThreshold = useCallback(
    (environmentId: BiosphereType): boolean => {
      const record = states?.[environmentId]
      if (!record) return false
      return evaluateStageThreshold(record)
    },
    [states],
  )

  /* ── 3i. Return surface ─────────────────────────────────────── */

  return {
    isLoading,
    states,
    terminalState,
    aquariumState,
    zooState,
    unlockAsset,
    advanceStage,
    updateMetadata,
    setHomeDisplay,
    setStudyDisplay,
    touchInteraction,
    checkStageThreshold,
  }
}
