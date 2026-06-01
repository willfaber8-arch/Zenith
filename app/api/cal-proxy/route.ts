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

export const runtime = 'nodejs'

const ALLOWED = new Set(['https:', 'http:'])

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')
  if (!rawUrl) {
    return NextResponse.json({ error: 'url parameter required' }, { status: 400 })
  }

  /* Normalise webcal:// → https:// (common for Apple/Canvas feeds) */
  const normalised = rawUrl.replace(/^webcal:\/\//i, 'https://')

  let parsed: URL
  try {
    parsed = new URL(normalised)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (!ALLOWED.has(parsed.protocol)) {
    return NextResponse.json({ error: 'Protocol not allowed' }, { status: 400 })
  }

  try {
    const upstream = await fetch(normalised, {
      headers: {
        'User-Agent': 'ZenithOS/2.5 CalendarAggregator (+https://zenith.app)',
        'Accept':     'text/calendar, text/plain, */*',
      },
      /* Next.js server cache — avoids hammering upstream on every render */
      next: { revalidate: 300 },
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream HTTP ${upstream.status}` },
        { status: 502 },
      )
    }

    const icalText = await upstream.text()

    return new NextResponse(icalText, {
      status: 200,
      headers: {
        'Content-Type':                'text/calendar; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':               'public, max-age=300, s-maxage=300',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Feed fetch failed', detail: String(err) },
      { status: 502 },
    )
  }
}
