/**
 * @jest-environment node
 *
 * The Strava OAuth routes.
 *
 * These are the parts that cannot be checked by hand without a real
 * Strava app, and the parts where a mistake is quiet: a callback that
 * accepts any state will happily attach someone else's account to this
 * browser, and a refresh that drops the rotated token disconnects the
 * user an hour later with no error anywhere.
 */

/* A cookie jar standing in for Next's request-scoped store. */
const jar = new Map<string, string>()

jest.mock('next/headers', () => ({
  cookies: async () => ({
    get:  (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set:  (name: string, value: string, opts?: { maxAge?: number }) => {
      if (opts?.maxAge === 0) jar.delete(name)
      else jar.set(name, value)
    },
  }),
}))

import { NextRequest } from 'next/server'
import {
  issueState, consumeState, writeTokens, readTokens, clearTokens,
  freshAccessToken, STRAVA_STATE_COOKIE, STRAVA_COOKIE,
} from '@/lib/server/stravaAuth'

const OLD_ENV = process.env

beforeEach(() => {
  jar.clear()
  jest.resetAllMocks()
  process.env = { ...OLD_ENV, STRAVA_CLIENT_ID: '123', STRAVA_CLIENT_SECRET: 'shh' }
})
afterAll(() => { process.env = OLD_ENV })

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(new Request(url, { headers }))
}

/* ── CSRF state ─────────────────────────────────────────────────── */

describe('OAuth state', () => {
  it('accepts the state it issued', async () => {
    const state = await issueState()
    expect(await consumeState(state)).toBe(true)
  })

  it('rejects a state nobody issued', async () => {
    await issueState()
    // Without this check, a link someone else crafted could complete an
    // OAuth flow into this browser and attach *their* Strava account.
    expect(await consumeState('forged')).toBe(false)
  })

  it('rejects a missing state', async () => {
    await issueState()
    expect(await consumeState(null)).toBe(false)
  })

  it('rejects when no state was ever issued', async () => {
    expect(await consumeState('anything')).toBe(false)
  })

  it('is one-shot — a replayed callback fails', async () => {
    const state = await issueState()
    expect(await consumeState(state)).toBe(true)
    expect(await consumeState(state)).toBe(false)
    expect(jar.has(STRAVA_STATE_COOKIE)).toBe(false)
  })

  it('clears the state even when it did not match', async () => {
    // Otherwise a wrong guess leaves the real state sitting there to be
    // guessed at again.
    await issueState()
    await consumeState('wrong')
    expect(jar.has(STRAVA_STATE_COOKIE)).toBe(false)
  })
})

/* ── Token storage ──────────────────────────────────────────────── */

describe('token cookie', () => {
  it('round-trips', async () => {
    await writeTokens({ access_token: 'a', refresh_token: 'r', expires_at: 99, athlete_name: 'Will' })
    expect(await readTokens()).toEqual({
      access_token: 'a', refresh_token: 'r', expires_at: 99, athlete_name: 'Will',
    })
  })

  it('treats a half-written cookie as no connection', async () => {
    jar.set(STRAVA_COOKIE, JSON.stringify({ access_token: 'a' }))
    expect(await readTokens()).toBeNull()
  })

  it('treats unparseable contents as no connection rather than throwing', async () => {
    jar.set(STRAVA_COOKIE, 'not json')
    expect(await readTokens()).toBeNull()
  })

  it('clearing drops the pending state too', async () => {
    await writeTokens({ access_token: 'a', refresh_token: 'r', expires_at: 99 })
    await issueState()
    await clearTokens()
    expect(await readTokens()).toBeNull()
    expect(jar.has(STRAVA_STATE_COOKIE)).toBe(false)
  })
})

/* ── Refresh ────────────────────────────────────────────────────── */

