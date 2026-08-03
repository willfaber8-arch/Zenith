/**
 * utils/bookCovers.ts — automatic book-cover resolution.
 *
 * Amazon/Goodreads expose no cover API, so covers are resolved from two free,
 * key-less services and then CACHED on the book row so we only ever look a
 * title up once:
 *
 *   1. Open Library Covers  — direct image URL keyed by ISBN. No request from
 *      our code at all: the URL goes straight into <img src>. `default=false`
 *      makes a miss return 404 instead of a blank placeholder, so the <img>
 *      onError handler can fall through to step 2.
 *   2. Google Books         — a search query (title + author) returning a
 *      thumbnail. Used when the book has no ISBN or Open Library has no cover.
 *
 * Privacy: resolving a cover sends the book's ISBN (or title + author) to the
 * service being queried. Nothing else about the user is transmitted, and the
 * resolved URL is cached locally so lookups don't repeat.
 */

import type { LibraryBook } from '@/types/bookTracker'

/* ── Open Library ─────────────────────────────────────────────── */

/** Direct cover URL for an ISBN. `default=false` → 404 on a miss. */
export function openLibraryCoverUrl(isbn: string, size: 'S' | 'M' | 'L' = 'L'): string | null {
  const clean = isbn.replace(/[^0-9Xx]/g, '')
  if (clean.length !== 10 && clean.length !== 13) return null
  return `https://covers.openlibrary.org/b/isbn/${clean}-${size}.jpg?default=false`
}

/* ── Google Books ─────────────────────────────────────────────── */

interface GoogleVolume {
  volumeInfo?: {
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

/**
 * Look up a cover via the Google Books API (no key required for basic
 * volume search). Returns null when nothing usable is found.
 */
export async function googleBooksCoverUrl(
  title: string,
  author?: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const q = author
    ? `intitle:${JSON.stringify(title)}+inauthor:${JSON.stringify(author)}`
    : `intitle:${JSON.stringify(title)}`
  const url = `https://www.googleapis.com/books/v1/volumes?maxResults=3&country=US&q=${encodeURIComponent(q)}`

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
    return null   // offline / blocked / rate-limited — caller falls back
  }
}

/* ── Resolution ───────────────────────────────────────────────── */

/**
 * Best cover URL for a book without performing any network request:
 * the Open Library ISBN URL when an ISBN exists. Safe to drop straight
 * into <img src> — a miss 404s and the caller can then try Google Books.
 */
export function immediateCoverUrl(book: Pick<LibraryBook, 'isbn13'>): string | null {
  return book.isbn13 ? openLibraryCoverUrl(book.isbn13) : null
}

/**
 * Resolve a cover URL, trying Open Library (by ISBN) then Google Books
 * (by title + author). Returns null when neither has one.
 *
 * `verify` HEAD-checks the Open Library URL so we don't cache a 404;
 * pass false to skip the round-trip when the <img> itself will validate it.
 */
export async function resolveCoverUrl(
  book: Pick<LibraryBook, 'isbn13' | 'title' | 'author'>,
  opts: { verify?: boolean; signal?: AbortSignal } = {},
): Promise<string | null> {
  const { verify = true, signal } = opts

  const olUrl = book.isbn13 ? openLibraryCoverUrl(book.isbn13) : null
  if (olUrl) {
    if (!verify) return olUrl
    try {
      const res = await fetch(olUrl, { method: 'HEAD', signal })
      if (res.ok) return olUrl
    } catch {
      /* network issue — fall through to Google Books */
    }
  }

  if (book.title) {
    const g = await googleBooksCoverUrl(book.title, book.author || undefined, signal)
    if (g) return g
  }

  return null
}
