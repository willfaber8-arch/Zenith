/**
 * lib/calendarMutations.ts — changing an event, wherever it came from.
 *
 * The week grid draws two kinds of row from two tables: your own events
 * from `personalEvents`, and imported ones from `calendarEvents` under a
 * feed. From the outside they are both just events on a calendar, and
 * clicking one should offer the same actions either way — so the choice
 * of table belongs here rather than in every handler.
 *
 * Two rules the UI depends on:
 *
 *   · Editing an imported event marks it `locallyEdited`, which stops
 *     the next feed refresh from silently reverting your change.
 *   · A repeating event is stored as one row per occurrence sharing a
 *     `seriesUid`, so "this one" and "all of them" are the same
 *     operation over a different set of rows.
 */

import { db, type CalendarEvent, type PersonalEvent, type EventPriority } from '@/lib/db'
import {
  planSeriesTimes, startOfLocalDay,
  type OccurrenceRow, type SeriesTimeMode,
} from '@/utils/seriesEdit'

/** The synthetic feed id the grid uses for your own events. */
export const PERSONAL_FEED_ID = -1

/**
 * Which occurrences an edit or deletion should reach.
 *
 * `'future'` sits between the two older options: every occurrence from
 * the one you touched onward, past ones left alone. That is the shape
 * most edits actually want — moving a standing meeting an hour later
 * "from now on" should not rewrite what already happened — and it used
 * to be missing entirely; only "this one" or literally all of them,
 * history included, were on offer.
 */
export type EditScope = 'this' | 'future' | 'series'

export interface EventPatch {
  title?:       string
  /* Personal events only — an imported event takes its colour from its
     feed, and has no calendar of its own to move between. The edit form
     passes these only when the target is a personal event. */
  color?:       string
  calendarId?:  number
  startMs?:     number
  endMs?:       number
  location?:    string
  description?: string
  category?:    string
  allDay?:      number
  timeZone?:    string
  priority?:    EventPriority
}

export function isPersonal(event: { feedId: number }): boolean {
  return event.feedId === PERSONAL_FEED_ID
}

/**
 * The `personalEvents` row id behind a grid event.
 *
 * The grid negates personal ids so they cannot collide with imported
 * ones in the same list — see the mapping in CalendarView. Everything
 * here writes to the table, which knows only the positive id, so the
 * sign has to come off exactly once and this is where.
 *
 * It was not coming off at all: deleting your own event called
 * `personalEvents.delete(-3)`, which matches nothing and reports
 * success, so the popover said "Event deleted" and the event stayed
 * exactly where it was.
 */
function personalRowId(event: CalendarEvent): number | null {
  return event.id != null ? Math.abs(event.id) : null
}

/**
 * True when this event is one of several occurrences of a repeat.
 *
 * Drives whether the UI has to ask "this event or all events" at all —
 * asking about a one-off is noise.
 */
export async function seriesSize(event: CalendarEvent): Promise<number> {
  if (!db || !event.seriesUid) return 1
  /* Your own repeats and imported ones are both rows sharing a
     seriesUid; only the table they live in differs. */
  return isPersonal(event)
    ? db.personalEvents.where('seriesUid').equals(event.seriesUid).count()
    : db.calendarEvents.where('seriesUid').equals(event.seriesUid).count()
}

/** Every row this operation should touch, given the chosen scope. */
async function targetIds(event: CalendarEvent, scope: EditScope): Promise<number[]> {
  if (!db) return []
  if (scope === 'this' || !event.seriesUid) {
    const one = isPersonal(event) ? personalRowId(event) : event.id
    return one != null ? [one] : []
  }
  const rows = isPersonal(event)
    ? await db.personalEvents.where('seriesUid').equals(event.seriesUid).toArray()
    : await db.calendarEvents.where('seriesUid').equals(event.seriesUid).toArray()

  /* 'future' keeps the one clicked and everything after it — the same
     rows 'series' returns, minus whatever already happened. */
  const inScope = scope === 'future'
    ? rows.filter(r => r.startMs >= event.startMs)
    : rows

  return inScope.map(r => r.id).filter((id): id is number => id != null)
}

/** The rows a scope reaches, with the timings the planner needs. */
async function rowsForScope(
  event: CalendarEvent,
  scope: EditScope,
): Promise<(OccurrenceRow & { id: number })[]> {
  if (!db) return []
  const clickedId = isPersonal(event) ? personalRowId(event) : event.id
  if (clickedId == null) return []

  if (scope === 'this' || !event.seriesUid) {
    return [{ id: clickedId, startMs: event.startMs, endMs: event.endMs }]
  }

  const all = isPersonal(event)
    ? await db.personalEvents.where('seriesUid').equals(event.seriesUid).toArray()
    : await db.calendarEvents.where('seriesUid').equals(event.seriesUid).toArray()

  const inScope = scope === 'future'
    ? all.filter(r => r.startMs >= event.startMs)
    : all

  return inScope
    .filter(r => r.id != null)
    .map(r => ({ id: r.id as number, startMs: r.startMs, endMs: r.endMs }))
}

