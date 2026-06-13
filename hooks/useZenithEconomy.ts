'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith Games Tab — Economy Hook
 * Step 1.2 — Global Economy Hook Setup
 *
 * Single-source state interface for all arcade minigames.
 * Wraps ZenithGamesDatabase mutations with:
 *   • Reactive live queries (0ms local lag via useLiveQuery)
 *   • Hard storage cap enforcement with overflow tracking
 *   • Atomic Dexie transactions that are safe under rapid game loops
 *   • O(1) resource dictionary for hot-path balance lookups
 *   • Boot-frame fallback structures that match every TypeScript interface
 *
 * Usage pattern:
 *   const { resources, addResources, isAtCapacity } = useZenithEconomy()
 * ════════════════════════════════════════════════════════════════
 */

import { useMemo, useCallback }  from 'react'
import { useLiveQuery }          from 'dexie-react-hooks'
import {
  gamesDb,
  type ResourceNode,
  type UserProfileConfig,
  type ResourceId,
} from '@/lib/gamesDb'

/* ════════════════════════════════════════════════════════════════
   §1  RESULT TYPES
   ════════════════════════════════════════════════════════════════ */

/**
 * Returned by `addResources` — gives callers precise insight into
 * how the cap affected the operation so games can react accordingly
 * (e.g., flash "inventory full", animate partial credit, etc.).
 */
export interface AddResourcesResult {
  /** Units actually credited to the balance (≤ requested amount). */
  added: number
  /**
   * True when the cap ceiling was hit during this operation.
   * False for infinite-capacity resources (cosmetic_points) or when
   * headroom was sufficient for the full requested amount.
   */
  capped: boolean
  /**
   * Units that were discarded because they exceeded maxCapacity.
   * Always `requested_amount − added`. Zero when not capped.
   */
  overflowDiscarded: number
}

/**
 * Full public surface returned by `useZenithEconomy`.
 * Every property is stable or reactive — game components may safely
 * destructure any subset without breaking memoization.
 */
export interface EconomyHookResult {
  /**
   * O(1) dictionary of all six ResourceNodes, keyed by ResourceId.
   * Reactively updated by useLiveQuery — components re-render the
   * instant any balance changes in IndexedDB.
   * Empty object `{}` during the initial async boot frame.
   */
  resources: Record<string, ResourceNode>
  /**
   * The theme ID currently applied to the Games UI.
   * Defaults to `'zenith_default'` during the boot frame.
   */
  activeTheme: string
  /**
   * Cosmetic point balance derived directly from the live resource
   * inventory — single source of truth, never stale.
   * Also kept in sync with `user_profile_config.cosmeticPointsBalance`
   * via the same transaction on every mutation.
   */
  cosmeticPoints: number
  /**
   * Atomically credits `amount` units to a resource with full cap
   * enforcement. Safe to call inside high-frequency game loops
   * (typing runs, tile-match streaks, etc.).
   *
   * @throws Never — invalid inputs return a zero-credit result.
   */
  addResources: (resourceId: string, amount: number) => Promise<AddResourcesResult>
  /**
   * Atomically debits `amount` units from a resource.
   * Returns `false` without writing if the balance is insufficient —
   * callers must not assume a successful debit.
   *
   * @throws Never — invalid inputs return false.
   */
  deductResources: (resourceId: string, amount: number) => Promise<boolean>
  /**
   * Synchronous capacity check against live reactive data.
   * Use to disable harvest buttons or flash UI alerts immediately
   * after a game round completes — no async round-trip needed.
   *
   * Returns `false` for unknown resource IDs and for
   * cosmetic_points (infinite capacity).
   */
  isAtCapacity: (resourceId: string) => boolean
}

/* ════════════════════════════════════════════════════════════════
   §2  BOOT-FRAME FALLBACK STRUCTURES
   ────────────────────────────────────────────────────────────────
   useLiveQuery returns `undefined` for one event-loop tick while
   IndexedDB warms up. These constants stand in so that consumers
   never have to null-guard the hook's return value.
   ════════════════════════════════════════════════════════════════ */

/** Empty dictionary — populated within one render cycle after mount. */
const FALLBACK_RESOURCES: Record<string, ResourceNode> = {}

/** Matches the seed value in lib/gamesDb.ts SEED_PROFILE. */
const FALLBACK_THEME = 'zenith_default'

/** Stable no-op result returned when a mutation cannot proceed. */
const ZERO_ADD_RESULT: AddResourcesResult = {
  added:             0,
  capped:            false,
  overflowDiscarded: 0,
}

/* ════════════════════════════════════════════════════════════════
   §3  HOOK IMPLEMENTATION
   ════════════════════════════════════════════════════════════════ */

