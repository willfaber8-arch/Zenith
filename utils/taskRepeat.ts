/**
 * utils/taskRepeat.ts — a task that comes back.
 *
 * The calendar could already repeat an event; a task could not, so
 * "bins every Tuesday" had no way to be written down. It reuses the
 * calendar's rule engine rather than growing a second one.
 *
 * The model is one row that moves, not many rows generated ahead.
 * A chore is not fifty-two separate obligations — it is one thing whose
 * next date keeps changing, and expanding it into rows would fill the
 * list with work nobody has to think about yet and leave a year of
 * tombstones behind. Ticking it moves it forward.
 *
 * Pure: no React, no Dexie.
 */

import { expandOccurrences, type RecurrenceRule } from '@/utils/recurrence'
import { fromLocalDateStr, toLocalDateStr } from '@/utils/localDate'

/* ── The presets ─────────────────────────────────────────────────
   Deliberately a short list rather than a rule builder. The full
   grammar belongs to the calendar, where events genuinely need it;
   a to-do list wants one tap. */

export type RepeatPreset =
  | 'none' | 'daily' | 'weekdays' | 'weekly' | 'fortnightly' | 'monthly' | 'yearly'

export const REPEAT_PRESETS: readonly RepeatPreset[] = [
  'none', 'daily', 'weekdays', 'weekly', 'fortnightly', 'monthly', 'yearly',
]

export const REPEAT_LABEL: Record<RepeatPreset, string> = {
  none:        'Does not repeat',
  daily:       'Every day',
  weekdays:    'Every weekday',
  weekly:      'Every week',
  fortnightly: 'Every 2 weeks',
  monthly:     'Every month',
  yearly:      'Every year',
}

/** Short form for a row: "Weekly", "Weekdays". Empty when it does not repeat. */
export const REPEAT_BADGE: Record<RepeatPreset, string> = {
  none: '', daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly',
  fortnightly: '2-weekly', monthly: 'Monthly', yearly: 'Yearly',
}

export function isRepeatPreset(v: unknown): v is RepeatPreset {
  return typeof v === 'string' && (REPEAT_PRESETS as readonly string[]).includes(v)
}

/** The stored value for a task that does not repeat is simply absent. */
export function presetOf(a: { repeat?: string | null }): RepeatPreset {
  return isRepeatPreset(a.repeat) ? a.repeat : 'none'
}

/* ── Presets as rules ────────────────────────────────────────── */

export function ruleFor(preset: RepeatPreset): RecurrenceRule | null {
  switch (preset) {
    case 'daily':       return { freq: 'DAILY',   interval: 1 }
    case 'weekdays':    return { freq: 'WEEKLY',  interval: 1, byDay: [1, 2, 3, 4, 5] }
    case 'weekly':      return { freq: 'WEEKLY',  interval: 1 }
    case 'fortnightly': return { freq: 'WEEKLY',  interval: 2 }
    case 'monthly':     return { freq: 'MONTHLY', interval: 1 }
    case 'yearly':      return { freq: 'YEARLY',  interval: 1 }
    default:            return null
  }
}

/* ── When it comes back ──────────────────────────────────────── */

/** How far ahead to look before giving up. Two years of daily is plenty. */
const SEARCH_DAYS = 800

/**
 * The next date a repeating task is due, after `from`.
 *
 * The judgement call is what happens when you tick a chore late. Bins
 * were due Tuesday, you do them Friday: the honest answer is next
 * Tuesday, not last Tuesday, and not three catch-up Tuesdays you never
 * did. So occurrences are walked from the old due date and the first
 * one strictly after `from` wins — missed ones are skipped rather than
 * piling up. A recurring task should never be able to accumulate a
 * backlog, because a chore you did not do last week is not extra work
 * this week; it is the same chore.
 *
 * Returns null when the task does not repeat, when the date is
 * unreadable, or when the rule runs out.
 */
export function nextDueDate(
  dueDate: string,
  preset:  RepeatPreset,
  from:    Date = new Date(),
): string | null {
  const rule = ruleFor(preset)
  if (!rule) return null

  const anchor = fromLocalDateStr(dueDate)
  if (Number.isNaN(anchor.getTime())) return null

  /*
   * The next occurrence has to clear both the old due date and today.
   *
   * Taking today alone breaks completing something early: a chore due
   * in March, ticked in September, would "advance" to the March date it
   * already had — the first occurrence after today is the one it is
   * sitting on. Taking the due date alone breaks completing something
   * late, which is the case this function exists for. The later of the
   * two is the only answer that handles both.
   *
   * Local midnight, so "strictly after" means a later day rather than
   * later this afternoon.
   */
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const cutoff = Math.max(anchor.getTime(), today)

  const horizon = new Date(
    anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + SEARCH_DAYS,
  ).getTime()

  const occurrences = expandOccurrences(
    anchor.getTime(), anchor.getTime(), rule, [],
    { maxOccurrences: SEARCH_DAYS, horizonMs: horizon },
  )

  for (const o of occurrences) {
    if (o.startMs > cutoff) return toLocalDateStr(new Date(o.startMs))
  }
  return null
}

/**
 * What ticking a repeating task should do to it.
 *
 * `null` means treat it as an ordinary completion — it does not repeat,
 * or the rule has run out and there is no next date, at which point the
 * task is genuinely finished rather than silently vanishing.
 */
export function advanceOnComplete(
  task: { dueDate: string; repeat?: string | null },
  from: Date = new Date(),
): { dueDate: string } | null {
  const preset = presetOf(task)
  if (preset === 'none') return null
  if (!task.dueDate) return null      // nothing to advance from
  const next = nextDueDate(task.dueDate, preset, from)
  return next ? { dueDate: next } : null
}
