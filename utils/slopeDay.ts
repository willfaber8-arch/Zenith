/**
 * utils/slopeDay.ts — Slope Day Countdown & Hype Multiplier Engine
 * Phase 5 · Step 5.7 — Mental Health Mapping & Slope Day Hype Tracker
 *
 * Pure module — zero React.
 * Cornell Slope Day is the first Thursday of May each year, which
 * historically aligns with the last day of classes:
 *   2024-05-02 (May 1 = Wed → first Thu = May 2) ✓
 *   2025-05-01 (May 1 = Thu)                      ✓
 *   2026-05-07 (May 1 = Fri → first Thu = May 7)  ✓
 */

/* ════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════ */

/**
 * Hype phase tiers — each maps to a distinct multiplier and UI treatment.
 * standard  → > 14 days out, no boost
 * season    → 7–14 days: "Slope Day Season" 1.25×
 * countdown → 3–7 days: building velocity 1.35×
 * peak      → 0–3 days: final sprint 1.5×
 * live      → day of: full celebration 2.0×
 */
export type HypePhase = 'standard' | 'season' | 'countdown' | 'peak' | 'live'

export interface HypeMetrics {
  slopeDay:       Date
  daysUntil:      number    // calendar days remaining (0 on day-of)
  hoursUntil:     number    // hours component of sub-day remainder
  minutesUntil:   number    // minutes component of sub-hour remainder
  totalMsUntil:   number    // raw ms delta (negative if past)
  hypeMultiplier: number    // reward scaling coefficient
  hypePhase:      HypePhase
  isPast:         boolean   // true if Slope Day has already passed this year
  yearLabel:      string    // "2026"
  dateLabel:      string    // "May 7"
  monthDay:       number    // 7
}

/* ════════════════════════════════════════════════════════════════
   DATE CALCULATION
   ════════════════════════════════════════════════════════════════ */

/**
 * Returns the first Thursday on or after May 1 of the given year.
 * Time is set to 12:00 local so the countdown reads whole-day values
 * naturally until the morning of the event.
 */
export function getSlopeDayDate(year: number): Date {
  const may1        = new Date(year, 4, 1)          // month 4 = May (0-indexed)
  const dayOfWeek   = may1.getDay()                  // 0=Sun … 4=Thu … 6=Sat
  const daysToThur  = (4 - dayOfWeek + 7) % 7       // 0 if May 1 is already Thursday
  return new Date(year, 4, 1 + daysToThur, 12, 0, 0, 0)
}

/** Returns the upcoming Slope Day (next year if this year's has already passed). */
export function getNextSlopeDayDate(): Date {
  const now      = new Date()
  const thisYear = getSlopeDayDate(now.getFullYear())
  return now > thisYear
    ? getSlopeDayDate(now.getFullYear() + 1)
    : thisYear
}

/* ════════════════════════════════════════════════════════════════
   HYPE MULTIPLIER
   ════════════════════════════════════════════════════════════════ */

/**
 * Calculates the reward multiplier coefficient for the given days-until value.
 *
 * Tier table (spec-aligned):
 *   > 14 days  → 1.00× standard
 *   7–14 days  → 1.25× "Slope Day Season"
 *   3–7 days   → 1.35× "Countdown"
 *   ≤ 3 days   → 1.50× "Peak celebration velocity"
 *   Day-of     → 2.00× "Slope Day Live"
 */
export function computeHypeMultiplier(
  daysUntil: number,
): { multiplier: number; phase: HypePhase } {
  if (daysUntil <= 0)  return { multiplier: 2.00, phase: 'live'      }
  if (daysUntil <= 3)  return { multiplier: 1.50, phase: 'peak'      }
  if (daysUntil <= 7)  return { multiplier: 1.35, phase: 'countdown' }
  if (daysUntil <= 14) return { multiplier: 1.25, phase: 'season'    }
  return                      { multiplier: 1.00, phase: 'standard'  }
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPUTE FUNCTION
   ════════════════════════════════════════════════════════════════ */

const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
]

/**
 * Computes the full HypeMetrics snapshot from the current wall-clock time.
 * Accepts an optional `now` override for testing.
 */
export function computeHypeMetrics(now: Date = new Date()): HypeMetrics {
  const slopeDay   = getNextSlopeDayDate()
  const totalMs    = slopeDay.getTime() - now.getTime()
  const isPast     = totalMs < 0

  const absTotalMs     = Math.max(0, totalMs)
  const MS_PER_DAY     = 24 * 60 * 60 * 1000
  const MS_PER_HOUR    = 60 * 60 * 1000
  const MS_PER_MINUTE  = 60 * 1000

  const daysUntil    = Math.floor(absTotalMs / MS_PER_DAY)
  const remainder1   = absTotalMs - daysUntil  * MS_PER_DAY
  const hoursUntil   = Math.floor(remainder1   / MS_PER_HOUR)
  const remainder2   = remainder1 - hoursUntil * MS_PER_HOUR
  const minutesUntil = Math.floor(remainder2   / MS_PER_MINUTE)

  const { multiplier: hypeMultiplier, phase: hypePhase } = computeHypeMultiplier(
    isPast ? -1 : daysUntil,
  )

  return {
    slopeDay,
    daysUntil,
    hoursUntil,
    minutesUntil,
    totalMsUntil:  totalMs,
    hypeMultiplier,
    hypePhase,
    isPast,
    yearLabel:  String(slopeDay.getFullYear()),
    dateLabel:  `${MONTH_NAMES[slopeDay.getMonth()]} ${slopeDay.getDate()}`,
    monthDay:   slopeDay.getDate(),
  }
}

/* ════════════════════════════════════════════════════════════════
   DISPLAY HELPERS
   ════════════════════════════════════════════════════════════════ */

export const HYPE_PHASE_LABELS: Record<HypePhase, string> = {
  standard:  'Standard',
  season:    'Slope Day Season',
  countdown: 'Countdown Active',
  peak:      'Peak Velocity',
  live:      'Slope Day Live',
}

export const HYPE_PHASE_COLORS: Record<HypePhase, string> = {
  standard:  'rgba(155, 163, 196, 0.55)',
  season:    'rgba(124, 149, 255, 0.75)',
  countdown: 'rgba(204, 175, 82,  0.80)',
  peak:      'rgba(224, 114, 58,  0.90)',
  live:      'rgba(82,  204, 163, 0.95)',
}

/** Human-readable multiplier string: "1.25×" */
export function fmtMultiplier(m: number): string {
  return `${m.toFixed(2).replace(/\.00$/, '')}×`
}

/**
 * Applies the hype multiplier to a raw reward amount, rounding to
 * the nearest integer and ensuring a minimum of 1.
 */
export function applyHypeMultiplier(rawReward: number, multiplier: number): number {
  return Math.max(1, Math.round(rawReward * multiplier))
}
