export type ReadingStatus = 'TO_READ' | 'CURRENTLY_READING' | 'COMPLETED'

export type StatusFilter = ReadingStatus | 'ALL'

export interface LibraryBook {
  id: string                    // UUID PK — explicit, not auto-increment
  title: string
  author: string
  isbn13?: string               // cleaned 13-digit string
  globalRating?: number         // Goodreads community average (0–5)
  userRating: number            // user's personal rating (0 = unrated)
  totalPages?: number
  readCount: number             // how many times read; ≥1 for COMPLETED
  readingStatus: ReadingStatus
  dateStarted?: number          // UTC ms
  dateCompleted?: number        // UTC ms
  customReviewText?: string
  spineColor?: string           // hex spine colour for the bookshelf visual
  addedAt: number               // UTC ms
}

export interface GoodreadsImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  TO_READ:           'To Read',
  CURRENTLY_READING: 'Currently Reading',
  COMPLETED:         'Completed',
}

export const STATUS_GLYPHS: Record<ReadingStatus, string> = {
  TO_READ:           '◈',
  CURRENTLY_READING: '◎',
  COMPLETED:         '✦',
}

/* ── Bookshelf spine colours ───────────────────────────────
   Muted, library-leather palette. White spine text reads
   cleanly against every entry. Used by the visual bookshelf. */
export const SPINE_COLORS: string[] = [
  '#8c2f2f', // deep red
  '#2f5d50', // forest green
  '#2f3e6e', // navy
  '#9c7a2f', // mustard gold
  '#6e2f4d', // burgundy plum
  '#2f6e6a', // teal
  '#4a4f63', // slate
  '#6b4423', // brown leather
  '#3d5a3d', // olive
  '#5a2f6e', // royal purple
  '#2f4a6e', // steel blue
  '#7a3b2f', // rust
]

/** Deterministic fallback spine colour from a book id — keeps a
 *  book's spine stable across reloads even before the user picks one. */
export function spineColorFor(book: { id: string; spineColor?: string }): string {
  if (book.spineColor) return book.spineColor
  let h = 0
  for (let i = 0; i < book.id.length; i++) {
    h = (h * 31 + book.id.charCodeAt(i)) >>> 0
  }
  return SPINE_COLORS[h % SPINE_COLORS.length]
}