/**
 * Every occurrence of this event's series, for a UI that wants to
 * describe an edit before making it.
 *
 * Exported so the form previews an edit against the same rows the write
 * will touch, rather than counting them a second way of its own.
 */
export async function seriesOccurrences(
  event: CalendarEvent,
): Promise<{ id: number; startMs: number; endMs: number }[]> {
  return rowsForScope(event, 'series')
}

/**
 * Apply a patch to an event, to the rest of its series, or to the part
 * of the series still ahead.
 *
 * Times used to be stripped from anything but the occurrence you
 * clicked. The reasoning only went halfway: an occurrence's `startMs`
 * is an absolute instant, and writing one instant onto forty rows does
 * collapse a whole term onto one afternoon — but a repeat's *time of
 * day* is not per-occurrence at all. "My daily free time is at the
 * wrong hour" was therefore forty separate edits, which is the bug this
 * now fixes: `timeMode` decides how far a time change carries, and
 * utils/seriesEdit works out each row's new timing from its own date.
 *
 * `'occurrence-only'` is the default, and is what dragging always uses:
 * a drag is a gesture on one block of time, never a statement about the
 * series.
 */
export async function applyEventPatch(
  event: CalendarEvent,
  patch: EventPatch,
  scope: EditScope = 'this',
  timeMode: SeriesTimeMode = 'occurrence-only',
): Promise<number> {
  if (!db) return 0

  const rows = await rowsForScope(event, scope)
  if (rows.length === 0) return 0

  const clickedId = isPersonal(event) ? personalRowId(event) : event.id
  if (clickedId == null) return 0

  const { startMs, endMs, ...shared } = patch

  /*
   * A time change reaches the other occurrences only when the caller
   * asked it to and both ends are known — half a time is not a time.
   *
   * Under `'series'` the past is protected: a repeat set to the wrong
   * hour should be fixed from here on, but rewriting when last week's
   * occurrences happened turns the calendar's record of them into a
   * guess. `'future'` needs no such guard, since every row it reaches
   * is already at or after the one being edited.
   */
  const timePlan = (startMs !== undefined && endMs !== undefined)
    ? planSeriesTimes(scope === 'this' ? 'occurrence-only' : timeMode, {
        rows,
        clickedId,
        target: { startMs, endMs },
        protectBeforeMs: scope === 'series' ? startOfLocalDay() : undefined,
      })
    : []
  const timeById = new Map(timePlan.map(p => [p.id, p]))

  /* Only one end supplied — write it where it was aimed and nowhere else. */
  const partialTime = (startMs !== undefined) !== (endMs !== undefined)

  const personal = isPersonal(event)
  let touched = 0

  for (const row of rows) {
    const moved = timeById.get(row.id)
    const body: Record<string, unknown> = { ...shared }

    if (moved) {
      body.startMs = moved.startMs
      body.endMs   = moved.endMs
    } else if (partialTime && row.id === clickedId) {
      if (startMs !== undefined) body.startMs = startMs
      if (endMs   !== undefined) body.endMs   = endMs
    }

    /* Keeps an edited feed event from being reverted by the next
       refresh — see the note on locallyEdited in CLAUDE.md. */
    if (!personal) body.locallyEdited = 1

    if (Object.keys(body).length === 0) continue

    if (personal) await db.personalEvents.update(row.id, body as Partial<PersonalEvent>)
    else          await db.calendarEvents.update(row.id, body as Partial<CalendarEvent>)
    touched++
  }

  return touched
}

/** Remove one occurrence, or every occurrence of the series. */
export async function removeEvent(
  event: CalendarEvent,
  scope: EditScope = 'this',
): Promise<number> {
  if (!db) return 0

  const ids = await targetIds(event, scope)
  if (ids.length === 0) return 0

  if (isPersonal(event)) {
    await db.personalEvents.bulkDelete(ids)
    return ids.length
  }

  await db.calendarEvents.bulkDelete(ids)
  return ids.length
}

/**
 * Move or resize a single occurrence.
 *
 * Always scoped to the one event: a drag is a gesture on a specific
 * block of time, and interpreting it as "shift the whole term" is never
 * what the hand meant.
 */
export async function commitDrag(
  event: CalendarEvent,
  next:  { startMs: number; endMs: number },
): Promise<void> {
  await applyEventPatch(event, { startMs: next.startMs, endMs: next.endMs }, 'this')
}
