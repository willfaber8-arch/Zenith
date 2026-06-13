/**
 * ════════════════════════════════════════════════════════════════
 * Zenith Games Tab — Productivity Event Broker
 * Step 6.3 — Path D: Nexus Synergy Event Bus
 *
 * Pure TypeScript module — zero React imports.
 * SSR-safe throughout (every browser-dependent call is guarded by
 * `typeof window !== 'undefined'`).
 *
 * Implements the native window.CustomEvent channel that lets any
 * application module announce a productivity action without importing
 * the games economy engine.  The subscriber layer (wired by
 * useProductivityMultiplier) gates rewards behind the skill_tree
 * table so only nodes the player has unlocked are active.
 *
 * Event name : 'zenith_action'
 * Payload    : ZenithActionEventDetail
 *
 * Skill gate behaviour
 * ────────────────────
 *   d1_synthesis unlocked AND incoming type is 'task_completed' or
 *   'study_shield_complete':
 *     → applyD1FlatReward() atomically credits +5 raw_data_shards,
 *       +5 organic_spores, and +5 cosmic_dust (cap-safe per resource).
 *
 *   d2_resonance unlocked AND incoming type is 'habit_streak_achieved':
 *     → activateBoon() writes to localStorage key
 *       'zenith_active_multiplier_boon' with a 60-minute expiry.
 *       While active, getBoonMultiplier() returns 2.  Any call site
 *       that routes through addResourcesWithBoon() automatically
 *       doubles yield without changing its own logic.
 * ════════════════════════════════════════════════════════════════
 */

import { gamesDb, type ResourceId } from '@/lib/gamesDb'

/* ════════════════════════════════════════════════════════════════
   §1  PUBLIC EVENT SCHEMA
   ════════════════════════════════════════════════════════════════ */

/**
 * The exhaustive set of productivity action types the broker
 * understands.  Extend this union as new cross-pillar triggers
 * are introduced — no changes to the hook listener are required.
 */
export type ZenithProductivityEventType =
  | 'task_completed'
  | 'habit_streak_achieved'
  | 'study_shield_complete'

/**
 * Payload structure carried inside every `'zenith_action'`
 * CustomEvent.  The `payload` field is optional so simple dispatch
 * sites don't need to construct it.
 */
export interface ZenithActionEventDetail {
  type: ZenithProductivityEventType
  payload?: {
    /**
     * Caller-supplied numeric weight forwarded transparently on
     * the event.  The broker does not interpret this value; future
     * D3-tier mechanics may use it for variable reward scaling.
     */
    multiplierWeight?: number
    /** Human-readable label for logging / toast surfaces. */
    description?: string
  }
}

/* ════════════════════════════════════════════════════════════════
   §2  CONSTANTS
   ════════════════════════════════════════════════════════════════ */

/** Native browser event name — shared between dispatcher and subscriber. */
export const ZENITH_ACTION_EVENT_NAME = 'zenith_action' as const

/** localStorage key for the serialised BoonRecord. */
export const BOON_STORAGE_KEY = 'zenith_active_multiplier_boon' as const

/** skill_tree nodeId that gates D1 flat-reward processing. */
export const D1_NODE_ID = 'd1_synthesis' as const

/** skill_tree nodeId that gates D2 boon activation. */
export const D2_NODE_ID = 'd2_resonance' as const

/** Duration of one D2 Nexus Boon window: 60 minutes in milliseconds. */
export const BOON_DURATION_MS = 3_600_000

/** Units credited to each raw resource when a D1 event fires. */
export const D1_FLAT_REWARD = 5 as const

/** The three ResourceIds that receive a D1 flat reward. */
export const D1_REWARD_RESOURCES: readonly ResourceId[] = [
  'raw_data_shards',
  'organic_spores',
  'cosmic_dust',
] as const

/* ════════════════════════════════════════════════════════════════
   §3  BOON STATE  (localStorage, synchronous, SSR-safe)
   ════════════════════════════════════════════════════════════════ */

/** Internal serialisation shape stored in localStorage. */
interface BoonRecord {
  active: boolean
  /** UTC ms epoch when this boon window expires. */
  expiresAt: number
}

