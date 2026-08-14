/**
 * POST /api/strava/disconnect — forget the connection.
 *
 * Tells Strava to revoke the token as well as dropping our cookie. Just
 * clearing the cookie would leave a live grant on the athlete's Strava
 * settings page that they did not know about and we could no longer
 * revoke, since we would have thrown away the token needed to do it.
 *
 * Deauthorisation is best-effort: if Strava is unreachable we still drop
 * the cookie, because a Disconnect button that sometimes refuses to
 * disconnect is worse than a stale grant.
 */

import { NextResponse } from 'next/server'
import { readTokens, clearTokens } from '@/lib/server/stravaAuth'

export const dynamic = 'force-dynamic'

export async function POST() {
  const tokens = await readTokens()

  if (tokens) {
    try {
      await fetch('https://www.strava.com/oauth/deauthorize', {
        method:  'POST',
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal:  AbortSignal.timeout(8_000),
      })
    } catch {
      /* Best-effort — see the header. */
    }
  }

  await clearTokens()
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
