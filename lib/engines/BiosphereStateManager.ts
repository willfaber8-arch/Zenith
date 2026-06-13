/**
 * ════════════════════════════════════════════════════════════════
 * Zenith Games Tab — Biosphere State Manager
 * Step 5.1 — Ecosystem Viewport State Matrix
 *
 * Pure engine module — zero React imports. Every exported function
 * is safe to call from a useEffect, event handler, or useLiveQuery
 * callback. All mutating operations run inside Dexie transactions
 * so callers never observe partial state.
 *
 * Three environments are managed:
 *   'terminal'  — Sci-Fi Mainframe terminal display
 *   'aquarium'  — Minimalist living aquascape
 *   'zoo'       — Micro-Zoo biosphere habitat
 *
 * Stage progression model:
 *   Each environment advances through five tiers (stages 1–5).
 *   Advancement requires both a minimum total asset count AND at
 *   least one asset that has reached a minimum evolution stage.
 *   See STAGE_ADVANCE_THRESHOLDS for the exact values per tier.
 *
 * Return convention:
 *   All mutating functions return a discriminated BiosphereMutationResult
 *   union — never throw for expected failure cases (duplicate asset,
 *   threshold not met, etc.). Callers inspect the `ok` boolean and
 *   branch on the typed `reason` string without try/catch boilerplate.
 * ════════════════════════════════════════════════════════════════
 */

import {
  gamesDb,
  getGamesDb,
  type BiosphereType,
  type EnvironmentalAsset,
  type BiosphereStateRecord,
} from '@/lib/gamesDb'

/* ════════════════════════════════════════════════════════════════
   §1  RE-EXPORTS
   ────────────────────────────────────────────────────────────────
   Forward the canonical types so consumers can import everything
   they need from a single module path:
     import { BiosphereType, EnvironmentalAsset, ... }
       from '@/lib/engines/BiosphereStateManager'
   ════════════════════════════════════════════════════════════════ */

export type { BiosphereType, EnvironmentalAsset, BiosphereStateRecord }

/* ════════════════════════════════════════════════════════════════
   §2  RESULT TYPES
   ════════════════════════════════════════════════════════════════ */

/**
 * Discriminated union returned by every mutating operation in this
 * engine. Callers branch on `ok` — no try/catch required.
 *
 * On success: `environmentId` names the affected row and
 * `updatedRecord` carries the full post-mutation snapshot so the
 * caller never needs a second DB read.
 *
 * On failure: `reason` is one of a closed string-literal set so
 * UI layers can localise messages without string-comparison fragility.
 */
export type BiosphereMutationResult =
  | {
      ok: true
      /** The environment that was mutated. */
      environmentId: BiosphereType
      /** Full record snapshot after the mutation was applied. */
      updatedRecord: BiosphereStateRecord
    }
  | {
      ok: false
      reason:
        | 'environment_not_found'    // row absent — call seedBiosphereStates() first
        | 'asset_already_unlocked'   // duplicate asset id in unlockedAssets[]
        | 'stage_threshold_not_met'  // asset count / evolution requirements unmet
        | 'already_at_max_stage'     // currentStage is already MAX_STAGE
        | 'display_pin_conflict'     // only raised when enforcing single-active policy
    }

/* ════════════════════════════════════════════════════════════════
   §3  STAGE PROGRESSION CONSTANTS
   ────────────────────────────────────────────────────────────────
   STAGE_ADVANCE_THRESHOLDS[N] describes the requirements to advance
   FROM stage (N + 1) TO stage (N + 2). Index 0 = stage 1 → 2.
   ════════════════════════════════════════════════════════════════ */

/** Requirements that must be simultaneously satisfied to advance one tier. */
export interface StageThreshold {
  /**
   * Minimum total number of unlocked assets in the environment.
   * Measures ecosystem breadth — the player must collect widely.
   */
  readonly minTotalAssets: number
  /**
   * At least one asset in `unlockedAssets[]` must have
   * `currentEvolutionStage >= minMaxEvolution`.
   * Measures ecosystem depth — the player must also nurture individual assets.
   */
  readonly minMaxEvolution: number
}

