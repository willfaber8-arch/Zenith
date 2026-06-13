'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith Games Tab — Storage Upgrade Engine
 * Step 1.3 — Storage Upgrade Engine Logic
 *
 * Manages the mathematical ruleset and database mutation pipeline
 * that allows players to permanently expand the maxCapacity of each
 * resource node in the inventory.
 *
 * Architecture:
 *   • Static UPGRADE_MATRIX encodes every tier's cost vector and
 *     new capacity ceiling — computed once at module load, zero runtime cost.
 *   • resolveNextUpgrade() maps current maxCapacity → UpgradeTier purely,
 *     enabling synchronous isUpgradable checks from live reactive data.
 *   • purchaseStorageUpgrade() runs a two-phase commit:
 *       Phase 1 (pre-flight) — fast reads outside the transaction to give
 *         an early descriptive error without ever opening a write lock.
 *       Phase 2 (atomic commit) — Dexie rw transaction re-reads and
 *         re-validates everything before writing, eliminating TOCTOU races.
 *
 * Level progression:
 *   Raw resources  : L1 (200) → L2 (1,000) → L3 (5,000, max)
 *   Refined items  : L1 (50)  → L2 (250)   → L3 (1,250, max)
 *   Cosmetic points: infinite capacity — not upgradable.
 *
 * L2→L3 costs = L1→L2 costs × TIER_SCALE_FACTOR (3.5)
 * ════════════════════════════════════════════════════════════════
 */

import { useMemo, useCallback } from 'react'
import { useLiveQuery }         from 'dexie-react-hooks'
import {
  gamesDb,
  type ResourceNode,
  type ResourceId,
} from '@/lib/gamesDb'

/* ════════════════════════════════════════════════════════════════
   §1  PUBLIC INTERFACES  (exported per spec)
   ════════════════════════════════════════════════════════════════ */

/** A single item within an upgrade's cost vector. */
export interface UpgradeRequirement {
  /** The resource that must be consumed. */
  resourceId: string
  /** Exact units required — not a minimum, not a range. */
  amountRequired: number
}

/**
 * Describes one upgradeable tier for a given resource:
 * what it currently costs, what level it moves to, and what
 * the new storage ceiling will be on success.
 */
export interface UpgradeMatrixNode {
  /** The player's current storage level for this resource. */
  currentLevel: number
  /** The level that will be granted on a successful purchase. */
  nextLevel: number
  /** The maxCapacity value written to the database on success. */
  newCapacity: number
  /** Every resource that must be simultaneously deducted. */
  costs: UpgradeRequirement[]
}

/**
 * The full result payload returned by `purchaseStorageUpgrade`.
 * A superset of the spec's inline return type — extra fields
 * are structurally compatible and ignored by consumers that
 * only destructure `{ success, error, newCapacity }`.
 */
export interface UpgradePurchaseResult {
  success: boolean
  /** Human-readable failure reason — only present when success is false. */
  error?: string
  /** The new maxCapacity written to the database — only present on success. */
  newCapacity?: number
  /**
   * Precise record of every deduction made in the atomic commit.
   * Only present on success. Consumers can drive delta animations
   * (e.g., "-150 Organic Spores") from this payload.
   */
  delta?: Array<{
    resourceId: string
    amountConsumed: number
    balanceAfter: number
  }>
}

/** Full public surface of `useZenithStorageUpgrades`. */
export interface StorageUpgradeHookResult {
  /**
   * Returns the upgrade node describing costs and new capacity for
   * the resource's *current* level. Returns `null` if the resource
   * is already at maximum level or has no upgrade path (e.g., cosmetic_points).
   *
   * Always performs a fresh database read so the matrix reflects
   * the committed capacity even if called immediately after an upgrade.
   */
  getUpgradeMatrix: (resourceId: string) => Promise<UpgradeMatrixNode | null>
  /**
   * Executes the full two-phase upgrade pipeline:
   * pre-flight validation → atomic Dexie rw transaction.
   * Returns a descriptive error object on every failure mode —
   * never throws so game-loop callers need no try/catch.
   */
  purchaseStorageUpgrade: (resourceId: string) => Promise<UpgradePurchaseResult>
  /**
   * Synchronous utility for UI button state.
   * Returns `true` only when:
   *   a) an upgrade tier exists for this resource, AND
   *   b) the live reactive balances satisfy *every* cost requirement.
   * Returns `false` during the boot frame (safe default).
   */
  isUpgradable: (resourceId: string) => boolean
}

