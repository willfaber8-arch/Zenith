/**
 * utils/gritScore.ts — Dynamic Grit-Score Analytics Engine
 * Phase 5 · Step 5.3
 *
 * ─────────────────────────────────────────────────────────────────
 * PARAMETRIC GRIT-SCORE FORMULA
 *
 * For each habit h on day d:
 *
 *   Wd  = difficulty weight     (Easy=1.0, Medium=2.5, Hard=5.0)
 *   Cc  = consistency coeff.    completions / expected in rolling 7-day window
 *   Bs  = streak bonus          ln(effectiveStreak + 1)
 *   Pa  = atrophy decay         0.85^consecutiveMissedDays
 *
 *   rawScore(h,d)  = Wd × Cc × (1 + Bs) × Pa
 *   maxScore(h)    = Wd × 1.0 × (1 + ln(refStreak+1)) × 1.0
 *   contribution   = min(1, rawScore / maxScore)
 *
 * Composite daily Grit Score (0–100):
 *   G(d) = clamp(mean(contribution_i) × 100, 0, 100)
 *
 * Historical reconstruction:
 *   Since the IDB habits table stores current streak state rather than
 *   a per-day log, the last N completed days are inferred from
 *   `streakCount` + `lastCompletedDate`. This gives an accurate picture
 *   of the recent streak window and projects realistic decay for earlier
 *   periods when the habit was not yet established.
 * ─────────────────────────────────────────────────────────────────
 */

import type { Habit } from '@/lib/db'

/* ════════════════════════════════════════════════════════════════
   PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

export interface GritDataPoint {
  dateISO: string   // "YYYY-MM-DD"
  score:   number   // 0–100, one decimal place
  label:   string   // "May 28"
}

export type GritTrend = 'gaining' | 'recovering' | 'steady'

/* ════════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════════ */

const DIFFICULTY_WEIGHTS: Record<string, number> = {
  easy:   1.0,
  medium: 2.5,
  hard:   5.0,
}

const ROLLING_WINDOW  = 7   // consistency coefficient window (days)
const HISTORY_WINDOW  = 30  // chart data points
const MAX_DECAY_DAYS  = 14  // cap Pa lookback to prevent extreme penalties

/* ════════════════════════════════════════════════════════════════
   PRIVATE HELPERS
   ════════════════════════════════════════════════════════════════ */

function difficultyWeight(difficulty: string | undefined | null): number {
  return DIFFICULTY_WEIGHTS[difficulty ?? 'medium'] ?? 2.5
}

/**
 * How many calendar days have elapsed between `lastCompletedDate` and today.
 * Returns Infinity when the habit has never been completed.
 */
function daysSinceLastCompletion(habit: Habit): number {
  if (!habit.lastCompletedDate) return Infinity

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [y, m, d] = habit.lastCompletedDate.split('-').map(Number)
  const last = new Date(y, m - 1, d)

  return Math.round((today.getTime() - last.getTime()) / 86_400_000)
}

/**
 * Was the habit completed on the day that was `daysAgo` days before today?
 *
 * A day falls inside the completion window when:
 *   daysSinceLast ≤ daysAgo < daysSinceLast + streakCount
 */
function wasCompletedOnDay(habit: Habit, daysAgo: number): boolean {
  if (!habit.lastCompletedDate || habit.streakCount <= 0) return false

  const gap = daysSinceLastCompletion(habit)
  if (!isFinite(gap)) return false

  return daysAgo >= gap && daysAgo < gap + habit.streakCount
}

/**
 * The effective streak length at a historical day.
 * 0 outside the streak window; linearly decrements towards the oldest day.
 *
 * Example — streakCount=7, lastCompletedDate=today (gap=0):
 *   daysAgo=0 → 7,  daysAgo=3 → 4,  daysAgo=6 → 1,  daysAgo=7 → 0
 */
function effectiveStreakOnDay(habit: Habit, daysAgo: number): number {
  if (!wasCompletedOnDay(habit, daysAgo)) return 0

  const gap = daysSinceLastCompletion(habit)
  const posFromEnd = daysAgo - gap   // 0 = most-recent streak day
  return habit.streakCount - posFromEnd
}

/**
 * Cc — consistency coefficient.
 * Ratio of completed days to expected completions within the rolling
 * 7-day window that *ends* on `daysAgo`.
 */
