/**
 * utils/bookCovers.ts — automatic book-cover resolution.
 *
 * Amazon/Goodreads expose no cover API, so covers come from two free,
 * key-less services, and the answer is cached on the book row so a title is
 * only ever looked up once:
 *
 *   1. Open Library Covers — a direct image URL keyed by ISBN.
 *   2. Google Books        — a title+author search returning a thumbnail.
 *                            Used when there is no ISBN, or Open Library has
 *                            no artwork for that one.
 *
 * ── WHY THIS WAS REWRITTEN ────────────────────────────────────────────
 *
 * The first version resolved almost nothing in a real browser. Three
 * separate faults, each sufficient on its own to return null:
 *
 *   1. It validated the Open Library URL with `fetch(url, {method:'HEAD'})`.
 *      A `fetch` is a CORS request: unless the host returns an explicit
 *      `Access-Control-Allow-Origin`, the browser rejects it and the call
 *      *throws* — even though the very same URL in an `<img>` would have
 *      displayed fine. So every ISBN book silently fell through to Google
 *      Books. Loading an image via `new Image()` is NOT CORS-gated (only
 *      reading its pixels back is), so that is the probe now.
 *
 *   2. The Google Books query joined its two terms with `+`. That string is
 *      then passed through `encodeURIComponent`, which turns `+` into `%2B`
 *      — a literal plus character inside the search phrase rather than a
 *      term separator. Google Books separates terms on whitespace.
 *
 *   3. It searched the raw Goodreads title. Goodreads exports titles like
 *      `Dune (Dune, #1)`, and an `intitle:"..."` phrase match against that
 *      finds nothing.
 *
 * Privacy: resolving a cover sends the book's ISBN (or title + author) to
 * the service queried. Nothing else about the user is transmitted, and the
 * resolved URL is cached locally so lookups do not repeat.
 */

import type { LibraryBook } from '@/types/bookTracker'

/* ── Open Library ─────────────────────────────────────────────── */

/** Direct cover URL for an ISBN. `default=false` → 404 on a miss. */
export function openLibraryCoverUrl(isbn: string, size: 'S' | 'M' | 'L' = 'L'): string | null {
  const clean = isbn.replace(/[^0-9Xx]/g, '')
  if (clean.length !== 10 && clean.length !== 13) return null
  return `https://covers.openlibrary.org/b/isbn/${clean}-${size}.jpg?default=false`
}

/**
 * Does this URL actually yield an image?
 *
 * Uses the image loader rather than `fetch`, deliberately. A cross-origin
 * `fetch` needs the host to opt in with CORS headers or it throws; an
 * `<img>` load has never been CORS-gated. Since the only question here is
 * "will this render", the loader is both the more permissive probe and the
 * more honest one — it tests exactly what the UI is about to do.
 *
 * Resolves false rather than rejecting, so callers can fall through cleanly.
 */
function probeImage(url: string, timeoutMs = 8000, signal?: AbortSignal): Promise<boolean> {
  if (typeof Image === 'undefined') return Promise.resolve(false)   // SSR
  return new Promise<boolean>(resolve => {
    const img = new Image()
    let settled = false

    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      img.onload  = null
      img.onerror = null
      img.src = ''                       // cancels an in-flight fetch
      signal?.removeEventListener('abort', onAbort)
      resolve(ok)
    }

    const timer   = setTimeout(() => done(false), timeoutMs)
    const onAbort = () => done(false)
    signal?.addEventListener('abort', onAbort)

    // An Open Library miss with default=false 404s → onerror. A hit decodes
    // → onload. naturalWidth guards against a 1px placeholder counting as art.
    img.onload  = () => done(img.naturalWidth > 1)
    img.onerror = () => done(false)
    img.referrerPolicy = 'no-referrer'
    img.src = url
  })
}

/* ── Title / author normalisation ─────────────────────────────── */

/**
 * Goodreads titles carry series and edition noise that defeats a phrase
 * match. Strip it back to the words likely to be printed on the cover.
 *
 *   "Dune (Dune, #1)"                          → "Dune"
 *   "Oathbringer (The Stormlight Archive, #3)" → "Oathbringer"
 *   "Neuromancer [Sprawl Trilogy]"             → "Neuromancer"
 */
export function cleanBookTitle(raw: string): string {
  let t = raw.trim()
  t = t.replace(/\s*\([^)]*\)\s*$/g, '')          // trailing (Series, #1)
  t = t.replace(/\s*\[[^\]]*\]\s*$/g, '')         // trailing [Boxed Set]
  return t.trim() || raw.trim()
}

/** The part before a subtitle colon — a looser retry than the full title. */
function titleWithoutSubtitle(title: string): string {
  const idx = title.indexOf(':')
  if (idx <= 0) return title
  const head = title.slice(0, idx).trim()
  // Guard a colon that follows a very short lead ("It: A Novel").
  return head.length >= 4 ? head : title
}

/**
 * Goodreads writes some authors "Herbert, Frank" and appends roles like
 * "(Goodreads Author)". Reduce to a plain "Frank Herbert".
 */