/* ════════════════════════════════════════════════════════════════
   §2  INTERNAL TIER TYPE
   ────────────────────────────────────────────────────────────────
   Extends UpgradeMatrixNode with `fromCapacity` so resolveNextUpgrade()
   can perform an O(n) lookup against the resource's current maxCapacity
   without building a secondary index.  n ≤ 2 for every resource.
   ════════════════════════════════════════════════════════════════ */

interface UpgradeTier extends UpgradeMatrixNode {
  /**
   * The maxCapacity value that maps to this tier.
   * A resource whose current maxCapacity equals this value is eligible
   * for the upgrade described by this node.
   */
  fromCapacity: number
}

/* ════════════════════════════════════════════════════════════════
   §3  UPGRADE MATRIX  (static, computed once at module load)
   ────────────────────────────────────────────────────────────────
   The matrix is keyed by ResourceId. Each entry is an array of
   exactly two UpgradeTier objects: [L1→L2, L2→L3].
   cosmetic_points has no entry — its capacity is infinite.

   Level 2→3 cost formula:  Math.round(baseCost × TIER_SCALE_FACTOR)
   All base costs are even multiples of 3.5 so Math.round is a no-op,
   but the call is retained for defensive correctness.
   ════════════════════════════════════════════════════════════════ */

const TIER_SCALE_FACTOR = 3.5

/**
 * Builds a Level 2→3 cost vector by scaling every element of the
 * Level 1→2 cost vector by TIER_SCALE_FACTOR and rounding to the
 * nearest integer.
 */
function scaleToTier3(l1Costs: UpgradeRequirement[]): UpgradeRequirement[] {
  return l1Costs.map(c => ({
    resourceId:      c.resourceId,
    amountRequired:  Math.round(c.amountRequired * TIER_SCALE_FACTOR),
  }))
}

/*
 * Tier 1→2 base cost vectors (per spec):
 *   raw_data_shards : 150 organic_spores  +  50 cosmic_dust
 *   organic_spores  : 150 raw_data_shards +  50 cosmic_dust
 *   cosmic_dust     : 100 raw_data_shards + 100 organic_spores
 *   quantum_fuel    : 500 raw_data_shards +  10 stardust_glass
 *   stardust_glass  :  10 quantum_fuel    + 500 cosmic_dust
 *
 * Tier 2→3 (× 3.5):
 *   raw_data_shards : 525 organic_spores  + 175 cosmic_dust
 *   organic_spores  : 525 raw_data_shards + 175 cosmic_dust
 *   cosmic_dust     : 350 raw_data_shards + 350 organic_spores
 *   quantum_fuel    : 1750 raw_data_shards + 35 stardust_glass
 *   stardust_glass  :  35 quantum_fuel    + 1750 cosmic_dust
 */

