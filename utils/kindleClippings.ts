import type { LibraryBook } from '@/types/bookTracker'
import { db, type KindleClipping, type KindleClippingType } from '@/lib/db'

/* ══════════════════════════════════════════════════════════════
   Kindle `My Clippings.txt` parser + importer.

   Amazon exposes no public Kindle API. The only offline export a
   Kindle (incl. Kindle Scribe) offers is the plain-text file at
   `documents/My Clippings.txt`, written every time a highlight,
   note or bookmark is made. This module turns that file into
   structured records and folds them into the Library.

   FILE FORMAT
   ───────────
   Records are separated by a line of `==========`. Each record is:

     Book Title (Author Name)
     - Your Highlight on page 12 | Location 176-177 | Added on Sunday, 3 August 2025 14:22:31
     <blank line>
     The highlighted text

   Real-world variations handled here:
     · Types: Your Highlight / Your Note / Your Bookmark
       (bookmarks carry an empty body).
     · Location-only records:  "- Your Highlight on Location 176-177 | Added on …"
     · Page-only records:      "- Your Note on page 12 | Added on …"
     · Roman-numeral front-matter pages ("page xii") → page left undefined.
     · Missing author (no parentheses) → author = 'Unknown'.
     · Nested / multiple parenthesised groups — the LAST balanced group
       is taken as the author ("Dune (Dune Chronicles) (Herbert, Frank)").
     · UTF-8 BOM prefix and CRLF (or bare CR) line endings.
     · Localised / varied date strings — parsed leniently via Date.parse
       with a weekday-stripped retry; unparseable dates become undefined
       instead of throwing.
     · Malformed or empty records are skipped without aborting the run.
   ══════════════════════════════════════════════════════════════ */

export type ClippingType = KindleClippingType

export interface ParsedClipping {
  title:     string
  author:    string
  type:      ClippingType
  text:      string
  page?:     number
  location?: string
  addedAt?:  number
}

export interface KindleImportResult {
  clippingsImported: number
  clippingsSkipped:  number
  booksCreated:      number
  booksUpdated:      number
  /** Distinct books the newly-imported clippings belong to (created + matched). */
  booksTouched:      number
  errors:            string[]
}

/* ── Title / author line ──────────────────────────────────── */

/**
 * Splits "Some Title (Series) (Herbert, Frank (Jr.))" into
 * { title: 'Some Title (Series)', author: 'Herbert, Frank (Jr.)' }.
 *
 * Scans backwards from the final ')' with a depth counter so the LAST
 * *balanced* parenthesised group wins, even when it contains nested
 * parentheses. Falls back to author = 'Unknown' when the line has no
 * trailing group (or the parentheses are unbalanced).
 */
function splitTitleAuthor(rawLine: string): { title: string; author: string } {
  const line = rawLine.trim()
  if (!line.endsWith(')')) return { title: line, author: 'Unknown' }

  let depth = 0
  let openIdx = -1
  for (let i = line.length - 1; i >= 0; i--) {
    const ch = line[i]
    if (ch === ')') depth++
    else if (ch === '(') {
      depth--
      if (depth === 0) { openIdx = i; break }
    }
  }
  if (openIdx <= 0) return { title: line, author: 'Unknown' }

  const title  = line.slice(0, openIdx).trim()
  const author = line.slice(openIdx + 1, line.length - 1).trim()
  if (!title) return { title: line, author: 'Unknown' }
  return { title, author: author || 'Unknown' }
}

/* ── Metadata line ────────────────────────────────────────── */

function resolveType(meta: string, hasBody: boolean): ClippingType {
  const m = meta.toLowerCase()
  // English + a few common localisations; ordered so "note" never
  // steals a highlight line that merely mentions notes.
  if (/\b(bookmark|lesezeichen|marcador|signet|segnalibro)\b/.test(m)) return 'BOOKMARK'
  if (/\b(note|notiz|nota|remarque)\b/.test(m))                        return 'NOTE'
  if (/\b(highlight|markierung|subrayado|surlignement|evidenziazione)\b/.test(m)) return 'HIGHLIGHT'
  // Unknown/localised wording — infer from the body.
  return hasBody ? 'HIGHLIGHT' : 'BOOKMARK'
}

function resolvePage(meta: string): number | undefined {
  // "on page 12", "on page 12-13", "Page 4" — roman numerals yield no digits.
  const m = /\bpage\s+([^|]+)/i.exec(meta)
  if (!m) return undefined
  const digits = /\d+/.exec(m[1])
  if (!digits) return undefined
  const n = parseInt(digits[0], 10)
  return Number.isFinite(n) ? n : undefined
}

function resolveLocation(meta: string): string | undefined {
  const m = /\blocation\s+([0-9]+(?:\s*-\s*[0-9]+)?)/i.exec(meta)
  if (!m) return undefined
  return m[1].replace(/\s+/g, '')
}

