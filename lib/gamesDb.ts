/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Games Tab · Local Database Engine
 * Step 1.1 — Dexie.js Schema Configuration
 *
 * Architecture:
 *   A standalone Dexie v4 database ("ZenithGamesOS") that is fully
 *   isolated from the main ZenithOS productivity database. This
 *   keeps game economy state out of the academic data layer and
 *   lets the Games Tab evolve its schema independently.
 *
 * SSR Safety:
 *   Identical pattern to lib/db.ts — `gamesDb` is null-cast on the
 *   server; `getGamesDb()` throws with a descriptive message if called
 *   outside a browser context. All mutations must live inside useEffect,
 *   event handlers, or useLiveQuery callbacks.
 *
 * Database name  : "ZenithGamesOS"
 * Schema version : 1
 * Tables         : resource_inventory · user_profile_config
 * ════════════════════════════════════════════════════════════════
 */

import Dexie, { type EntityTable } from 'dexie'

/* ════════════════════════════════════════════════════════════════
   §1  RESOURCE IDENTIFIER UNION
   ────────────────────────────────────────────────────────────────
   Exhaustive union of every valid key in resource_inventory.
   Kept at the top so every downstream type can reference it.
   ════════════════════════════════════════════════════════════════ */

/**
 * Every resource that can exist in the player's inventory.
 * Three are harvested through gameplay; two are refined via crafting;
 * one is the universal cosmetic currency with no storage cap.
 */
export type ResourceId =
  | 'raw_data_shards'   // raw — typing / grid games
  | 'organic_spores'    // raw — colour / snake games
  | 'cosmic_dust'       // raw — vector / pathfinder games
  | 'quantum_fuel'      // refined — processed from raw_data_shards
  | 'stardust_glass'    // refined — processed from cosmic_dust
  | 'cosmetic_points'   // currency — unlimited, earned via Crucible loop

/* ════════════════════════════════════════════════════════════════
   §2  TABLE ROW INTERFACES
   ════════════════════════════════════════════════════════════════ */

/**
 * One row per resource in `resource_inventory`.
 *
 * `maxCapacity: null` signals infinite storage — only valid for
 * `cosmetic_points`. Every other resource has a hard ceiling.
 *
 * `totalEarnedLifetime` is append-only: it tracks cumulative income
 * independent of spending, enabling long-term progression analytics
 * (e.g., "you have ever earned X shards").
 */
export interface ResourceNode {
  /** Primary key — one of the six ResourceId values. */
  id: ResourceId
  /** Human-readable display name. */
  name: string
  /** Current held amount. Never negative; never exceeds maxCapacity (unless null). */
  balance: number
  /**
   * Hard storage ceiling.
   * `null` means the resource has no cap (cosmetic_points only).
   * All other resources have a base ceiling defined in RESOURCE_META.
   */
  maxCapacity: number | null
  /** Running total of all units ever credited — unaffected by consumption. */
  totalEarnedLifetime: number
}

/**
 * Singleton row in `user_profile_config` (always keyed `'active_user'`).
 *
 * `cosmeticPointsBalance` is a denormalised mirror of the corresponding
 * ResourceNode balance. Both are updated inside the same Dexie transaction
 * by `purchaseTheme()` so they never drift. This field exists for fast
 * profile-level reads (e.g., topbar chip) without a cross-table lookup.
 */
export interface UserProfileConfig {
  /** Always `'active_user'` — this table is a singleton. */
  id: string
  /** The theme currently applied to the Games UI. */
  activeTheme: string
  /** All theme IDs the player has unlocked, including the default. */
  purchasedThemes: string[]
  /**
   * Denormalised cosmetic point balance.
   * Kept in sync with `resource_inventory['cosmetic_points'].balance`
   * via transactional writes in `purchaseTheme()`.
   */
  cosmeticPointsBalance: number
}

/* ════════════════════════════════════════════════════════════════
   §2b  BIOSPHERE STATE INTERFACES  (Step 5.1)
   ────────────────────────────────────────────────────────────────
   Polymorphic record schema for the three visual environments in
   the Games Tab Biosphere Station: Terminal · Aquarium · Zoo.
   Primary key: `environmentId` (BiosphereType string literal).
   ════════════════════════════════════════════════════════════════ */

