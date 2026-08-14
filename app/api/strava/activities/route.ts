/**
 * GET /api/strava/activities?after=<unix seconds>&days=<n>
 *
 * The athlete's recent activities, trimmed to the fields the import
 * actually uses. Mapping them onto cardio sessions happens on the
 * client, in `lib/strava.ts`, because deciding what is new needs the
 * local database and that only exists in the browser.
 *
 * `after` is a watermark: pass the timestamp of the newest session
 * already imported and Strava only sends what came after it. A repeat
 * sync then costs one small request rather than re-downloading a year.
 */

import { NextRequest, NextResponse } from 'next/server'
import type { StravaActivity } from '@/lib/strava'
import { stravaConfig, freshAccessToken, readTokens } from '@/lib/server/stravaAuth'

export const dynamic = 'force-dynamic'

/** Strava's own ceiling. Asking for more is silently truncated. */
const PER_PAGE = 200
/** Four pages is 800 activities — several years of running for most people. */
const MAX_PAGES = 4
const DEFAULT_DAYS = 90

function trim(a: Record<string, unknown>): StravaActivity {
  return {
    id:               a.id as number,
    name:             a.name as string | undefined,
    type:             a.type as string | undefined,
    sport_type:       a.sport_type as string | undefined,
    moving_time:      a.moving_time as number | undefined,
    elapsed_time:     a.elapsed_time as number | undefined,
    distance:         a.distance as number | undefined,
    start_date_local: a.start_date_local as string | undefined,
    start_date:       a.start_date as string | undefined,
    calories:         a.calories as number | undefined,
    trainer:          a.trainer as boolean | undefined,
    manual:           a.manual as boolean | undefined,
  }
}

export async function GET(req: NextRequest) {
  const cfg = stravaConfig()
  if (!cfg) {
    return NextResponse.json({ error: 'not_configured' }, { status: 501 })
  }
  if (!await readTokens()) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  const token = await freshAccessToken(cfg)
  if (!token) {
    /* The refresh failed, which in practice means the grant was revoked
       from Strava's side. Say "not connected" so the UI offers Connect
       again instead of a retry that will fail identically. */
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams
  const afterParam = Number(q.get('after'))
  const days = Math.min(Math.max(Number(q.get('days')) || DEFAULT_DAYS, 1), 3650)
  const after = Number.isFinite(afterParam) && afterParam > 0
    ? Math.floor(afterParam)
    : Math.floor(Date.now() / 1000) - days * 86_400

  const activities: StravaActivity[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://www.strava.com/api/v3/athlete/activities`
              + `?after=${after}&per_page=${PER_PAGE}&page=${page}`

    let res: Response
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal:  AbortSignal.timeout(20_000),
        cache:   'no-store',
      })
    } catch {
      return NextResponse.json({ error: 'unreachable' }, { status: 502 })
    }

    if (res.status === 401) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 })
    }
    if (res.status === 429) {
      /* Strava's window is 15 minutes. Passing that through as its own
         status lets the UI say "try again shortly" rather than reporting
         a failure the user might respond to by pressing the button
         harder, which is exactly what keeps them rate-limited. */
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }
    if (!res.ok) {
      return NextResponse.json({ error: 'upstream_failed' }, { status: 502 })
    }

    const batch = await res.json().catch(() => null)
    if (!Array.isArray(batch)) {
      return NextResponse.json({ error: 'upstream_failed' }, { status: 502 })
    }

    for (const a of batch) {
      if (a && typeof a.id === 'number') activities.push(trim(a))
    }

    // A short page is the last page.
    if (batch.length < PER_PAGE) {
      return NextResponse.json({ activities, complete: true },
        { headers: { 'Cache-Control': 'no-store' } })
    }
  }

  /* Ran out of pages before running out of history. Saying so lets the
     UI mention it instead of quietly presenting a partial import as a
     complete one. */
  return NextResponse.json({ activities, complete: false },
    { headers: { 'Cache-Control': 'no-store' } })
}
