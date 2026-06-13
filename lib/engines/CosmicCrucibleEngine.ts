/**
 * ════════════════════════════════════════════════════════════════
 * Zenith Games Tab — Cosmic Crucible Engine
 * Step 1.4 — Time-Locked Conversion Loop
 *
 * Pure engine module — no React imports. Every function is safe to
 * call from a useEffect, event handler, or setInterval callback.
 *
 * Conversion model:
 *   startTransmutation()  — deducts input resources + opens a job record
 *   runCatchUpPhase()     — called once on app boot; auto-credits any jobs
 *                           that completed while the app was closed
 *   claimCompletedJob()   — called by the player for jobs that completed
 *                           while the app was open (status: 'completed')
 *   computeRemainingSeconds() — pure computation from job.targetTime
 *
 * Time-delta design:
 *   All timing is anchored to `Date.now()` vs the stored `targetTime`
 *   (a fixed UTC ms epoch). This makes the engine immune to:
 *     • setInterval drift in background tabs
 *     • machine sleep / hibernation
 *     • browser process suspension (iOS Safari, Chrome energy saver)
 *   On resume, the NEXT tick or the next catch-up run compares
 *   `Date.now()` against the stored target and self-corrects.
 * ════════════════════════════════════════════════════════════════
 */

import {
  gamesDb,
  type ResourceId,
  type CrucibleJob,
  type CrucibleRecipeId,
} from '@/lib/gamesDb'

/* ════════════════════════════════════════════════════════════════
   §1  PUBLIC INTERFACES
   ════════════════════════════════════════════════════════════════ */

/** Static display + conversion metadata for a single Crucible recipe. */
export interface CrucibleRecipe {
  recipeId: CrucibleRecipeId
  /** Human-readable label for the UI recipe card. */
  displayName: string
  /** Resource consumed as input. */
  inputResourceId: ResourceId
  /** Exact units consumed per batch submission. */
  inputAmount: number
  /** cosmetic_points credited on successful claim or catch-up. */
  outputAmount: number
  /** Real-world duration of the conversion in seconds. */
  durationSeconds: number
}

/** Payload returned by `startTransmutation`. */
export interface TransmutationStartResult {
  success: boolean
  /** Only present on failure. */
  error?: string
  /** UTC ms when the batch will be ready — only present on success. */
  targetTime?: number
}

/**
 * Full public surface of the Crucible engine, returned by
 * `useCosmicCrucible`. Mirrors the spec's `CrucibleEngineResult`.
 */
export interface CrucibleEngineResult {
  /**
   * All current job records — both `'processing'` and `'completed'`.
   * Reactively updated by useLiveQuery in the hook layer.
   */
  activeJobs: CrucibleJob[]
  startTransmutation: (recipeId: string) => Promise<TransmutationStartResult>
  /**
   * Claims a job that completed while the app was open.
   * Credits cosmetic_points and removes the job record atomically.
   * No-ops silently if the job does not exist or is still processing.
   */
  claimCompletedJob: (jobId: string) => Promise<void>
  /**
   * Returns the integer seconds remaining until `jobId` completes.
   * Returns 0 for unknown IDs and for `'completed'` jobs.
   * Value is derived from `Date.now()` on each call — callers must
   * re-render (driven by the hook's tick state) to see updates.
   */
  getRemainingTime: (jobId: string) => number
}

/* re-export so consumers can import CrucibleJob from the engine module */
export type { CrucibleJob, CrucibleRecipeId }

/* ════════════════════════════════════════════════════════════════
   §2  RECIPE REGISTRY
   ════════════════════════════════════════════════════════════════ */

/**
 * Immutable conversion recipe table.
 * Indexed by `CrucibleRecipeId` for O(1) lookup during validation
 * and credential crediting.
 *
 * Conversion rates per spec:
 *   Raw resources  — 500 units → 10 CP in 1 h  (3 600 s)
 *   Refined items  — 50 units  → 25 CP in 4 h  (14 400 s)
 */
