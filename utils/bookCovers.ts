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

/* ── Lookup result ────────────────────────────────────────────────────
 *
 * Resolution returns a RESULT rather than a bare URL because the caller
 * has to distinguish two very different kinds of "no cover":
 *
 *   · not_found    — genuinely no artwork. Cache it; never ask again.
 *   · rate_limited — we were throttled and learned nothing. Caching this
 *                    as a miss is what turned one bad afternoon into 19
 *                    books permanently marked "no cover available".
 *
 * It also carries back any ISBN discovered along the way, so a title-only
 * book gains a stable key for every future lookup.
 */

export type CoverFailure = 'not_found' | 'rate_limited' | 'offline'

export interface CoverLookupResult {
  url:      string | null
  /** ISBN discovered during the search — worth persisting on the book. */
  isbn13?:  string
  failure?: CoverFailure
}

/** Upgrade a Google Books thumbnail to https + a larger, un-curled image. */
function normaliseGoogleThumb(raw: string): string {
  return raw
    .replace(/^http:/, 'https:')
    .replace(/&edge=curl/g, '')
    .replace(/&zoom=\d+/g, '&zoom=2')
}

/* ── Open Library search ──────────────────────────────────────────────
 *
 * The primary title-based lookup, and the reason the hit rate is not
 * hostage to one provider's quota.
 *
 * search.json is far more permissive than the Google Books API and gives
 * back two things at once: `cover_i` (an edition cover id, which builds a
 * URL with no ISBN needed) and `isbn` (a list of editions). Caching that
 * ISBN means the book has a stable, quota-free key for every future
 * lookup — which is the thing the Librarian was being asked to guess at.
 */
interface OpenLibraryDoc {
  title?:       string
  author_name?: string[]
  cover_i?:     number
  isbn?:        string[]
}

export function openLibraryCoverIdUrl(coverId: number, size: 'S' | 'M' | 'L' = 'L'): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
}

/** Pick a 13-digit ISBN from an edition list, falling back to a 10. */
function pickIsbn(list?: string[]): string | undefined {
  if (!list?.length) return undefined
  const clean = list.map(x => x.replace(/[^0-9Xx]/g, ''))
  return clean.find(x => x.length === 13) ?? clean.find(x => x.length === 10)
}

async function searchOpenLibrary(
  title: string,
  author?: string,
  signal?: AbortSignal,
): Promise<CoverLookupResult> {
  const t = cleanBookTitle(title)
  const a = author ? cleanAuthor(author) : ''

  const params = new URLSearchParams({
    title: t,
    limit: '3',
    // Ask for only the four fields we use — the default response is enormous.
    fields: 'title,author_name,cover_i,isbn',
  })
  if (a) params.set('author', a)

  try {
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, { signal })
    if (res.status === 429) return { url: null, failure: 'rate_limited' }
    if (!res.ok) return { url: null, failure: 'not_found' }

    const data = (await res.json()) as { docs?: OpenLibraryDoc[] }
    for (const doc of data.docs ?? []) {
      const isbn13 = pickIsbn(doc.isbn)
      if (doc.cover_i) {
        return { url: openLibraryCoverIdUrl(doc.cover_i), isbn13 }
      }
      // No cover on this edition, but an ISBN is still worth keeping — the
      // covers CDN may have artwork filed under it even when search does not.
      if (isbn13) {
        const byIsbn = openLibraryCoverUrl(isbn13)
        if (byIsbn && await probeImage(byIsbn, 6000, signal)) {
          return { url: byIsbn, isbn13 }
        }
        return { url: null, isbn13, failure: 'not_found' }
      }
    }
    return { url: null, failure: 'not_found' }
  } catch {
    return { url: null, failure: 'offline' }
  }
}

/* ── Google Books ─────────────────────────────────────────────────── */

interface GoogleQueryOutcome {
  url:      string | null
  failure?: CoverFailure
}

/**
 * Run one Google Books query.
 *
 * 429 and 403 are reported rather than swallowed. The unauthenticated
 * endpoint throttles aggressively per IP, and a throttled response used to
 * be indistinguishable from "this book has no cover" — so a sweep that hit
 * the limit quietly wrote a permanent null onto every remaining book.
 */
