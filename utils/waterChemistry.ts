/* ════════════════════════════════════════════════════════════════
   Zenith OS — Water Chemistry Schema & Nitrogen Cycle Auditor
   Phase 4 · Step 4.3 — Hardscape Simulator & Water Parameter Logger

   Exports:
     WaterLog            — IDB row type for parameter readings
     CyclePhase          — nitrogen cycle progression stages
     CycleStatus         — auditor output consumed by ParameterChart
     analyzeCycleStatus  — pure function: WaterLog[] → CycleStatus
   ════════════════════════════════════════════════════════════════ */

export interface WaterLog {
  id?: number
  /** ISO-8601 date string "YYYY-MM-DD" — indexed for chronological queries */
  logDate: string
  /** pH reading — valid range 4.0–9.0 */
  pH: number
  /** Ammonia (NH3/NH4+) in ppm — valid range 0–8 */
  ammonia: number
  /** Nitrite (NO2−) in ppm — valid range 0–5 */
  nitrite: number
  /** Nitrate (NO3−) in ppm — valid range 0–160 */
  nitrate: number
  notes?: string
  /** Unix timestamp ms — indexed for insertion-order queries */
  createdAt: number
}

export type CyclePhase =
  | 'no_data'        // nothing logged yet
  | 'initial'        // baseline established, no spike yet
  | 'ammonia_spike'  // NH3 elevated, Nitrosomonas seeding
  | 'nitrite_spike'  // NH3 dropping, NO2 rising, Nitrobacter seeding
  | 'stabilizing'    // low NH3, watch for NO2
  | 'cycled'         // NH3=0, NO2=0, NO3>0 — SAFE

export interface CycleStatus {
  phase: CyclePhase
  isCycled: boolean
  message: string
  detail: string
}

/** ppm threshold below which a reading is considered biologically zero */
const ZERO_THRESHOLD = 0.25

/**
 * Evaluates a chronologically ordered series of WaterLog entries against
 * the Nitrogen Cycle signature. Returns a CycleStatus describing the
 * current biological phase and, when appropriate, the stabilisation banner.
 *
 * Algorithm:
 *   1. Sorted by logDate (ascending).
 *   2. Examines the most recent row for current conditions.
 *   3. Scans the full history to confirm a prior spike occurred.
 *   4. Cycle is "complete" only when NH3 ≤ 0.25 ppm, NO2 ≤ 0.25 ppm,
 *      NO3 > 0 ppm, AND at least one prior reading had NH3 or NO2 > 0.25.
 */
export function analyzeCycleStatus(logs: WaterLog[]): CycleStatus {
  if (logs.length === 0) {
    return {
      phase:    'no_data',
      isCycled: false,
      message:  'Awaiting first parameter reading.',
      detail:   'Log your initial water test to begin tracking the nitrogen cycle.',
    }
  }

  const sorted = [...logs].sort((a, b) => a.logDate.localeCompare(b.logDate))
  const latest = sorted[sorted.length - 1]

  const nh3Zero   = latest.ammonia <= ZERO_THRESHOLD
  const no2Zero   = latest.nitrite <= ZERO_THRESHOLD
  const no3Pos    = latest.nitrate > 0
  const hadSpike  = sorted.some(
    l => l.ammonia > ZERO_THRESHOLD || l.nitrite > ZERO_THRESHOLD,
  )

  // ── Cycle complete ──────────────────────────────────────────
  if (nh3Zero && no2Zero && no3Pos && hadSpike) {
    return {
      phase:    'cycled',
      isCycled: true,
      message:  'STATUS: NITROGEN CYCLE STABILIZED // SAFE TO INTRODUCE INHABITANTS',
      detail:
        `NH3 and NO2 have spiked and returned to 0 ppm. ` +
        `Stable NO3 (${latest.nitrate} ppm) confirms the full nitrification ` +
        `pathway is established. Biological filtration is active.`,
    }
  }

  // ── Nitrite spike — second phase ────────────────────────────
  if (latest.nitrite > ZERO_THRESHOLD) {
    return {
      phase:    'nitrite_spike',
      isCycled: false,
      message:  'Nitrite spike active — Nitrobacter establishing.',
      detail:
        `NO2 at ${latest.nitrite} ppm. Nitrosomonas have converted ammonia to ` +
        `nitrite. Nitrobacter are colonising and will convert NO2 to NO3. ` +
        `Expect nitrite to fall as nitrate accumulates.`,
    }
  }

  // ── Ammonia spike — first phase ─────────────────────────────
  if (latest.ammonia > 2) {
    return {
      phase:    'ammonia_spike',
      isCycled: false,
      message:  'Ammonia spike detected — Nitrosomonas colonising.',
      detail:
        `NH3 at ${latest.ammonia} ppm. Beneficial bacteria are seeding on ` +
        `filter media. Expect a nitrite spike next as Nitrosomonas establish ` +
        `and begin converting ammonia.`,
    }
  }

  // ── Low ammonia — monitoring phase ──────────────────────────
  if (latest.ammonia > ZERO_THRESHOLD) {
    return {
      phase:    'stabilizing',
      isCycled: false,
      message:  'Low ammonia — monitor for nitrite spike.',
      detail:
        `Trace NH3 (${latest.ammonia} ppm) present. ` +
        `Watch for a NO2 elevation signalling the second stage of the cycle.`,
    }
  }

  // ── No detectable spike yet ──────────────────────────────────
  return {
    phase:    'initial',
    isCycled: false,
    message:  'Baseline established — cycle not yet initiated.',
    detail:
      `All parameters at baseline. Add an ammonia source (fish food, ` +
      `pure ammonia drops) to seed Nitrosomonas and initiate the cycle.`,
  }
}
