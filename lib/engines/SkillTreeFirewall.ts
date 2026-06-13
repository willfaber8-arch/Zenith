/**
 * ════════════════════════════════════════════════════════════════
 * Zenith Games Tab — Skill Tree Firewall
 * Step 6.2 — Nexus Gateway Access Firewall
 *
 * Pure validation and transaction engine — zero React imports.
 * All exported functions are safe to call from useEffect, event
 * handlers, or useCallback closures.
 *
 * Execution pipeline (enforced in this order on every unlock):
 *
 *   Phase 1 · Prerequisite Scan
 *     Read the target node's `prerequisites` array. Query the
 *     `skill_tree` table for each prerequisite. Abort with
 *     'PREREQUISITE_LOCKED' if any parent node row is missing.
 *
 *   Phase 2 · Pre-Flight Inventory Check
 *     Read the node's `costs` array. Query `resource_inventory`
 *     for current balances. Abort with 'INSUFFICIENT_FUNDS' if
 *     any single resource dimension is below its required amount.
 *
 *   Phase 3 · Atomic Transaction Commit
 *     Open a strict rw transaction over both tables. Inside:
 *       a. Re-validate prerequisites (TOCTOU guard).
 *       b. Re-validate all balances (TOCTOU guard).
 *       c. Deduct each cost element from resource_inventory.
 *       d. Write the SkillTreeRecord to skill_tree.
 *     The transaction ensures that no partial state is ever
 *     committed — all-or-nothing semantics.
 *
 * Central Nexus Firewall rule:
 *   All Branch A / B / C / D tier-1 nodes list `nexus_core_01` as
 *   a prerequisite. Phase 1 enforces this: no downstream node can
 *   be unlocked until `nexus_core_01` is in the skill_tree table.
 *   The firewall is structural — it is the prerequisite graph
 *   itself, not a separate code path.
 *
 * Cost schema summary:
 *   Nexus root  — 5,000 × raw_data_shards + 5,000 × organic_spores
 *                 + 5,000 × cosmic_dust
 *   Tier 1      — 1,500 × branch-specific raw resource
 *   Tier 2      — 5,000 × quantum_fuel or stardust_glass
 *   Tier 3      — 15,000 mixed quantum_fuel + stardust_glass
 * ════════════════════════════════════════════════════════════════
 */

import {
  getGamesDb,
  type ResourceId,
  type ResourceNode,
} from '@/lib/gamesDb'

/* ════════════════════════════════════════════════════════════════
   §1  PUBLIC TYPES  (exported as required by the specification)
   ════════════════════════════════════════════════════════════════ */

/**
 * A single resource cost dimension for unlocking one skill node.
 * The `resourceId` must match a valid key in `resource_inventory`.
 */
export interface NodeCostElement {
  /** Must be a valid ResourceId ('raw_data_shards', 'quantum_fuel', etc.). */
  resourceId: string
  /** Exact units required — validation is strict-equality (balance ≥ amount). */
  amount: number
}

/**
 * Complete definition of a skill tree node.
 * Stored in `SKILL_TREE_REGISTRY` — never mutated at runtime.
 */
export interface NodeDefinition {
  /** Unique slug — used as the primary key in the `skill_tree` Dexie table. */
  id: string
  /** Determines branch colour tinting and unlock multipliers. */
  branchId: 'aesthetic' | 'efficiency' | 'cultivation' | 'synergy'
  /**
   * Tier within the branch.
   * Tier 1 nodes require only `nexus_core_01`.
   * Tier 2 nodes require their branch's tier-1 parent.
   * Tier 3 nodes require their branch's tier-2 parent.
   */
  tier: 1 | 2 | 3
  /**
   * Node IDs that must be present in `skill_tree` before this node
   * can be unlocked.  Empty array = immediately accessible (root only).
   */
  prerequisites: string[]
  /** Multi-resource cost array — all dimensions must be satisfied. */
  costs: NodeCostElement[]
}

/**
 * Discriminated result type for a single firewall execution attempt.
 * Returned by `executeAtomicUnlock` and used by `useSkillTreeActions`.
 */
export interface FirewallExecutionResult {
  success: boolean
  /** Machine-readable reason for failure — omitted on success. */
  error?:
    | 'ALREADY_UNLOCKED'
    | 'PREREQUISITE_LOCKED'
    | 'INSUFFICIENT_FUNDS'
    | 'NODE_NOT_FOUND'
  /** The node ID that was written to `skill_tree` on success. */
  updatedNodeId?: string
}