export const CRUCIBLE_RECIPES: Readonly<Record<CrucibleRecipeId, CrucibleRecipe>> = {
  shards_to_cp: {
    recipeId:        'shards_to_cp',
    displayName:     'Data Shard Transmutation',
    inputResourceId: 'raw_data_shards',
    inputAmount:     500,
    outputAmount:    10,
    durationSeconds: 3_600,
  },
  spores_to_cp: {
    recipeId:        'spores_to_cp',
    displayName:     'Bio-Spore Transmutation',
    inputResourceId: 'organic_spores',
    inputAmount:     500,
    outputAmount:    10,
    durationSeconds: 3_600,
  },
  dust_to_cp: {
    recipeId:        'dust_to_cp',
    displayName:     'Cosmic Dust Transmutation',
    inputResourceId: 'cosmic_dust',
    inputAmount:     500,
    outputAmount:    10,
    durationSeconds: 3_600,
  },
  fuel_to_cp: {
    recipeId:        'fuel_to_cp',
    displayName:     'Quantum Fuel Super-Charge',
    inputResourceId: 'quantum_fuel',
    inputAmount:     50,
    outputAmount:    25,
    durationSeconds: 14_400,
  },
  glass_to_cp: {
    recipeId:        'glass_to_cp',
    displayName:     'Stardust Glass Fusion',
    inputResourceId: 'stardust_glass',
    inputAmount:     50,
    outputAmount:    25,
    durationSeconds: 14_400,
  },
} as const

/* ════════════════════════════════════════════════════════════════
   §3  PURE UTILITIES
   ════════════════════════════════════════════════════════════════ */

/**
 * Returns integer seconds until the job's `targetTime`, clamped to 0.
 * Pure — always calls `Date.now()` fresh. Safe to call from any context.
 */
export function computeRemainingSeconds(job: CrucibleJob): number {
  if (job.status === 'completed') return 0
  return Math.max(0, Math.floor((job.targetTime - Date.now()) / 1000))
}

/**
 * Computes percentage progress through the conversion window [0, 100].
 * Useful for rendering a progress bar on a Crucible UI card.
 */
export function computeProgressPercent(job: CrucibleJob): number {
  if (job.status === 'completed') return 100
  const recipe = CRUCIBLE_RECIPES[job.recipeId]
  if (!recipe) return 0
  const totalMs  = recipe.durationSeconds * 1000
  const elapsed  = Date.now() - job.startTime
  return Math.min(100, Math.max(0, Math.round((elapsed / totalMs) * 100)))
}

/* ════════════════════════════════════════════════════════════════
   §4  CORE CREDIT PRIMITIVE  (internal)
   ────────────────────────────────────────────────────────────────
   All paths that award cosmetic_points funnel through this single
   helper so the crediting logic lives in exactly one place.
   Must be called inside an active Dexie rw transaction that includes
   both resource_inventory and user_profile_config.
   ════════════════════════════════════════════════════════════════ */

async function _creditCosmeticPoints(amount: number): Promise<void> {
  const cpNode = await gamesDb.resource_inventory.get('cosmetic_points')
  if (!cpNode) return

  const newBalance = cpNode.balance + amount
  await Promise.all([
    gamesDb.resource_inventory.update('cosmetic_points', {
      balance:             newBalance,
      totalEarnedLifetime: cpNode.totalEarnedLifetime + amount,
    }),
    // Keep the denormalised profile mirror in sync
    gamesDb.user_profile_config.update('active_user', {
      cosmeticPointsBalance: newBalance,
    }),
  ])
}

/* ════════════════════════════════════════════════════════════════
   §5  ENGINE FUNCTIONS
   ════════════════════════════════════════════════════════════════ */