/**
 * Discriminated identifier for each of the three biosphere environments.
 * Used as the explicit primary key in the `biosphere_states` table.
 */
export type BiosphereType = 'terminal' | 'aquarium' | 'zoo'

/**
 * An individual collectible or decorative asset that the player
 * has unlocked inside a specific biosphere environment.
 *
 * `currentEvolutionStage` tracks the asset's growth over time.
 * Assets at higher stages unlock richer visual states and count
 * toward `advanceEnvironmentStage` threshold requirements inside
 * `BiosphereStateManager`.
 */
export interface EnvironmentalAsset {
  /** Unique slug identifier, e.g. `'kelp_forest'`, `'mainframe_node'`. */
  id: string
  /** Human-readable label rendered in the asset card or tooltip. */
  name: string
  /**
   * Broad domain category determining visual layer and interaction rules.
   * - `'flora'`      — plant-like growths (aquarium, zoo, terminal moss)
   * - `'fauna'`      — living creatures (fish, animals, digital entities)
   * - `'structural'` — hard scenery (rocks, tanks, server racks)
   * - `'digital'`    — synthetic terminal constructs (nodes, processes)
   */
  category: 'flora' | 'fauna' | 'structural' | 'digital'
  /** Unix ms epoch when the player first acquired this asset. */
  purchasedTimestamp: number
  /**
   * Integer tracking the asset's growth level.
   * 0 = newly unlocked / dormant.
   * Incremented by dedicated evolution mechanics in the Biosphere panel.
   * Higher values satisfy `minMaxEvolution` thresholds in the stage engine.
   */
  currentEvolutionStage: number
}

/**
 * Complete state snapshot for one biosphere environment.
 * One row per `BiosphereType` in the `biosphere_states` table.
 *
 * `metadata` is an open extension bucket for environment-specific
 * scalars (e.g. `{ pH: 7.4 }` for aquarium, `{ uptime: 99.8 }` for
 * terminal, `{ occupancy: 12 }` for zoo). Values are typed as
 * `unknown` for structural safety — narrow at point of use.
 */
export interface BiosphereStateRecord {
  /** Primary key. One of the three BiosphereType literals. */
  environmentId: BiosphereType
  /**
   * Overall ecosystem tier (1–5). Incremented atomically by
   * `advanceEnvironmentStage` in `BiosphereStateManager` when the
   * asset-count and evolution-stage thresholds for the next tier are met.
   */
  currentStage: number
  /** When true, this environment is pinned as the global home display. */
  isActiveHomeDisplay: boolean
  /** When true, this environment is pinned to the Study Shield cockpit. */
  isActiveStudyDisplay: boolean
  /** All assets the player has unlocked in this environment. Append-only. */
  unlockedAssets: EnvironmentalAsset[]
  /** Unix ms of the most recent mutation or direct interaction event. */
  lastInteractionTimestamp: number
  /**
   * Open metadata bucket for environment-specific extension data.
   * Values are `unknown` — cast or narrow at the call site.
   *
   * @example Aquarium: `{ pH: 7.4, tempCelsius: 24 }`
   * @example Terminal: `{ uptime: 99.8, processLoad: 42 }`
   * @example Zoo:      `{ occupancy: 12, feedingScheduleHour: 8 }`
   */
  metadata: Record<string, unknown>
}

/**
 * Every valid recipe that can be submitted to the Cosmic Crucible.
 * Five recipes total — one per non-currency resource type.
 */
export type CrucibleRecipeId =
  | 'shards_to_cp'
  | 'spores_to_cp'
  | 'dust_to_cp'
  | 'fuel_to_cp'
  | 'glass_to_cp'

/**
 * One active or completed conversion job in `crucibleJobs`.
 *
 * `startTime` and `targetTime` are UTC milliseconds (Date.now() epoch).
 * The engine computes elapsed time by comparing `Date.now()` against
 * `targetTime` on every tick and on app reboot — no server clock needed.
 */
