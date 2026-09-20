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

/**
 * Apply a patch to an event, or to its whole series.
 *
 * A series edit deliberately does not carry start and end times across
 * occurrences — moving every Monday class to Tuesday by editing one of
 * them would be a surprise, and the times are what make each occurrence
 * distinct. Times only ever apply to the occurrence you touched.
 */
export async function applyEventPatch(
  event: CalendarEvent,
  patch: EventPatch,
  scope: EditScope = 'this',
): Promise<number> {
  if (!db) return 0

  const ids = await targetIds(event, scope)
  if (ids.length === 0) return 0

  const { startMs, endMs, ...shared } = patch

  if (isPersonal(event)) {
    let n = 0
    for (const id of ids) {
      /* Times belong to the occurrence you touched, never to the
         series — moving every Tuesday seminar to Wednesday by editing
         one of them is not what editing one of them means. */
      const body: Partial<PersonalEvent> = id === personalRowId(event)
        ? { ...shared, ...(startMs !== undefined ? { startMs } : {}),
                       ...(endMs   !== undefined ? { endMs   } : {}) }
        : { ...shared }
      if (Object.keys(body).length === 0) continue
      await db.personalEvents.update(id, body)
      n++
    }
    return n
  }
  let touched = 0

  for (const id of ids) {
    const isTheOneClicked = id === event.id
    /* Times belong to the occurrence, never to the series. */
    const body: Partial<CalendarEvent> = isTheOneClicked
      ? { ...shared, ...(startMs !== undefined ? { startMs } : {}),
                     ...(endMs   !== undefined ? { endMs   } : {}),
          locallyEdited: 1 }
      : { ...shared, locallyEdited: 1 }
    if (Object.keys(body).length === 0) continue
    await db.calendarEvents.update(id, body)
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