/**
 * Ordered thresholds for each stage transition.
 * Index 0 → stage 1 → 2, index 1 → stage 2 → 3, etc.
 * The array length implicitly defines MAX_STAGE - 1.
 */
export const STAGE_ADVANCE_THRESHOLDS: readonly StageThreshold[] = [
  { minTotalAssets:  3, minMaxEvolution: 1 },   // Tier 1 → Tier 2
  { minTotalAssets:  6, minMaxEvolution: 2 },   // Tier 2 → Tier 3
  { minTotalAssets: 10, minMaxEvolution: 3 },   // Tier 3 → Tier 4
  { minTotalAssets: 15, minMaxEvolution: 4 },   // Tier 4 → Tier 5
] as const

/** Highest achievable ecosystem tier. Never exceeded by any mutation. */
export const MAX_STAGE = 5 as const

/* ════════════════════════════════════════════════════════════════
   §4  SEED DATA
   ────────────────────────────────────────────────────────────────
   Skeleton profiles for the three environments. Inserted once by
   seedBiosphereStates() when the table is vacant.
   ════════════════════════════════════════════════════════════════ */

const SEED_BIOSPHERE_STATES: BiosphereStateRecord[] = [
  {
    environmentId:           'terminal',
    currentStage:            1,
    isActiveHomeDisplay:     false,
    isActiveStudyDisplay:    false,
    unlockedAssets:          [],
    lastInteractionTimestamp: 0,
    metadata:                {},
  },
  {
    environmentId:           'aquarium',
    currentStage:            1,
    isActiveHomeDisplay:     false,
    isActiveStudyDisplay:    false,
    unlockedAssets:          [],
    lastInteractionTimestamp: 0,
    metadata:                {},
  },
  {
    environmentId:           'zoo',
    currentStage:            1,
    isActiveHomeDisplay:     false,
    isActiveStudyDisplay:    false,
    unlockedAssets:          [],
    lastInteractionTimestamp: 0,
    metadata:                {},
  },
] as const satisfies BiosphereStateRecord[]

/* ════════════════════════════════════════════════════════════════
   §5  INTERNAL UTILITIES
   Pure helpers — not exported. Used only within this module.
   ════════════════════════════════════════════════════════════════ */

/**
 * Returns the `StageThreshold` that must be satisfied to advance
 * `record` from its current stage to the next, or `null` when the
 * environment is already at or above MAX_STAGE.
 */
function resolveNextThreshold(record: BiosphereStateRecord): StageThreshold | null {
  if (record.currentStage >= MAX_STAGE) return null
  const thresholdIndex = record.currentStage - 1   // stages are 1-indexed
  return STAGE_ADVANCE_THRESHOLDS[thresholdIndex] ?? null
}

/**
 * Returns the highest `currentEvolutionStage` value across all
 * unlocked assets in a record, or 0 if the asset list is empty.
 */
function computeMaxEvolution(record: BiosphereStateRecord): number {
  if (record.unlockedAssets.length === 0) return 0
  return Math.max(...record.unlockedAssets.map(a => a.currentEvolutionStage))
}

/* ════════════════════════════════════════════════════════════════
   §6  READ OPERATIONS
   No transactions needed — these are read-only point lookups.
   ════════════════════════════════════════════════════════════════ */

/**
 * Returns the state record for a single environment, or `null` if
 * the row does not exist (i.e. the table has not been seeded yet).
 *
 * @example
 * const record = await getBiosphereState('aquarium')
 * if (!record) await seedBiosphereStates()
 */
export async function getBiosphereState(
  environmentId: BiosphereType,
): Promise<BiosphereStateRecord | null> {
  const db = getGamesDb()
  return (await db.biosphere_states.get(environmentId)) ?? null
}

/**
 * Returns all three environment state records as an ordered array.
 * Result is always length 0 or 3 after correct seeding —
 * partial arrays indicate an incomplete seed run.
 */
