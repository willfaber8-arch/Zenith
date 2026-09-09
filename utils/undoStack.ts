/**
 * utils/undoStack.ts — a bounded history of reversible changes.
 *
 * Direct manipulation needs a way back. Dragging an event is one gesture
 * away from a wrong week, and the calendar has no other record of where
 * it used to be — the previous position exists only in the row you just
 * overwrote.
 *
 * Every entry carries the rows *as they were*, so undoing is a write
 * rather than an inverse calculation. That matters because the inverse
 * of "delete a 40-week series" is not a smaller edit, it is the forty
 * rows themselves; storing them is the only honest way to put them back.
 *
 * Pure: the stack is an immutable array and every operation returns a
 * new one. Nothing here touches Dexie.
 */

/** Which table an entry's rows belong to. */
export type UndoTable = 'calendarEvents' | 'personalEvents'

export interface UndoEntry<Row = Record<string, unknown>> {
  id:    string
  /** Shown on the button: "Undo move", "Undo delete of 40". */
  label: string
  at:    number
  table: UndoTable
  /** Every row id the action touched. */
  affectedIds: number[]
  /**
   * Those rows as they were beforehand.
   *
   * An id in `affectedIds` with no matching row here was created by the
   * action, so undoing it means deleting that row.
   */
  before: Row[]
}

/**
 * How far back the history goes.
 *
 * Deep enough to walk out of a bad editing session, shallow enough that
 * a deleted series does not sit in memory forever.
 */
export const UNDO_LIMIT = 25

export function pushUndo<Row>(
  stack: readonly UndoEntry<Row>[],
  entry: UndoEntry<Row>,
  limit = UNDO_LIMIT,
): UndoEntry<Row>[] {
  const next = [entry, ...stack]
  return next.length > limit ? next.slice(0, limit) : next
}

/** The entry that would be undone next, if there is one. */
export function peekUndo<Row>(stack: readonly UndoEntry<Row>[]): UndoEntry<Row> | null {
  return stack.length > 0 ? stack[0] : null
}

/** Remove the most recent entry, returning it and the shorter stack. */
export function popUndo<Row>(
  stack: readonly UndoEntry<Row>[],
): { entry: UndoEntry<Row> | null; rest: UndoEntry<Row>[] } {
  if (stack.length === 0) return { entry: null, rest: [] }
  return { entry: stack[0], rest: stack.slice(1) }
}

export function clearUndo<Row>(): UndoEntry<Row>[] {
  return []
}

/**
 * Work out what an undo has to write and what it has to delete.
 *
 * Rows present beforehand are written back as they were; ids the action
 * touched that have no prior row were created by it, so they go.
 */
export function planUndo<Row extends { id?: number }>(
  entry: UndoEntry<Row>,
): { restore: Row[]; remove: number[] } {
  const had = new Set(
    entry.before.map(r => r.id).filter((id): id is number => typeof id === 'number'),
  )
  return {
    restore: entry.before,
    remove:  entry.affectedIds.filter(id => !had.has(id)),
  }
}

/** "Undo move" / "Undo delete of 40" — what the button should say. */
export function describeUndo<Row>(entry: UndoEntry<Row> | null): string {
  return entry ? `Undo ${entry.label}` : 'Nothing to undo'
}