/**
 * Public interface returned by `useSkillTreeActions`.
 *
 * `getNodeLockReason` is synchronous because the hook's
 * `useLiveQuery` subscriptions keep both `skill_tree` and
 * `resource_inventory` cached in React state — no IDB round-trip
 * is needed for UI rendering.
 *
 * `isNodeUnlockable` and `executeNodeUnlock` are async because they
 * may be called in rapid succession from user interaction and benefit
 * from fresh DB reads to detect concurrent tab conflicts.
 */
export interface SkillFirewallResult {
  /**
   * Returns `true` when all prerequisites are met and all resource
   * balances are sufficient. Never throws.
   */
  isNodeUnlockable: (nodeId: string) => Promise<boolean>
  /**
   * Runs the full three-phase pipeline and commits the atomic
   * transaction.  Returns a result object — never throws.
   */
  executeNodeUnlock: (nodeId: string) => Promise<{
    success:         boolean
    error?:          string
    updatedNodeId?:  string
  }>
  /**
   * Synchronous lock-reason probe using cached reactive data.
   * Safe to call during the React render cycle.
   */
  getNodeLockReason: (nodeId: string) =>
    | 'PREREQUISITE_LOCKED'
    | 'INSUFFICIENT_FUNDS'
    | 'READY'
    | 'ALREADY_UNLOCKED'
}

/* ════════════════════════════════════════════════════════════════
   §2  CONSTANTS
   ════════════════════════════════════════════════════════════════ */

/** Primary key of the Central Nexus Gateway node — the root of the tree. */
export const NEXUS_NODE_ID = 'nexus_core_01' as const

/* ════════════════════════════════════════════════════════════════
   §3  SKILL TREE REGISTRY
   ────────────────────────────────────────────────────────────────
   13 nodes total:
     1  nexus_core_01         (root — branch: synergy)
     3  Branch A              (aesthetic)
     3  Branch B              (efficiency)
     3  Branch C              (cultivation)
     3  Branch D              (synergy tier 1–3)

   Cost schema (see module comment for the full breakdown):
     Root      5,000 × raw_data_shards + 5,000 × organic_spores
               + 5,000 × cosmic_dust
     Tier 1    1,500 × branch-specific raw resource
     Tier 2    5,000 × quantum_fuel or stardust_glass
     Tier 3    15,000 total mixed quantum_fuel + stardust_glass
   ════════════════════════════════════════════════════════════════ */

export const SKILL_TREE_REGISTRY: readonly NodeDefinition[] = [

  /* ── Central Nexus Gateway ─────────────────────────────────── */
  {
    id:            NEXUS_NODE_ID,
    branchId:      'synergy',
    tier:          1,
    prerequisites: [],
    costs: [
      { resourceId: 'raw_data_shards', amount: 5_000 },
      { resourceId: 'organic_spores',  amount: 5_000 },
      { resourceId: 'cosmic_dust',     amount: 5_000 },
    ],
  },

  /* ── Branch A · Aesthetic Resonance (Cosmetics Path) ────────── */
  {
    id:            'a1_preview',
    branchId:      'aesthetic',
    tier:          1,
    prerequisites: [NEXUS_NODE_ID],
    costs: [{ resourceId: 'raw_data_shards', amount: 1_500 }],
  },
  {
    id:            'a2_particles',
    branchId:      'aesthetic',
    tier:          2,
    prerequisites: ['a1_preview'],
    costs: [{ resourceId: 'quantum_fuel', amount: 5_000 }],
  },
  {
    id:            'a3_typography',
    branchId:      'aesthetic',
    tier:          3,
    prerequisites: ['a2_particles'],
    costs: [
      { resourceId: 'quantum_fuel',   amount: 8_000 },
      { resourceId: 'stardust_glass', amount: 7_000 },
    ],
  },

  /* ── Branch B · Quantum Efficiency (Gameplay Multipliers) ────── */
  {
    id:            'b1_refinery',
    branchId:      'efficiency',
    tier:          1,
    prerequisites: [NEXUS_NODE_ID],
    costs: [{ resourceId: 'organic_spores', amount: 1_500 }],
  },
  {
    id:            'b2_shield',
    branchId:      'efficiency',
    tier:          2,
    prerequisites: ['b1_refinery'],
    costs: [{ resourceId: 'quantum_fuel', amount: 5_000 }],
  },
  {
    id:            'b3_harvest',
    branchId:      'efficiency',
    tier:          3,
    prerequisites: ['b2_shield'],
    costs: [
      { resourceId: 'quantum_fuel',   amount: 10_000 },
      { resourceId: 'stardust_glass', amount:  5_000 },
    ],
  },

  /* ── Branch C · Ecosphere Cultivation (Biosphere Modules) ────── */
  {
    id:            'c1_aquarium',
    branchId:      'cultivation',
    tier:          1,
    prerequisites: [NEXUS_NODE_ID],
    costs: [{ resourceId: 'cosmic_dust', amount: 1_500 }],
  },
  {
    id:            'c2_zoo',
    branchId:      'cultivation',
    tier:          2,
    prerequisites: ['c1_aquarium'],
    costs: [{ resourceId: 'stardust_glass', amount: 5_000 }],
  },
  {
    id:            'c3_projection',
    branchId:      'cultivation',
    tier:          3,
    prerequisites: ['c2_zoo'],
    costs: [
      { resourceId: 'quantum_fuel',   amount:  5_000 },
      { resourceId: 'stardust_glass', amount: 10_000 },
    ],
  },

  /* ── Branch D · Synergy Convergence (Cross-System Mastery) ────── */
  {
    id:            'd1_synthesis',
    branchId:      'synergy',
    tier:          1,
    prerequisites: [NEXUS_NODE_ID],
    costs: [{ resourceId: 'raw_data_shards', amount: 1_500 }],
  },
  {
    id:            'd2_resonance',
    branchId:      'synergy',
    tier:          2,
    prerequisites: ['d1_synthesis'],
    costs: [{ resourceId: 'stardust_glass', amount: 5_000 }],
  },
  {
    id:            'd3_convergence',
    branchId:      'synergy',
    tier:          3,
    prerequisites: ['d2_resonance'],
    costs: [
      { resourceId: 'quantum_fuel',   amount: 7_500 },
      { resourceId: 'stardust_glass', amount: 7_500 },
    ],
  },
] as const satisfies NodeDefinition[]