export async function getAllBiosphereStates(): Promise<BiosphereStateRecord[]> {
  const db = getGamesDb()
  return db.biosphere_states.toArray()
}

/**
 * Pure synchronous helper — evaluates whether the given record's
 * current asset portfolio satisfies the threshold for advancing
 * to the next stage.
 *
 * Returns `false` when the environment is already at MAX_STAGE.
 * Safe to call from the React render cycle (no async needed) because
 * the full record is available from the live useLiveQuery subscription.
 */
export function evaluateStageThreshold(record: BiosphereStateRecord): boolean {
  const threshold = resolveNextThreshold(record)
  if (!threshold) return false   // at max stage or no threshold entry

  const totalAssets  = record.unlockedAssets.length
  const maxEvolution = computeMaxEvolution(record)

  return (
    totalAssets  >= threshold.minTotalAssets &&
    maxEvolution >= threshold.minMaxEvolution
  )
}

/* ════════════════════════════════════════════════════════════════
   §7  SEEDER INITIALISATION PIPELINE
   ────────────────────────────────────────────────────────────────
   Called once from the biosphere station boot hook. Safe to call
   on every app load — the count-guard makes repeated calls no-ops.
   ════════════════════════════════════════════════════════════════ */

/**
 * Idempotent seeder for the `biosphere_states` table.
 *
 * Checks the row count before writing. If the table is empty,
 * inserts three skeleton profiles (terminal / aquarium / zoo),
 * each at `currentStage: 1` with an empty asset array.
 *
 * This guarantees structural integrity before any UI panel attempts
 * to render environment state — preventing null-reference panics
 * on first launch.
 *
 * @example
 * useEffect(() => { void seedBiosphereStates() }, [])
 */
export async function seedBiosphereStates(): Promise<void> {
  const db = getGamesDb()

  const existingCount = await db.biosphere_states.count()
  if (existingCount > 0) return   // already seeded — no-op

  await db.biosphere_states.bulkPut(SEED_BIOSPHERE_STATES)
}

/* ════════════════════════════════════════════════════════════════
   §8  ASSET UNLOCK OPERATION
   ════════════════════════════════════════════════════════════════ */

/**
 * Unlocks a new `EnvironmentalAsset` in the specified environment.
 *
 * Execution path:
 *   1. Opens a read-write transaction on `biosphere_states`.
 *   2. Fetches the target row — returns `environment_not_found`
 *      if the seeder has not run.
 *   3. Checks `unlockedAssets[]` for a pre-existing entry with the
 *      same `asset.id` — returns `asset_already_unlocked` if found.
 *      This prevents duplicate catalogue entries under rapid-fire UI.
 *   4. Appends the new asset and stamps `lastInteractionTimestamp`.
 *   5. Returns the full post-mutation record so callers never need
 *      a second DB read to refresh their UI.
 *
 * @param environmentId  The target biosphere environment.
 * @param asset          The fully-formed asset object to persist.
 * @returns              A BiosphereMutationResult discriminated union.
 */
export async function unlockAssetNode(
  environmentId: BiosphereType,
  asset: EnvironmentalAsset,
): Promise<BiosphereMutationResult> {
  const db = getGamesDb()

  return db.transaction('rw', db.biosphere_states, async () => {
    const record = await db.biosphere_states.get(environmentId)

    if (!record) {
      return { ok: false as const, reason: 'environment_not_found' as const }
    }

    // Duplication guard — O(n) scan on a small array; no index overhead warranted
    const alreadyOwned = record.unlockedAssets.some(a => a.id === asset.id)
    if (alreadyOwned) {
      return { ok: false as const, reason: 'asset_already_unlocked' as const }
    }

    const now           = Date.now()
    const updatedAssets = [...record.unlockedAssets, asset]

    await db.biosphere_states.update(environmentId, {
      unlockedAssets:           updatedAssets,
      lastInteractionTimestamp: now,
    })

    const updatedRecord: BiosphereStateRecord = {
      ...record,
      unlockedAssets:           updatedAssets,
      lastInteractionTimestamp: now,
    }

    return { ok: true as const, environmentId, updatedRecord }
  })
}

