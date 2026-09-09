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

/** Which rows an operation at this scope is about to touch. */
async function rowsInScope(event: CalendarEvent, scope: EditScope): Promise<CalRow[]> {
  if (!db) return []

  if (isPersonal(event)) {
    if (event.id == null) return []
    const row = await db.personalEvents.get(event.id)
    return row ? [row] : []
  }

  if (scope === 'series' && event.seriesUid) {
    return db.calendarEvents.where('seriesUid').equals(event.seriesUid).toArray()
  }
  if (event.id == null) return []
  const row = await db.calendarEvents.get(event.id)
  return row ? [row] : []
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