export interface CrucibleJob {
  /** UUID generated by crypto.randomUUID() at submission time. */
  id: string
  recipeId: CrucibleRecipeId
  /** Unix ms when the batch was submitted and resources were deducted. */
  startTime: number
  /** Unix ms when the conversion will complete (startTime + durationMs). */
  targetTime: number
  /**
   * `'processing'` — countdown running, cosmetic_points not yet awarded.
   * `'completed'`  — timer expired while the app was open; awaiting claim.
   * Catch-up (app-reload) jobs skip `'completed'` — they are auto-credited
   * and deleted by `runCatchUpPhase()` before the UI can observe them.
   */
  status: 'processing' | 'completed'
}

/* ════════════════════════════════════════════════════════════════
   §2c  SKILL TREE RECORD  (Step 6.2)
   ────────────────────────────────────────────────────────────────
   One row per unlocked skill node in the `skill_tree` table.
   Primary key: `nodeId` (string literal matching NodeDefinition.id).
   Locked nodes are simply ABSENT — never store `isUnlocked: false`.
   This "absence = locked" design keeps the table small and makes
   the unlock check a single point-lookup: if the key exists, it's
   unlocked.
   ════════════════════════════════════════════════════════════════ */

/**
 * Persisted record for a skill node that the player has unlocked.
 *
 * Only unlocked nodes are stored. A missing row means locked.
 * This keeps queries O(1) (primary-key get) for prerequisite checks.
 */
export interface SkillTreeRecord {
  /** Primary key — matches the `id` field on `NodeDefinition`. */
  nodeId: string
  /** Always `true` when stored — the presence of the row IS the unlock state. */
  isUnlocked: boolean
  /** Unix ms timestamp when the node was unlocked. */
  dateUnlocked: number
}

/* ════════════════════════════════════════════════════════════════
   §3  RESOURCE METADATA REGISTRY
   ────────────────────────────────────────────────────────────────
   Static compile-time truth for display properties and capacity
   ceilings. Components derive seed data from this — no magic
   numbers scattered across the codebase.
   ════════════════════════════════════════════════════════════════ */

/** Display + domain metadata for a resource — never mutated at runtime. */
export interface ResourceMeta {
  /** Human-readable label shown in UI. */
  readonly name: string
  /**
   * Base storage ceiling for this resource.
   * `null` exclusively for `cosmetic_points`.
   * Future progression systems can multiply this value by an upgrade
   * multiplier without touching this registry.
   */
  readonly maxCapacity: number | null
  /** One-sentence flavour / tooltip description. */
  readonly description: string
  /**
   * Broad category used for grouping in the inventory panel.
   * - `'raw'`      — directly harvested through minigames
   * - `'refined'`  — crafted from raw resources
   * - `'currency'` — universal, uncapped late-game currency
   */
  readonly category: 'raw' | 'refined' | 'currency'
  /**
   * True if players earn this resource directly by playing a game.
   * False for crafted / passively-generated resources.
   */
  readonly isHarvested: boolean
}

export const RESOURCE_META: Readonly<Record<ResourceId, ResourceMeta>> = {
  raw_data_shards: {
    name:         'Raw Data Shards',
    maxCapacity:  200,
    description:  'Harvested by typing and grid-based minigames.',
    category:     'raw',
    isHarvested:  true,
  },
  organic_spores: {
    name:         'Organic Spores',
    maxCapacity:  200,
    description:  'Harvested by colour-matching and snake minigames.',
    category:     'raw',
    isHarvested:  true,
  },
  cosmic_dust: {
    name:         'Cosmic Dust',
    maxCapacity:  200,
    description:  'Harvested by vector-drawing and pathfinder minigames.',
    category:     'raw',
    isHarvested:  true,
  },
  quantum_fuel: {
    name:         'Quantum Fuel',
    maxCapacity:  50,
    description:  'Refined from Raw Data Shards in the Crucible.',
    category:     'refined',
    isHarvested:  false,
  },
  stardust_glass: {
    name:         'Stardust Glass',
    maxCapacity:  50,
    description:  'Refined from Cosmic Dust in the Crucible.',
    category:     'refined',
    isHarvested:  false,
  },
  cosmetic_points: {
    name:         'Cosmetic Points',
    maxCapacity:  null,
    description:  'Universal currency. Accumulated over time via the Crucible loop.',
    category:     'currency',
    isHarvested:  false,
  },
} as const

