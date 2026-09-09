'use client'

/**
 * lib/undo.ts — putting back anything, not only calendar events.
 *
 * The stack (utils/undoStack) and the calendar's capture-and-restore
 * (lib/calendarUndo) already did this well; they were just wired to two
 * tables. "I did not mean to delete that" is not a calendar-specific
 * feeling, so this is the same idea addressed by table name.
 *
 * Why it earns its place next to confirmations: a confirmation asks you
 * to be careful *before* you know whether you were wrong, and you learn
 * to click through it. Undo asks nothing and is there when you turn out
 * to be wrong. Confirmations are for what undo cannot reach.
 */

import { db } from '@/lib/db'
import { planUndo, type UndoEntry } from '@/utils/undoStack'

/** A row from any table — keyed by its own primary key, whatever that is. */
export type AnyRow = Record<string, unknown>
export type GenericUndoEntry = UndoEntry<AnyRow>

function newId(): string {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Dexie's `Table` is typed per-store, and this deliberately is not.
 * The alternative is a union of every table in the database repeated at
 * every call site, which is how the calendar version ended up pinned to
 * two tables.
 */
interface LooseTable {
  get(key: unknown): Promise<AnyRow | undefined>
  bulkPut(rows: AnyRow[]): Promise<unknown>
  bulkDelete(keys: unknown[]): Promise<unknown>
  schema: { primKey: { keyPath?: string | string[] | null } }
}

function table(name: string): LooseTable | null {
  if (!db) return null
  try {
    return (db as unknown as { table(n: string): LooseTable }).table(name)
  } catch {
    /* A table that does not exist on this schema version. Better to
       lose the undo than to throw inside a delete handler. */
    return null
  }
}

/** The primary key value of a row, per that table's own key path. */
export function keyOf(t: LooseTable, row: AnyRow): unknown {
  const kp = t.schema.primKey.keyPath
  if (typeof kp === 'string') return row[kp]
  /* Compound keys are not supported here — no table Zenith deletes from
     uses one, and guessing at one would restore rows to the wrong ids. */
  return undefined
}

/**
 * Photograph rows before they are deleted or overwritten.
 *
 * Taken *before* the mutation, deliberately: reconstructing a previous
 * value afterwards is guesswork, reading the row while it still says
 * what it used to is not.
 *
 * `label` completes the sentence "Undo …" and is shown on the button,
 * so it reads as an action: "delete", "delete of 3 notes".
 */
export function captureRows<T extends object>(
  tableName: string,
  rows: readonly T[],
  label: string,
): GenericUndoEntry | null {
  const t = table(tableName)
  if (!t || rows.length === 0) return null

  /* Declared interfaces have no index signature, so they are not
     assignable to Record<string, unknown> even though every row is one
     at runtime. The cast is at the boundary, once. */
  const asRows = rows as readonly AnyRow[]

  const ids = asRows
    .map(r => keyOf(t, r))
    .filter((k): k is number => typeof k === 'number')

  /* String primary keys are common in this database (books, links,
     subscriptions). Fall back to positional ids only when every row has
     a usable key of some sort. */
  const keys = asRows.map(r => keyOf(t, r))
  if (keys.some(k => k === undefined)) return null

  return {
    id:          newId(),
    label,
    at:          Date.now(),
    table:       tableName,
    affectedIds: ids.length === asRows.length ? ids : [],
    before:      asRows.map(r => ({ ...r })),
  }
}

/**
 * Write the photographed rows back.
 *
 * `bulkPut` rather than `add`, so an undo of an *edit* overwrites the
 * changed row and an undo of a *delete* recreates it, with one code
 * path and the original primary keys intact — which is what keeps the
 * things that pointed at those rows still pointing at them.
 */
export async function restoreEntry(entry: GenericUndoEntry): Promise<number> {
  const t = table(entry.table)
  if (!t) return 0

  const { restore, remove } = planUndo(entry as UndoEntry<AnyRow & { id?: number }>)
  if (restore.length > 0) await t.bulkPut(restore as AnyRow[])
  if (remove.length  > 0) await t.bulkDelete(remove)
  return restore.length
}

/** "3 notes" / "1 task" — for the message beside the button. */
export function countLabel(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}
