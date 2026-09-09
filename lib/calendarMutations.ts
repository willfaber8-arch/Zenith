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

import { db, type CalendarEvent, type PersonalEvent } from '@/lib/db'

/** The synthetic feed id the grid uses for your own events. */
export const PERSONAL_FEED_ID = -1

/** Which occurrences an edit or deletion should reach. */
export type EditScope = 'this' | 'series'

export interface EventPatch {
  title?:       string
  startMs?:     number
  endMs?:       number
  location?:    string
  description?: string
  category?:    string
  allDay?:      number
  timeZone?:    string
}

export function isPersonal(event: { feedId: number }): boolean {
  return event.feedId === PERSONAL_FEED_ID
}

/**
 * True when this event is one of several occurrences of a repeat.
 *
 * Drives whether the UI has to ask "this event or all events" at all —
 * asking about a one-off is noise.
 */
export async function seriesSize(event: CalendarEvent): Promise<number> {
  if (!db || isPersonal(event) || !event.seriesUid) return 1
  return db.calendarEvents.where('seriesUid').equals(event.seriesUid).count()
}

/** Every row this operation should touch, given the chosen scope. */
async function targetIds(event: CalendarEvent, scope: EditScope): Promise<number[]> {
  if (!db) return []
  if (scope === 'this' || isPersonal(event) || !event.seriesUid) {
    return event.id != null ? [event.id] : []
  }
  const rows = await db.calendarEvents.where('seriesUid').equals(event.seriesUid).toArray()
  return rows.map(r => r.id).filter((id): id is number => id != null)
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

  if (isPersonal(event)) {
    if (event.id == null) return 0
    await db.personalEvents.update(event.id, patch as Partial<PersonalEvent>)
    return 1
  }

  const ids = await targetIds(event, scope)
  if (ids.length === 0) return 0

  const { startMs, endMs, ...shared } = patch
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

  if (isPersonal(event)) {
    if (event.id == null) return 0
    await db.personalEvents.delete(event.id)
    return 1
  }

  const ids = await targetIds(event, scope)
  if (ids.length === 0) return 0
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
