/**
 * utils/taskRetention.ts — tidying finished work away.
 *
 * "Show done" is only useful while it is short. A list that keeps every
 * task you have ever ticked off stops being a record of what you just
 * finished and becomes an archive nobody scrolls, which is the same as
 * having no such view at all.
 *
 * So finished tasks are removed after a while. That is a deletion on a
 * timer in an app whose only copy of your data is this browser, so it
 * is built to the narrowest rule that solves the problem:
 *
 *   · It only ever touches tasks you ticked off yourself. Anything
 *     still open is never in scope, whatever its date.
 *   · The clock starts when you ticked it, not when it was created or
 *     last edited. Unticking a task clears the clock.
 *   · It can be turned off, and "Never" is a real setting rather than a
 *     very long window.
 *   · Tasks finished before this existed are stamped rather than
 *     deleted, so switching this on never removes anything
 *     retroactively — the window starts from the day you got it.
 *   · It runs after the daily snapshot, never before, so anything it
 *     removes is still recoverable from a snapshot for a few days.
 */

import { db, type Assignment } from '@/lib/db'

/** How long finished tasks stay, in days. `null` means keep them. */
export type RetentionDays = 7 | 14 | 30 | null

export const RETENTION_KEY = 'zenith_done_retention_v1'

/** A week, per the ask. Long enough to still see what you did. */
export const DEFAULT_RETENTION: RetentionDays = 7

export const RETENTION_CHOICES: { value: RetentionDays; label: string }[] = [
  { value: 7,    label: 'After a week' },
  { value: 14,   label: 'After two weeks' },
  { value: 30,   label: 'After a month' },
  { value: null, label: 'Never — keep them all' },
]

const DAY_MS = 24 * 60 * 60 * 1000

export function readRetention(): RetentionDays {
  if (typeof window === 'undefined') return DEFAULT_RETENTION
  try {
    const raw = localStorage.getItem(RETENTION_KEY)
    if (raw === null) return DEFAULT_RETENTION
    if (raw === 'never') return null
    const n = Number(raw)
    /* An unrecognised value means storage has been edited or has moved
       on a version. Keeping the default is the safe reading — the other
       branch of a bad parse is deleting on a window nobody chose. */
    return n === 7 || n === 14 || n === 30 ? n : DEFAULT_RETENTION
  } catch {
    return DEFAULT_RETENTION
  }
}

export function writeRetention(value: RetentionDays): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(RETENTION_KEY, value === null ? 'never' : String(value))
    window.dispatchEvent(new CustomEvent(RETENTION_CHANGED))
  } catch { /* a browser refusing to store a preference is not fatal */ }
}

/** Lets open panels re-read the setting without a reload. */
export const RETENTION_CHANGED = 'zenith:done-retention-changed'

export function describeRetention(value: RetentionDays): string {
  if (value === null) return 'Finished tasks are kept until you delete them.'
  const unit = value === 7 ? 'a week' : value === 14 ? 'two weeks' : 'a month'
  return `Finished tasks are removed ${unit} after you tick them off.`
}

export interface SweepResult {
  /** Rows deleted. */
  removed: number
  /** Pre-existing finished tasks given a clock for the first time. */
  stamped: number
}

/**
 * Remove finished tasks past the window.
 *
 * `now` is injectable so the boundary can be tested at a real date
 * rather than by sleeping.
 */
export async function sweepCompletedTasks(
  opts: { now?: number; retention?: RetentionDays } = {},
): Promise<SweepResult> {
  if (!db) return { removed: 0, stamped: 0 }

  const retention = opts.retention !== undefined ? opts.retention : readRetention()
  const now       = opts.now ?? Date.now()

  /* `status` is indexed, so this reads only the finished ones. */
  const done: Assignment[] = await db.assignments
    .where('status').equals('completed').toArray()
  if (done.length === 0) return { removed: 0, stamped: 0 }

  /*
   * Anything finished before completedAt existed has no clock. Give it
   * one now instead of treating "unknown" as "old" — the alternative
   * deletes a year of finished work the first time the app opens after
   * an update, which is not something anyone asked for.
   *
   * This happens even when retention is off, so turning it on later
   * still starts everyone's window from a sensible place.
   */
  const unstamped = done.filter(a => a.completedAt == null && a.id != null)
  if (unstamped.length > 0) {
    await db.assignments.bulkUpdate(
      unstamped.map(a => ({ key: a.id as number, changes: { completedAt: now } })),
    )
  }

  if (retention === null) return { removed: 0, stamped: unstamped.length }

  const cutoff = now - retention * DAY_MS
  const expired = done
    .filter(a => a.completedAt != null && a.completedAt <= cutoff && a.id != null)
    .map(a => a.id as number)

  if (expired.length > 0) await db.assignments.bulkDelete(expired)

  return { removed: expired.length, stamped: unstamped.length }
}
