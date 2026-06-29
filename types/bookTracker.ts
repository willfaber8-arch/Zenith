export type ReadingStatus = 'TO_READ' | 'CURRENTLY_READING' | 'COMPLETED'

export type StatusFilter = ReadingStatus | 'ALL'

export type BookFormat = 'hardcover' | 'paperback' | 'ebook' | 'audiobook'

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
  // ── Advanced (Goodreads-style) fields — all optional, non-indexed ──
  genre?: string                // primary genre (preset or custom)
  publicationYear?: number      // year published, e.g. 2019
  series?: string               // series name + number, e.g. "Mistborn #1"
  format?: BookFormat
  readingMinutes?: number       // cumulative minutes logged by the reading timer
  lastReadAt?: number           // UTC ms of the last reading session
}

/** Common genres for the add-book dropdown (plus a free-text custom option). */
export const BOOK_GENRES: string[] = [
  'Fiction', 'Nonfiction', 'Fantasy', 'Science Fiction', 'Mystery', 'Thriller',
  'Romance', 'Historical Fiction', 'Horror', 'Biography', 'Memoir', 'History',
  'Self-Help', 'Business', 'Philosophy', 'Poetry', 'Young Adult', 'Classics',
  'Graphic Novel', 'Science', 'Other',
]

export const BOOK_FORMATS: { value: BookFormat; label: string }[] = [
  { value: 'hardcover', label: 'Hardcover' },
  { value: 'paperback', label: 'Paperback' },
  { value: 'ebook',     label: 'eBook'     },
  { value: 'audiobook', label: 'Audiobook' },
]

/* ── Sorting ─────────────────────────────────────────────── */

export type SortKey =
  | 'recent' | 'title-az' | 'title-za' | 'author'
  | 'genre'  | 'published' | 'pages'    | 'color'

export const SORT_LABELS: Record<SortKey, string> = {
  'recent':   'Recently added',
  'title-az': 'Title A–Z',
  'title-za': 'Title Z–A',
  'author':   'Author',
  'genre':    'Genre',
  'published':'Date published',
  'pages':    'Total pages',
  'color':    'Color',
}

/** Hue (0–360) of a hex colour — used by the "Color" sort to group the shelf
 *  into a rainbow. Falls back to 0 for unparseable input. */
function hexHue(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0
  const n = parseInt(m[1], 16)
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d === 0) return 0
  let h = 0
  if (max === r)      h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else                h = (r - g) / d + 4
  h *= 60
  return h < 0 ? h + 360 : h
}

/** Pure comparator-driven sort for the bookshelf. Stable, never mutates input. */
export function sortBooks(books: LibraryBook[], key: SortKey): LibraryBook[] {
  const arr = [...books]
  const byTitle = (b: LibraryBook) => b.title.toLowerCase()
  switch (key) {
    case 'title-az': return arr.sort((a, b) => byTitle(a).localeCompare(byTitle(b)))
    case 'title-za': return arr.sort((a, b) => byTitle(b).localeCompare(byTitle(a)))
    case 'author':   return arr.sort((a, b) => (a.author || '~').toLowerCase().localeCompare((b.author || '~').toLowerCase()))
    case 'genre':    return arr.sort((a, b) => (a.genre || '~').localeCompare(b.genre || '~') || byTitle(a).localeCompare(byTitle(b)))
    case 'published':return arr.sort((a, b) => (b.publicationYear ?? -Infinity) - (a.publicationYear ?? -Infinity))
    case 'pages':    return arr.sort((a, b) => (b.totalPages ?? 0) - (a.totalPages ?? 0))
    case 'color':    return arr.sort((a, b) => hexHue(spineColorFor(a)) - hexHue(spineColorFor(b)))
    case 'recent':
    default:         return arr.sort((a, b) => b.addedAt - a.addedAt)
  }
}

/**
 * ReadingSession — one logged reading sitting from the reading timer.
 * Stores duration and (optionally) pages read, so per-book stats like
 * total time, total pages, and pages-per-minute can be derived locally.
 */
export interface ReadingSession {
  id?:        number
  bookId:     string    // FK → LibraryBook.id (indexed)
  date:       string    // 'YYYY-MM-DD' (local)
  minutes:    number
  pagesRead?: number
  createdAt:  number    // UTC ms (indexed)
}

/** Aggregate reading stats for one book, derived from its sessions. */
export interface BookReadingStats {
  totalMinutes: number
  totalPages:   number
  sessions:     number
  pagesPerMin:  number | null   // null until there's time + pages logged
}

export function computeBookStats(sessions: ReadingSession[]): BookReadingStats {
  const totalMinutes = sessions.reduce((s, x) => s + (x.minutes || 0), 0)
  const totalPages   = sessions.reduce((s, x) => s + (x.pagesRead || 0), 0)
  return {
    totalMinutes,
    totalPages,
    sessions:    sessions.length,
    pagesPerMin: totalMinutes > 0 && totalPages > 0
      ? Math.round((totalPages / totalMinutes) * 10) / 10
      : null,
  }
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