describe('freshAccessToken', () => {
  const cfg = { clientId: '123', clientSecret: 'shh' }
  const far = () => Math.floor(Date.now() / 1000) + 7200
  const soon = () => Math.floor(Date.now() / 1000) + 60

  it('returns the existing token when it has life left', async () => {
    global.fetch = jest.fn()
    await writeTokens({ access_token: 'live', refresh_token: 'r', expires_at: far() })
    expect(await freshAccessToken(cfg)).toBe('live')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('stores the rotated refresh token, not the old one', async () => {
    // Strava rotates the refresh token on every refresh. Keeping the old
    // one means the *next* refresh fails and the user is silently
    // disconnected an hour later, with nothing in any log.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'new', refresh_token: 'rotated', expires_at: far() }),
    })
    await writeTokens({ access_token: 'old', refresh_token: 'original', expires_at: soon() })

    expect(await freshAccessToken(cfg)).toBe('new')
    expect((await readTokens())!.refresh_token).toBe('rotated')
  })

  it('carries the athlete name across a refresh', async () => {
    // The refresh response has no athlete on it, so the name has to be
    // carried forward or the UI forgets who is connected.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'new', refresh_token: 'r2', expires_at: far() }),
    })
    await writeTokens({ access_token: 'old', refresh_token: 'r', expires_at: soon(), athlete_name: 'Will' })

    await freshAccessToken(cfg)
    expect((await readTokens())!.athlete_name).toBe('Will')
  })

  it('returns null when the grant has been revoked', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) })
    await writeTokens({ access_token: 'old', refresh_token: 'r', expires_at: soon() })
    expect(await freshAccessToken(cfg)).toBeNull()
  })

  it('does not overwrite good tokens with a malformed response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'partial' }) })
    await writeTokens({ access_token: 'old', refresh_token: 'keepme', expires_at: soon() })

    expect(await freshAccessToken(cfg)).toBeNull()
    expect((await readTokens())!.refresh_token).toBe('keepme')
  })

  it('returns null when nothing is connected', async () => {
    global.fetch = jest.fn()
    expect(await freshAccessToken(cfg)).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

/* ── Callback ───────────────────────────────────────────────────── */

describe('GET /api/strava/callback', () => {
  async function callback(query: string, opts: { state?: boolean } = {}) {
    const { GET } = await import('@/app/api/strava/callback/route')
    if (opts.state !== false) jar.set(STRAVA_STATE_COOKIE, 'good')
    return GET(req(`https://zenith.test/api/strava/callback?${query}`))
  }

  /** The reason a redirect carries back to the app. */
  function outcome(res: Response) {
    const u = new URL(res.headers.get('location')!)
    return { strava: u.searchParams.get('strava'), reason: u.searchParams.get('reason') }
  }

  it('rejects a mismatched state', async () => {
    global.fetch = jest.fn()
    const res = await callback('code=abc&state=forged&scope=activity:read_all')
    expect(outcome(res)).toEqual({ strava: 'error', reason: 'state_mismatch' })
    // And crucially never reaches the token exchange.
    expect(global.fetch).not.toHaveBeenCalled()
    expect(await readTokens()).toBeNull()
  })

  it('reports a cancelled consent as cancelled, not an error', async () => {
    const res = await callback('error=access_denied&state=good')
    expect(outcome(res).strava).toBe('cancelled')
  })

  it('catches an approval that withheld activity access', async () => {
    global.fetch = jest.fn()
    const res = await callback('code=abc&state=good&scope=read')
    expect(outcome(res)).toEqual({ strava: 'error', reason: 'scope_denied' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('stores tokens and reports success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'a', refresh_token: 'r', expires_at: 4_000_000_000,
        athlete: { firstname: 'Will' },
      }),
    })
    const res = await callback('code=abc&state=good&scope=read,activity:read_all')
    expect(outcome(res).strava).toBe('connected')
    expect(await readTokens()).toMatchObject({ refresh_token: 'r', athlete_name: 'Will' })
  })

  it('does not store anything when the exchange fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) })
    const res = await callback('code=abc&state=good&scope=activity:read_all')
    expect(outcome(res)).toEqual({ strava: 'error', reason: 'exchange_failed' })
    expect(await readTokens()).toBeNull()
  })

  it('survives Strava being unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'))
    const res = await callback('code=abc&state=good&scope=activity:read_all')
    expect(outcome(res)).toEqual({ strava: 'error', reason: 'unreachable' })
  })

  it('redirects to our own origin, not a forwarded one', async () => {
    // `x-forwarded-host` is a request header and anyone can send one.
    // Building our own redirect from it would be an open redirect.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'a', refresh_token: 'r', expires_at: 4_000_000_000 }),
    })
    const { GET } = await import('@/app/api/strava/callback/route')
    jar.set(STRAVA_STATE_COOKIE, 'good')
    const res = await GET(req(
      'https://zenith.test/api/strava/callback?code=abc&state=good&scope=activity:read_all',
      { 'x-forwarded-host': 'evil.example' },
    ))
    expect(new URL(res.headers.get('location')!).host).toBe('zenith.test')
  })
})