/**
 * Submits a new conversion batch to the Crucible.
 *
 * Pipeline:
 *   1. Validate recipe ID.
 *   2. Pre-flight: check for an in-flight job for the same recipe.
 *   3. Pre-flight: verify input resource balance is sufficient.
 *   4. Atomic rw transaction:
 *      a. Re-read and re-validate balance (TOCTOU elimination).
 *      b. Deduct input resources.
 *      c. Create CrucibleJob record with status 'processing'.
 *   5. Return `{ success, targetTime }` or `{ success: false, error }`.
 *
 * @param recipeId  One of the five CrucibleRecipeId string literals.
 */
export async function startTransmutation(
  recipeId: string,
): Promise<TransmutationStartResult> {
  if (!gamesDb) return { success: false, error: 'Database unavailable.' }

  const recipe = CRUCIBLE_RECIPES[recipeId as CrucibleRecipeId]
  if (!recipe) {
    return { success: false, error: `Unknown recipe: '${recipeId}'.` }
  }

  /* ── Pre-flight 1: duplicate-submission guard ─────────────── */
  const inflightCount = await gamesDb.crucibleJobs
    .where('recipeId').equals(recipeId)
    .filter(j => j.status === 'processing')
    .count()

  if (inflightCount > 0) {
    return {
      success: false,
      error:   `A "${recipe.displayName}" job is already running. Wait for it to complete before queuing another.`,
    }
  }

  /* ── Pre-flight 2: balance check ─────────────────────────── */
  const inputNode = await gamesDb.resource_inventory.get(recipe.inputResourceId)
  if (!inputNode || inputNode.balance < recipe.inputAmount) {
    const have = inputNode?.balance ?? 0
    return {
      success: false,
      error:   `Insufficient ${inputNode?.name ?? recipe.inputResourceId}. ` +
               `Need ${recipe.inputAmount.toLocaleString()}, have ${have.toLocaleString()}.`,
    }
  }

  /* ── Atomic commit ───────────────────────────────────────── */
  const now        = Date.now()
  const targetTime = now + recipe.durationSeconds * 1000
  const jobId      = crypto.randomUUID()

  return gamesDb.transaction(
    'rw',
    [gamesDb.resource_inventory, gamesDb.crucibleJobs],
    async (): Promise<TransmutationStartResult> => {

      // Re-read inside the transaction — eliminates the TOCTOU window
      // between the pre-flight check and the write.
      const txInputNode = await gamesDb.resource_inventory.get(recipe.inputResourceId)

      if (!txInputNode || txInputNode.balance < recipe.inputAmount) {
        const have = txInputNode?.balance ?? 0
        return {
          success: false,
          error:   `Balance changed during commit. ` +
                   `Need ${recipe.inputAmount.toLocaleString()}, have ${have.toLocaleString()}.`,
        }
      }

      // Deduct the input resource batch.
      await gamesDb.resource_inventory.update(recipe.inputResourceId, {
        balance: txInputNode.balance - recipe.inputAmount,
      })

      // Create the job record.
      const job: CrucibleJob = {
        id:         jobId,
        recipeId:   recipe.recipeId,
        startTime:  now,
        targetTime,
        status:     'processing',
      }
      await gamesDb.crucibleJobs.add(job)

      return { success: true, targetTime }
    },
  )
}

/**
 * Time-Delta Catch-Up Phase — called once on application boot.
 *
 * Scans all `'processing'` jobs and compares `Date.now()` against
 * each job's `targetTime`. For every expired job:
 *   1. Credits the full cosmetic_points output atomically.
 *   2. Deletes the job record (no `'completed'` status — the app
 *      was closed when these finished so there is no UI to update).
 *
 * Jobs whose `targetTime` is in the future are left untouched;
 * the hook's live countdown interval resumes from the remaining delta.
 *
 * The entire catch-up runs inside a single rw transaction so a
 * partial credit + deletion is impossible even under abrupt failure.
 */
