/**
 * utils/dayBoundary.ts — when your day actually ends.
 *
 * The calendar rolls over at midnight; people generally do not. Finish a
 * study session at 02:30 and tick the habit off, and by the clock it
 * lands on tomorrow — the day you just worked through shows as missed
 * and the streak breaks, which is the opposite of what the app should
 * be doing to someone who stayed up to do the work.
 *
 * A configurable cutoff fixes it: until that hour, "today" still means
 * yesterday. Set to 0 the behaviour is exactly what it was.
 *
 * Pure — the current time is always passed in, so the awkward hours can
 * be tested without waiting for 3am.
 */

import { toLocalDateStr } from '@/utils/localDate'

export const DAY_CUTOFF_KEY = 'zenith_day_cutoff_v1'

/**
 * Hours past midnight that still belong to the previous day.
 *
 * 4am by default. The feature exists because finishing a session at 2am
 * and having it count as tomorrow breaks a streak you actually earned,
 * and leaving that off until someone finds a setting means the common
 * case stays broken. Set it to 0 for a plain midnight rollover.
 */
export const DEFAULT_CUTOFF_HOUR = 4
export const MAX_CUTOFF_HOUR = 11

/**
 * Read the configured cutoff.
 *
 * Clamped rather than trusted: a stored value of 20 would mean most of
 * the day counted as yesterday, which is not a setting anyone wants and
 * would be baffling to debug from the outside.
 */
export function loadCutoffHour(): number {
  try {
    const raw = localStorage.getItem(DAY_CUTOFF_KEY)
    /*
     * A missing key means "never chosen", which is the default — not
     * zero. Number(null) is 0, so reading it without this check would
     * have made the default midnight no matter what it was set to.
     */
    if (raw === null || raw === '') return DEFAULT_CUTOFF_HOUR
    return clampCutoff(Number(raw))
  } catch {
    return DEFAULT_CUTOFF_HOUR
  }
}

export function saveCutoffHour(hour: number): void {
  try {
    localStorage.setItem(DAY_CUTOFF_KEY, String(clampCutoff(hour)))
  } catch { /* private mode — the setting just won't persist */ }
}

export function clampCutoff(hour: number): number {
  if (!Number.isFinite(hour)) return DEFAULT_CUTOFF_HOUR
  return Math.min(MAX_CUTOFF_HOUR, Math.max(0, Math.floor(hour)))
}

/**
 * The date a habit logged right now should be credited to.
 *
 * Before the cutoff, that is yesterday — you are still in the day you
 * have not been to bed from.
 */
export function effectiveDateISO(now: Date = new Date(), cutoffHour = 0): string {
  const cutoff = clampCutoff(cutoffHour)
  if (cutoff === 0 || now.getHours() >= cutoff) return toLocalDateStr(now)

  const shifted = new Date(now.getTime())
  /* Step the date component, not the milliseconds: a "day" is 23 or 25
     hours twice a year and the arithmetic version lands a day out. */
  shifted.setDate(shifted.getDate() - 1)
  return toLocalDateStr(shifted)
}

/** True when the cutoff is currently holding the day open. */
export function isInGraceWindow(now: Date = new Date(), cutoffHour = 0): boolean {
  const cutoff = clampCutoff(cutoffHour)
  return cutoff > 0 && now.getHours() < cutoff
}

/** "until 4:00 AM" — for saying what the setting actually does. */
export function describeCutoff(hour: number): string {
  const h = clampCutoff(hour)
  if (h === 0) return 'Days end at midnight'
  const label = new Date(2000, 0, 1, h, 0)
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `Days end at ${label} — anything logged before then counts for the day before`
}

/**
 * The habit day as of right now, honouring the stored cutoff.
 *
 * The convenience that stops the cutoff from being half-applied. Every
 * place that asks "what day is it" for a habit — the streak, the ring,
 * the trend chart, the grit score — has to agree, or a tick at 01:00
 * gets written to one day and read back from another and looks to the
 * user like it did nothing at all.
 *
 * On the server there is no localStorage and no user, so it falls back
 * to a plain midnight rollover; every caller re-reads on the client.
 */
export function currentDayISO(now: Date = new Date()): string {
  const cutoff = typeof window !== 'undefined' ? loadCutoffHour() : 0
  return effectiveDateISO(now, cutoff)
}

/**
 * The timestamp range covered by the current habit day.
 *
 * For anything logged by the clock rather than by a date key — a focus
 * session, a timed workout — "today" has to run from the cutoff to the
 * next cutoff, not from midnight to midnight. Otherwise the session you
 * are in the middle of at 00:05 stops counting towards today while you
 * are still sitting at it.
 *
 * Both ends are built by stepping the date component, so a daylight
 * saving change inside the window doesn't shift the boundary by an hour.
 */
export function dayBoundsMs(now: Date = new Date(), cutoffHour?: number): [number, number] {
  const cutoff = clampCutoff(
    cutoffHour ?? (typeof window !== 'undefined' ? loadCutoffHour() : 0),
  )

  const start = new Date(now.getTime())
  start.setHours(cutoff, 0, 0, 0)
  if (now.getHours() < cutoff) start.setDate(start.getDate() - 1)

  const end = new Date(start.getTime())
  end.setDate(end.getDate() + 1)

  return [start.getTime(), end.getTime() - 1]
}
