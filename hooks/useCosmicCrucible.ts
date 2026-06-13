'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith Games Tab — useCosmicCrucible Hook
 * Step 1.4 — Time-Locked Conversion Loop · React Interface
 *
 * Bridges the pure CosmicCrucibleEngine into the React lifecycle:
 *
 *   • useLiveQuery streams the crucibleJobs table reactively so
 *     the UI re-renders the instant any job record changes.
 *
 *   • Catch-up phase runs once on mount via useEffect — expired
 *     jobs from before the last app session are silently credited
 *     and removed before the component tree can render stale data.
 *
 *   • A single stable setInterval ticks every second. It uses a
 *     ref-forwarded snapshot of the live job list to avoid stale
 *     closures, and calls _markJobCompleted() for any job whose
 *     targetTime has passed while the app was open. The useLiveQuery
 *     subscription picks up the status change and re-renders the UI.
 *
 *   • A `tick` useState counter increments every second whenever
 *     processing jobs exist. This forces re-renders so that
 *     getRemainingTime() — which calls Date.now() fresh on each
 *     invocation — produces a ticking countdown in component JSX.
 *
 * Usage:
 *   const { activeJobs, startTransmutation, claimCompletedJob,
 *           getRemainingTime } = useCosmicCrucible()
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useLiveQuery }                              from 'dexie-react-hooks'
import { gamesDb, type CrucibleJob }                 from '@/lib/gamesDb'
import {
  startTransmutation    as engineStart,
  claimCompletedJob     as engineClaim,
  runCatchUpPhase,
  computeRemainingSeconds,
  _markJobCompleted,
  type CrucibleEngineResult,
  type TransmutationStartResult,
} from '@/lib/engines/CosmicCrucibleEngine'

/* ════════════════════════════════════════════════════════════════
   §1  HOOK
   ════════════════════════════════════════════════════════════════ */

export function useCosmicCrucible(): CrucibleEngineResult {

  /* ── 1a. Reactive job stream ────────────────────────────────
     Returns undefined for one event-loop tick during boot.
     useLiveQuery max 2 arguments (dexie-react-hooks v4 rule).     */

  const rawJobs = useLiveQuery<CrucibleJob[]>(
    () => gamesDb?.crucibleJobs.toArray() ?? Promise.resolve([]),
    [],
  )

  const activeJobs: CrucibleJob[] = rawJobs ?? []

  /* ── 1b. Stable job ref for the interval closure ────────────
     The setInterval callback reads this ref instead of the
     captured `activeJobs` value, so it always operates on the
     latest DB snapshot without needing the effect to re-run.     */

  const jobsRef = useRef<CrucibleJob[]>(activeJobs)
  useEffect(() => {
    jobsRef.current = activeJobs
  }, [activeJobs])

  /* ── 1c. Tick state — drives countdown re-renders ──────────
     Only increments when at least one job is processing.
     Reduces unnecessary re-renders to zero when the Crucible
     is idle.                                                     */

  const [tick, setTick] = useState(0)

  /* ── 1d. Catch-up on mount ──────────────────────────────────
     Auto-credits any jobs that expired while the app was closed.
     Runs before the interval so the UI never shows an already-
     expired job as "processing" after a page reload.             */

  useEffect(() => {
    void runCatchUpPhase()
  }, [])   // empty deps — runs exactly once on mount

  /* ── 1e. Deterministic countdown interval ──────────────────
     Single stable interval (empty deps). On each tick:
       1. Reads live jobs from the ref (no stale closure).
       2. Calls _markJobCompleted() for any job whose targetTime
          has passed — useLiveQuery propagates the status change.
       3. Increments the tick counter only when processing jobs
          remain, driving countdown re-renders in the UI.

     Immune to machine sleep / tab hibernation: the comparison
     is always `Date.now()` vs the stored `targetTime` epoch,
     so a job that expired during a 6-hour sleep will be caught
     on the very first tick after the tab resumes.               */

  useEffect(() => {
    const intervalId = setInterval(() => {
      const now          = Date.now()
      const currentJobs  = jobsRef.current
      const hasProcessing = currentJobs.some(j => j.status === 'processing')

      // Mark expired jobs completed — each call is a targeted single-row
      // update so only that job's useLiveQuery subscription re-renders.
      currentJobs
        .filter(j => j.status === 'processing' && now >= j.targetTime)
        .forEach(job => { void _markJobCompleted(job.id) })

      // Drive re-renders for countdown display — only while jobs are live.
      if (hasProcessing) {
        setTick(t => t + 1)
      }
    }, 1_000)

    return () => clearInterval(intervalId)
  }, [])   // empty deps — one stable interval for the component lifetime

  /* ── 1f. Public mutation wrappers ───────────────────────────
     Thin stable callbacks — they forward to the engine functions
     which own all business logic and DB transaction handling.    */

  const startTransmutation = useCallback(
    (recipeId: string): Promise<TransmutationStartResult> =>
      engineStart(recipeId),
    [],
  )

  const claimCompletedJob = useCallback(
    (jobId: string): Promise<void> =>
      engineClaim(jobId),
    [],
  )

  /* ── 1g. getRemainingTime ───────────────────────────────────
     Synchronous O(n) lookup by job ID against the live snapshot.
     Calls Date.now() on every invocation so the returned integer
     is always fresh. Components get updated values because the
     tick state above forces a re-render each second.

     `tick` is in the dependency array so the function reference
     changes every second, keeping any downstream effects or
     memos that depend on it correctly invalidated.              */

  const getRemainingTime = useCallback(
    (jobId: string): number => {
      void tick   // declare dependency — ensures reference changes each second
      const job = activeJobs.find(j => j.id === jobId)
      if (!job) return 0
      return computeRemainingSeconds(job)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeJobs, tick],
  )

  /* ── 1h. Return surface ─────────────────────────────────── */

  return {
    activeJobs,
    startTransmutation,
    claimCompletedJob,
    getRemainingTime,
  }
}
