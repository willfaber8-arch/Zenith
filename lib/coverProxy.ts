/**
 * lib/coverProxy.ts — deciding whether a cover is genuinely gone.
 *
 * `coverSrc` lives in its own leaf module so the resolver and the UI can
 * both import it without a cycle; this file adds the part that needs to
 * talk to the network.
 */

import { coverSrc } from '@/lib/coverSrc'

export { coverSrc }

/* ── Verification ──────────────────────────────────────────────────── */

export type CoverVerdict =
  /** Upstream said this cover does not exist. Safe to record as a miss. */
  | 'missing'
  /** It loads. */
  | 'ok'
  /** Throttled, timed out, offline. Says nothing about the cover. */
  | 'unknown'

/**
 * Does this cover still resolve, and if not, whose fault is it?
 *
 * The distinction is the whole point. Through an `<img>` every failure
 * looks identical, so a rate-limited burst and a dead URL are the same
 * event — and treating the first as the second is how a shelf of perfectly
 * good covers got written down as permanent misses.
 *
 * Going through our own origin makes the status code readable, so a 404
 * can be acted on and a 503 can be left alone.
 */
export async function verifyCover(raw: string): Promise<CoverVerdict> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'unknown'

  const src = coverSrc(raw)
  if (!src) return 'unknown'

  /*
   * Not ours to interrogate. An image load can only answer yes/no, so a
   * failure has to stay inconclusive rather than be read as a miss.
   */
  if (!src.startsWith('/api/book-cover')) {
    const { probeCoverUrl } = await import('@/utils/bookCovers')
    return (await probeCoverUrl(raw)) ? 'ok' : 'unknown'
  }

  try {
    const res = await fetch(src, { method: 'GET', cache: 'force-cache' })
    if (res.ok)                return 'ok'
    if (res.status === 404)    return 'missing'
    return 'unknown'           // 503 / 429 / 502 — retryable, not an answer
  } catch {
    return 'unknown'           // network died mid-flight
  }
}