function resolveAddedAt(meta: string): number | undefined {
  // The timestamp is the last pipe-delimited segment on the metadata line.
  const segments = meta.split('|').map(s => s.trim()).filter(Boolean)
  if (segments.length === 0) return undefined
  const tail = segments[segments.length - 1]

  // Strip the "Added on " (or localised equivalent) prefix — everything up
  // to and including the first " on "/" am "/" el " token if present.
  const cleaned = tail
    .replace(/^added\s+on\s+/i, '')
    .replace(/^hinzugefügt\s+am\s+/i, '')
    .replace(/^añadido\s+el\s+/i, '')
    .trim()

  const direct = Date.parse(cleaned)
  if (!Number.isNaN(direct)) return direct

  // Lenient retry: drop a leading weekday token ("domingo, 3 de …").
  const commaIdx = cleaned.indexOf(',')
  if (commaIdx > 0) {
    const retry = Date.parse(cleaned.slice(commaIdx + 1).trim())
    if (!Number.isNaN(retry)) return retry
  }
  return undefined
}

/* ══════════════════════════════════════════════════════════════
   parseClippings
   Accepts the raw string content of a Kindle `My Clippings.txt`
   file and returns every structured record it can recover.
   Never throws — unreadable records are dropped silently.
   ══════════════════════════════════════════════════════════════ */
export function parseClippings(text: string): ParsedClipping[] {
  if (!text) return []

  // Strip UTF-8 BOM + normalise CRLF / bare CR to LF.
  const normalised = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')

  // Records are separated by a line consisting only of '=' characters.
  const blocks = normalised.split(/\n?^={3,}[ \t]*$\n?/m)

  const out: ParsedClipping[] = []

  for (const block of blocks) {
    if (!block.trim()) continue

    const lines = block.split('\n')
    // Drop leading blank lines so the title is always lines[0].
    while (lines.length > 0 && !lines[0].trim()) lines.shift()
    if (lines.length === 0) continue

    const titleLine = lines[0].trim()
    if (!titleLine) continue

    const metaLine = (lines[1] ?? '').trim()
    // A record with no metadata line is not a clipping (stray text/footer).
    if (!metaLine.startsWith('-')) continue

    const meta = metaLine.replace(/^-\s*/, '')
    const body = lines.slice(2).join('\n').trim()

    const { title, author } = splitTitleAuthor(titleLine)
    if (!title) continue

    const type = resolveType(meta, body.length > 0)
    // Highlights and notes with no body are unusable; bookmarks are
    // legitimately empty.
    if (type !== 'BOOKMARK' && !body) continue

    out.push({
      title,
      author,
      type,
      text:     body,
      page:     resolvePage(meta),
      location: resolveLocation(meta),
      addedAt:  resolveAddedAt(meta),
    })
  }

  return out
}

/* ── De-duplication ───────────────────────────────────────── */