/* ════════════════════════════════════════════════════════════════
   §9  STAGE ADVANCEMENT OPERATION
   ════════════════════════════════════════════════════════════════ */

/**
 * Attempts to advance the target environment to the next ecosystem stage.
 *
 * Execution path:
 *   1. Opens a read-write transaction on `biosphere_states`.
 *   2. Fetches the target row — returns `environment_not_found` if absent.
 *   3. Short-circuits with `already_at_max_stage` when `currentStage`
 *      has reached `MAX_STAGE` (5).
 *   4. Resolves the `StageThreshold` for the current stage and evaluates
 *      two criteria simultaneously:
 *        a) `unlockedAssets.length >= threshold.minTotalAssets`
 *        b) `max(asset.currentEvolutionStage) >= threshold.minMaxEvolution`
 *   5. Returns `stage_threshold_not_met` if either criterion fails.
 *   6. Increments `currentStage` and stamps `lastInteractionTimestamp`
 *      in a single atomic write.
 *
 * @param environmentId  The target biosphere environment.
 * @returns              A BiosphereMutationResult discriminated union.
 */
export async function advanceEnvironmentStage(
  environmentId: BiosphereType,
): Promise<BiosphereMutationResult> {
  const db = getGamesDb()

  return db.transaction('rw', db.biosphere_states, async () => {
    const record = await db.biosphere_states.get(environmentId)

    if (!record) {
      return { ok: false as const, reason: 'environment_not_found' as const }
    }

    if (record.currentStage >= MAX_STAGE) {
      return { ok: false as const, reason: 'already_at_max_stage' as const }
    }

    const threshold = resolveNextThreshold(record)
    if (!threshold) {
      // Defensive — should be unreachable given the MAX_STAGE check above
      return { ok: false as const, reason: 'already_at_max_stage' as const }
    }

    const totalAssets  = record.unlockedAssets.length
    const maxEvolution = computeMaxEvolution(record)

    if (
      totalAssets  < threshold.minTotalAssets ||
      maxEvolution < threshold.minMaxEvolution
    ) {
      return { ok: false as const, reason: 'stage_threshold_not_met' as const }
    }

    const newStage = record.currentStage + 1
    const now      = Date.now()

    await db.biosphere_states.update(environmentId, {
      currentStage:            newStage,
      lastInteractionTimestamp: now,
    })

    const updatedRecord: BiosphereStateRecord = {
      ...record,
      currentStage:            newStage,
      lastInteractionTimestamp: now,
    }

    return { ok: true as const, environmentId, updatedRecord }
  })
}

/* ════════════════════════════════════════════════════════════════
   §10  METADATA UPDATE OPERATION
   ════════════════════════════════════════════════════════════════ */

/**
 * Merges a partial metadata patch into an environment's `metadata` bucket.
 *
 * Execution path:
 *   1. Opens a read-write transaction on `biosphere_states`.
 *   2. Fetches the target row — returns `environment_not_found` if absent.
 *   3. Shallow-merges `patch` over the existing metadata object.
 *      Existing keys not present in `patch` are preserved unchanged.
 *      Keys set to `null` in `patch` are preserved as `null` —
 *      to remove a key, pass `{ keyToRemove: undefined }`.
 *   4. Writes the merged object and stamps `lastInteractionTimestamp`.
 *
 * @param environmentId  The target biosphere environment.
 * @param patch          Key-value pairs to merge into `metadata`.
 * @returns              A BiosphereMutationResult discriminated union.
 *
 * @example
 * // Aquarium pH and temperature update
 * await updateBiosphereMetadata('aquarium', { pH: 7.4, tempCelsius: 24 })
 *
 * @example
 * // Terminal uptime update
 * await updateBiosphereMetadata('terminal', { uptime: 99.97, processLoad: 38 })
 */