/**
 * Canonical render order for the inventory panel.
 * Raw resources first, then refined, then currency.
 */
export const RESOURCE_IDS: readonly ResourceId[] = [
  'raw_data_shards',
  'organic_spores',
  'cosmic_dust',
  'quantum_fuel',
  'stardust_glass',
  'cosmetic_points',
] as const

/* ════════════════════════════════════════════════════════════════
   §4  SEED DATA
   ════════════════════════════════════════════════════════════════ */

/** Singleton primary key used throughout for the profile table. */
const ACTIVE_USER_ID = 'active_user' as const

/** The always-available base theme that every player owns by default. */
const DEFAULT_THEME = 'zenith_default' as const

/**
 * Baseline `ResourceNode` rows — every resource starts at zero.
 * Derived entirely from RESOURCE_META so the ceiling values stay
 * in one place.
 */
const SEED_RESOURCES: ResourceNode[] = RESOURCE_IDS.map(id => ({
  id,
  name:                RESOURCE_META[id].name,
  balance:             0,
  maxCapacity:         RESOURCE_META[id].maxCapacity,
  totalEarnedLifetime: 0,
}))

/** Baseline profile singleton. */
const SEED_PROFILE: UserProfileConfig = {
  id:                    ACTIVE_USER_ID,
  activeTheme:           DEFAULT_THEME,
  purchasedThemes:       [DEFAULT_THEME],
  cosmeticPointsBalance: 0,
}

/* ════════════════════════════════════════════════════════════════
   §5  DATABASE CLASS
   ════════════════════════════════════════════════════════════════ */

class ZenithGamesDatabase extends Dexie {
  /**
   * One row per ResourceId — six rows total.
   * Key path: `id` (ResourceId string — explicit, not auto-increment).
   * No secondary indices needed at v1; all reads are by primary key
   * or full-scan via `.toArray()`.
   */
  resource_inventory!: EntityTable<ResourceNode, 'id'>

  /**
   * Global cosmetic / theme config singleton.
   * Key path: `id` (always `'active_user'`).
   */
  user_profile_config!: EntityTable<UserProfileConfig, 'id'>

  /**
   * Active and recently-completed Crucible conversion jobs.
   * Key path: `id` (UUID string).
   * Secondary indices: `recipeId`, `status`, `targetTime` — used by
   * the engine for efficient catch-up and duplicate-submission queries.
   */
  crucibleJobs!: EntityTable<CrucibleJob, 'id'>

  /**
   * Visual environment state for the three Biosphere Station displays.
   * Key path: `environmentId` (BiosphereType string — explicit, not auto-increment).
   * Three rows total after seeding: `'terminal'`, `'aquarium'`, `'zoo'`.
   * No secondary indices at v3 — all reads are O(1) primary-key lookups
   * or full-scan via `.toArray()` (3-row cost; index overhead unwarranted).
   */
  biosphere_states!: EntityTable<BiosphereStateRecord, 'environmentId'>

  /**
   * Skill node unlock ledger for the Games Tab progression tree.
   * Key path: `nodeId` (explicit string PK — never auto-increment).
   * Only unlocked nodes appear here; absence of a row = locked.
   * The secondary index on `isUnlocked` enables efficient "all
   * unlocked nodes" bulk reads without a full-table scan.
   */
  skill_tree!: EntityTable<SkillTreeRecord, 'nodeId'>