export function useZenithEconomy(): EconomyHookResult {

  /* ── 3a. Reactive database streams ─────────────────────────
     Both queries use max 2 arguments (dexie-react-hooks v4 API).
     The return type is T | undefined; boot-frame undefined is
     handled in the derived values below.                        */

  const resourcesArray = useLiveQuery<ResourceNode[]>(
    () => gamesDb?.resource_inventory.toArray() ?? Promise.resolve([]),
    [],
  )

  const profile = useLiveQuery<UserProfileConfig | undefined>(
    () => gamesDb?.user_profile_config.get('active_user'),
    [],
  )

  /* ── 3b. O(1) resource dictionary ──────────────────────────
     Convert the live array into a keyed Record once per update.
     Games hit this path on every frame — the Map-free object
     lookup is the fastest possible read path in V8.             */

  const resources = useMemo<Record<string, ResourceNode>>(() => {
    if (!resourcesArray || resourcesArray.length === 0) return FALLBACK_RESOURCES
    const dict: Record<string, ResourceNode> = {}
    for (const node of resourcesArray) dict[node.id] = node
    return dict
  }, [resourcesArray])

  /* ── 3c. Derived scalar state ───────────────────────────── */

  const activeTheme: string =
    profile?.activeTheme ?? FALLBACK_THEME

  // Primary source: live resource balance (never stale).
  // Fallback: denormalised profile field (covers the rare boot frame
  // where resource_inventory has loaded but user_profile_config has not).
  const cosmeticPoints: number =
    resources['cosmetic_points']?.balance ?? profile?.cosmeticPointsBalance ?? 0

  /* ── 3d. addResources ───────────────────────────────────────
     Implements the full cap-enforcement pipeline from the spec:
       1. Read current node inside the transaction.
       2. Compute potentialBalance = current + requested.
       3. Branch: null cap → infinite; within cap → full credit;
          over cap → clamp to maxCapacity.
       4. Derive added (actual) and overflowDiscarded.
       5. Increment totalEarnedLifetime by the actual added amount.
       6. Atomic write back to resource_inventory.
       7. If touching cosmetic_points, sync user_profile_config.  */

  const addResources = useCallback(async (
    resourceId: string,
    amount: number,
  ): Promise<AddResourcesResult> => {
    // Guard: invalid input — return zero-credit without touching DB
    if (!gamesDb || !Number.isFinite(amount) || amount <= 0) {
      return ZERO_ADD_RESULT
    }

    // Always include user_profile_config in the transaction scope so
    // the cosmetic_points balance stays atomically in sync.
    return gamesDb.transaction(
      'rw',
      [gamesDb.resource_inventory, gamesDb.user_profile_config],
      async (): Promise<AddResourcesResult> => {
        const node = await gamesDb.resource_inventory.get(resourceId as ResourceId)

        // Unknown resource — nothing to credit
        if (!node) return ZERO_ADD_RESULT

        /* ── Cap Enforcement ─────────────────────────────── */
        const potentialBalance = node.balance + amount

        let newBalance: number
        let capped: boolean

        if (node.maxCapacity === null) {
          // Infinite capacity (cosmetic_points) — always allow full credit
          newBalance = potentialBalance
          capped     = false
        } else if (potentialBalance <= node.maxCapacity) {
          // Headroom is sufficient — full credit
          newBalance = potentialBalance
          capped     = false
        } else {
          // Overflow — clamp hard to ceiling
          newBalance = node.maxCapacity
          capped     = true
        }

        const added             = newBalance - node.balance
        const overflowDiscarded = amount - added

        /* ── Atomic Writes ──────────────────────────────── */
        await gamesDb.resource_inventory.update(resourceId as ResourceId, {
          balance:             newBalance,
          totalEarnedLifetime: node.totalEarnedLifetime + added,
        })

        // Keep denormalised profile field in sync for cosmetic_points
        if (resourceId === 'cosmetic_points') {
          await gamesDb.user_profile_config.update('active_user', {
            cosmeticPointsBalance: newBalance,
          })
        }

        return { added, capped, overflowDiscarded }
      },
    )
  }, [])

  /* ── 3e. deductResources ────────────────────────────────────
     Atomic balance check + debit. Returns false instead of throwing
     so that game-loop callers can gate on the boolean without a
     try/catch on every tile match, keystroke, or path completion.  */

  const deductResources = useCallback(async (
    resourceId: string,
    amount: number,
  ): Promise<boolean> => {
    // Guard: invalid input — nothing to deduct
    if (!gamesDb || !Number.isFinite(amount) || amount <= 0) return false

    return gamesDb.transaction(
      'rw',
      [gamesDb.resource_inventory, gamesDb.user_profile_config],
      async (): Promise<boolean> => {
        const node = await gamesDb.resource_inventory.get(resourceId as ResourceId)

        // Unknown resource or insufficient balance — clean refusal
        if (!node || node.balance < amount) return false

        const newBalance = node.balance - amount

        await gamesDb.resource_inventory.update(resourceId as ResourceId, {
          balance: newBalance,
        })

        // Keep denormalised profile field in sync for cosmetic_points
        if (resourceId === 'cosmetic_points') {
          await gamesDb.user_profile_config.update('active_user', {
            cosmeticPointsBalance: newBalance,
          })
        }

        return true
      },
    )
  }, [])

  /* ── 3f. isAtCapacity ───────────────────────────────────────
     Synchronous helper that reads from the already-loaded reactive
     `resources` dict — no async round-trip, no extra DB read.
     Re-memoized only when the `resources` reference changes (i.e.,
     when any balance updates), so dependent effects stay stable.  */

  const isAtCapacity = useCallback((resourceId: string): boolean => {
    const node = resources[resourceId]
    if (!node) return false
    // Infinite-capacity resources can never be "at capacity"
    if (node.maxCapacity === null) return false
    return node.balance >= node.maxCapacity
  }, [resources])

  /* ── 3g. Return surface ─────────────────────────────────── */

  return {
    resources,
    activeTheme,
    cosmeticPoints,
    addResources,
    deductResources,
    isAtCapacity,
  }
}
