/**
 * Zenith OS — SSRF Guard
 * Server-only utility that validates a user-supplied URL before the server
 * is allowed to fetch it. Defends the `cal-proxy` and `recipe-import` routes
 * against Server-Side Request Forgery.
 *
 * What it blocks:
 *   • Non-http(s) schemes (file://, gopher://, ftp://, data:, …)
 *   • Embedded credentials (http://user:pass@host)
 *   • Ports other than 80 / 443
 *   • localhost and *.localhost
 *   • IP literals OR hostnames that RESOLVE to private / loopback / link-local /
 *     carrier-grade-NAT / reserved / multicast ranges — including the cloud
 *     metadata endpoint 169.254.169.254 and IPv6 ::1 / ULA / link-local.
 *
 * Residual risk (documented): DNS rebinding has a small TOCTOU window between
 * this resolve-and-validate check and the subsequent fetch()'s own resolution.
 * Defeating it fully requires pinning the validated IP into the connection,
 * which is impractical with the platform fetch + TLS SNI. The resolve check
 * here stops the overwhelming majority of SSRF payloads (direct metadata IPs,
 * localhost, RFC1918 hosts, and hostnames pointing at them).
 *
 * Requires the Node.js runtime (uses node:dns + node:net). Routes that import
 * this must declare `export const runtime = 'nodejs'`.
 */

import { lookup } from 'node:dns/promises'
import net from 'node:net'

/* Only the standard web ports may be targeted. */
const ALLOWED_PORTS = new Set(['', '80', '443'])

/* ── IPv4 helpers ─────────────────────────────────────────────── */

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const o = Number(p)
    if (o < 0 || o > 255) return null
    n = (n << 8) | o
  }
  return n >>> 0
}

function ipv4InCidr(n: number, base: string, bits: number): boolean {
  const b = ipv4ToInt(base)
  if (b === null) return false
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (n & mask) === (b & mask)
}

function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true // unparseable → treat as unsafe
  return (
    ipv4InCidr(n, '0.0.0.0',        8)  || // "this network"
    ipv4InCidr(n, '10.0.0.0',       8)  || // RFC1918 private
    ipv4InCidr(n, '100.64.0.0',     10) || // carrier-grade NAT
    ipv4InCidr(n, '127.0.0.0',      8)  || // loopback
    ipv4InCidr(n, '169.254.0.0',    16) || // link-local + cloud metadata
    ipv4InCidr(n, '172.16.0.0',     12) || // RFC1918 private
    ipv4InCidr(n, '192.0.0.0',      24) || // IETF protocol assignments
    ipv4InCidr(n, '192.0.2.0',      24) || // TEST-NET-1
    ipv4InCidr(n, '192.168.0.0',    16) || // RFC1918 private
    ipv4InCidr(n, '198.18.0.0',     15) || // benchmarking
    ipv4InCidr(n, '198.51.100.0',   24) || // TEST-NET-2
    ipv4InCidr(n, '203.0.113.0',    24) || // TEST-NET-3
    ipv4InCidr(n, '224.0.0.0',      4)  || // multicast
    ipv4InCidr(n, '240.0.0.0',      4)     // reserved + broadcast
  )
}

/* ── IPv6 helpers ─────────────────────────────────────────────── */

/**
 * Expand an IPv6 literal to its 16 bytes, or null if it will not parse.
 *
 * Matching on the *text* of an IPv6 address does not work here, and
 * quietly failed open for a long time: this guard used to recognise an
 * IPv4-mapped address only as `::ffff:127.0.0.1`, but `new URL()`
 * normalises every IPv6 literal to its hex form before the guard sees
 * the hostname, so what actually arrived was `::ffff:7f00:1`. The
 * dotted-quad branch could never match a parsed URL, and every private
 * IPv4 address was reachable by spelling it as IPv6 —
 * `http://[::ffff:a9fe:a9fe]/` is the cloud metadata endpoint.
 *
 * Parsing to bytes removes the whole class of problem: one address has
 * many spellings, and exactly one byte sequence.
 */
