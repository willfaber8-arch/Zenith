/**
 * Zenith OS — In-Memory Rate Limiter
 * Best-effort, per-instance sliding-window rate limiter for API routes.
 *
 * Keyed by `route:clientIp`. Protects the paid Anthropic endpoints
 * (chat / roadmap / study-ai) and the server-side fetch proxies
 * (cal-proxy / recipe-import) from naive abuse and cost-amplification DoS.
 *
 * NOTE on serverless: on Vercel each function instance has its own memory,
 * so this is a per-instance limiter, not a globally-consistent one. It stops
 * the common case (one client hammering one instance) but is not a hard
 * distributed quota. For strict global limits, back this with Upstash/Redis.
 */

import type { NextRequest } from 'next/server'

const store = new Map<string, number[]>()

let lastSweep = Date.now()
const SWEEP_INTERVAL_MS = 60_000

/** Periodically drop empty / stale buckets so the Map can't grow unbounded. */
function maybeSweep(windowMs: number): void {
  const now = Date.now()
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  const cutoff = now - windowMs
  for (const [key, hits] of store) {
    const recent = hits.filter(t => t > cutoff)
    if (recent.length === 0) store.delete(key)
    else store.set(key, recent)
  }
}

export interface RateLimitResult {
  ok:         boolean
  /** Seconds the client should wait before retrying (0 when allowed). */
  retryAfter: number
  /** Requests remaining in the current window. */
  remaining:  number
}

/**
 * Record a hit for `key` and report whether it is within `limit` requests
 * per `windowMs`. Call once per request, before doing any expensive work.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  maybeSweep(windowMs)

  const now    = Date.now()
  const cutoff = now - windowMs
  const recent = (store.get(key) ?? []).filter(t => t > cutoff)

  if (recent.length >= limit) {
    store.set(key, recent)
    const oldest = recent[0]
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    return { ok: false, retryAfter, remaining: 0 }
  }

  recent.push(now)
  store.set(key, recent)
  return { ok: true, retryAfter: 0, remaining: limit - recent.length }
}

/**
 * Derive a best-effort client identifier from proxy headers. Falls back to a
 * constant so a missing header still funnels into a single shared bucket
 * (fail-closed-ish) rather than bypassing the limiter entirely.
 */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}
