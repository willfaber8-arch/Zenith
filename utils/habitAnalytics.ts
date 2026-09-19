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
 *
 * ── WHICH DAY IS "TODAY" ──────────────────────────────────────────────
 * The series is anchored on the *habit* day, not the calendar day. With a
 * late cutoff configured, a tick at 01:00 is written under yesterday's key;
 * a chart anchored on the calendar day would put its final point on a date
 * that has no rows yet, so the score would sit flat at zero however much
 * work had just been logged. The anchor is a parameter so the awkward hours
 * can be tested without waiting for 3am.
 */

import type { Habit, HabitCompletion } from '@/lib/db'
import type { GritDataPoint } from '@/utils/gritScore'
import { isHabitScheduledOn, previousScheduledDate } from '@/utils/habitSchedule'
import { addDaysISO, fromLocalDateStr } from '@/utils/localDate'
import { currentDayISO } from '@/utils/dayBoundary'

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
  todayISO: string = currentDayISO(),
): GritDataPoint[] {
  if (habits.length === 0) return []

  // Index completions by `${habitId}|${date}` → count for O(1) lookup.
  const countMap = new Map<string, number>()
  for (const c of completions) {
    countMap.set(`${c.habitId}|${c.date}`, c.count)
  }

  const points: GritDataPoint[] = []

  for (let offset = -(days - 1); offset <= 0; offset++) {
    const iso  = addDaysISO(todayISO, offset)
    const date = fromLocalDateStr(iso)
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    let sum = 0
    let scheduledCount = 0

    for (const h of habits) {
      // Only count habits that existed on (or before) this day.
      if (h.createdAt && h.createdAt > date.getTime() + 86_400_000) continue
      if (!isHabitScheduledOn(h, iso)) continue
      scheduledCount++

      const count    = countMap.get(`${h.id}|${iso}`) ?? 0
      const target   = h.targetCompletions > 0 ? h.targetCompletions : 1
      const fraction = (h.goalType ?? 'at_least') === 'at_most'
        ? Math.max(0, 1 - count / target)   // 0 count = perfect; over target = 0
        : Math.min(1, count / target)
      sum += fraction
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
 * `streakCount` but the occurrence immediately before today — the last
 * time it was actually due — was not the one it was last completed on.
 * Today itself is never enough on its own to break it: the user can
 * still complete today to continue.
 *
 * This is deliberately the same rule `addHabitProgress` uses to decide
 * whether a completion continues a streak, read backwards
 * (`lastCompletedDate === previousScheduledDate`) rather than a
 * separate "how many calendar days" count. Two consequences follow from
 * sharing it instead of re-deriving it:
 *
 *   A specific-days habit's own off days no longer count against it —
 *   the old calendar-day gap flagged a Mon/Wed/Fri habit as broken on
 *   Wednesday morning, before that day's occurrence had even happened,
 *   because two calendar days had passed since Monday.
 *
 *   A skipped day is transparent to it. `previousScheduledDate` already
 *   walks straight past anything in `skippedDates` (that is the whole
 *   point of `isHabitScheduledOn` checking skips first), so the
 *   occurrence "immediately before today" lands on the last day that
 *   was genuinely due — exactly as if the skipped day were never on the
 *   calendar, which is what a skip is for.
 *
 * The gap is measured against the habit day, which matters more here than
 * anywhere else: the caller writes `streakCount: 0` on what this returns.
 * Anchored on the calendar day, a habit last completed the day before
 * would read as two days stale at 01:00 and have a live streak destroyed
 * three hours before the user's day was actually over.
 *
 * Pure detection only — the caller decides how to surface + reset.
 */
export function detectBrokenStreaks(
  habits: Habit[],
  todayISO: string = currentDayISO(),
): BrokenStreak[] {
  const broken: BrokenStreak[] = []
  for (const h of habits) {
    if (h.id == null) continue
    if (h.streakCount <= 0) continue
    if (!h.lastCompletedDate) {
      broken.push({ habitId: h.id, name: h.name, lostStreak: h.streakCount })
      continue
    }
    if (h.lastCompletedDate === todayISO) continue   // already done today

    const prevScheduled = previousScheduledDate(h, todayISO)
    if (prevScheduled == null) continue              // nothing due before today yet
    if (h.lastCompletedDate === prevScheduled) continue   // yesterday's occurrence — still alive

    broken.push({ habitId: h.id, name: h.name, lostStreak: h.streakCount })
  }
  return broken
}