export async function runCatchUpPhase(): Promise<void> {
  if (!gamesDb) return

  const now = Date.now()

  // Identify all processing jobs that have passed their deadline.
  const expiredJobs = await gamesDb.crucibleJobs
    .where('status').equals('processing')
    .filter(j => j.targetTime <= now)
    .toArray()

  if (expiredJobs.length === 0) return

  // Accumulate the total CP award across all expired jobs so we can
  // write a single update to resource_inventory instead of N updates.
  let totalCpToAward   = 0
  const validJobIds: string[] = []

  for (const job of expiredJobs) {
    const recipe = CRUCIBLE_RECIPES[job.recipeId]
    if (!recipe) continue
    totalCpToAward += recipe.outputAmount
    validJobIds.push(job.id)
  }

  if (validJobIds.length === 0) return

  await gamesDb.transaction(
    'rw',
    [gamesDb.resource_inventory, gamesDb.crucibleJobs, gamesDb.user_profile_config],
    async () => {

      // Re-verify each job inside the transaction to guard against a
      // concurrent catch-up call (e.g., two tabs opening simultaneously).
      let confirmedCp   = 0
      const confirmedIds: string[] = []

      for (const jobId of validJobIds) {
        const txJob = await gamesDb.crucibleJobs.get(jobId)
        // Skip if already processed by a parallel call.
        if (!txJob || txJob.status !== 'processing') continue
        const recipe = CRUCIBLE_RECIPES[txJob.recipeId]
        if (!recipe) continue
        confirmedCp += recipe.outputAmount
        confirmedIds.push(jobId)
      }

      if (confirmedIds.length === 0) return

      // Credit all accumulated cosmetic_points in a single DB write.
      await _creditCosmeticPoints(confirmedCp)

      // Delete all confirmed expired jobs — they were never shown as
      // 'completed' in the UI so no claim interaction is needed.
      await gamesDb.crucibleJobs.bulkDelete(confirmedIds)
    },
  )
}

/**
 * Claims a job that completed while the application was running.
 *
 * Unlike catch-up (which auto-credits silently), live completions
 * require an explicit player interaction. This function:
 *   1. Verifies the job exists and has `status: 'completed'`.
 *   2. Credits the cosmetic_points output.
 *   3. Deletes the job record.
 *
 * Silently no-ops if the job is unknown, still processing, or was
 * already claimed — the caller does not need to handle the void result.
 *
 * @param jobId  The UUID of the completed CrucibleJob.
 */
export async function claimCompletedJob(jobId: string): Promise<void> {
  if (!gamesDb) return

  await gamesDb.transaction(
    'rw',
    [gamesDb.resource_inventory, gamesDb.crucibleJobs, gamesDb.user_profile_config],
    async () => {
      const job = await gamesDb.crucibleJobs.get(jobId)

      // Guard: job must exist and be in the claimable state.
      if (!job || job.status !== 'completed') return

      const recipe = CRUCIBLE_RECIPES[job.recipeId]
      if (!recipe) {
        // Unknown recipe — clean up the orphan record without crediting.
        await gamesDb.crucibleJobs.delete(jobId)
        return
      }

      await _creditCosmeticPoints(recipe.outputAmount)
      await gamesDb.crucibleJobs.delete(jobId)
    },
  )
}

/**
 * Transitions a processing job to `'completed'` status when its
 * `targetTime` has passed. Called by the hook's setInterval tick.
 *
 * This is a targeted single-job update — the hook calls it per-job
 * so that only the specific record changes, minimising useLiveQuery
 * re-render surface area.
 *
 * @internal — exported for use by `useCosmicCrucible` only.
 */
export async function _markJobCompleted(jobId: string): Promise<void> {
  if (!gamesDb) return

  await gamesDb.transaction('rw', gamesDb.crucibleJobs, async () => {
    const job = await gamesDb.crucibleJobs.get(jobId)
    // Only advance if still processing — prevents double-transition.
    if (job?.status === 'processing') {
      await gamesDb.crucibleJobs.update(jobId, { status: 'completed' })
    }
  })
}
