/**
 * lib/server/stravaAuth.ts — Strava credentials, server side only.
 *
 * The tokens never reach the browser. Strava's refresh token is a
 * long-lived credential for an account that knows where you run, and
 * localStorage is readable by any script that ever manages to run on the
 * page. It lives in an httpOnly cookie instead, and the client asks this
 * server for activities rather than asking Strava directly.
 *
 * That is a deliberate departure from how the AI key is handled. An AI
 * key is the user's own, spends the user's own money, and is useless for
 * reading anything about them; a Strava refresh token is neither.
 */

import 'server-only'
import { cookies } from 'next/headers'
import { tokensExpired, type StravaTokens } from '@/lib/strava'

export const STRAVA_COOKIE = 'zenith_strava'

export interface StravaConfig { clientId: string; clientSecret: string }

/** Null when the deployment has no Strava app configured. */
export function stravaConfig(): StravaConfig | null {
  const clientId     = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

/** Where Strava sends the user back. Must match the app's settings exactly. */
export function redirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/strava/callback`
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path:     '/',
  /* Strava refresh tokens do not expire on their own, so this is really
     "how long before you have to reconnect if unused". */
  maxAge:   60 * 60 * 24 * 180,
}

export async function readTokens(): Promise<StravaTokens | null> {
  try {
    const raw = (await cookies()).get(STRAVA_COOKIE)?.value
    if (!raw) return null
    const parsed = JSON.parse(raw) as StravaTokens
    if (!parsed?.access_token || !parsed?.refresh_token) return null
    return parsed
  } catch {
    return null
  }
}

export async function writeTokens(t: StravaTokens): Promise<void> {
  (await cookies()).set(STRAVA_COOKIE, JSON.stringify({
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: t.expires_at,
    ...(t.athlete_name ? { athlete_name: t.athlete_name } : {}),
  }), COOKIE_OPTS)
}

export async function clearTokens(): Promise<void> {
  (await cookies()).set(STRAVA_COOKIE, '', { ...COOKIE_OPTS, maxAge: 0 })
  await clearState()
}

/* ── CSRF state ─────────────────────────────────────────────────────
   The state parameter is generated here, kept in its own short-lived
   cookie, and compared on the way back. Without it, a link someone else
   crafted could complete an OAuth flow into this browser and quietly
   attach *their* Strava account to the user's log. */

export const STRAVA_STATE_COOKIE = 'zenith_strava_state'

export async function issueState(): Promise<string> {
  const state = crypto.randomUUID()
  ;(await cookies()).set(STRAVA_STATE_COOKIE, state, {
    ...COOKIE_OPTS,
    maxAge: 60 * 10,   // long enough to read a consent screen, no longer
  })
  return state
}

/** True only if the returned state matches the one we issued. */
export async function consumeState(returned: string | null): Promise<boolean> {
  const stored = (await cookies()).get(STRAVA_STATE_COOKIE)?.value
  await clearState()
  return Boolean(stored && returned && stored === returned)
}

async function clearState(): Promise<void> {
  (await cookies()).set(STRAVA_STATE_COOKIE, '', { ...COOKIE_OPTS, maxAge: 0 })
}

/**
 * A usable access token, refreshing first if it is close to expiring.
 *
 * Strava rotates the refresh token on every refresh, so the new one has
 * to be written back — keeping the old one means the next refresh fails
 * and the user is silently disconnected.
 */
export async function freshAccessToken(cfg: StravaConfig): Promise<string | null> {
  const tokens = await readTokens()
  if (!tokens) return null

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (!tokensExpired(tokens.expires_at, nowSeconds)) return tokens.access_token

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type:    'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  })
  if (!res.ok) return null

  const next = await res.json() as Partial<StravaTokens>
  if (!next.access_token || !next.refresh_token || !next.expires_at) return null

  // The refresh response has no athlete on it; carry the name forward or
  // the UI forgets who it is connected to after the first hour.
  await writeTokens({ ...(next as StravaTokens), athlete_name: tokens.athlete_name })
  return next.access_token
}