/* ════════════════════════════════════════════════════════════════
   §4  O(1) LOOKUP MAP
   ────────────────────────────────────────────────────────────────
   Built once at module load from SKILL_TREE_REGISTRY.
   All engine functions use this map rather than Array.find() to
   keep prerequisite scans O(1) even as the registry grows.
   ════════════════════════════════════════════════════════════════ */

export const SKILL_TREE_MAP: ReadonlyMap<string, NodeDefinition> = new Map(
  SKILL_TREE_REGISTRY.map(def => [def.id, def]),
)

/**
 * Returns the `NodeDefinition` for `nodeId`, or `null` if the ID
 * is not in the registry.  Prefer this over `SKILL_TREE_MAP.get()`
 * at call sites that need the null-safety narrowing.
 */
export function resolveNodeDefinition(nodeId: string): NodeDefinition | null {
  return SKILL_TREE_MAP.get(nodeId) ?? null
}

/* ════════════════════════════════════════════════════════════════
   §5  PHASE 1 — PREREQUISITE SCAN
   ────────────────────────────────────────────────────────────────
   Reads each prerequisite node ID from the registry and confirms
   that a corresponding unlocked record exists in the `skill_tree`
   table.  Executed OUTSIDE the main transaction for fast early-
   exit, then RE-EXECUTED inside the transaction as a TOCTOU guard.
   ════════════════════════════════════════════════════════════════ */

/**
 * Returns `true` if every prerequisite listed in `def.prerequisites`
 * has a row in the `skill_tree` table with `isUnlocked: true`.
 *
 * Returns `false` if any prerequisite is missing or locked.
 * Returns `true` immediately when `prerequisites` is empty (root).
 *
 * @param def  The target node's definition.
 */
export async function runPrerequisiteScan(
  def: NodeDefinition,
): Promise<boolean> {
  if (def.prerequisites.length === 0) return true

  const db = getGamesDb()

  const results = await Promise.all(
    def.prerequisites.map(prereqId => db.skill_tree.get(prereqId)),
  )

  return results.every(record => record?.isUnlocked === true)
}

/* ════════════════════════════════════════════════════════════════
   §6  PHASE 2 — PRE-FLIGHT INVENTORY CHECK
   ────────────────────────────────────────────────────────────────
   Reads each cost dimension from `resource_inventory` and verifies
   that the current balance meets or exceeds the required amount.
   Strict: one deficient resource is enough to abort.
   ════════════════════════════════════════════════════════════════ */

/**
 * Returns `true` if the current `resource_inventory` balances
 * satisfy every cost element in `costs`.
 *
 * Returns `false` immediately when the first deficient resource is
 * found — no need to evaluate remaining costs.
 *
 * @param costs  The cost array from `NodeDefinition.costs`.
 */
export async function runPreFlightInventoryCheck(
  costs: readonly NodeCostElement[],
): Promise<boolean> {
  if (costs.length === 0) return true

  const db = getGamesDb()

  for (const cost of costs) {
    const record = await db.resource_inventory.get(cost.resourceId as ResourceId)
    if (!record || record.balance < cost.amount) return false
  }

  return true
}