// L1→L2 base cost vectors — defined once and referenced by scaleToTier3()
const RAW_SHARDS_L1_COSTS: UpgradeRequirement[] = [
  { resourceId: 'organic_spores', amountRequired: 150 },
  { resourceId: 'cosmic_dust',    amountRequired: 50  },
]
const ORGANIC_SPORES_L1_COSTS: UpgradeRequirement[] = [
  { resourceId: 'raw_data_shards', amountRequired: 150 },
  { resourceId: 'cosmic_dust',     amountRequired: 50  },
]
const COSMIC_DUST_L1_COSTS: UpgradeRequirement[] = [
  { resourceId: 'raw_data_shards', amountRequired: 100 },
  { resourceId: 'organic_spores',  amountRequired: 100 },
]
const QUANTUM_FUEL_L1_COSTS: UpgradeRequirement[] = [
  { resourceId: 'raw_data_shards', amountRequired: 500 },
  { resourceId: 'stardust_glass',  amountRequired: 10  },
]
const STARDUST_GLASS_L1_COSTS: UpgradeRequirement[] = [
  { resourceId: 'cosmic_dust',   amountRequired: 500 },
  { resourceId: 'quantum_fuel',  amountRequired: 10  },
]

const UPGRADE_MATRIX: Readonly<Partial<Record<string, readonly UpgradeTier[]>>> = {
  raw_data_shards: [
    {
      fromCapacity: 200,
      currentLevel: 1,
      nextLevel:    2,
      newCapacity:  1_000,
      costs:        RAW_SHARDS_L1_COSTS,
    },
    {
      fromCapacity: 1_000,
      currentLevel: 2,
      nextLevel:    3,
      newCapacity:  5_000,
      costs:        scaleToTier3(RAW_SHARDS_L1_COSTS),
    },
  ],

  organic_spores: [
    {
      fromCapacity: 200,
      currentLevel: 1,
      nextLevel:    2,
      newCapacity:  1_000,
      costs:        ORGANIC_SPORES_L1_COSTS,
    },
    {
      fromCapacity: 1_000,
      currentLevel: 2,
      nextLevel:    3,
      newCapacity:  5_000,
      costs:        scaleToTier3(ORGANIC_SPORES_L1_COSTS),
    },
  ],

  cosmic_dust: [
    {
      fromCapacity: 200,
      currentLevel: 1,
      nextLevel:    2,
      newCapacity:  1_000,
      costs:        COSMIC_DUST_L1_COSTS,
    },
    {
      fromCapacity: 1_000,
      currentLevel: 2,
      nextLevel:    3,
      newCapacity:  5_000,
      costs:        scaleToTier3(COSMIC_DUST_L1_COSTS),
    },
  ],

  quantum_fuel: [
    {
      fromCapacity: 50,
      currentLevel: 1,
      nextLevel:    2,
      newCapacity:  250,
      costs:        QUANTUM_FUEL_L1_COSTS,
    },
    {
      fromCapacity: 250,
      currentLevel: 2,
      nextLevel:    3,
      newCapacity:  1_250,
      costs:        scaleToTier3(QUANTUM_FUEL_L1_COSTS),
    },
  ],

  stardust_glass: [
    {
      fromCapacity: 50,
      currentLevel: 1,
      nextLevel:    2,
      newCapacity:  250,
      costs:        STARDUST_GLASS_L1_COSTS,
    },
    {
      fromCapacity: 250,
      currentLevel: 2,
      nextLevel:    3,
      newCapacity:  1_250,
      costs:        scaleToTier3(STARDUST_GLASS_L1_COSTS),
    },
  ],
  // cosmetic_points intentionally absent — infinite capacity, no upgrade path.
} as const

/* ════════════════════════════════════════════════════════════════
   §4  PURE UTILITY FUNCTIONS
   ════════════════════════════════════════════════════════════════ */

/**
 * Resolves the applicable upgrade tier for a given resource at its
 * current maxCapacity. Returns `null` when:
 *   • The resource has no upgrade path (cosmetic_points).
 *   • The resource is already at maximum level (capacity matches no fromCapacity).
 *   • maxCapacity is null (infinite — cannot be upgraded).
 *
 * This is a pure O(n) lookup with n ≤ 2 — safe in hot render paths.
 */
function resolveNextUpgrade(resourceId: string, currentMaxCapacity: number | null): UpgradeTier | null {
  if (currentMaxCapacity === null) return null
  const tiers = UPGRADE_MATRIX[resourceId]
  if (!tiers) return null
  return tiers.find(t => t.fromCapacity === currentMaxCapacity) ?? null
}

