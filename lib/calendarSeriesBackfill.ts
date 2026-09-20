/**
 * lib/calendarSeriesBackfill.ts — giving old events the grouping they
 * never got.
 *
 * "This and following" and "all events" both work by `seriesUid`: rows
 * sharing one are the same repeating thing, and `targetIds()` in
 * lib/calendarMutations.ts reaches them together. Events written before
 * that field existed — and every course schedule the replicator has
 * ever generated, which wrote one independent row per class session —
 * carry no `seriesUid` at all. The app therefore believes a semester of
 * CHEM 2090 is forty unrelated events that happen to share a name:
 * `seriesSize()` answers 1, the scope picker never appears, and editing
 * one changes exactly one. Nothing is broken enough to look broken,
 * which is why it reads as "the save for future events doesn't work".
 *
 * The fix is to fill in the mechanism that already exists rather than
 * add a second one beside it (see the note on `seriesUid` in CLAUDE.md):
 * work out which ungrouped rows were always one series, and stamp them.
 * Everything downstream — edit scope, delete scope, the "Repeats · N
 * times" chip, undo — then works on them exactly as it does on rows
 * written today, with no branch anywhere asking how old an event is.
 *
 * Grouping is deliberately conservative, because the cost of the two
 * mistakes is not symmetric. Missing a group leaves an event editable
 * one at a time, which is where it already is. Inventing one puts "All
 * 40" in front of a delete button for events that were never related.
 */

import { db } from '@/lib/db'

/** Marks a series that was reconstructed here rather than written as one. */
const BACKFILL_PREFIX = 'bf'

/** Set once the backfill has run, so it costs one table scan per install. */
export const BACKFILL_FLAG = 'zenith_series_backfill_v1'

function newSeriesUid(): string {
  return `${BACKFILL_PREFIX}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** The fields grouping needs, from either table. */
export interface GroupableEvent {
  id?:        number
  feedId?:    number
  title:      string
  startMs:    number
  endMs:      number
  allDay?:    number
  seriesUid?: string
}

export interface PlannedSeries {
  key: string
  ids: number[]
}

/**
 * What makes two imported events the same recurring thing: the same
 * calendar, and the same title.
 *
 * A feed is a machine-made set — a generated course schedule, or a
 * server that expanded a recurrence into separate VEVENTs before
 * sending it. Within one calendar, two events with an identical title
 * are the same commitment on two dates; that is what a calendar feed
 * means by repeating something. Title alone would be too loose across
 * feeds (a "Lecture" in two different courses), which is why the feed
 * is part of the key.
 */
function feedKey(e: GroupableEvent): string {
  return `feed:${e.feedId ?? 'none'}:${e.title.trim().toLowerCase()}`
}

/**
 * The same question for your own events, asked more strictly.
 *
 * Nothing made these a set: they were typed in one at a time, so the
 * only honest evidence that they are one repeating thing is that they
 * look identical — same name, same hours, same length. "Gym, 07:00,
 * one hour" ten times over is a repeat someone entered by hand. Two
 * unrelated events that merely share a name are not, and matching on
 * the title alone would sweep them together.
 */
function personalKey(e: GroupableEvent): string {
  const d = new Date(e.startMs)
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return [
    'personal',
    e.title.trim().toLowerCase(),
    hhmm,
    e.endMs - e.startMs,
    e.allDay ?? 0,
  ].join(':')
}

export type BackfillKind = 'feed' | 'personal'

/**
 * Work out which ungrouped rows belong together.
 *
 * Pure — no Dexie, no clock. Rows that already have a `seriesUid` are
 * left strictly alone: this only ever fills a gap, and re-running it
 * can never re-group something already grouped. A key matched by a
 * single row is not a series, so it is dropped rather than given a
 * `seriesUid` that would make one event claim to repeat.
 */
export function planSeriesBackfill(
  rows: GroupableEvent[],
  kind: BackfillKind,
): PlannedSeries[] {
  const keyOf = kind === 'feed' ? feedKey : personalKey
  const groups = new Map<string, number[]>()

  for (const row of rows) {
    if (row.seriesUid || row.id == null) continue
    const key = keyOf(row)
    const bucket = groups.get(key)
    if (bucket) bucket.push(row.id)
    else groups.set(key, [row.id])
  }

  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }))
}

export interface BackfillResult {
  /** How many series were reconstructed. */
  series: number
  /** How many rows were given a seriesUid. */
  rows:   number
}

/**
 * Stamp every reconstructed series, across both tables.
 *
 * Idempotent: a second run finds nothing left without a `seriesUid` and
 * writes nothing. Safe to call on every load, though `hasRunBackfill`
 * exists so it normally costs one scan per install rather than one per
 * page view.
 */
export async function runSeriesBackfill(): Promise<BackfillResult> {
  if (!db) return { series: 0, rows: 0 }

  let series = 0
  let rows   = 0

  /* Rows missing the field are absent from its index entirely, so this
     is a scan either way — filter in JS rather than pretend otherwise. */
  const imported = await db.calendarEvents.filter(r => !r.seriesUid).toArray()
  for (const group of planSeriesBackfill(imported, 'feed')) {
    const uid = newSeriesUid()
    await db.calendarEvents.where('id').anyOf(group.ids).modify({ seriesUid: uid })
    series++
    rows += group.ids.length
  }

  const personal = await db.personalEvents.filter(r => !r.seriesUid).toArray()
  for (const group of planSeriesBackfill(personal, 'personal')) {
    const uid = newSeriesUid()
    await db.personalEvents.where('id').anyOf(group.ids).modify({ seriesUid: uid })
    series++
    rows += group.ids.length
  }

  return { series, rows }
}

/**
 * Group one feed's ungrouped events, right after an import.
 *
 * A calendar server that expanded a recurrence before sending it —
 * separate VEVENTs, distinct uids, no RRULE for the parser to work
 * from — delivers exactly the rows this module exists for, and it does
 * so again on every refresh. Without this the one-time backfill would
 * fix such a feed once and a later refresh would silently undo it,
 * which is a worse bug than the original because it comes back.
 *
 * Scoped to the feed just written, so an import costs a query against
 * an index rather than a scan of the table.
 */
export async function backfillFeedSeries(feedId: number): Promise<BackfillResult> {
  if (!db) return { series: 0, rows: 0 }

  const rows = (await db.calendarEvents.where('feedId').equals(feedId).toArray())
    .filter(r => !r.seriesUid)

  let series = 0
  let touched = 0
  for (const group of planSeriesBackfill(rows, 'feed')) {
    const uid = newSeriesUid()
    await db.calendarEvents.where('id').anyOf(group.ids).modify({ seriesUid: uid })
    series++
    touched += group.ids.length
  }
  return { series, rows: touched }
}

export function hasRunBackfill(): boolean {
  try {
    return localStorage.getItem(BACKFILL_FLAG) === '1'
  } catch {
    /* Storage blocked: run it again rather than skip it. The write below
       is a no-op the second time, so the only cost is the scan. */
    return false
  }
}

export function markBackfillRun(): void {
  try { localStorage.setItem(BACKFILL_FLAG, '1') } catch { /* nothing to do */ }
}

/** Run once per install, and say what it found. */
export async function backfillSeriesOnce(): Promise<BackfillResult | null> {
  if (hasRunBackfill()) return null
  const result = await runSeriesBackfill()
  markBackfillRun()
  return result
}
