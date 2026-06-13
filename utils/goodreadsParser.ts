import type { LibraryBook, ReadingStatus, GoodreadsImportResult } from '@/types/bookTracker'
import { db } from '@/lib/db'

/* ══════════════════════════════════════════════════════════════
   RFC 4180 compliant CSV state-machine parser.

   Handles:
   - Quoted fields containing commas (e.g. "The Hobbit, or There and Back Again")
   - Escaped double-quotes within quoted fields ("")
   - Multiline quoted fields (Goodreads "My Review" can span lines)
   - Both CRLF and LF line endings
   ══════════════════════════════════════════════════════════════ */
function parseCSVDocument(text: string): string[][] {
  const records: string[][] = []
  const currentRecord: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const len = text.length

  while (i < len) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // RFC 4180 escaped double-quote → single quote in output
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        // Any character inside quotes (including \r, \n for multiline reviews)
        field += ch
        i++
      }
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
      } else if (ch === ',') {
        currentRecord.push(field)
        field = ''
        i++
      } else if (ch === '\r' && text[i + 1] === '\n') {
        // CRLF record terminator
        currentRecord.push(field)
        field = ''
        records.push([...currentRecord])
        currentRecord.length = 0
        i += 2
      } else if (ch === '\n' || ch === '\r') {
        // LF or bare CR record terminator
        currentRecord.push(field)
        field = ''
        records.push([...currentRecord])
        currentRecord.length = 0
        i++
      } else {
        field += ch
        i++
      }
    }
  }

  // Flush last field + record (file may not end with a newline)
  if (field || currentRecord.length > 0) {
    currentRecord.push(field)
    if (currentRecord.some(f => f.trim() !== '')) {
      records.push([...currentRecord])
    }
  }

  return records
}

/* ── Field-level helpers ──────────────────────────────────── */

function mapShelfToStatus(shelf: string): ReadingStatus {
  const s = shelf.trim().toLowerCase()
  if (s === 'currently-reading') return 'CURRENTLY_READING'
  if (s === 'read')               return 'COMPLETED'
  return 'TO_READ'
}

function cleanIsbn(raw: string): string | undefined {
  // Goodreads exports ISBN13 as ="9780262033848" — strip = and all non-digit chars
  const cleaned = raw.replace(/[^0-9X]/gi, '')
  return cleaned.length >= 10 ? cleaned : undefined
}

function parseGoodreadsDate(dateStr: string): number | undefined {
  if (!dateStr?.trim()) return undefined
  // Goodreads date format: "YYYY/MM/DD" — normalise slashes to hyphens for Date parsing
  const normalised = dateStr.trim().replace(/\//g, '-')
  const ts = new Date(normalised).getTime()
  return isNaN(ts) ? undefined : ts
}

/* ══════════════════════════════════════════════════════════════
   parseGoodreadsCSV
   Accepts the raw string content of a Goodreads library export CSV
   and returns an array of LibraryBook records ready for IDB insertion.

   Goodreads header names this parser reads (case-sensitive):
     Book Id, Title, Author, ISBN13, My Rating, Average Rating,
     Number of Pages, Exclusive Shelf, Date Read, Date Added,
     My Review, Read Count
   All other columns are ignored.
   ══════════════════════════════════════════════════════════════ */
export function parseGoodreadsCSV(csvText: string): LibraryBook[] {
  const records = parseCSVDocument(csvText)
  if (records.length < 2) return []

  // Build header → column-index map
  const headerRow = records[0]
  const idx: Record<string, number> = {}
  headerRow.forEach((h, i) => { idx[h.trim()] = i })

  const get = (row: string[], key: string): string =>
    (row[idx[key]] ?? '').trim()

  const books: LibraryBook[] = []

  for (let r = 1; r < records.length; r++) {
    const row = records[r]
    if (row.length < 3) continue

    const title = get(row, 'Title')
    if (!title) continue

    const author         = get(row, 'Author')
    const shelf          = get(row, 'Exclusive Shelf')
    const readingStatus  = mapShelfToStatus(shelf)

    const userRating     = Math.min(5, Math.max(0, parseInt(get(row, 'My Rating'), 10) || 0))
    const avgRatingRaw   = parseFloat(get(row, 'Average Rating'))
    const globalRating   = isNaN(avgRatingRaw) ? undefined : Math.round(avgRatingRaw * 100) / 100

    const totalPages     = parseInt(get(row, 'Number of Pages'), 10) || undefined
    const readCountRaw   = parseInt(get(row, 'Read Count'), 10)
    const readCount      = isNaN(readCountRaw)
      ? (readingStatus === 'COMPLETED' ? 1 : 0)
      : readCountRaw

    const dateCompleted  = parseGoodreadsDate(get(row, 'Date Read'))
    const dateAddedRaw   = parseGoodreadsDate(get(row, 'Date Added'))
    const addedAt        = dateAddedRaw ?? Date.now()

    const isbn13         = cleanIsbn(get(row, 'ISBN13'))
    const reviewRaw      = get(row, 'My Review')
    const customReviewText = reviewRaw || undefined

    books.push({
      id: crypto.randomUUID(),
      title,
      author,
      isbn13,
      globalRating,
      userRating,
      totalPages,
      readCount,
      readingStatus,
      dateCompleted,
      customReviewText,
      addedAt,
    })
  }

  return books
}

/* ══════════════════════════════════════════════════════════════
   importGoodreadsCSV
   Parses the CSV and atomically bulk-inserts all parsed records
   into the library_books IDB table via Dexie bulkPut.
   Uses bulkPut (not bulkAdd) so re-importing the same export
   is safe — records are replaced rather than duplicated by id.
   ══════════════════════════════════════════════════════════════ */
export async function importGoodreadsCSV(csvText: string): Promise<GoodreadsImportResult> {
  const books = parseGoodreadsCSV(csvText)

  if (books.length === 0) {
    return {
      imported: 0,
      skipped: 0,
      errors: ['No valid book records found. Ensure this is a Goodreads library export CSV.'],
    }
  }

  try {
    await db.library_books.bulkPut(books)
    return { imported: books.length, skipped: 0, errors: [] }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { imported: 0, skipped: 0, errors: [message] }
  }
}
