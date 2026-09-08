/**
 * @jest-environment node
 */

/*
 * Runs in the node environment, not jsdom: this is server code and the
 * test builds real Response objects, which jsdom does not provide.
 */

/**
 * Following a calendar feed's redirects without opening an SSRF hole.
 *
 * The property that matters is simple and absolute: every URL this
 * fetches has been through the guard first — the starting one and each
 * redirect target alike. The original code got that guarantee by
 * refusing all redirects, at the cost of every feed that uses one.
 */

import {
  fetchFeedFollowingRedirects, MAX_REDIRECTS,
} from '@/lib/server/fetchFeed'

/** A fetch stand-in driven by a map of url → response. */
function fakeFetch(routes: Record<string, { status: number; location?: string }>) {
  const visited: string[] = []
  const impl = (async (url: string | URL) => {
    const u = String(url)
    visited.push(u)
    const r = routes[u]
    if (!r) return new Response('not found', { status: 404 })
    const headers = r.location ? { location: r.location } : undefined
    return new Response(r.status === 200 ? 'BEGIN:VCALENDAR' : '', { status: r.status, headers })
  }) as unknown as typeof fetch
  return { impl, visited }
}

const allowAll  = async () => ({ ok: true })
const checked: string[] = []
const recording = async (url: string) => { checked.push(url); return { ok: true } }

beforeEach(() => { checked.length = 0 })

describe('fetchFeedFollowingRedirects', () => {
  it('returns a direct 200 unchanged', async () => {
    const { impl } = fakeFetch({ 'https://cal.test/a.ics': { status: 200 } })
    const r = await fetchFeedFollowingRedirects('https://cal.test/a.ics',
      { fetchImpl: impl, assertSafe: allowAll })
    expect(r.ok).toBe(true)
    expect(r.status).toBe(200)
  })

  it('follows a redirect to the final calendar', async () => {
    // The whole point: this case used to fail outright.
    const { impl, visited } = fakeFetch({
      'https://cal.test/start.ics': { status: 302, location: 'https://cal.test/real.ics' },
      'https://cal.test/real.ics':  { status: 200 },
    })
    const r = await fetchFeedFollowingRedirects('https://cal.test/start.ics',
      { fetchImpl: impl, assertSafe: allowAll })
    expect(r.ok).toBe(true)
    expect(visited).toEqual(['https://cal.test/start.ics', 'https://cal.test/real.ics'])
  })

  it('handles every redirect status a calendar host might use', async () => {
    for (const status of [301, 302, 303, 307, 308]) {
      const { impl } = fakeFetch({
        'https://cal.test/s': { status, location: 'https://cal.test/f' },
        'https://cal.test/f': { status: 200 },
      })
      const r = await fetchFeedFollowingRedirects('https://cal.test/s',
        { fetchImpl: impl, assertSafe: allowAll })
      expect(r.ok).toBe(true)
    }
  })

  it('resolves a relative Location against the current URL', async () => {
    const { impl, visited } = fakeFetch({
      'https://cal.test/deep/start.ics': { status: 302, location: '../real.ics' },
      'https://cal.test/real.ics':       { status: 200 },
    })
    const r = await fetchFeedFollowingRedirects('https://cal.test/deep/start.ics',
      { fetchImpl: impl, assertSafe: allowAll })
    expect(r.ok).toBe(true)
    expect(visited[1]).toBe('https://cal.test/real.ics')
  })

  /* ── The security property ─────────────────────────────────── */

  it('checks the guard before the very first request', async () => {
    const { impl } = fakeFetch({ 'https://cal.test/a.ics': { status: 200 } })
    await fetchFeedFollowingRedirects('https://cal.test/a.ics',
      { fetchImpl: impl, assertSafe: recording })
    expect(checked).toEqual(['https://cal.test/a.ics'])
  })

  it('checks the guard again on every redirect target', async () => {
    const { impl } = fakeFetch({
      'https://cal.test/a': { status: 302, location: 'https://cal.test/b' },
      'https://cal.test/b': { status: 302, location: 'https://cal.test/c' },
      'https://cal.test/c': { status: 200 },
    })
    await fetchFeedFollowingRedirects('https://cal.test/a',
      { fetchImpl: impl, assertSafe: recording })
    expect(checked).toEqual(['https://cal.test/a', 'https://cal.test/b', 'https://cal.test/c'])
  })

  it('refuses a redirect into a blocked address, and never requests it', async () => {
    // The exact attack refusing redirects was protecting against:
    // a public host bouncing the server at cloud metadata.
    const { impl, visited } = fakeFetch({
      'https://cal.test/a': { status: 302, location: 'http://169.254.169.254/latest/meta-data/' },
    })
    const guard = async (url: string) =>
      url.includes('169.254.169.254') ? { ok: false, reason: 'Private address' } : { ok: true }

    const r = await fetchFeedFollowingRedirects('https://cal.test/a',
      { fetchImpl: impl, assertSafe: guard })

    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(visited).not.toContain('http://169.254.169.254/latest/meta-data/')
  })

  it('refuses a blocked starting URL without fetching anything', async () => {
    const { impl, visited } = fakeFetch({})
    const r = await fetchFeedFollowingRedirects('http://127.0.0.1/a.ics',
      { fetchImpl: impl, assertSafe: async () => ({ ok: false, reason: 'Loopback' }) })
    expect(r.ok).toBe(false)
    expect(visited).toEqual([])
  })

  /* ── Bounds ────────────────────────────────────────────────── */

  it('stops on a redirect loop instead of walking forever', async () => {
    const { impl } = fakeFetch({
      'https://cal.test/a': { status: 302, location: 'https://cal.test/b' },
      'https://cal.test/b': { status: 302, location: 'https://cal.test/a' },
    })
    const r = await fetchFeedFollowingRedirects('https://cal.test/a',
      { fetchImpl: impl, assertSafe: allowAll })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/loop/i)
  })

  it('gives up after a bounded number of hops', async () => {
    const routes: Record<string, { status: number; location?: string }> = {}
    for (let i = 0; i < MAX_REDIRECTS + 4; i++) {
      routes[`https://cal.test/${i}`] = { status: 302, location: `https://cal.test/${i + 1}` }
    }
    const { impl, visited } = fakeFetch(routes)
    const r = await fetchFeedFollowingRedirects('https://cal.test/0',
      { fetchImpl: impl, assertSafe: allowAll })
    expect(r.ok).toBe(false)
    expect(visited.length).toBeLessThanOrEqual(MAX_REDIRECTS + 1)
  })

  it('reports a redirect with no destination rather than crashing', async () => {
    const { impl } = fakeFetch({ 'https://cal.test/a': { status: 302 } })
    const r = await fetchFeedFollowingRedirects('https://cal.test/a',
      { fetchImpl: impl, assertSafe: allowAll })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/without saying where/i)
  })

  it('passes an upstream error through with its status named', async () => {
    const { impl } = fakeFetch({ 'https://cal.test/a': { status: 404 } })
    const r = await fetchFeedFollowingRedirects('https://cal.test/a',
      { fetchImpl: impl, assertSafe: allowAll })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/404/)
  })
})
