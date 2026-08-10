/**
 * lib/coverCooldown.ts — remember that a cover provider throttled us.
 *
 * Backoff-within-a-pass was not enough. Google Books' un-keyed endpoint
 * has a low per-IP daily quota, so once it is spent, every subsequent
 * press of "Fetch covers" burns more requests against a service that is
 * going to refuse them — and the user sees the same rate-limit message
 * with no idea whether waiting ten seconds or ten hours is the answer.
 *
 * So a throttle is remembered across sweeps and across reloads: that
 * provider is skipped until the cooldown expires, the other one carries
 * the load, and the UI can say when it is worth trying again.
 */

'use client'

import type { Provider, ProviderState } from '@/utils/bookCovers'

const KEY = 'zenith_cover_cooldown_v1'

/** Default hold after a throttle with no Retry-After to go on. */
const DEFAULT_COOLDOWN_MS = 15 * 60_000
/** Never hold longer than this, however hostile the header. */
const MAX_COOLDOWN_MS     = 6 * 60 * 60_000

type Store = Partial<Record<Provider, number>>   // provider → expiry epoch ms

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) as Store : {}
  } catch { return {} }
}

function write(s: Store): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode */ }
}

/** Record that `provider` throttled us. */
export function startCooldown(provider: Provider, ms = DEFAULT_COOLDOWN_MS): void {
  const s = read()
  const until = Date.now() + Math.min(Math.max(ms, 60_000), MAX_COOLDOWN_MS)
  // Extend rather than shorten — a second throttle means it is still bad.
  s[provider] = Math.max(s[provider] ?? 0, until)
  write(s)
}

/** Ms remaining, or 0 when the provider is usable. */
export function cooldownRemaining(provider: Provider): number {
  const until = read()[provider]
  if (!until) return 0
  return Math.max(0, until - Date.now())
}

/** Provider state to seed a sweep with, so known-limited services are skipped. */
export function currentProviderState(): ProviderState {
  return {
    openlibrary: cooldownRemaining('openlibrary') > 0,
    google:      cooldownRemaining('google') > 0,
  }
}

/** Longest remaining hold across providers — drives the UI countdown. */
export function longestCooldown(): number {
  return Math.max(cooldownRemaining('openlibrary'), cooldownRemaining('google'))
}

export function clearCooldowns(): void {
  write({})
}

/** "4 min" / "2 hr 10 min" — for telling the user when to come back. */
export function formatCooldown(ms: number): string {
  if (ms <= 0) return 'now'
  const mins = Math.ceil(ms / 60_000)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem === 0 ? `${hrs} hr` : `${hrs} hr ${rem} min`
}