export function ipv6ToBytes(addr: string): Uint8Array | null {
  let a = addr.toLowerCase().split('%')[0]      // strip zone id (fe80::1%eth0)
  if (a.length === 0) return null

  /* A trailing dotted-quad carries the low 32 bits (::ffff:1.2.3.4). */
  let tail: number[] = []
  const lastColon = a.lastIndexOf(':')
  const afterColon = a.slice(lastColon + 1)
  if (afterColon.includes('.')) {
    const v4 = ipv4ToInt(afterColon)
    if (v4 === null) return null
    tail = [(v4 >>> 24) & 0xff, (v4 >>> 16) & 0xff, (v4 >>> 8) & 0xff, v4 & 0xff]
    a = a.slice(0, lastColon + 1) + '0:0'       // stand in for the 32 bits
  }

  const halves = a.split('::')
  if (halves.length > 2) return null            // "::" may appear once

  const toGroups = (part: string): number[] | null => {
    if (part === '') return []
    const out: number[] = []
    for (const g of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null
      out.push(parseInt(g, 16))
    }
    return out
  }

  const head = toGroups(halves[0])
  const rest = halves.length === 2 ? toGroups(halves[1]) : null
  if (head === null || (halves.length === 2 && rest === null)) return null

  let groups: number[]
  if (halves.length === 2) {
    const fill = 8 - head.length - rest!.length
    if (fill < 1) return null                   // "::" must cover ≥1 group
    groups = [...head, ...Array(fill).fill(0), ...rest!]
  } else {
    groups = head
  }
  if (groups.length !== 8) return null

  const bytes = new Uint8Array(16)
  groups.forEach((g, i) => {
    bytes[i * 2]     = (g >>> 8) & 0xff
    bytes[i * 2 + 1] = g & 0xff
  })
  if (tail.length === 4) bytes.set(tail, 12)
  return bytes
}

function isBlockedIpv6(ip: string): boolean {
  const b = ipv6ToBytes(ip)
  if (b === null) return true                   // unparseable → treat as unsafe

  const firstTenZero = b.subarray(0, 10).every(x => x === 0)

  /*
   * ::ffff:0:0/96 — IPv4-mapped. The embedded address is the one the
   * socket will actually reach, so it gets the full IPv4 treatment.
   */
  if (firstTenZero && b[10] === 0xff && b[11] === 0xff) {
    return isBlockedIpv4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`)
  }

  /*
   * ::/96 — the unspecified address, loopback, and the deprecated
   * IPv4-compatible form. Nothing public lives in this range, so the
   * whole of it is refused rather than picking out the known-bad ones.
   */
  if (firstTenZero && b[10] === 0 && b[11] === 0) return true

  if ((b[0] & 0xfe) === 0xfc) return true                     // fc00::/7 unique-local
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true    // fe80::/10 link-local
  if (b[0] === 0xff) return true                              // ff00::/8 multicast
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true // 2001:db8::/32
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) return true // 64:ff9b::/96 NAT64
  return false
}

/** True when the literal IP belongs to a private / reserved / loopback range. */
export function isBlockedIp(ip: string, family: number): boolean {
  return family === 6 ? isBlockedIpv6(ip) : isBlockedIpv4(ip)
}

/* ── Public API ───────────────────────────────────────────────── */

export interface SsrfCheckResult {
  ok:      boolean
  /** Generic, non-leaky reason suitable for returning to the client. */
  reason?: string
}

/**
 * Validate that `rawUrl` is safe for the server to fetch. Returns
 * `{ ok: true }` when the URL is a public http(s) endpoint, or
 * `{ ok: false, reason }` describing (generically) why it was rejected.
 */
export async function assertSafePublicUrl(rawUrl: string): Promise<SsrfCheckResult> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'Invalid URL' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only http and https URLs are allowed' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'URLs with embedded credentials are not allowed' }
  }
  if (!ALLOWED_PORTS.has(parsed.port)) {
    return { ok: false, reason: 'Only ports 80 and 443 are allowed' }
  }

  /* hostname keeps IPv6 brackets — strip before testing */
  const host = parsed.hostname.replace(/^\[|\]$/g, '')

  /* IP literal → check directly, no DNS needed */
  const literalFamily = net.isIP(host)
  if (literalFamily !== 0) {
    if (isBlockedIp(host, literalFamily)) {
      return { ok: false, reason: 'Target address is not permitted' }
    }
    return { ok: true }
  }

  /* localhost aliases never resolve through public DNS reliably — block by name */
  if (/^localhost$/i.test(host) || /\.localhost$/i.test(host)) {
    return { ok: false, reason: 'Target host is not permitted' }
  }

  /* Resolve and validate EVERY returned address */
  let addrs: { address: string; family: number }[]
  try {
    addrs = await lookup(host, { all: true })
  } catch {
    return { ok: false, reason: 'Could not resolve host' }
  }
  if (addrs.length === 0) {
    return { ok: false, reason: 'Could not resolve host' }
  }
  for (const a of addrs) {
    if (isBlockedIp(a.address, a.family)) {
      return { ok: false, reason: 'Target host resolves to a non-public address' }
    }
  }

  return { ok: true }
}
