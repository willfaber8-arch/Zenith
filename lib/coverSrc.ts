/**
 * lib/coverSrc.ts — where a cover image is actually loaded from.
 *
 * A leaf module on purpose. Both the resolver (which probes a candidate
 * URL) and the UI (which renders it) need this, and they must agree: the
 * whole class of bug being fixed here came from a URL being validated by
 * one path and loaded by another.
 */

/**
 * Hosts the proxy route will fetch.
 *
 * Exact match, or a leading dot for a suffix match. Deliberately not a
 * substring test — `books.google.com.evil.test` contains
 * "books.google.com" and would sail through one.
 */
export const PROXYABLE_COVER_HOSTS: readonly string[] = [
  'covers.openlibrary.org',
  'books.google.com',
  'books.googleusercontent.com',
  '.googleusercontent.com',
  '.bks.books.google.com',
]

export function isProxyableCoverHost(raw: string): boolean {
  try {
    const h = new URL(raw).hostname.toLowerCase()
    return PROXYABLE_COVER_HOSTS.some(a => (a.startsWith('.') ? h.endsWith(a) : h === a))
  } catch {
    return false
  }
}

/**
 * The URL to put in an `<img src>`, or to probe.
 *
 * Stored `coverUrl` values are left as the upstream address — that is the
 * durable identity of a cover, and rewriting the library to point at our
 * own routing would make the data depend on it. The proxy is applied at
 * the point of use.
 *
 * Anything unproxyable is handed back untouched rather than broken: a
 * cover pasted in by hand should still render.
 */
export function coverSrc(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (raw.startsWith('data:') || raw.startsWith('/')) return raw
  if (!isProxyableCoverHost(raw)) return raw
  return `/api/book-cover?url=${encodeURIComponent(raw)}`
}