/* ════════════════════════════════════════════════════════════════
   §7  PHASE 3 — ATOMIC TRANSACTION COMMIT
   ────────────────────────────────────────────────────────────────
   Opens a strict rw transaction over `skill_tree` and
   `resource_inventory`.  Inside the transaction:
     1. Re-validates already-unlocked guard (idempotency).
     2. Re-validates all prerequisites (TOCTOU guard).
     3. Re-reads all inventory records atomically.
     4. Re-validates all balances (TOCTOU guard).
     5. Deducts each cost dimension from resource_inventory.
     6. Writes the SkillTreeRecord to skill_tree.
   Returns a typed result object — never throws.
   ════════════════════════════════════════════════════════════════ */

/**
 * Executes the full three-phase unlock pipeline for `nodeId`.
 *
 * This is the single entry-point that `useSkillTreeActions` calls.
 * Phases 1 and 2 run as quick pre-flight checks before opening the
 * transaction, reducing lock contention on the IDB store.  Both
 * phases are then repeated inside the transaction as TOCTOU guards.
 *
 * @param nodeId  Must match a key in `SKILL_TREE_MAP`.
 * @returns       A `FirewallExecutionResult` — never throws.
 */
export async function executeAtomicUnlock(
  nodeId: string,
): Promise<FirewallExecutionResult> {
  const db = getGamesDb()

  /* ── Resolve node definition ──────────────────────────────── */
  const def = resolveNodeDefinition(nodeId)
  if (!def) {
    return { success: false, error: 'NODE_NOT_FOUND' }
  }

  /* ── Quick idempotency guard (pre-transaction read) ───────── */
  const existingRecord = await db.skill_tree.get(nodeId)
  if (existingRecord?.isUnlocked) {
    return { success: false, error: 'ALREADY_UNLOCKED' }
  }

  /* ── Phase 1: Prerequisite scan (pre-transaction) ──────────── */
  const prereqOk = await runPrerequisiteScan(def)
  if (!prereqOk) {
    return { success: false, error: 'PREREQUISITE_LOCKED' }
  }

  /* ── Phase 2: Pre-flight inventory check (pre-transaction) ─── */
  const balanceOk = await runPreFlightInventoryCheck(def.costs)
  if (!balanceOk) {
    return { success: false, error: 'INSUFFICIENT_FUNDS' }
  }

  /* ── Phase 3: Atomic transaction commit ─────────────────────── */
  return db.transaction(
    'rw',
    [db.skill_tree, db.resource_inventory],
    async (): Promise<FirewallExecutionResult> => {

      /* TOCTOU guard — re-verify already-unlocked inside tx ── */
      const txExisting = await db.skill_tree.get(nodeId)
      if (txExisting?.isUnlocked) {
        return { success: false, error: 'ALREADY_UNLOCKED' }
      }

      /* TOCTOU guard — re-validate prerequisites inside tx ──── */
      const txPrereqResults = await Promise.all(
        def.prerequisites.map(prereqId => db.skill_tree.get(prereqId)),
      )
      const txPrereqOk = txPrereqResults.every(r => r?.isUnlocked === true)
      if (!txPrereqOk) {
        return { success: false, error: 'PREREQUISITE_LOCKED' }
      }

      /* Re-read all cost resources atomically inside tx ───────── */
      const inventorySnapshots = await Promise.all(
        def.costs.map(cost =>
          db.resource_inventory.get(cost.resourceId as ResourceId),
        ),
      )

      /* TOCTOU guard — re-validate all balances inside tx ─────── */
      for (let i = 0; i < def.costs.length; i++) {
        const cost     = def.costs[i]
        const snapshot = inventorySnapshots[i] as ResourceNode | undefined
        if (!snapshot || snapshot.balance < cost.amount) {
          return { success: false, error: 'INSUFFICIENT_FUNDS' }
        }
      }

      /* Deduct each cost dimension from resource_inventory ─────── */
      for (let i = 0; i < def.costs.length; i++) {
        const cost     = def.costs[i]
        const snapshot = inventorySnapshots[i] as ResourceNode
        await db.resource_inventory.update(
          cost.resourceId as ResourceId,
          { balance: snapshot.balance - cost.amount },
        )
      }

      /* Write the unlock record to skill_tree ─────────────────── */
      await db.skill_tree.put({
        nodeId,
        isUnlocked:    true,
        dateUnlocked:  Date.now(),
      })

      return { success: true, updatedNodeId: nodeId }
    },
  )
}