export async function updateBiosphereMetadata(
  environmentId: BiosphereType,
  patch: Record<string, unknown>,
): Promise<BiosphereMutationResult> {
  const db = getGamesDb()

  return db.transaction('rw', db.biosphere_states, async () => {
    const record = await db.biosphere_states.get(environmentId)

    if (!record) {
      return { ok: false as const, reason: 'environment_not_found' as const }
    }

    const now            = Date.now()
    const mergedMetadata = { ...record.metadata, ...patch }

    await db.biosphere_states.update(environmentId, {
      metadata:                mergedMetadata,
      lastInteractionTimestamp: now,
    })

    const updatedRecord: BiosphereStateRecord = {
      ...record,
      metadata:                mergedMetadata,
      lastInteractionTimestamp: now,
    }

    return { ok: true as const, environmentId, updatedRecord }
  })
}

/* ════════════════════════════════════════════════════════════════
   §11  DISPLAY PIN OPERATION
   ════════════════════════════════════════════════════════════════ */

/**
 * Sets the `isActiveHomeDisplay` or `isActiveStudyDisplay` flag
 * on the target environment.
 *
 * Execution path:
 *   1. Opens a read-write transaction on `biosphere_states`.
 *   2. Fetches the target row — returns `environment_not_found` if absent.
 *   3. Writes the requested pin field and stamps `lastInteractionTimestamp`.
 *
 * Exclusive-pin enforcement (only one active at a time) is intentionally
 * NOT enforced here — that policy belongs in the view layer where it can
 * unpin the previous environment in the same user-action handler without
 * a cross-environment transaction sweep.
 *
 * @param environmentId  The target biosphere environment.
 * @param field          Which display slot to update.
 * @param value          `true` to pin, `false` to unpin.
 * @returns              A BiosphereMutationResult discriminated union.
 */
export async function setPinnedDisplay(
  environmentId: BiosphereType,
  field: 'isActiveHomeDisplay' | 'isActiveStudyDisplay',
  value: boolean,
): Promise<BiosphereMutationResult> {
  const db = getGamesDb()

  return db.transaction('rw', db.biosphere_states, async () => {
    const record = await db.biosphere_states.get(environmentId)

    if (!record) {
      return { ok: false as const, reason: 'environment_not_found' as const }
    }

    const now = Date.now()

    // Use explicit update objects — Dexie's UpdateSpec cannot be satisfied
    // by a computed-key object because `{ [field]: boolean }` widens to
    // `{ [x: string]: boolean }`, which is incompatible with the strict
    // per-field types in UpdateSpec<BiosphereStateRecord>.
    if (field === 'isActiveHomeDisplay') {
      await db.biosphere_states.update(environmentId, {
        isActiveHomeDisplay:     value,
        lastInteractionTimestamp: now,
      })
    } else {
      await db.biosphere_states.update(environmentId, {
        isActiveStudyDisplay:    value,
        lastInteractionTimestamp: now,
      })
    }

    const updatedRecord: BiosphereStateRecord =
      field === 'isActiveHomeDisplay'
        ? { ...record, isActiveHomeDisplay:  value, lastInteractionTimestamp: now }
        : { ...record, isActiveStudyDisplay: value, lastInteractionTimestamp: now }

    return { ok: true as const, environmentId, updatedRecord }
  })
}

/* ════════════════════════════════════════════════════════════════
   §11b  EXCLUSIVE DISPLAY PIN OPERATION  (Step 5.3)
   ────────────────────────────────────────────────────────────────
   Atomic variant of setPinnedDisplay that enforces the single-active
   constraint across all three environments.

   Setting Aquarium's `isActiveStudyDisplay = true` atomically:
     1. Reads all three rows inside the same rw transaction.
     2. Flips Terminal and Zoo's `isActiveStudyDisplay` to false
        (only if they were true — avoids unnecessary writes).
     3. Sets Aquarium's flag to `value`.

   All three writes land in a single Dexie transaction, so consumers
   never observe a state where two environments are simultaneously
   pinned for the same display context.

   Note: the non-exclusive `setPinnedDisplay` (§11) is still exported
   for callers that want fine-grained control without the sweep.
   ════════════════════════════════════════════════════════════════ */

const ALL_BIOSPHERE_ENVS: readonly BiosphereType[] = [
  'terminal',
  'aquarium',
  'zoo',
] as const

