/**
 * lib/hooks/useShelves.ts — user-defined shelves for the library.
 *
 * Shelves are additive. They sit alongside `readingStatus` rather than
 * replacing it, so a book can be COMPLETED and also on "Sci-fi" and "Uni
 * reading"; and a library that has never made a shelf behaves exactly as
 * it did before, because membership is an absent array on every row.
 *
 * Membership lives on the book (`shelfIds`) and identity lives in
 * `library_shelves`, which means creating or deleting a shelf never has
 * to rewrite the whole library — deleting only has to clean up the books
 * that actually referenced it.
 */

'use client'

import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { LibraryBook, LibraryShelf } from '@/types/bookTracker'

/** Palette for new shelves — cycled so consecutive shelves differ. */
const SHELF_COLORS = [
  '#7c95ff', '#52cca3', '#f6a96b', '#e0723a',
  '#a78bfa', '#38bdf8', '#f87171', '#c2a980',
] as const

export interface ShelvesApi {
  shelves:   LibraryShelf[]
  isLoading: boolean
  createShelf: (name: string) => Promise<string | null>
  renameShelf: (id: string, name: string) => Promise<void>
  deleteShelf: (id: string) => Promise<void>
  setShelfExcluded: (id: string, excluded: boolean) => Promise<void>
  /** Add or remove one book from one shelf. */
  toggleBookShelf: (book: LibraryBook, shelfId: string) => Promise<void>
  /** Ids of shelves excluded from recommendations. */
  excludedShelfIds: Set<string>
}

export function useShelves(): ShelvesApi {
  const rows = useLiveQuery(
    async () => (db ? db.library_shelves.toArray() : []),
    [],
  )

  const shelves = useMemo(
    () => [...(rows ?? [])].sort((a, b) =>
      a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [rows],
  )

  const excludedShelfIds = useMemo(
    () => new Set(shelves.filter(s => s.excludeFromRecs).map(s => s.id)),
    [shelves],
  )

  const createShelf = useCallback(async (name: string): Promise<string | null> => {
    const clean = name.trim()
    if (!db || !clean) return null

    const existing = await db.library_shelves.toArray()
    // Case-insensitive: "Sci-fi" and "sci-fi" are the same shelf to a person.
    const clash = existing.find(s => s.name.toLowerCase() === clean.toLowerCase())
    if (clash) return clash.id

    const id = crypto.randomUUID()
    await db.library_shelves.add({
      id,
      name:      clean,
      sortOrder: existing.length,
      color:     SHELF_COLORS[existing.length % SHELF_COLORS.length],
      createdAt: Date.now(),
    })
    return id
  }, [])

  const renameShelf = useCallback(async (id: string, name: string) => {
    const clean = name.trim()
    if (!db || !clean) return
    await db.library_shelves.update(id, { name: clean })
  }, [])

  const deleteShelf = useCallback(async (id: string) => {
    if (!db) return
    /*
     * Removing the shelf without unfiling its books would leave dangling
     * ids on every one of them — invisible, but they would resurface as
     * phantom membership the moment a new shelf reused the id.
     */
    await db.transaction('rw', db.library_shelves, db.library_books, async () => {
      const members = await db.library_books
        .filter(b => Array.isArray(b.shelfIds) && b.shelfIds.includes(id))
        .toArray()
      for (const b of members) {
        await db.library_books.update(b.id, {
          shelfIds: (b.shelfIds ?? []).filter(s => s !== id),
        })
      }
      await db.library_shelves.delete(id)
    })
  }, [])

  const setShelfExcluded = useCallback(async (id: string, excluded: boolean) => {
    if (!db) return
    await db.library_shelves.update(id, { excludeFromRecs: excluded })
  }, [])

  const toggleBookShelf = useCallback(async (book: LibraryBook, shelfId: string) => {
    if (!db || !book.id) return
    const current = book.shelfIds ?? []
    const next = current.includes(shelfId)
      ? current.filter(s => s !== shelfId)
      : [...current, shelfId]
    await db.library_books.update(book.id, { shelfIds: next })
  }, [])

  return {
    shelves,
    isLoading: rows === undefined,
    createShelf, renameShelf, deleteShelf, setShelfExcluded,
    toggleBookShelf, excludedShelfIds,
  }
}

/**
 * Should this book seed recommendations?
 *
 * Three ways to say no, and any one of them is enough: the book itself is
 * marked, it sits on an excluded shelf, or it was never actually read.
 * The last is not a user setting — a book on the to-read pile says
 * nothing about taste yet.
 */
export function isRecommendationSource(
  book: LibraryBook,
  excludedShelfIds: ReadonlySet<string>,
): boolean {
  if (book.excludeFromRecs) return false
  if ((book.shelfIds ?? []).some(id => excludedShelfIds.has(id))) return false
  return true
}