async function runGoogleQuery(q: string, signal?: AbortSignal): Promise<GoogleQueryOutcome> {
  const url = `https://www.googleapis.com/books/v1/volumes?maxResults=5&country=US&q=${encodeURIComponent(q)}`
  try {
    const res = await fetch(url, { signal })
    // 403 is what the API returns for a spent daily quota; 429 for a burst.
    if (res.status === 429 || res.status === 403) {
      return { url: null, failure: 'rate_limited' }
    }
    if (!res.ok) return { url: null, failure: 'not_found' }

    const data = (await res.json()) as { items?: GoogleVolume[] }
    for (const item of data.items ?? []) {
      const thumb = item.volumeInfo?.imageLinks?.thumbnail
        ?? item.volumeInfo?.imageLinks?.smallThumbnail
      if (thumb) return { url: normaliseGoogleThumb(thumb) }
    }
    return { url: null, failure: 'not_found' }
  } catch {
    return { url: null, failure: 'offline' }
  }
}

/**
 * Query forms for a book, strictest first. Exported for testing.
 *
 * DELIBERATELY SHORT. An earlier version tried five variations per book,
 * which turned a 21-book shelf into ~100 requests and tripped Google's
 * rate limiter — every book after the limit resolved to a cached null, so
 * the "more thorough" cascade produced *fewer* covers than one query would
 * have. Two attempts is the compromise: the strict one to get the right
 * book, one loose one for an awkward title.
 *
 * Terms are separated by a SPACE. Joining with `+` yielded `%2B` after
 * encoding — a literal plus inside the phrase, which matched nothing.
 */
export function buildGoogleQueries(title: string, author?: string): string[] {
  const t  = cleanBookTitle(title)
  const tS = titleWithoutSubtitle(t)
  const a  = author ? cleanAuthor(author) : ''

  const attempts = a
    ? [`intitle:"${tS}" inauthor:"${a}"`, `${tS} ${a}`]
    : [`intitle:"${tS}"`, tS]

  return [...new Set(attempts)]
}

/** Look up a cover via Google Books. Stops immediately on a rate limit. */
export async function googleBooksCoverUrl(
  title: string,
  author?: string,
  signal?: AbortSignal,
): Promise<CoverLookupResult> {
  let lastFailure: CoverFailure = 'not_found'
  for (const q of buildGoogleQueries(title, author)) {
    if (signal?.aborted) return { url: null, failure: 'offline' }
    const out = await runGoogleQuery(q, signal)
    if (out.url) return { url: out.url }
    if (out.failure === 'rate_limited') return { url: null, failure: 'rate_limited' }
    if (out.failure) lastFailure = out.failure
  }
  return { url: null, failure: lastFailure }
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
 * Resolve a cover for one book.
 *
 * Order matters, and it is ordered by cost to the user rather than by
 * likelihood of a hit:
 *
 *   1. Open Library by ISBN — a plain image load. No API, no quota.
 *   2. Open Library search  — generous limits, and hands back an ISBN we
 *                             can keep so step 1 works next time.
 *   3. Google Books         — the strictest quota of the three, so it goes
 *                             last and gets at most two queries.
 */
export async function resolveCover(
  book: Pick<LibraryBook, 'isbn13' | 'title' | 'author'>,
  opts: { verify?: boolean; signal?: AbortSignal } = {},
): Promise<CoverLookupResult> {
  const { verify = true, signal } = opts

  // 1 — known ISBN, straight at the covers CDN.
  const olUrl = book.isbn13 ? openLibraryCoverUrl(book.isbn13) : null
  if (olUrl) {
    if (!verify) return { url: olUrl }
    if (await probeImage(olUrl, 8000, signal)) return { url: olUrl }
  }

  if (!book.title) return { url: null, failure: 'not_found' }

  // 2 — Open Library search: cover id and/or a usable ISBN.
  const ol = await searchOpenLibrary(book.title, book.author || undefined, signal)
  if (ol.url) return ol
  if (ol.failure === 'offline') return ol   // network down — do not cache

  // 3 — Google Books, last and cheapest-to-exhaust.
  const g = await googleBooksCoverUrl(book.title, book.author || undefined, signal)
  // Carry forward any ISBN the Open Library search found even when neither
  // provider had artwork: it still improves every future attempt.
  return { ...g, isbn13: g.isbn13 ?? ol.isbn13 }
}

/**
 * Back-compat wrapper returning just the URL.
 * Prefer `resolveCover` — it reports *why* a lookup failed, which is what
 * lets a caller avoid caching a rate-limited miss as a permanent answer.
 */
export async function resolveCoverUrl(
  book: Pick<LibraryBook, 'isbn13' | 'title' | 'author'>,
  opts: { verify?: boolean; signal?: AbortSignal } = {},
): Promise<string | null> {
  return (await resolveCover(book, opts)).url
}
