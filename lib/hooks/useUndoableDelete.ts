'use client'

/**
 * useUndoableDelete — deleting something and offering it back.
 *
 * The pattern this replaces is a confirmation dialog. Confirmations ask
 * you to be careful *before* you know whether you were wrong, which is
 * the one moment you cannot answer the question — so you learn to click
 * through them, and they stop protecting anything. Undo asks nothing at
 * the time and is there when you turn out to be wrong.
 *
 * Confirmations still belong on the things undo cannot reach: replacing
 * the whole database, or anything that leaves no rows to put back.
 */

import { useCallback } from 'react'
import { db } from '@/lib/db'
import { useToast } from '@/lib/ToastContext'
import { captureRows, restoreEntry, type AnyRow } from '@/lib/undo'

export interface UndoableDeleteOptions {
  /** Table to delete from, by name. */
  table: string
  /** Primary keys of the rows going. */
  keys:  readonly unknown[]
  /** What the toast says happened: `"Read chapter 3" deleted.` */
  message: string
}

/** What actually happened, for callers that need to react to it. */
export interface UndoableDeleteResult {
  deleted:    number
  /** False when there was nothing to delete, or no way back. */
  undoable:   boolean
}

interface LooseTable {
  get(key: unknown): Promise<AnyRow | undefined>
  bulkDelete(keys: unknown[]): Promise<unknown>
}

export function useUndoableDelete() {
  const { toast } = useToast()

  return useCallback(async (opts: UndoableDeleteOptions): Promise<UndoableDeleteResult> => {
    if (!db || opts.keys.length === 0) return { deleted: 0, undoable: false }

    let t: LooseTable
    try {
      t = (db as unknown as { table(n: string): LooseTable }).table(opts.table)
    } catch {
      return { deleted: 0, undoable: false }
    }

    /*
     * Read before deleting. Reconstructing a row afterwards is guesswork;
     * reading it while it still exists is not. A row that has already
     * gone is skipped rather than failing the whole delete.
     */
    const rows: AnyRow[] = []
    for (const k of opts.keys) {
      const row = await t.get(k)
      if (row) rows.push(row)
    }
    if (rows.length === 0) return { deleted: 0, undoable: false }

    const entry = captureRows(opts.table, rows, 'delete')
    await t.bulkDelete([...opts.keys])

    if (!entry) {
      /* No usable snapshot — say what happened, but do not offer a way
         back that would not work. */
      toast(opts.message, 'info')
      return { deleted: rows.length, undoable: false }
    }

    toast(opts.message, 'info', {
      label: 'Undo',
      run: () => { void restoreEntry(entry) },
    })
    return { deleted: rows.length, undoable: true }
  }, [toast])
}
