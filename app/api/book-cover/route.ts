/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Book cover proxy
 *
 * Why a proxy for something as simple as an <img src>:
 *
 * Cover art was resolving and then not appearing. The lookup would
 * report sixteen covers found, and three would render. The sweep paces
 * itself and probes each URL one at a time, so every probe succeeded —
 * and then the shelf mounted, asked the same hosts for sixteen images
 * within a few hundred milliseconds, and Google throttled the burst.
 * Image serving is rate-limited separately from the API, so a lookup can
 * comfortably succeed and the render still fail.
 *
 * Serving covers from this origin fixes that at the root:
 *
 *   · the burst hits our cache, not Google's rate limiter
 *   · a cover fetched once stays fetched — these URLs are effectively
 *     immutable, keyed by ISBN or volume id
 *   · no Referer is sent upstream, so hotlink protection never trips
 *   · the browser fetches same-origin, which means client code can read
 *     the real status code. That is the part that matters most: a 404
 *     ("no such cover") and a 429 ("come back later") were previously
 *     indistinguishable through an <img> onError, and treating the
 *     second as the first is exactly how a shelf of good covers got
 *     recorded as permanent misses.
 *
 * Security: an allowlist of cover hosts, on top of the shared SSRF
 * guard. An open image proxy is a useful thing to hand an attacker.
 * ════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertSafePublicUrl } from '@/lib/server/ssrfGuard'
import { rateLimit, clientIp } from '@/lib/server/rateLimit'

export const runtime = 'nodejs'

/**
 * Hosts we will fetch a cover from.
 *
 * Exact matches or a leading-dot suffix. Deliberately not a regex over
 * the whole URL: `books.google.com.evil.test` matches a naive
 * `includes('books.google.com')` and would turn this into an open proxy.
 */
const ALLOWED_HOSTS: readonly string[] = [
  'covers.openlibrary.org',
  'books.google.com',
  'books.googleusercontent.com',
  '.googleusercontent.com',
  '.bks.books.google.com',
]

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase()
  return ALLOWED_HOSTS.some(a => (a.startsWith('.') ? h.endsWith(a) : h === a))
}

/** A cover thumbnail well over this is not a thumbnail. */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024

/** Upstream is slow far more often than it is down. */
const UPSTREAM_TIMEOUT_MS = 10_000

export async function GET(req: NextRequest) {
  const limit = rateLimit(`book-cover:${clientIp(req)}`, 120, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  const rawUrl = req.nextUrl.searchParams.get('url')
  if (!rawUrl) {
    return NextResponse.json({ error: 'url parameter required' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (!hostAllowed(parsed.hostname)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 })
  }

  const safe = await assertSafePublicUrl(parsed.toString())
  if (!safe.ok) {
    return NextResponse.json({ error: safe.reason ?? 'Blocked' }, { status: 400 })
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const upstream = await fetch(parsed.toString(), {
      signal:   ctrl.signal,
      redirect: 'follow',
      headers: {
        Accept: 'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8',
        'User-Agent': 'ZenithOS/1.0 (personal library; cover art)',
        // No Referer at all, which is what keeps hotlink protection quiet.
      },
    })

    /*
     * Status is forwarded rather than flattened, because the caller acts
     * on the difference. 404 means this cover genuinely does not exist
     * and the book can be recorded as a miss; 429 or 5xx means try later
     * and must never be cached as an answer.
     */
    if (upstream.status === 404 || upstream.status === 410) {
      return NextResponse.json({ error: 'No cover' }, {
        status: 404,
        // A miss is stable enough to cache briefly, but not forever: a
        // cover can be added to Open Library next week.
        headers: { 'Cache-Control': 'public, max-age=3600' },
      })
    }

    if (upstream.status === 429 || upstream.status === 403 || upstream.status >= 500) {
      return NextResponse.json(
        { error: 'Upstream unavailable', retryable: true },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store',
            ...(upstream.headers.get('retry-after')
              ? { 'Retry-After': upstream.headers.get('retry-after') as string }
              : {}),
          },
        },
      )
    }

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Upstream error' }, {
        status: 502, headers: { 'Cache-Control': 'no-store' },
      })
    }

    const type = upstream.headers.get('content-type') ?? ''
    if (!type.startsWith('image/')) {
      // Open Library answers a miss with an HTML page rather than a 404
      // when `default=false` is dropped, and a 1×1 GIF in some cases.
      return NextResponse.json({ error: 'Not an image' }, {
        status: 404, headers: { 'Cache-Control': 'public, max-age=3600' },
      })
    }

    const buf = await upstream.arrayBuffer()
    if (buf.byteLength === 0) {
      return NextResponse.json({ error: 'Empty image' }, {
        status: 404, headers: { 'Cache-Control': 'public, max-age=3600' },
      })
    }
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 })
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type':   type,
        'Content-Length': String(buf.byteLength),
        /*
         * A year, immutable. These URLs are content-addressed — an Open
         * Library cover id and a Google volume id both name one specific
         * image — so re-fetching them achieves nothing except another
         * chance to be rate-limited.
         */
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError'
    return NextResponse.json(
      { error: aborted ? 'Upstream timed out' : 'Fetch failed', retryable: true },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  } finally {
    clearTimeout(timer)
  }
}
