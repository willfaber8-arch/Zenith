/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Calendar Feed Proxy
 * Phase 2 · Step 2.5 — iCal / Canvas Feed Aggregate Engine
 *
 * Purpose: server-side iCal fetch so the browser never hits CORS.
 *   Browser → GET /api/cal-proxy?url=<ical-url>
 *           → server fetches upstream
 *           → returns raw text/calendar to client
 *
 * Security:
 *   • Only http / https / webcal protocols allowed
 *   • webcal:// normalised to https://
 *   • 5-minute Next.js edge cache (revalidate: 300)
 *   • User-Agent identifies the aggregator
 * ════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertSafePublicUrl } from '@/lib/server/ssrfGuard'
import { fetchFeedFollowingRedirects } from '@/lib/server/fetchFeed'
import { rateLimit, clientIp } from '@/lib/server/rateLimit'

export const runtime = 'nodejs'

/* Reject calendars larger than 8 MB — protects against memory exhaustion. */
const MAX_FEED_BYTES = 8 * 1024 * 1024

export async function GET(req: NextRequest) {
  /* 0 — Throttle per client IP (best-effort, per-instance) */
  const limit = rateLimit(`cal-proxy:${clientIp(req)}`, 30, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  const rawUrl = req.nextUrl.searchParams.get('url')
  if (!rawUrl) {
    return NextResponse.json({ error: 'url parameter required' }, { status: 400 })
  }

  /* Normalise webcal:// → https:// (common for Apple/Canvas feeds) */
  const normalised = rawUrl.replace(/^webcal:\/\//i, 'https://')

  try {
    /*
     * Redirects are followed, and the SSRF guard runs on every hop
     * including the first. This used to pass `redirect: 'error'`, which
     * made fetch throw on any 3xx — safe, but it meant no redirecting
     * feed could ever be added, and published Outlook calendars, some
     * Canvas deployments and most webcal:// hosts all redirect.
     */
    const result = await fetchFeedFollowingRedirects(
      normalised,
      { fetchImpl: fetch, assertSafe: assertSafePublicUrl },
      {
        headers: {
          'User-Agent': 'ZenithOS/2.5 CalendarAggregator (+https://zenith.app)',
          'Accept':     'text/calendar, text/plain, */*',
        },
        signal: AbortSignal.timeout(10_000),   // bound slow/hung upstreams
        /* Next.js server cache — avoids hammering upstream on every render */
        next: { revalidate: 300 },
      } as RequestInit,
    )

    if (!result.ok || !result.response) {
      return NextResponse.json(
        { error: result.reason ?? 'Feed fetch failed' },
        { status: result.status || 502 },
      )
    }
    const upstream = result.response

    /* Enforce a byte ceiling while reading the body */
    const reader = upstream.body?.getReader()
    let icalText = ''
    if (reader) {
      const decoder = new TextDecoder()
      let total = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done || !value) break
        total += value.byteLength
        if (total > MAX_FEED_BYTES) {
          await reader.cancel()
          return NextResponse.json({ error: 'Feed too large' }, { status: 413 })
        }
        icalText += decoder.decode(value, { stream: true })
      }
      icalText += decoder.decode()
    } else {
      icalText = await upstream.text()
    }

    return new NextResponse(icalText, {
      status: 200,
      headers: {
        'Content-Type':  'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    })
  } catch {
    /* Generic message — never echo the raw error (may leak internal detail) */
    return NextResponse.json({ error: 'Feed fetch failed' }, { status: 502 })
  }
}
