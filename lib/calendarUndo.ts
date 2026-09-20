/**
 * lib/calendarUndo.ts — capturing and reversing calendar changes.
 *
 * The stack itself is pure (utils/undoStack); this is the half that
 * talks to Dexie: reading rows before a change so there is something to
 * go back to, and writing them again when the button is pressed.
 *
 * Snapshots are taken *before* the mutation, deliberately. Reconstructing
 * a previous position afterwards is guesswork; reading the row while it
 * still says what it used to is not.
 */

import { db, type CalendarEvent, type PersonalEvent } from '@/lib/db'
import { isPersonal, type EditScope } from '@/lib/calendarMutations'
import { planUndo, type UndoEntry, type UndoTable } from '@/utils/undoStack'

export type CalRow = CalendarEvent | PersonalEvent
export type CalUndoEntry = UndoEntry<CalRow>

function newId(): string {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Which rows an operation at this scope is about to touch.
 *
 * Mirrors targetIds() in lib/calendarMutations.ts — the two have to agree
 * on what a scope means, or an undo could restore a different set of rows
 * than the mutation it is meant to reverse touched.
 *
 * The grid negates a personal event's id to keep it from colliding with
 * feed events in the same list (see the mapping in CalendarView), so it
 * has to come off here too. It wasn't: `personalEvents.get(-3)` matches
 * nothing, so every personal-event edit or drag silently captured no
 * snapshot at all, and "Undo" never appeared after moving your own event.
 */
async function rowsInScope(event: CalendarEvent, scope: EditScope): Promise<CalRow[]> {
  if (!db) return []

  if (isPersonal(event)) {
    if (event.id == null) return []
    const rowId = Math.abs(event.id)
    if (scope === 'this' || !event.seriesUid) {
      const row = await db.personalEvents.get(rowId)
      return row ? [row] : []
    }
    const rows = await db.personalEvents.where('seriesUid').equals(event.seriesUid).toArray()
    return scope === 'future' ? rows.filter(r => r.startMs >= event.startMs) : rows
  }

  if (scope === 'this' || !event.seriesUid) {
    if (event.id == null) return []
    const row = await db.calendarEvents.get(event.id)
    return row ? [row] : []
  }
  const rows = await db.calendarEvents.where('seriesUid').equals(event.seriesUid).toArray()
  return scope === 'future' ? rows.filter(r => r.startMs >= event.startMs) : rows
}

/**
 * Photograph the rows an action is about to change.
 *
 * Call this immediately before the mutation. The returned entry is what
 * makes the change reversible; without it the previous state is gone the
 * moment the write lands.
 */
export async function captureUndo(
  event: CalendarEvent,
  scope: EditScope,
  label: string,
): Promise<CalUndoEntry | null> {
  const rows = await rowsInScope(event, scope)
  if (rows.length === 0) return null

  const table: UndoTable = isPersonal(event) ? 'personalEvents' : 'calendarEvents'
  return {
    id:          newId(),
    label,
    at:          Date.now(),
    table,
    affectedIds: rows.map(r => r.id).filter((id): id is number => typeof id === 'number'),
    before:      rows,
  }
}

/**
 * Put the calendar back the way the entry describes.
 *
 * `bulkPut` rather than `update`: a deleted row has to come back whole,
 * and an edited one has to lose every field the change touched, not just
 * the ones we happened to think of.
 */
export async function applyUndo(entry: CalUndoEntry): Promise<number> {
  if (!db) return 0
  const { restore, remove } = planUndo(entry)
  const table = entry.table === 'personalEvents' ? db.personalEvents : db.calendarEvents

  if (restore.length > 0) {
    await (table as unknown as {
      bulkPut: (rows: unknown[]) => Promise<unknown>
    }).bulkPut(restore)
  }
  if (remove.length > 0) {
    await (table as unknown as {
      bulkDelete: (ids: number[]) => Promise<void>
    }).bulkDelete(remove)
  }
  return restore.length + remove.length
}
