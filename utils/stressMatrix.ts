/**
 * Zenith OS — Stress Matrix Algorithm
 * Phase 3 · Step 3.4 — Cognitive Load Forecasting Engine
 *
 * Scans upcoming calendar events, matches them to course intensity profiles
 * via title substring matching, and computes per-day cognitive strain vectors.
 * Flags HIGH_STRAIN (≥60 composite) and MODERATE_STRAIN (≥35 composite) days
 * with actionable warning messages.
 */

import type { CalendarEvent } from '@/lib/db'
import type {
  CourseIntensityProfile,
  CognitiveLoadScore,
  DailyStrainVector,
  LoadTier,
  StrainWarning,
} from '@/types/academics'

/* ── Weighting constants ─────────────────────────────────────── */

const MATH_W = 0.35
const CODE_W = 0.35
const MEM_W  = 0.30

/* ── Threshold constants ─────────────────────────────────────── */

const HIGH_THRESHOLD     = 60
const MODERATE_THRESHOLD = 35

/* ── Day label arrays ────────────────────────────────────────── */

const FULL_DAYS  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/* ── Public: compute composite load score for a single profile ── */

export function computeCognitiveLoad(p: CourseIntensityProfile): CognitiveLoadScore {
  const raw       = p.mathIntensity * MATH_W + p.codingIntensity * CODE_W + p.memorizationIntensity * MEM_W
  const composite = Math.round(raw * 10) // 0–100

  const tier: LoadTier =
    composite >= 75 ? 'critical' :
    composite >= 55 ? 'high'     :
    composite >= 35 ? 'moderate' : 'low'

  return {
    math:         p.mathIntensity         * 10,
    coding:       p.codingIntensity       * 10,
    memorization: p.memorizationIntensity * 10,
    composite,
    tier,
  }
}

/* ── Internal: match a CalendarEvent to a CourseIntensityProfile ─ */

function matchProfile(
  ev: CalendarEvent,
  profiles: CourseIntensityProfile[],
): CourseIntensityProfile | undefined {
  const haystack = `${ev.title} ${ev.description ?? ''}`.toLowerCase()
  return profiles.find(p => {
    const code  = p.courseCode.toLowerCase()
    // Match by course code (e.g. "cs 3110" in event title)
    if (haystack.includes(code)) return true
    // Match by first two meaningful words of course name (e.g. "data structures")
    const words = p.courseName.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    return words.length >= 2 && haystack.includes(words[0]) && haystack.includes(words[1])
  })
}

/* ── Public: build the 7-day strain matrix ───────────────────── */

/**
 * Produces one DailyStrainVector per day for the next 7 days starting
 * from `todayMs` (defaults to Date.now()).
 *
 * Intensity dimensions are summed across all matched events on a given day
 * (concurrent load), then capped at 100.  The concurrency sum means two
 * high-coding courses due on the same day yield a coding load of 100,
 * accurately reflecting the cognitive context-switching cost.
 */
export function buildWeeklyStrainMatrix(
  events: CalendarEvent[],
  profiles: CourseIntensityProfile[],
  todayMs: number = Date.now(),
): DailyStrainVector[] {
  // Normalize to local midnight
  const today = new Date(todayMs)
  today.setHours(0, 0, 0, 0)
  const startMs = today.getTime()

  return Array.from({ length: 7 }, (_, d): DailyStrainVector => {
    const dayStart = startMs + d * 86_400_000
    const dayEnd   = dayStart + 86_400_000
    const date     = new Date(dayStart)
    const dow      = date.getDay()
    const dateISO  = date.toISOString().slice(0, 10)

    // Collect events that fall on this day
    const dayEvents = events.filter(e =>
      e.is1159 === 1
        ? e.startMs >= dayStart && e.startMs < dayEnd          // deadline: placed on due day
        : e.startMs < dayEnd   && e.endMs   > dayStart         // timed: overlap check
    )

    // Aggregate intensity across all matched events (concurrent load sum)
    let mathSum = 0, codingSum = 0, memSum = 0, matchCount = 0
    const matchedCourses: string[] = []

    for (const ev of dayEvents) {
      const p = matchProfile(ev, profiles)
      if (!p) continue
      mathSum   += p.mathIntensity
      codingSum += p.codingIntensity
      memSum    += p.memorizationIntensity
      matchCount++
      if (!matchedCourses.includes(p.courseCode)) matchedCourses.push(p.courseCode)
    }

    // Scale to 0–100; summing intentionally accumulates concurrent load
    const mathLoad   = Math.min(mathSum   * 10, 100)
    const codingLoad = Math.min(codingSum * 10, 100)
    const memLoad    = Math.min(memSum    * 10, 100)
    const compositeLoad = Math.round(mathLoad * MATH_W + codingLoad * CODE_W + memLoad * MEM_W)

    // Generate strain warning when threshold is crossed and at least one course matched
    let warning: StrainWarning | undefined
    if (matchCount > 0 && compositeLoad >= HIGH_THRESHOLD) {
      const prevDow = (dow + 6) % 7
      const loads   = [
        { label: 'math',         v: mathLoad   },
        { label: 'coding',       v: codingLoad },
        { label: 'memorization', v: memLoad    },
      ].sort((a, b) => b.v - a.v)

      warning = {
        status: 'HIGH_STRAIN',
        message:
          `Warning: ${FULL_DAYS[dow]} has high concurrent ${loads[0].label} and ` +
          `${loads[1].label} loads. Schedule a heavy study block on ${FULL_DAYS[prevDow]}.`,
      }
    } else if (matchCount > 0 && compositeLoad >= MODERATE_THRESHOLD) {
      const prevDow = (dow + 6) % 7
      warning = {
        status: 'MODERATE_STRAIN',
        message:
          `Heads up: ${FULL_DAYS[dow]} carries moderate cognitive load. ` +
          `Consider reviewing materials on ${FULL_DAYS[prevDow]}.`,
      }
    }

    return {
      dateISO,
      dayLabel:     SHORT_DAYS[dow],
      fullDayLabel: FULL_DAYS[dow],
      mathLoad,
      codingLoad,
      memLoad,
      compositeLoad,
      eventCount:    dayEvents.length,
      matchedCourses,
      warning,
    }
  })
}