export function cleanAuthor(raw: string): string {
  const stripped = raw.replace(/\s*\([^)]*\)/g, '').trim()

  // "Last, First" → "First Last", but only when both halves look like a
  // personal name. Multi-author fields ("Gaiman, Neil, Terry Pratchett")
  // and imprint names should not be reordered.
  const m = /^([^,]+),\s*([^,]+)$/.exec(stripped)
  if (m
      && m[1].trim().split(/\s+/).length <= 2
      && m[2].trim().split(/\s+/).length <= 3) {
    return `${m[2].trim()} ${m[1].trim()}`
  }

  // Otherwise take the first listed author.
  return stripped.split(/[,;]|\s+&\s+|\s+\band\b\s+/)[0].trim() || stripped
}

/* ── Google Books ─────────────────────────────────────────────── */

interface GoogleVolume {
  volumeInfo?: {
    title?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    industryIdentifiers?: { type: string; identifier: string }[]
  }
}

/** Upgrade a Google Books thumbnail to https + a larger, un-curled image. */
function normaliseGoogleThumb(raw: string): string {
  return raw
    .replace(/^http:/, 'https:')
    .replace(/&edge=curl/g, '')
    .replace(/&zoom=\d+/g, '&zoom=2')
}

/** Run one Google Books query; returns the first usable thumbnail. */
async function runGoogleQuery(q: string, signal?: AbortSignal): Promise<string | null> {
  const url = `https://www.googleapis.com/books/v1/volumes?maxResults=5&country=US&q=${encodeURIComponent(q)}`
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const data = (await res.json()) as { items?: GoogleVolume[] }
    for (const item of data.items ?? []) {
      const thumb = item.volumeInfo?.imageLinks?.thumbnail
        ?? item.volumeInfo?.imageLinks?.smallThumbnail
      if (thumb) return normaliseGoogleThumb(thumb)
    }
    return null
  } catch {
    return null   // offline / blocked / rate-limited — caller falls through
  }
}

/**
 * Build the query cascade for a book, strictest first.
 *
 * The strict phrase match runs first because it is most likely to be the
 * *right* book; the looser ones exist so an awkwardly-formatted title still
 * gets artwork instead of nothing. Exported for testing.
 *
 * Terms are separated by a SPACE. Joining with `+` yielded `%2B` after
 * encoding — a literal plus inside the phrase, which matched nothing.
 */
export function buildGoogleQueries(title: string, author?: string): string[] {
  const t  = cleanBookTitle(title)
  const tS = titleWithoutSubtitle(t)
  const a  = author ? cleanAuthor(author) : ''

  const attempts: string[] = []
  if (a) attempts.push(`intitle:"${t}" inauthor:"${a}"`)
  attempts.push(`intitle:"${t}"`)
  if (tS !== t) {
    if (a) attempts.push(`intitle:"${tS}" inauthor:"${a}"`)
    attempts.push(`intitle:"${tS}"`)
  }
  // Last resort: unquoted free text — loosest match, so it runs last.
  attempts.push(a ? `${tS} ${a}` : tS)

  return [...new Set(attempts)]
}

/**
 * Look up a cover via Google Books (no key required for volume search).
 * Tries progressively looser queries and stops at the first hit.
 */
export async function googleBooksCoverUrl(
  title: string,
  author?: string,
  signal?: AbortSignal,
): Promise<string | null> {
  for (const q of buildGoogleQueries(title, author)) {
    if (signal?.aborted) return null
    const hit = await runGoogleQuery(q, signal)
    if (hit) return hit
  }
  return null
}

/* ── Resolution ───────────────────────────────────────────────── */

/**
 * Best cover URL for a book without performing any network request:
 * the Open Library ISBN URL when an ISBN exists. Safe to drop straight
 * into <img src> — a miss 404s and the caller's onError handles it.
 */
export function immediateCoverUrl(book: Pick<LibraryBook, 'isbn13'>): string | null {
  return book.isbn13 ? openLibraryCoverUrl(book.isbn13) : null
}

/**
 * Resolve a cover URL: Open Library by ISBN, then Google Books by
 * title + author. Returns null only when neither has one.
 *
 * `verify` probes the Open Library URL with an image load so a 404 is not
 * cached as a hit. Pass false to skip the probe when the caller's own
 * `<img>` will validate it anyway.
 */
export async function resolveCoverUrl(
  book: Pick<LibraryBook, 'isbn13' | 'title' | 'author'>,
  opts: { verify?: boolean; signal?: AbortSignal } = {},
): Promise<string | null> {
  const { verify = true, signal } = opts

  const olUrl = book.isbn13 ? openLibraryCoverUrl(book.isbn13) : null
  if (olUrl) {
    if (!verify) return olUrl
    if (await probeImage(olUrl, 8000, signal)) return olUrl
    // 404 or unreachable — fall through to Google Books.
  }

  if (book.title) {
    const g = await googleBooksCoverUrl(book.title, book.author || undefined, signal)
    if (g) return g
  }

  return null
}
