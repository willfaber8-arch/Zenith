/**
 * The cover proxy route itself.
 *
 * @jest-environment node
 *
 * Runs in the node environment because the handler builds real
 * Request/Response objects, which jsdom does not provide faithfully.
 *
 * The upstream fetch is mocked. This does not prove Google answers the
 * way we expect — nothing runnable here can, since this sandbox cannot
 * reach it — but it does pin down everything the route decides once an
 * answer arrives, which is where the behaviour that matters lives: which
 * statuses mean "no cover" versus "come back later", and what gets
 * cached as a result.
 */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/book-cover/route'

const OL = 'https://covers.openlibrary.org/b/isbn/9780123456789-L.jpg'
const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3])

function req(url: string | null): NextRequest {
  const base = 'http://localhost:3000/api/book-cover'
  return new NextRequest(url === null ? base : `${base}?url=${encodeURIComponent(url)}`)
}

function upstream(init: {
  status: number; type?: string; body?: Uint8Array; retryAfter?: string
}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok:     init.status >= 200 && init.status < 300,
    status: init.status,
    headers: new Headers({
      ...(init.type ? { 'content-type': init.type } : {}),
      ...(init.retryAfter ? { 'retry-after': init.retryAfter } : {}),
    }),
    arrayBuffer: async () => (init.body ?? PNG).buffer,
  }) as unknown as typeof fetch
}

const realFetch = global.fetch
afterEach(() => { global.fetch = realFetch; jest.restoreAllMocks() })

describe('GET /api/book-cover — guards', () => {
  it('requires a url', async () => {
    expect((await GET(req(null))).status).toBe(400)
  })

  it('refuses a host that is not a cover host', async () => {
    expect((await GET(req('https://example.com/x.png'))).status).toBe(403)
  })

  it('refuses a lookalike host', async () => {
    // `books.google.com.evil.test` contains "books.google.com"; a
    // substring check would turn this into an open image proxy.
    expect((await GET(req('https://books.google.com.evil.test/x.png'))).status).toBe(403)
  })

  it('refuses a non-http scheme', async () => {
    expect((await GET(req('file:///etc/passwd'))).status).toBe(403)
  })

  it('does not contact upstream for a rejected URL', async () => {
    const spy = jest.fn()
    global.fetch = spy as unknown as typeof fetch
    await GET(req('https://example.com/x.png'))
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('GET /api/book-cover — status mapping', () => {
  it('passes an image through with an immutable cache', async () => {
    upstream({ status: 200, type: 'image/jpeg' })
    const res = await GET(req(OL))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    // Content-addressed by ISBN or volume id, so re-fetching only risks
    // another rate limit.
    expect(res.headers.get('cache-control')).toContain('immutable')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('reports a genuine miss as 404', async () => {
    upstream({ status: 404 })
    expect((await GET(req(OL))).status).toBe(404)
  })

  it.each([429, 403, 500, 502, 503])(
    'reports %i as a retryable 503, never as a miss', async status => {
      // The distinction the whole change exists for: a client that reads
      // 404 records a permanent miss, so a throttle must not look like one.
      upstream({ status })
      const res = await GET(req(OL))
      expect(res.status).toBe(503)
      expect(res.headers.get('cache-control')).toBe('no-store')
    })

  it('forwards Retry-After when upstream sends one', async () => {
    upstream({ status: 429, retryAfter: '120' })
    expect((await GET(req(OL))).headers.get('retry-after')).toBe('120')
  })

  it('treats a non-image 200 as a miss', async () => {
    // Open Library answers some misses with an HTML page rather than a 404.
    upstream({ status: 200, type: 'text/html' })
    expect((await GET(req(OL))).status).toBe(404)
  })

  it('treats an empty body as a miss', async () => {
    upstream({ status: 200, type: 'image/png', body: new Uint8Array(0) })
    expect((await GET(req(OL))).status).toBe(404)
  })

  it('reports a network failure as retryable, not as a miss', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch
    const res = await GET(req(OL))
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('sends no Referer upstream', async () => {
    // What keeps hotlink protection quiet.
    const spy = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: async () => PNG.buffer,
    })
    global.fetch = spy as unknown as typeof fetch

    await GET(req(OL))
    const headers = (spy.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(Object.keys(headers).map(k => k.toLowerCase())).not.toContain('referer')
  })
})