  constructor() {
    super('ZenithGamesOS')

    /**
     * v1 — Initial schema.
     *
     * Index strategy: only primary keys are registered here.
     * There are only 6 resource rows, so full-table scans via
     * `.toArray()` are O(6) — faster than index overhead.
     * Add secondary indices in a v2 block if new query patterns
     * demand .where() filtering (e.g., filtering by `category`).
     *
     * Migration rule: never mutate an existing version() block.
     * Append a new `.version(N).stores({...}).upgrade(tx => {...})`
     * below this one for every future schema change.
     */
    this.version(1).stores({
      resource_inventory:  'id',
      user_profile_config: 'id',
    })

    /**
     * v2 — Cosmic Crucible (Step 1.4)
     *
     * Adds `crucibleJobs` with four indexed columns:
     *   `recipeId`   — O(1) duplicate-submission check per recipe.
     *   `status`     — catch-up query filters processing jobs.
     *   `targetTime` — enables future range queries (e.g., completed before X).
     * Max 5 rows at any time (one per recipe), so index overhead is negligible.
     */
    this.version(2).stores({
      crucibleJobs: 'id, recipeId, status, targetTime',
    })

    /**
     * v3 — Biosphere State Manager (Step 5.1)
     *
     * Adds `biosphere_states` keyed on `environmentId` (a BiosphereType
     * string literal — never auto-incremented).
     *
     * Only the primary key is registered. Three rows total after seeding;
     * all queries are primary-key reads, so secondary indices add cost
     * without benefit at this table size.
     *
     * Migration rule: do not mutate this block. Append a new version(4)
     * block below for any future schema changes to this table.
     */
    this.version(3).stores({
      biosphere_states: 'environmentId',
    })

    /**
     * v4 — Skill Tree Firewall (Step 6.2)
     *
     * Adds `skill_tree` keyed on `nodeId` (string literal node ID —
     * matches `NodeDefinition.id` in SkillTreeFirewall.ts).
     *
     * `isUnlocked` is indexed as a secondary key to allow efficient
     * bulk-reads of all unlocked nodes (`.where('isUnlocked').equals(1)`
     * pattern used by `useSkillTreeActions`).
     *
     * Only unlocked nodes are stored. Checking whether a node is locked
     * is a single O(1) primary-key lookup: if `.get(nodeId)` returns
     * undefined, the node is locked.
     *
     * Migration rule: do not mutate this block. Append a new version(5)
     * block below for any future schema changes.
     */
    this.version(4).stores({
      skill_tree: 'nodeId, isUnlocked',
    })
  }
}

/* ════════════════════════════════════════════════════════════════
   §6  SSR-SAFE SINGLETON EXPORT
   ════════════════════════════════════════════════════════════════ */

/**
 * The live ZenithGamesDatabase instance.
 *
 * On the server this resolves to `null` (cast to the class type).
 * It is always defined in the browser — Dexie defers IndexedDB
 * access until the first query, so construction is safe at module scope.
 *
 * ⚠️  Never call database methods at module scope or inside
 *     Server Components. Use `useEffect`, event handlers, or
 *     `useLiveQuery` callbacks.
 */
export const gamesDb: ZenithGamesDatabase =
  typeof window !== 'undefined'
    ? new ZenithGamesDatabase()
    : (null as unknown as ZenithGamesDatabase)

/**
 * Returns the live database instance, throwing a descriptive error
 * if called server-side. Prefer the `gamesDb` export directly in
 * contexts that are already guaranteed to be client-only.
 */
export function getGamesDb(): ZenithGamesDatabase {
  if (typeof window === 'undefined') {
    throw new Error(
      '[gamesDb] ZenithGamesDatabase is not available on the server. ' +
        'Move this call inside a useEffect, event handler, or useLiveQuery callback.',
    )
  }
  return gamesDb
}

/* ════════════════════════════════════════════════════════════════
   §7  DATABASE INITIALISER  (idempotent)
   ════════════════════════════════════════════════════════════════ */

/**
 * Populates the database with baseline rows on first launch.
 * Safe to call on every app boot — checks counts before writing
 * so re-runs are no-ops.
 *
 * Call once from a client-side `useEffect` in the Games Tab root
 * component or a shared bootstrap hook.
 *
 * @example
 * useEffect(() => { seedGamesDatabase() }, [])
 */
export async function seedGamesDatabase(): Promise<void> {
  const db = getGamesDb()

  const [resourceCount, existingProfile] = await Promise.all([
    db.resource_inventory.count(),
    db.user_profile_config.get(ACTIVE_USER_ID),
  ])

  const ops: Promise<unknown>[] = []
  if (resourceCount === 0) ops.push(db.resource_inventory.bulkPut(SEED_RESOURCES))
  if (!existingProfile)   ops.push(db.user_profile_config.put(SEED_PROFILE))
  if (ops.length > 0)     await Promise.all(ops)
}

