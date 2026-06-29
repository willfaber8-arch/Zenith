/**
 * utils/mentalHealthLog.ts — Mental Health Log Schema & Evaluator
 * Phase 5 · Step 5.7 — Mental Health Mapping & Slope Day Hype Tracker
 *
 * Pure module — zero React, zero Dexie imports.
 * The MentalHealthLog interface is defined here and re-exported from lib/db.ts
 * following the same pattern as WaterLog, Houseplant, etc.
 */

/* ════════════════════════════════════════════════════════════════
   MENTAL HEALTH LOG SCHEMA
   ════════════════════════════════════════════════════════════════ */

/**
 * One entry per calendar day.  The moodVector field stores the MoodKey
 * string so Dexie can serialise it without a schema migration if keys
 * are added in the future.
 */
export interface MentalHealthLog {
  id?:              number   // * PK auto-increment (omit on insert)
  logDate:          string   // * indexed — ISO "YYYY-MM-DD" — one log per day
  stressLevel:      number   //   scalar 1–10
  energyLevel:      number   //   scalar 1–10
  qualitativeNotes: string   //   micro-journal free text
  moodVector:       string   //   MoodKey stored as string
  createdAt:        number   // * indexed — Unix ms
}

/* ════════════════════════════════════════════════════════════════
   MOOD VECTORS
   ════════════════════════════════════════════════════════════════ */

export type MoodKey =
  | 'thriving' | 'energized' | 'focused' | 'coasting'
  | 'neutral'  | 'grinding'  | 'stressed' | 'drained'

export interface MoodVector {
  key:         MoodKey
  emoji:       string
  label:       string
  /** Pre-set stress reading for one-tap logging (1–10) */
  stressLevel: number
  /** Pre-set energy reading for one-tap logging (1–10) */
  energyLevel: number
  /** HSL hue for the accent colour used in the mood grid */
  hue:         number
}

/* Labels kept clear and distinct. The MoodKey values are unchanged so existing
   logs keep resolving; only the display label/emoji were refreshed. */
export const MOOD_VECTORS: MoodVector[] = [
  { key: 'thriving',  emoji: '🌟', label: 'Great',     stressLevel: 2, energyLevel: 9, hue: 158 },
  { key: 'energized', emoji: '✨', label: 'Energized', stressLevel: 3, energyLevel: 9, hue: 228 },
  { key: 'focused',   emoji: '🎯', label: 'Focused',   stressLevel: 4, energyLevel: 8, hue: 218 },
  { key: 'coasting',  emoji: '🙂', label: 'Relaxed',   stressLevel: 3, energyLevel: 5, hue: 198 },
  { key: 'neutral',   emoji: '😐', label: 'Neutral',   stressLevel: 5, energyLevel: 5, hue: 210 },
  { key: 'grinding',  emoji: '⚡', label: 'Busy',      stressLevel: 8, energyLevel: 7, hue:  42 },
  { key: 'stressed',  emoji: '😤', label: 'Stressed',  stressLevel: 9, energyLevel: 4, hue:  22 },
  { key: 'drained',   emoji: '😴', label: 'Drained',   stressLevel: 8, energyLevel: 2, hue:   0 },
]

export const MOOD_MAP: Record<MoodKey, MoodVector> = Object.fromEntries(
  MOOD_VECTORS.map(m => [m.key, m]),
) as Record<MoodKey, MoodVector>

/* ════════════════════════════════════════════════════════════════
   DATE UTILITIES
   ════════════════════════════════════════════════════════════════ */

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function dateISO(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

/** Returns a friendly relative label: "Today", "Yesterday", or "Mon 31" */
export function relativeDateLabel(dateStr: string): string {
  const today     = todayISO()
  const yesterday = dateISO(1)
  if (dateStr === today)     return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
}

/* ════════════════════════════════════════════════════════════════
   MENTAL STATE EVALUATOR
   ════════════════════════════════════════════════════════════════ */

export interface MentalStateEvaluation {
  /** True when burnout threshold met on 2+ of the last 3 logged days */
  shouldSuggestRecovery: boolean
  burnoutRisk:           'none' | 'emerging' | 'critical'
  rollingAvgStress:      number
  rollingAvgEnergy:      number
  /** Number of days within the 3-day window that hit the burnout threshold */
  burnoutDaysInWindow:   number
  trendMessage:          string | null
}

/**
 * Evaluates the rolling 3-day mental health trend.
 *
 * Burnout threshold per day: stressLevel >= 8 AND energyLevel <= 3
 *   1 day in window  → 'emerging' risk (no recovery prompt)
 *   2+ days in window → 'critical' risk + shouldSuggestRecovery = true
 *
 * Logs beyond the 3-day window are ignored; days with no log are skipped.
 */
export function evaluateMentalState(logs: MentalHealthLog[]): MentalStateEvaluation {
  // Build [today, yesterday, day-before] — skip days with no log
  const window3: MentalHealthLog[] = [0, 1, 2]
    .map(dAgo => logs.find(l => l.logDate === dateISO(dAgo)) ?? null)
    .filter((l): l is MentalHealthLog => l !== null)

  if (window3.length === 0) {
    return {
      shouldSuggestRecovery: false,
      burnoutRisk:           'none',
      rollingAvgStress:      5,
      rollingAvgEnergy:      5,
      burnoutDaysInWindow:   0,
      trendMessage:          null,
    }
  }

  const burnoutDays = window3.filter(
    l => l.stressLevel >= 8 && l.energyLevel <= 3,
  ).length

  const avgStress = window3.reduce((s, l) => s + l.stressLevel, 0) / window3.length
  const avgEnergy = window3.reduce((s, l) => s + l.energyLevel, 0) / window3.length

  const burnoutRisk: MentalStateEvaluation['burnoutRisk'] =
    burnoutDays >= 2 ? 'critical' :
    burnoutDays >= 1 ? 'emerging' :
    'none'

  const trendMessage =
    burnoutDays >= 2
      ? 'Sustained burnout across 3-day window. Recovery cycle strongly recommended.'
      : burnoutDays >= 1
      ? 'Emerging fatigue signal detected. Monitor your energy closely.'
      : avgStress > 7.5
      ? 'Elevated stress trend — consider initiating a recovery cycle soon.'
      : null

  return {
    shouldSuggestRecovery: burnoutDays >= 2,
    burnoutRisk,
    rollingAvgStress:    Math.round(avgStress * 10) / 10,
    rollingAvgEnergy:    Math.round(avgEnergy * 10) / 10,
    burnoutDaysInWindow: burnoutDays,
    trendMessage,
  }
}