/**
 * Atomically pins one environment as the exclusive active display for
 * the given context slot, clearing the same flag on every other
 * environment within a single Dexie transaction.
 *
 * Execution path:
 *   1. Opens a rw transaction on `biosphere_states`.
 *   2. Verifies the target row exists — returns `environment_not_found`
 *      if the seeder has not yet run.
 *   3. When `value = true`: reads each other environment and clears the
 *      relevant flag if currently set (avoids redundant writes on rows
 *      that are already false).
 *   4. Writes the target row's flag to `value` and stamps
 *      `lastInteractionTimestamp` on the target row.
 *   5. Returns the full post-mutation snapshot of the target row.
 *
 * When `value = false` (unpin): only the target row is written.
 * The exclusivity sweep is skipped because un-pinning does not risk
 * creating a duplicate.
 *
 * @param environmentId  The environment to pin or unpin.
 * @param field          Which display slot to update.
 * @param value          `true` to pin exclusively; `false` to unpin.
 */
export async function setExclusivePinnedDisplay(
  environmentId: BiosphereType,
  field: 'isActiveHomeDisplay' | 'isActiveStudyDisplay',
  value: boolean,
): Promise<BiosphereMutationResult> {
  const db = getGamesDb()

  return db.transaction('rw', db.biosphere_states, async () => {
    const target = await db.biosphere_states.get(environmentId)

    if (!target) {
      return { ok: false as const, reason: 'environment_not_found' as const }
    }

    const now = Date.now()

    // ── Exclusivity sweep (only needed when setting a new pin) ──
    if (value) {
      for (const envId of ALL_BIOSPHERE_ENVS) {
        if (envId === environmentId) continue

        const other = await db.biosphere_states.get(envId)
        if (!other) continue

        const isPinned =
          field === 'isActiveHomeDisplay'
            ? other.isActiveHomeDisplay
            : other.isActiveStudyDisplay

        if (isPinned) {
          if (field === 'isActiveHomeDisplay') {
            await db.biosphere_states.update(envId, {
              isActiveHomeDisplay:      false,
              lastInteractionTimestamp: now,
            })
          } else {
            await db.biosphere_states.update(envId, {
              isActiveStudyDisplay:     false,
              lastInteractionTimestamp: now,
            })
          }
        }
      }
    }

    // ── Write the target environment's flag ──────────────────────
    if (field === 'isActiveHomeDisplay') {
      await db.biosphere_states.update(environmentId, {
        isActiveHomeDisplay:      value,
        lastInteractionTimestamp: now,
      })
    } else {
      await db.biosphere_states.update(environmentId, {
        isActiveStudyDisplay:     value,
        lastInteractionTimestamp: now,
      })
    }

    const updatedRecord: BiosphereStateRecord =
      field === 'isActiveHomeDisplay'
        ? { ...target, isActiveHomeDisplay:  value, lastInteractionTimestamp: now }
        : { ...target, isActiveStudyDisplay: value, lastInteractionTimestamp: now }

    return { ok: true as const, environmentId, updatedRecord }
  })
}

/* ════════════════════════════════════════════════════════════════
   §12  INTERACTION TIMESTAMP STAMP
   ════════════════════════════════════════════════════════════════ */

/**
 * Stamps the `lastInteractionTimestamp` for an environment to
 * `Date.now()` without modifying any other field.
 *
 * Use this for lightweight "the player viewed / interacted with
 * this panel" tracking that does not constitute a meaningful
 * state mutation (and therefore does not warrant a full mutation
 * result payload).
 *
 * @param environmentId  The target biosphere environment.
 * @throws {Error} only when the database is unavailable (SSR).
 */
export async function touchInteractionTimestamp(
  environmentId: BiosphereType,
): Promise<void> {
  const db = getGamesDb()

  // Intentionally not wrapped in a transaction — this is a single-field
  // update with no consistency requirements across other fields.
  await db.biosphere_states.update(environmentId, {
    lastInteractionTimestamp: Date.now(),
  })
}
