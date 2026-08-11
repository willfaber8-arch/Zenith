/**
 * Cover proxying and verification.
 *
 * The interesting behaviour is the verdict mapping. Through an `<img>`
 * every failure is the same event, so a rate-limited burst and a dead URL
 * were indistinguishable — and treating the first as the second is how a
 * shelf of good covers got recorded as permanent misses. Going through
 * our own origin makes the status readable; these tests pin down what is
 * done with it.
 */

import { coverSrc, isProxyableCoverHost } from '@/lib/coverSrc'
import { verifyCover } from '@/lib/coverProxy'

const OL  = 'https://covers.openlibrary.org/b/isbn/9780123456789-L.jpg'
const GB  = 'https://books.google.com/books/content?id=abc&zoom=2'

describe('coverSrc', () => {
  it('routes known cover hosts through the proxy', () => {
    expect(coverSrc(OL)).toBe(`/api/book-cover?url=${encodeURIComponent(OL)}`)
    expect(coverSrc(GB)).toBe(`/api/book-cover?url=${encodeURIComponent(GB)}`)
  })

  it('leaves anything it cannot proxy alone rather than breaking it', () => {
    // A hand-pasted cover should still render.
    const other = 'https://example.com/my-cover.jpg'
    expect(coverSrc(other)).toBe(other)
  })

  it('passes through data and same-origin URLs untouched', () => {
    expect(coverSrc('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA')
    expect(coverSrc('/local.png')).toBe('/local.png')
  })

  it('returns null for nothing', () => {
    expect(coverSrc(null)).toBeNull()
    expect(coverSrc(undefined)).toBeNull()
    expect(coverSrc('')).toBeNull()
  })

  it('encodes the URL so query strings survive', () => {
    // Google thumbnails carry &zoom= and friends; a raw concatenation
    // would let them be read as parameters of our own route.
    const src = coverSrc(GB)!
    expect(src.includes('&zoom=2')).toBe(false)
    expect(decodeURIComponent(src.split('url=')[1])).toBe(GB)
  })
})

describe('isProxyableCoverHost', () => {
  it.each([
    ['https://covers.openlibrary.org/x.jpg',   true],
    ['https://books.google.com/x',             true],
    ['https://foo.googleusercontent.com/x',    true],
    ['https://example.com/x.jpg',              false],
    ['not a url',                              false],
  ])('%s → %s', (url, expected) => {
    expect(isProxyableCoverHost(url)).toBe(expected)
  })

  it('rejects a lookalike host rather than matching a substring', () => {
    // The reason this is a hostname check and not `includes()`: an open
    // image proxy is a genuinely useful thing to hand an attacker.
    expect(isProxyableCoverHost('https://books.google.com.evil.test/x')).toBe(false)
    expect(isProxyableCoverHost('https://evil.test/?u=covers.openlibrary.org')).toBe(false)
  })
})

describe('verifyCover', () => {
  const realFetch = global.fetch

  afterEach(() => { global.fetch = realFetch })

  const mockStatus = (status: number) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300, status,
    }) as unknown as typeof fetch
  }

  it('reports ok on a 200', async () => {
    mockStatus(200)
    await expect(verifyCover(OL)).resolves.toBe('ok')
  })

  it('reports missing only on a 404', async () => {
    mockStatus(404)
    await expect(verifyCover(OL)).resolves.toBe('missing')
  })

  it.each([429, 503, 502, 500])(
    'treats %i as no answer, never as a miss', async status => {
      // The whole point: a throttled check must not clear a good cover.
      mockStatus(status)
      await expect(verifyCover(OL)).resolves.toBe('unknown')
    })

  it('treats a network failure as no answer', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('boom')) as unknown as typeof fetch
    await expect(verifyCover(OL)).resolves.toBe('unknown')
  })

  it('does not even ask while offline', async () => {
    const spy = jest.fn()
    global.fetch = spy as unknown as typeof fetch
    const nav = global.navigator as unknown as { onLine: boolean }
    const was = nav.onLine
    Object.defineProperty(global.navigator, 'onLine', { value: false, configurable: true })

    await expect(verifyCover(OL)).resolves.toBe('unknown')
    expect(spy).not.toHaveBeenCalled()

    Object.defineProperty(global.navigator, 'onLine', { value: was, configurable: true })
  })
})