function consistencyCoefficient(habit: Habit, daysAgo: number): number {
  let completed = 0
  for (let d = daysAgo; d < daysAgo + ROLLING_WINDOW; d++) {
    if (wasCompletedOnDay(habit, d)) completed++
  }

  let expected: number
  switch (habit.frequency) {
    case 'specific_days': expected = habit.activeDays?.length ?? 3; break
    default:              expected = ROLLING_WINDOW   // 'daily'
  }

  return Math.min(1, completed / Math.max(1, expected))
}

/**
 * Pa — atrophy decay penalty: 0.85^consecutiveMissedDays.
 *
 * Counts consecutive missed days going backward in time from `daysAgo`.
 * Only applied to daily habits; other frequencies decay at a fixed low rate.
 * Capped at MAX_DECAY_DAYS to prevent extreme penalisation.
 */
function atrophyDecay(habit: Habit, daysAgo: number): number {
  if (wasCompletedOnDay(habit, daysAgo)) return 1.0

  if (habit.frequency !== 'daily') {
    // Weekly/custom: mild fixed decay when missed
    return Math.pow(0.85, 2)
  }

  let missed = 0
  for (let d = daysAgo; d < daysAgo + MAX_DECAY_DAYS; d++) {
    if (wasCompletedOnDay(habit, d)) break
    missed++
  }

  return Math.pow(0.85, Math.min(missed, MAX_DECAY_DAYS))
}

/* ════════════════════════════════════════════════════════════════
   PRIMARY EXPORTS
   ════════════════════════════════════════════════════════════════ */

/**
 * Generates a 30-day rolling Grit Score series from the habits table.
 * Returns an empty array when no habits are present.
 */
export function calculateMovingGritScore(habits: Habit[]): GritDataPoint[] {
  if (habits.length === 0) return []

  const points: GritDataPoint[] = []

  for (let daysAgo = HISTORY_WINDOW - 1; daysAgo >= 0; daysAgo--) {
    /* Build the date label for this slot */
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - daysAgo)

    const dateISO = date.toISOString().slice(0, 10)
    const label   = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    /* Per-habit normalised contributions */
    const contributions = habits.map(h => {
      const Wd = difficultyWeight(undefined)
      const Cc = consistencyCoefficient(h, daysAgo)
      const Es = effectiveStreakOnDay(h, daysAgo)
      const Bs = Math.log(Es + 1)                           // ln(streak + 1)
      const Pa = atrophyDecay(h, daysAgo)                   // 0.85^missed

      const rawScore = Wd * Cc * (1 + Bs) * Pa

      /* Reference maximum: perfect consistency, today's streak as ceiling */
      const refStreak = Math.max(h.streakCount, 1)
      const maxScore  = Math.max(Wd * (1 + Math.log(refStreak + 1)), 0.001)

      return Math.min(1, Math.max(0, rawScore / maxScore))
    })

    const avg   = contributions.reduce((s, c) => s + c, 0) / contributions.length
    const score = Math.round(Math.min(100, Math.max(0, avg * 100)) * 10) / 10

    points.push({ dateISO, score, label })
  }

  return points
}

/**
 * Evaluates the slope of the Grit Score across the last 3 data points.
 *
 * Threshold (|Δ| > 2 pp over 2 days) keeps the indicator stable and
 * prevents noisy single-point jitter from triggering state changes.
 */
export function evaluateTrend(points: GritDataPoint[]): GritTrend {
  if (points.length < 3) return 'steady'
  const last = points.slice(-3)
  const slope = last[2].score - last[0].score
  if (slope >  2) return 'gaining'
  if (slope < -2) return 'recovering'
  return 'steady'
}

/* ── Derived stat helpers ─────────────────────────────────────── */

export function latestScore(points: GritDataPoint[]): number {
  return Math.round((points.at(-1)?.score ?? 0) * 10) / 10
}

export function weeklyAverage(points: GritDataPoint[]): number {
  const window = points.slice(-7)
  if (window.length === 0) return 0
  const avg = window.reduce((s, p) => s + p.score, 0) / window.length
  return Math.round(avg * 10) / 10
}

export function periodHigh(points: GritDataPoint[]): number {
  if (points.length === 0) return 0
  return Math.round(Math.max(...points.map(p => p.score)) * 10) / 10
}
