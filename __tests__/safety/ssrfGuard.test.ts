/**
 * What the server is allowed to fetch on a user's say-so.
 *
 * `cal-proxy`, `book-cover` and `recipe-import` all take a URL from the
 * query string, fetch it server-side and hand the body back. That is a
 * textbook SSRF surface: without a guard, anyone who can reach the
 * deployed site can use it to read whatever the *server* can reach —
 * the cloud metadata endpoint, a LAN router's admin page, a service
 * bound to localhost.
 *
 * The regression these lock down is subtle and was live: the guard
 * recognised IPv4-mapped IPv6 only in dotted-quad form
 * (`::ffff:127.0.0.1`), but `new URL()` normalises every IPv6 literal
 * to hex (`::ffff:7f00:1`) before the guard ever sees the hostname. So
 * the dotted-quad branch could not match a parsed URL, and every
 * private IPv4 address was reachable by spelling it as IPv6.
 */

import { assertSafePublicUrl, isBlockedIp } from '@/lib/server/ssrfGuard'

const allowed = async (url: string) => (await assertSafePublicUrl(url)).ok

describe('the IPv4-mapped IPv6 bypass', () => {
  /*
   * Each of these is the same private address a URL parser would hand
   * the guard after normalising it. They must be blocked in the form
   * the guard actually receives, not the form a human would type.
   */
  it.each([
    ['http://[::ffff:7f00:1]/',     'loopback 127.0.0.1'],
    ['http://[::ffff:a9fe:a9fe]/',  'cloud metadata 169.254.169.254'],
    ['http://[::ffff:c0a8:1]/',     'LAN 192.168.0.1'],
    ['http://[::ffff:a00:1]/',      'private 10.0.0.1'],
    ['http://[::ffff:ac10:1]/',     'private 172.16.0.1'],
  ])('blocks %s — %s', async (url) => {
    expect(await allowed(url)).toBe(false)
  })

  /* The dotted-quad spellings, which a parser rewrites to the above. */
  it.each([
    'http://[::ffff:127.0.0.1]/',
    'http://[0:0:0:0:0:ffff:127.0.0.1]/',
    'http://[::ffff:169.254.169.254]/',
  ])('blocks %s however it is spelled', async (url) => {
    expect(await allowed(url)).toBe(false)
  })

  /* IPv4-compatible (deprecated, but stacks still route some of it). */
  it('blocks the deprecated IPv4-compatible form', async () => {
    expect(await allowed('http://[::7f00:1]/')).toBe(false)
  })
})

describe('plain private and special addresses', () => {
  it.each([
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'http://0.0.0.0/',
    'http://[::1]/',
    'http://[fd00::1]/',      // unique-local
    'http://[fe80::1]/',      // link-local
    'http://[ff02::1]/',      // multicast
    'http://localhost/',
    'http://foo.localhost/',
    'http://2130706433/',     // 127.0.0.1 as a decimal integer
    'http://0x7f.0.0.1/',     // hex octet
  ])('blocks %s', async (url) => {
    expect(await allowed(url)).toBe(false)
  })
})

describe('the rest of the URL surface', () => {
  it.each([
    ['file:///etc/passwd',            'non-http scheme'],
    ['gopher://example.com/',         'non-http scheme'],
    ['data:text/plain,hi',            'data URI'],
    ['http://user:pass@example.com/', 'embedded credentials'],
    ['http://example.com:22/',        'non-web port'],
    ['http://example.com:8080/',      'non-web port'],
    ['not a url at all',              'unparseable'],
  ])('blocks %s (%s)', async (url) => {
    expect(await allowed(url)).toBe(false)
  })
})

describe('isBlockedIp', () => {
  it('recognises a mapped address whichever way it is written', () => {
    for (const form of ['::ffff:7f00:1', '::ffff:127.0.0.1', '0:0:0:0:0:ffff:127.0.0.1']) {
      expect(isBlockedIp(form, 6)).toBe(true)
    }
  })

  it('treats an unparseable address as unsafe rather than assuming the best', () => {
    expect(isBlockedIp('not-an-ip', 6)).toBe(true)
    expect(isBlockedIp('1.2.3', 4)).toBe(true)
  })

  /*
   * A guard that blocks everything is not a guard — it just moves the
   * failure. Ordinary public addresses have to survive it.
   */
  it('lets genuinely public addresses through', () => {
    expect(isBlockedIp('8.8.8.8', 4)).toBe(false)
    expect(isBlockedIp('1.1.1.1', 4)).toBe(false)
    expect(isBlockedIp('2606:4700:4700::1111', 6)).toBe(false)
    expect(isBlockedIp('::ffff:8.8.8.8', 6)).toBe(false)
    expect(isBlockedIp('::ffff:808:808', 6)).toBe(false)
  })
})