/**
 * Parses the boon record from localStorage without throwing.
 * Returns null when absent, malformed, or called server-side.
 */
function readBoonRecord(): BoonRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(BOON_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BoonRecord
    if (
      typeof parsed?.active !== 'boolean' ||
      typeof parsed?.expiresAt !== 'number'
    ) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Returns true when a D2 Nexus Boon is stored in localStorage and
 * its expiry epoch has not yet been reached.  SSR-safe.
 */
export function isBoonCurrentlyActive(): boolean {
  const record = readBoonRecord()
  if (!record || !record.active) return false
  return Date.now() < record.expiresAt
}

/**
 * Returns the UTC ms expiry epoch for the active boon, or null when
 * no boon is running.  SSR-safe.
 */
export function getBoonExpiresAt(): number | null {
  const record = readBoonRecord()
  if (!record || !record.active) return null
  if (Date.now() >= record.expiresAt) return null
  return record.expiresAt
}

/**
 * Returns 2 while a D2 Nexus Boon is active, 1 at all other times.
 * Synchronous — reads from localStorage with no async overhead.
 * Call this at any game session payout site that should participate
 * in the boon multiplier economy.
 */
export function getBoonMultiplier(): 1 | 2 {
  return isBoonCurrentlyActive() ? 2 : 1
}

/**
 * Writes a fresh BoonRecord to localStorage with a BOON_DURATION_MS
 * expiry from the current moment.  If a boon is already running, the
 * window is refreshed to a full 60 minutes from now.  SSR-safe.
 */
export function activateBoon(): void {
  if (typeof window === 'undefined') return
  const record: BoonRecord = {
    active:    true,
    expiresAt: Date.now() + BOON_DURATION_MS,
  }
  window.localStorage.setItem(BOON_STORAGE_KEY, JSON.stringify(record))
}

/**
 * Removes the boon record from localStorage.
 * No-op when called server-side or when no boon is stored.
 */
export function deactivateBoon(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(BOON_STORAGE_KEY)
}

/* ════════════════════════════════════════════════════════════════
   §4  DISPATCH HELPER
   ════════════════════════════════════════════════════════════════ */

/**
 * Dispatches a `ZenithActionEventDetail` onto the global window
 * CustomEvent bus.  Any module in the application can call this
 * without importing the games DB layer — the subscriber registered
 * by useProductivityMultiplier owns the reward pipeline.
 *
 * SSR-safe — no-op when called outside a browser context.
 *
 * @param type    The productivity action category.
 * @param weight  Optional numeric hint passed through the payload
 *                for future D3-tier variable-scaling mechanics.
 */
export const trackZenithAction = (
  type: ZenithProductivityEventType,
  weight?: number,
): void => {
  if (typeof window === 'undefined') return
  const detail: ZenithActionEventDetail = {
    type,
    payload: { multiplierWeight: weight },
  }
  window.dispatchEvent(
    new CustomEvent<ZenithActionEventDetail>(ZENITH_ACTION_EVENT_NAME, { detail }),
  )
}

/* ════════════════════════════════════════════════════════════════
   §5  SHARED RESULT TYPE
   ════════════════════════════════════════════════════════════════ */

/**
 * Returned by applyD1FlatReward (one element per resource) and by
 * addResourcesWithBoon (single element for the targeted resource).
 */
export interface BrokerAddResult {
  /** The resource that was modified. */
  resourceId: ResourceId
  /** Units actually credited (≤ requested, accounting for cap). */
  added: number
  /** True when the storage ceiling was reached during this credit. */
  capped: boolean
}

/* ════════════════════════════════════════════════════════════════
   §6  D1 FLAT REWARD  (invoked by useProductivityMultiplier)
   ════════════════════════════════════════════════════════════════ */

/**
 * Atomically credits D1_FLAT_REWARD units to each of the three raw
 * resources inside a single Dexie rw transaction.  Cap-safe: a full
 * inventory on one resource never blocks credits to others.
 *
 * Returns an empty array when gamesDb is unavailable (SSR or before
 * the database has been seeded).  Otherwise returns one BrokerAddResult
 * per resource in D1_REWARD_RESOURCES order.
 *
 * Intended to be called exclusively from the useProductivityMultiplier
 * event handler after d1_synthesis validation has passed.
 */
export async function applyD1FlatReward(): Promise<BrokerAddResult[]> {
  if (!gamesDb) return []

  return gamesDb.transaction(
    'rw',
    gamesDb.resource_inventory,
    async (): Promise<BrokerAddResult[]> => {
      const results: BrokerAddResult[] = []

      for (const resourceId of D1_REWARD_RESOURCES) {
        const node = await gamesDb.resource_inventory.get(resourceId)
        if (!node) continue

        const potential = node.balance + D1_FLAT_REWARD
        let newBalance: number
        let capped: boolean

        if (node.maxCapacity === null) {
          newBalance = potential
          capped     = false
        } else if (potential <= node.maxCapacity) {
          newBalance = potential
          capped     = false
        } else {
          newBalance = node.maxCapacity
          capped     = true
        }

        const added = newBalance - node.balance
        if (added > 0) {
          await gamesDb.resource_inventory.update(resourceId, {
            balance:             newBalance,
            totalEarnedLifetime: node.totalEarnedLifetime + added,
          })
        }

        results.push({ resourceId, added, capped })
      }

      return results
    },
  )
}

/* ════════════════════════════════════════════════════════════════
   §7  BOON-AWARE RESOURCE CREDIT
   ════════════════════════════════════════════════════════════════ */

/**
 * Drop-in replacement for addToInventory at game session completion
 * sites that should participate in the D2 boon multiplier.
 *
 * Multiplies `amount` by getBoonMultiplier() (1 or 2) before writing
 * so that sessions launched during an active boon automatically receive
 * doubled yield without any change to the calling game code.
 *
 * Performs full cap enforcement and increments totalEarnedLifetime by
 * the actual credited amount (matching the addToInventory contract).
 *
 * Returns a zero-credit BrokerAddResult when gamesDb is unavailable
 * or when `amount` is not a positive finite number.
 */
export async function addResourcesWithBoon(
  resourceId: ResourceId,
  amount: number,
): Promise<BrokerAddResult> {
  const zero: BrokerAddResult = { resourceId, added: 0, capped: false }

  if (!gamesDb || !Number.isFinite(amount) || amount <= 0) return zero

  const effectiveAmount = amount * getBoonMultiplier()

  return gamesDb.transaction(
    'rw',
    gamesDb.resource_inventory,
    async (): Promise<BrokerAddResult> => {
      const node = await gamesDb.resource_inventory.get(resourceId)
      if (!node) return zero

      const potential = node.balance + effectiveAmount
      let newBalance: number
      let capped: boolean

      if (node.maxCapacity === null) {
        newBalance = potential
        capped     = false
      } else if (potential <= node.maxCapacity) {
        newBalance = potential
        capped     = false
      } else {
        newBalance = node.maxCapacity
        capped     = true
      }

      const added = newBalance - node.balance
      if (added > 0) {
        await gamesDb.resource_inventory.update(resourceId, {
          balance:             newBalance,
          totalEarnedLifetime: node.totalEarnedLifetime + added,
        })
      }

      return { resourceId, added, capped }
    },
  )
}

/* ════════════════════════════════════════════════════════════════
   §8  SKILL TREE VALIDATION HELPERS  (async DB reads)
   ════════════════════════════════════════════════════════════════ */

/**
 * Returns true when the d1_synthesis node is present and marked
 * unlocked in the gamesDb skill_tree table.
 *
 * Intended for the event handler path — not for the React render cycle.
 * SSR-safe — returns false when gamesDb is null.
 */
export async function isD1Active(): Promise<boolean> {
  if (!gamesDb) return false
  const record = await gamesDb.skill_tree.get(D1_NODE_ID)
  return record?.isUnlocked === true
}

/**
 * Returns true when the d2_resonance node is present and marked
 * unlocked in the gamesDb skill_tree table.
 *
 * Intended for the event handler path — not for the React render cycle.
 * SSR-safe — returns false when gamesDb is null.
 */
export async function isD2Active(): Promise<boolean> {
  if (!gamesDb) return false
  const record = await gamesDb.skill_tree.get(D2_NODE_ID)
  return record?.isUnlocked === true
}