/* ════════════════════════════════════════════════════════════════
   §8  INVENTORY MUTATION HELPERS
   ────────────────────────────────────────────────────────────────
   All writes are wrapped in Dexie transactions so callers never
   observe partial state. Return a discriminated union instead of
   throwing — callers decide how to surface errors to the player.
   ════════════════════════════════════════════════════════════════ */

/** Discriminated result union returned by every inventory write. */
export type InventoryMutationResult =
  | {
      ok: true
      /** Balance after the operation. */
      newBalance: number
      /**
       * How many units were actually credited (≤ requested amount).
       * Only present on `addToInventory` — `consumeFromInventory`
       * always debits the exact requested amount or fails cleanly.
       */
      amountActuallyAdded?: number
    }
  | {
      ok: false
      reason:
        | 'at_capacity'          // resource is full; no units credited
        | 'insufficient_balance' // balance < requested debit amount
        | 'resource_not_found'   // resourceId not in the database yet
    }

/**
 * Atomically credits `amount` units to a resource.
 *
 * If `amount` would overflow `maxCapacity`, the actual credited amount
 * is clamped to the remaining headroom (`maxCapacity - balance`).
 * `totalEarnedLifetime` is incremented by the clamped amount, not the
 * requested amount — it reflects what was actually stored.
 *
 * Returns `{ ok: false, reason: 'at_capacity' }` when the resource
 * is already at its ceiling with no headroom at all.
 *
 * @throws {RangeError} if `amount` is not a positive finite number.
 */
export async function addToInventory(
  resourceId: ResourceId,
  amount: number,
): Promise<InventoryMutationResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RangeError(
      `addToInventory: amount must be a positive finite number, received ${amount}`,
    )
  }

  const db = getGamesDb()

  return db.transaction('rw', db.resource_inventory, async () => {
    const node = await db.resource_inventory.get(resourceId)
    if (!node) return { ok: false as const, reason: 'resource_not_found' as const }

    // At capacity — no headroom at all
    if (node.maxCapacity !== null && node.balance >= node.maxCapacity) {
      return { ok: false as const, reason: 'at_capacity' as const }
    }

    // Clamp to remaining headroom (null maxCapacity = no clamp)
    const credited =
      node.maxCapacity !== null
        ? Math.min(amount, node.maxCapacity - node.balance)
        : amount

    const newBalance = node.balance + credited

    await db.resource_inventory.update(resourceId, {
      balance:             newBalance,
      totalEarnedLifetime: node.totalEarnedLifetime + credited,
    })

    return { ok: true as const, newBalance, amountActuallyAdded: credited }
  })
}

/**
 * Atomically debits `amount` units from a resource.
 *
 * Fails cleanly with `'insufficient_balance'` rather than allowing
 * the balance to go negative. `totalEarnedLifetime` is not affected
 * by consumption — it only ever grows.
 *
 * @throws {RangeError} if `amount` is not a positive finite number.
 */
export async function consumeFromInventory(
  resourceId: ResourceId,
  amount: number,
): Promise<InventoryMutationResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RangeError(
      `consumeFromInventory: amount must be a positive finite number, received ${amount}`,
    )
  }

  const db = getGamesDb()

  return db.transaction('rw', db.resource_inventory, async () => {
    const node = await db.resource_inventory.get(resourceId)
    if (!node) return { ok: false as const, reason: 'resource_not_found' as const }
    if (node.balance < amount) return { ok: false as const, reason: 'insufficient_balance' as const }

    const newBalance = node.balance - amount
    await db.resource_inventory.update(resourceId, { balance: newBalance })
    return { ok: true as const, newBalance }
  })
}

/**
 * Read-only pre-flight check — can this resource accept more units?
 * Use to disable harvest buttons before committing a write.
 */
export async function canAdd(resourceId: ResourceId, amount = 1): Promise<boolean> {
  const node = await getGamesDb().resource_inventory.get(resourceId)
  if (!node) return false
  if (node.maxCapacity === null) return amount > 0
  return node.balance < node.maxCapacity && amount > 0
}

