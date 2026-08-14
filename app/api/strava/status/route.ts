/**
 * GET /api/strava/status — is Strava available, and are we connected?
 *
 * Two separate facts, deliberately. "Not configured" is the deployment's
 * problem and shows a setup note; "not connected" is the user's and
 * shows a Connect button. Collapsing them into one boolean would offer
 * a button that cannot work.
 */

import { NextResponse } from 'next/server'
import { stravaConfig, readTokens } from '@/lib/server/stravaAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const configured = stravaConfig() !== null
  const tokens = configured ? await readTokens() : null
  return NextResponse.json(
    { configured, connected: tokens !== null, athleteName: tokens?.athlete_name ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
