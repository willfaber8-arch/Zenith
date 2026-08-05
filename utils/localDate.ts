/**
 * utils/localDate.ts — the single source of truth for "what day is it".
 *
 * ── THE BUG THIS EXISTS TO KILL ───────────────────────────────────────
 *
 * `new Date().toISOString().slice(0, 10)` looks like it yields today's
 * date. It does not. `toISOString()` converts to **UTC** first, so the
 * calendar day it returns is UTC's, not the user's:
 *
 *     9:30pm on Aug 4th in New York  →  "2026-08-05"
 *     7:00am on Aug 5th in Tokyo     →  "2026-08-04"
 *
 * Every evening, a user in the Americas silently writes their mood log,
 * habit tick, cardio session and study streak onto *tomorrow*. Today's
 * row then reads as empty and refuses further entries, because the code
 * that looks up "today" agrees with the code that wrote it — both are
 * wrong in the same direction, so nothing errors. It just quietly logs
 * to the wrong day, and the streak the user has been building breaks.
 *
 * Zenith is local-first and single-user: there is no server, no shared
 * timeline, and no second timezone to reconcile against. The user's wall
 * clock is the only clock that means anything here, so every date stamp
 * and every "is this today" comparison uses local components.
 *
 * ── USE THIS INSTEAD ──────────────────────────────────────────────────
 *
 *     todayISO()            // "2026-08-04" — the user's today
 *     toLocalDateStr(date)  // any Date → its local YYYY-MM-DD
 *     daysAgoISO(6)         // six days back, local
 *
 * Do NOT reach for `toISOString()` to build a date key. The only correct
 * use of `toISOString()` is a genuine UTC timestamp for transport.
 */

/** A `Date` → the local calendar day it falls on, as `YYYY-MM-DD`. */
export function toLocalDateStr(d: Date): string {
  const y   = d.getFullYear()
  const mo  = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/** Today in the user's own timezone, as `YYYY-MM-DD`. */
export function todayISO(): string {
  return toLocalDateStr(new Date())
}

/**
 * `n` days before today, local. Built by stepping the *date component*
 * rather than subtracting `n * 86_400_000` ms: on a daylight-saving
 * boundary a "day" is 23 or 25 hours long, so the arithmetic version
 * lands on the wrong date twice a year.
 */
export function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toLocalDateStr(d)
}

/** `n` days after today, local. Same DST-safe stepping as `daysAgoISO`. */
export function daysAheadISO(n: number): string {
  return daysAgoISO(-n)
}

/** True when `d` falls on the user's current calendar day. */
export function isToday(d: Date): boolean {
  return toLocalDateStr(d) === todayISO()
}

/**
 * Parse a `YYYY-MM-DD` key back into a Date at local midnight.
 *
 * `new Date("2026-08-04")` is parsed by the spec as **UTC** midnight,
 * which renders as Aug 3rd for anyone west of Greenwich — the same
 * off-by-one arriving from the opposite direction. Passing the parts to
 * the `Date` constructor keeps it local.
 */
export function fromLocalDateStr(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return new Date(NaN)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}
