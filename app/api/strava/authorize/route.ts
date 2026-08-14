/**
 * GET /api/strava/authorize — start the OAuth flow.
 *
 * Redirects to Strava's consent screen. Nothing is stored yet except a
 * one-shot CSRF state; the tokens only exist once the user has said yes
 * and Strava has sent them back to the callback.
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildAuthorizeUrl } from '@/lib/strava'
import { stravaConfig, redirectUri, issueState } from '@/lib/server/stravaAuth'
import { requestOrigin } from '@/lib/server/requestOrigin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cfg = stravaConfig()
  if (!cfg) {
    /* Deployments without a Strava app are the normal case for anyone
       running this locally. Say so plainly rather than redirecting them
       to a Strava error page they cannot act on. */
    return NextResponse.json(
      { error: 'not_configured',
        detail: 'Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to enable Strava.' },
      { status: 501 },
    )
  }

  const state = await issueState()
  return NextResponse.redirect(buildAuthorizeUrl({
    clientId:    cfg.clientId,
    redirectUri: redirectUri(requestOrigin(req)),
    state,
  }))
}
