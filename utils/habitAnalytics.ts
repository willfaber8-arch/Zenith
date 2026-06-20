/**
 * utils/habitAnalytics.ts — honest, completion-data-driven habit analytics.
 *
 * Unlike utils/gritScore.ts (which RECONSTRUCTS a synthetic history from the
 * current streak counter), these helpers read the real `habitCompletions`
 * rows. That means a day where a habit reached only 50% of its goal is
 * reflected as 50% — partial progress is preserved and shown, not collapsed
 * to a binary done/not-done.
 *
 * Pure module — no React / Dexie imports. Callers pass the rows in.
 */

import type { Habit, HabitCompletion } from '@/lib/db'
import type { GritDataPoint } from '@/utils/gritScore'

/* ── Date helpers (local ISO YYYY-MM-DD) ──────────────────────── */

function isoForOffset(offset: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function dayOfWeek(iso: string): number {
  return new Date(iso + 'T12:00:00').getDay()
}

function isScheduledOn(habit: Habit, iso: string): boolean {
  if (!habit.activeDays || habit.activeDays.length === 0) return true
  return habit.activeDays.includes(dayOfWeek(iso))
}

function daysSince(iso: string | null): number {
  if (!iso) return Infinity
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const then  = new Date(iso + 'T12:00:00'); then.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - then.getTime()) / 86_400_000)
}

/* ── Completion fraction series ───────────────────────────────── */

/**
 * Build a `days`-long daily series where each point is the AVERAGE
 * completion fraction (0–100) across the habits scheduled that day —
 * computed from the actual per-day `count` vs each habit's goal.
 *
 * A day with no scheduled habits is skipped from the average (counts as
 * having no demand) so off-days don't drag the line to zero.
 *
 * Returns GritDataPoint[] so it can feed the existing GritAnalyticsChart
 * unchanged.
 */
export function computeCompletionSeries(
  habits: Habit[],
  completions: HabitCompletion[],
  days = 30,
): GritDataPoint[] {
  if (habits.length === 0) return []

  // Index completions by `${habitId}|${date}` → count for O(1) lookup.
  const countMap = new Map<string, number>()
  for (const c of completions) {
    countMap.set(`${c.habitId}|${c.date}`, c.count)
  }

  const points: GritDataPoint[] = []

  for (let offset = -(days - 1); offset <= 0; offset++) {
    const iso  = isoForOffset(offset)
    const date = new Date(iso + 'T12:00:00')
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    let sum = 0
    let scheduledCount = 0

    for (const h of habits) {
      // Only count habits that existed on (or before) this day.
      if (h.createdAt && h.createdAt > date.getTime() + 86_400_000) continue
      if (!isScheduledOn(h, iso)) continue
      scheduledCount++

      const count  = countMap.get(`${h.id}|${iso}`) ?? 0
      const target = h.targetCompletions > 0 ? h.targetCompletions : 1
      sum += Math.min(1, count / target)
    }

    const score = scheduledCount > 0
      ? Math.round((sum / scheduledCount) * 100 * 10) / 10
      : 0

    points.push({ dateISO: iso, score, label })
  }

  return points
}

/* ── Broken-streak detection ──────────────────────────────────── */

export interface BrokenStreak {
  habitId:     number
  name:        string
  lostStreak:  number   // the streak length that was just lost
}

/**
 * A streak is considered LOST when the habit still carries a positive
 * `streakCount` but its last full completion was 2+ days ago (i.e. at
 * least one scheduled day was missed). Yesterday (gap === 1) is still
 * "alive" — the user can complete today to continue.
 *
 * Pure detection only — the caller decides how to surface + reset.
 */
export function detectBrokenStreaks(habits: Habit[]): BrokenStreak[] {
  const broken: BrokenStreak[] = []
  for (const h of habits) {
    if (h.id == null) continue
    if (h.streakCount <= 0) continue
    if (daysSince(h.lastCompletedDate) >= 2) {
      broken.push({ habitId: h.id, name: h.name, lostStreak: h.streakCount })
    }
  }
  return broken
}