/** 53-bit deterministic string hash (cyrb53) rendered as hex. */
function hashString(input: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

/**
 * Stable identity of one clipping:
 *   title | author | type | location | addedAt | first ~80 chars of text
 *
 * Re-importing the same `My Clippings.txt` therefore adds ZERO rows,
 * and appending new highlights to the file only imports the new ones.
 */
export function clippingHash(c: ParsedClipping): string {
  const key = [
    c.title.trim().toLowerCase(),
    c.author.trim().toLowerCase(),
    c.type,
    c.location ?? '',
    c.addedAt ?? '',
    c.text.trim().slice(0, 80).toLowerCase(),
  ].join('|')
  return hashString(key)
}

/* ── Book matching ────────────────────────────────────────── */

const normTitle = (t: string): string => t.trim().toLowerCase()

/** "Herbert, Frank" and "Frank Herbert" normalise to the same key. */
function normAuthor(a: string): string {
  return (a ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ')
}

interface BookGroup {
  title:     string
  author:    string
  clippings: ParsedClipping[]
  earliest?: number
  latest?:   number
}

function groupByBook(clippings: ParsedClipping[]): BookGroup[] {
  const map = new Map<string, BookGroup>()
  for (const c of clippings) {
    const key = `${normTitle(c.title)}|${normAuthor(c.author)}`
    let g = map.get(key)
    if (!g) {
      g = { title: c.title.trim(), author: c.author.trim(), clippings: [] }
      map.set(key, g)
    }
    g.clippings.push(c)
    if (c.addedAt !== undefined) {
      if (g.earliest === undefined || c.addedAt < g.earliest) g.earliest = c.addedAt
      if (g.latest   === undefined || c.addedAt > g.latest)   g.latest   = c.addedAt
    }
  }
  return [...map.values()]
}

/**
 * Resolves a parsed group to an existing library row: case-insensitive
 * title match, disambiguated by author when several books share a title.
 */
function matchExistingBook(group: BookGroup, books: LibraryBook[]): LibraryBook | undefined {
  const t = normTitle(group.title)
  const candidates = books.filter(b => normTitle(b.title) === t)
  if (candidates.length === 0) return undefined
  if (candidates.length === 1) return candidates[0]
  const a = normAuthor(group.author)
  return candidates.find(b => normAuthor(b.author) === a) ?? candidates[0]
}

/* ══════════════════════════════════════════════════════════════
   importKindleClippings
   Parses the file, folds every new clipping into `kindle_clippings`
   and links it to a library book — creating the book when it is not
   already on a shelf.

   Guarantees:
     · Re-importing an unchanged file writes nothing (hash de-dup).
     · An existing book's readingStatus, rating and review are NEVER
       touched — a COMPLETED book is never downgraded.
     · Only `lastReadAt` (when newer) and an empty `dateStarted` are
       filled in on books that already exist.
     · All writes happen inside a single rw transaction.
   ══════════════════════════════════════════════════════════════ */
export async function importKindleClippings(text: string): Promise<KindleImportResult> {
  const empty: KindleImportResult = {
    clippingsImported: 0, clippingsSkipped: 0,
    booksCreated: 0, booksUpdated: 0, booksTouched: 0, errors: [],
  }

  const parsed = parseClippings(text)
  if (parsed.length === 0) {
    return {
      ...empty,
      errors: ['No Kindle clippings found. Select the "My Clippings.txt" file from your Kindle\'s documents folder.'],
    }
  }

  try {
    const [existingClippings, existingBooks] = await Promise.all([
      db.kindle_clippings.toArray(),
      db.library_books.toArray(),
    ])

    const seen = new Set(existingClippings.map(c => c.hash))

    const fresh: { clipping: ParsedClipping; hash: string }[] = []
    let skipped = 0
    for (const c of parsed) {
      const hash = clippingHash(c)
      if (seen.has(hash)) { skipped++; continue }   // already imported (or dupe within the file)
      seen.add(hash)
      fresh.push({ clipping: c, hash })
    }

    if (fresh.length === 0) {
      return { ...empty, clippingsSkipped: skipped }
    }

    const groups = groupByBook(fresh.map(f => f.clipping))

    const booksToCreate: LibraryBook[] = []
    const bookUpdates: { id: string; patch: Partial<LibraryBook> }[] = []
    /** normalised group key → resolved LibraryBook.id */
    const bookIdByGroup = new Map<string, string>()

    const now = Date.now()

    for (const g of groups) {
      const groupKey = `${normTitle(g.title)}|${normAuthor(g.author)}`
      const match = matchExistingBook(g, existingBooks)

      if (!match) {
        const created: LibraryBook = {
          id:            crypto.randomUUID(),
          title:         g.title,
          author:        g.author,
          userRating:    0,
          readCount:     0,
          readingStatus: 'CURRENTLY_READING',
          dateStarted:   g.earliest,
          lastReadAt:    g.latest,
          addedAt:       now,
        }
        booksToCreate.push(created)
        existingBooks.push(created)      // future groups in this run can match it
        bookIdByGroup.set(groupKey, created.id)
        continue
      }

      bookIdByGroup.set(groupKey, match.id)

      // Only ever fill gaps / advance the clock. Reading status, rating and
      // review belong to the user and are left untouched.
      const patch: Partial<LibraryBook> = {}
      if (g.latest !== undefined && g.latest > (match.lastReadAt ?? 0)) patch.lastReadAt = g.latest
      if (!match.dateStarted && g.earliest !== undefined)               patch.dateStarted = g.earliest
      if (Object.keys(patch).length > 0) bookUpdates.push({ id: match.id, patch })
    }

    const rows: KindleClipping[] = fresh.map(({ clipping: c, hash }) => {
      const groupKey = `${normTitle(c.title)}|${normAuthor(c.author)}`
      return {
        id:         crypto.randomUUID(),
        bookId:     bookIdByGroup.get(groupKey) ?? null,
        title:      c.title,
        author:     c.author,
        type:       c.type,
        text:       c.text,
        page:       c.page,
        location:   c.location,
        addedAt:    c.addedAt,
        hash,
        importedAt: now,
      }
    })

    await db.transaction('rw', db.kindle_clippings, db.library_books, async () => {
      if (booksToCreate.length > 0) await db.library_books.bulkPut(booksToCreate)
      for (const u of bookUpdates) await db.library_books.update(u.id, u.patch)
      await db.kindle_clippings.bulkPut(rows)
    })

    return {
      clippingsImported: rows.length,
      clippingsSkipped:  skipped,
      booksCreated:      booksToCreate.length,
      booksUpdated:      bookUpdates.length,
      booksTouched:      groups.length,
      errors:            [],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ...empty, errors: [message] }
  }
}
