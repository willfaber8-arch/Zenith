/**
 * GET /api/strava/callback — the other end of the OAuth flow.
 *
 * Strava sends the browser here with a one-time code. We swap it for
 * tokens server-side and send the user back into the app. The tokens
 * never touch the response body, only the httpOnly cookie.
 *
 * Every failure lands back on the app with a reason in the query string
 * rather than showing a bare JSON error, because this page is reached
 * by a redirect and the user has no back button that helps.
 */

import { NextRequest, NextResponse } from 'next/server'
import { scopeGranted, type StravaTokens } from '@/lib/strava'
import { stravaConfig, redirectUri, writeTokens, consumeState } from '@/lib/server/stravaAuth'
import { requestOrigin } from '@/lib/server/requestOrigin'

export const dynamic = 'force-dynamic'

/** Back into the app. Built from nextUrl, which no header can forge. */
function home(req: NextRequest, params: Record<string, string>) {
  const url = new URL('/', req.nextUrl.origin)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const cfg = stravaConfig()
  if (!cfg) return home(req, { strava: 'error', reason: 'not_configured' })

  const q     = req.nextUrl.searchParams
  const code  = q.get('code')
  const state = q.get('state')

  // The user pressed Cancel on the consent screen. Not an error.
  if (q.get('error')) return home(req, { strava: 'cancelled' })

  if (!await consumeState(state)) {
    return home(req, { strava: 'error', reason: 'state_mismatch' })
  }
  if (!code) return home(req, { strava: 'error', reason: 'no_code' })

  /* Strava lets you approve the connection with the activity checkbox
     unticked. Catching it here turns "the import is broken" into "you
     missed a checkbox", which is a thing the user can fix. */
  if (!scopeGranted(q.get('scope'))) {
    return home(req, { strava: 'error', reason: 'scope_denied' })
  }

  let res: Response
  try {
    res = await fetch('https://www.strava.com/oauth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  AbortSignal.timeout(15_000),
      body: JSON.stringify({
        client_id:     cfg.clientId,
        client_secret: cfg.clientSecret,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redirectUri(requestOrigin(req)),
      }),
    })
  } catch {
    return home(req, { strava: 'error', reason: 'unreachable' })
  }

  if (!res.ok) return home(req, { strava: 'error', reason: 'exchange_failed' })

  const body = await res.json().catch(() => null) as
    (Partial<StravaTokens> & { athlete?: { firstname?: string } }) | null

  if (!body?.access_token || !body.refresh_token || !body.expires_at) {
    return home(req, { strava: 'error', reason: 'exchange_failed' })
  }

  await writeTokens({
    access_token:  body.access_token,
    refresh_token: body.refresh_token,
    expires_at:    body.expires_at,
    athlete_name:  body.athlete?.firstname?.trim() || undefined,
  })

  return home(req, { strava: 'connected' })
}