/**
 * Builds a human-readable deficiency description for a failed pre-flight check.
 * Avoids raw resource IDs in player-visible strings.
 */
function buildDeficiencyError(
  costNode: ResourceNode | undefined,
  cost: UpgradeRequirement,
): string {
  const displayName = costNode?.name ?? cost.resourceId.replace(/_/g, ' ')
  const have        = costNode?.balance ?? 0
  return (
    `Insufficient ${displayName}: need ${cost.amountRequired.toLocaleString()}, ` +
    `have ${have.toLocaleString()}.`
  )
}

/* ════════════════════════════════════════════════════════════════
   §5  HOOK IMPLEMENTATION
   ════════════════════════════════════════════════════════════════ */

export function useZenithStorageUpgrades(): StorageUpgradeHookResult {

  /* ── 5a. Reactive inventory stream ──────────────────────────
     Live query feeds the synchronous isUpgradable check.
     Max 2 arguments per dexie-react-hooks v4 (CLAUDE.md rule 31).
     Returns ResourceNode[] | undefined during the boot frame.     */

  const resourcesArray = useLiveQuery<ResourceNode[]>(
    () => gamesDb?.resource_inventory.toArray() ?? Promise.resolve([]),
    [],
  )

  /* O(1) dict keyed by ResourceId — rebuilt only on DB change. */
  const resources = useMemo<Record<string, ResourceNode>>(() => {
    if (!resourcesArray || resourcesArray.length === 0) return {}
    const dict: Record<string, ResourceNode> = {}
    for (const node of resourcesArray) dict[node.id] = node
    return dict
  }, [resourcesArray])

  /* ── 5b. getUpgradeMatrix ───────────────────────────────────
     Performs a fresh database read so the returned node is always
     consistent with the committed state — safe to call immediately
     after purchaseStorageUpgrade completes.                        */

  const getUpgradeMatrix = useCallback(
    async (resourceId: string): Promise<UpgradeMatrixNode | null> => {
      if (!gamesDb) return null

      const node = await gamesDb.resource_inventory.get(resourceId as ResourceId)
      if (!node) return null

      const tier = resolveNextUpgrade(resourceId, node.maxCapacity)
      if (!tier) return null

      // Strip internal `fromCapacity` — return the public UpgradeMatrixNode shape.
      return {
        currentLevel: tier.currentLevel,
        nextLevel:    tier.nextLevel,
        newCapacity:  tier.newCapacity,
        costs:        tier.costs,
      }
    },
    [],
  )

  /* ── 5c. purchaseStorageUpgrade ─────────────────────────────
     Two-phase commit:
       Phase 1 — pre-flight reads outside any transaction for a
         fast early-exit path with descriptive errors. No write lock
         is acquired when validation fails here.
       Phase 2 — atomic rw transaction re-reads and re-validates
         the full cost vector before executing any write, eliminating
         the TOCTOU window between Phase 1 and the commit.           */

  const purchaseStorageUpgrade = useCallback(
    async (resourceId: string): Promise<UpgradePurchaseResult> => {
      if (!gamesDb) {
        return { success: false, error: 'Database unavailable.' }
      }

      /* ── Phase 1: Pre-flight balance interception ─────────── */

      const targetNode = await gamesDb.resource_inventory.get(resourceId as ResourceId)

      if (!targetNode) {
        return { success: false, error: `Resource '${resourceId}' not found in inventory.` }
      }

      const tier = resolveNextUpgrade(resourceId, targetNode.maxCapacity)

      if (!tier) {
        const isInfinite = targetNode.maxCapacity === null
        const reason = isInfinite
          ? `'${resourceId}' has infinite capacity and cannot be upgraded.`
          : `'${resourceId}' is already at maximum storage level.`
        return { success: false, error: reason }
      }

      // Batch-fetch all cost nodes with a single parallel read sweep.
      const costNodeResults = await Promise.all(
        tier.costs.map(c => gamesDb.resource_inventory.get(c.resourceId as ResourceId)),
      )

      // Validate every element in the cost vector — abort on first deficiency.
      for (let i = 0; i < tier.costs.length; i++) {
        const cost     = tier.costs[i]
        const costNode = costNodeResults[i]
        if (!costNode || costNode.balance < cost.amountRequired) {
          return { success: false, error: buildDeficiencyError(costNode, cost) }
        }
      }

      /* ── Phase 2: Atomic commit ───────────────────────────── */

      return gamesDb.transaction(
        'rw',
        gamesDb.resource_inventory,
        async (): Promise<UpgradePurchaseResult> => {

          // Re-read inside the transaction — TOCTOU elimination.
          const txTarget = await gamesDb.resource_inventory.get(resourceId as ResourceId)

          if (!txTarget) {
            return { success: false, error: 'Target resource vanished during transaction.' }
          }

          // Re-resolve the tier — a concurrent upgrade could have already advanced the level.
          const txTier = resolveNextUpgrade(resourceId, txTarget.maxCapacity)

          if (!txTier) {
            return {
              success: false,
              error:   'Upgrade tier no longer available. The resource may have been upgraded concurrently.',
            }
          }

          // Batch re-read all cost nodes inside the transaction.
          const txCostNodes = await Promise.all(
            txTier.costs.map(c => gamesDb.resource_inventory.get(c.resourceId as ResourceId)),
          )

          // Re-validate the full cost vector under the write lock.
          for (let i = 0; i < txTier.costs.length; i++) {
            const cost     = txTier.costs[i]
            const txCostNode = txCostNodes[i]
            if (!txCostNode || txCostNode.balance < cost.amountRequired) {
              return { success: false, error: buildDeficiencyError(txCostNode, cost) }
            }
          }

          // All validations passed — execute atomic writes.
          const delta: UpgradePurchaseResult['delta'] = []

          // Deduct every cost element.
          for (let i = 0; i < txTier.costs.length; i++) {
            const cost       = txTier.costs[i]
            const txCostNode = txCostNodes[i]!
            const balanceAfter = txCostNode.balance - cost.amountRequired

            await gamesDb.resource_inventory.update(cost.resourceId as ResourceId, {
              balance: balanceAfter,
            })

            delta!.push({
              resourceId:     cost.resourceId,
              amountConsumed: cost.amountRequired,
              balanceAfter,
            })
          }

          // Write the upgraded maxCapacity to the target resource.
          await gamesDb.resource_inventory.update(resourceId as ResourceId, {
            maxCapacity: txTier.newCapacity,
          })

          return { success: true, newCapacity: txTier.newCapacity, delta }
        },
      )
    },
    [],
  )

  /* ── 5d. isUpgradable ───────────────────────────────────────
     Purely synchronous — reads from the live reactive `resources`
     dict. No DB round-trip, no Promise. Safe in render expressions
     and imperative button-disabled calculations.

     Returns true only when BOTH conditions hold:
       1. An upgrade tier exists for this resource at its current
          maxCapacity (i.e., it is not already at max level).
       2. Every cost element in that tier's requirement vector is
          fully covered by the current live balance.                */

  const isUpgradable = useCallback(
    (resourceId: string): boolean => {
      const node = resources[resourceId]
      if (!node) return false

      const tier = resolveNextUpgrade(resourceId, node.maxCapacity)
      if (!tier) return false

      return tier.costs.every(cost => {
        const costNode = resources[cost.resourceId]
        return costNode !== undefined && costNode.balance >= cost.amountRequired
      })
    },
    [resources],
  )

  /* ── 5e. Return surface ─────────────────────────────────── */

  return { getUpgradeMatrix, purchaseStorageUpgrade, isUpgradable }
}