/**
 * Read-only pre-flight check — does this resource have enough balance?
 * Use to disable spend buttons before committing a write.
 */
export async function canConsume(resourceId: ResourceId, amount: number): Promise<boolean> {
  const node = await getGamesDb().resource_inventory.get(resourceId)
  if (!node) return false
  return node.balance >= amount
}

/* ════════════════════════════════════════════════════════════════
   §9  PROFILE HELPERS
   ════════════════════════════════════════════════════════════════ */

/**
 * Returns the active player profile, or `null` if the database has
 * not been seeded yet (call `seedGamesDatabase()` first).
 */
export async function getActiveProfile(): Promise<UserProfileConfig | null> {
  return (await getGamesDb().user_profile_config.get(ACTIVE_USER_ID)) ?? null
}

/**
 * Purchases a cosmetic theme in a single atomic transaction.
 *
 * Debits `cost` cosmetic points from both `resource_inventory` and
 * the denormalised `user_profile_config.cosmeticPointsBalance` field,
 * then appends `themeId` to `purchasedThemes`.
 *
 * All three writes land atomically — partial state is impossible.
 *
 * @returns `{ ok: false, reason }` for every guard failure so the
 *          UI can show an actionable message without catching errors.
 */
export async function purchaseTheme(
  themeId: string,
  cost: number,
): Promise<{ ok: boolean; reason?: string }> {
  if (!Number.isFinite(cost) || cost < 0) {
    throw new RangeError(`purchaseTheme: cost must be a non-negative finite number, received ${cost}`)
  }

  const db = getGamesDb()

  return db.transaction('rw', [db.resource_inventory, db.user_profile_config], async () => {
    const [profile, cosmeticNode] = await Promise.all([
      db.user_profile_config.get(ACTIVE_USER_ID),
      db.resource_inventory.get('cosmetic_points'),
    ])

    if (!profile || !cosmeticNode) {
      return { ok: false, reason: 'Database not seeded. Call seedGamesDatabase() first.' }
    }
    if (profile.purchasedThemes.includes(themeId)) {
      return { ok: false, reason: 'Theme already owned.' }
    }
    if (cosmeticNode.balance < cost) {
      return { ok: false, reason: `Insufficient Cosmetic Points (have ${cosmeticNode.balance}, need ${cost}).` }
    }

    const newBalance = cosmeticNode.balance - cost

    await Promise.all([
      db.resource_inventory.update('cosmetic_points', { balance: newBalance }),
      db.user_profile_config.update(ACTIVE_USER_ID, {
        purchasedThemes:       [...profile.purchasedThemes, themeId],
        cosmeticPointsBalance: newBalance,
      }),
    ])

    return { ok: true }
  })
}

/**
 * Activates a previously purchased theme.
 *
 * Returns `false` if the theme has not been purchased — the caller
 * should surface a "not owned" message rather than silently failing.
 */
export async function setActiveTheme(themeId: string): Promise<boolean> {
  const db      = getGamesDb()
  const profile = await db.user_profile_config.get(ACTIVE_USER_ID)
  if (!profile?.purchasedThemes.includes(themeId)) return false
  await db.user_profile_config.update(ACTIVE_USER_ID, { activeTheme: themeId })
  return true
}

/**
 * Activates a free theme that bypasses the purchase gate (e.g. university
 * brand themes, which are granted for free). Ensures the theme id is also
 * recorded in `purchasedThemes` so the rest of the theme machinery
 * (Shop "Equipped" state, setActiveTheme) treats it as owned afterwards.
 */
export async function applyFreeTheme(themeId: string): Promise<void> {
  const db      = getGamesDb()
  const profile = await db.user_profile_config.get(ACTIVE_USER_ID)
  if (!profile) return
  const purchasedThemes = profile.purchasedThemes.includes(themeId)
    ? profile.purchasedThemes
    : [...profile.purchasedThemes, themeId]
  await db.user_profile_config.update(ACTIVE_USER_ID, { activeTheme: themeId, purchasedThemes })
}
