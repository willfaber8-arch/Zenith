/**
 * utils/habitLimit.ts — how a "no more than N" habit is judged.
 *
 * A limit habit is not the mirror of a goal habit, and treating it as
 * one is where this went wrong. Reaching a goal is knowable the moment
 * you reach it: tap the twelfth cup and the day is won. Staying under a
 * limit is only knowable when the day is over — one coffee is not
 * success at "no more than two", it is success so far.
 *
 * So a limit day has three states rather than two, and its streak is
 * derived from history on read rather than written at the moment of a
 * press. Nothing runs at midnight to settle the day, and inventing a
 * background job to do it would be a worse answer than deriving the
 * number when someone actually looks at it.
 */

import type { Habit } from '@/lib/db'

/** Today is still in play; a past day has already been decided. */
export type LimitDayState = 'pending' | 'success' | 'failed'

/**
 * How a single day of a limit habit stands.
 *
 * A day with nothing logged is a success, not an absence: having no
 * coffees is the best possible outcome for "no more than two", and
 * showing it as a missed day would invert the whole habit.
 */
export function limitDayState(
  count:   number,
  target:  number,
  isToday: boolean,
): LimitDayState {
  if (count > target) return 'failed'   // decided, whatever the day does next
  return isToday ? 'pending' : 'success'
}

/**
 * The streak for a limit habit, counted back from the last finished day.
 *
 * Today is deliberately excluded however well it is going — it has not
 * finished, and counting it would let a streak evaporate later in the
 * same day, which reads as the app taking something away.
 *
 * Walks back over scheduled days only, so a weekday-only limit is not
 * broken by the weekend, and stops at the day the habit was created so
 * a new habit does not inherit credit for days that predate it.
 */
export function limitStreak(
  habit:         Habit,
  countFor:      (iso: string) => number,
  today:         string,
  scheduledOn:   (habit: Habit, iso: string) => boolean,
  /* Returns null when there is no earlier scheduled day to walk to. */
  previousDay:   (habit: Habit, iso: string) => string | null,
  maxLookback  = 400,
): number {
  const target  = habit.targetCompletions
  const created = createdDateISO(habit)

  let streak = 0
  let cursor: string | null = previousDay(habit, today)

  for (let i = 0; i < maxLookback; i++) {
    if (!cursor || cursor < created) break
    if (scheduledOn(habit, cursor)) {
      if (countFor(cursor) > target) break    // the run ends here
      streak += 1
    }
    const next: string | null = previousDay(habit, cursor)
    if (next === cursor) break                // no progress; refuse to spin
    cursor = next
  }
  return streak
}

/** The habit's creation date as an ISO day, for bounding the walk back. */
function createdDateISO(habit: Habit): string {
  const d = new Date(habit.createdAt)
  if (isNaN(d.getTime())) return '0000-01-01'
  const y  = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${dd}`
}

/**
 * How much of the allowance is left, as a fraction.
 *
 * 1 is untouched, 0 is spent. Used to pitch the sound downward as the
 * allowance drains, so a limit habit sounds like the opposite of a goal
 * habit rather than the same tone in a different colour.
 */
export function remainingFraction(count: number, target: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(target) || target <= 0) return 0
  return Math.min(1, Math.max(0, (target - count) / target))
}
