/**
 * lib/engines/DiningHours.ts — is this dining hall open right now?
 *
 * Pure and clock-injected, so the midnight and rollover cases are
 * actually testable rather than hoped-for.
 *
 * Uses local date/time components throughout. `toISOString()` would ask
 * UTC what day it is, which is the bug that made wellness log to the
 * wrong date — and "what day is it, and what time" is the entire question
 * this module answers.
 */

/** 0 = Sunday … 6 = Saturday, matching Date#getDay. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface OpeningWindow {
  day:   Weekday
  /** "HH:MM", 24-hour, local. */
  open:  string
  close: string
}

export type DiningStatus =
  | { state: 'open';        closesAt: string; minutesLeft: number }
  | { state: 'opens_later'; opensAt: string;  minutesUntil: number }
  | { state: 'opens_next';  opensAt: string;  dayLabel: string }
  | { state: 'closed_today' }
  | { state: 'no_hours' }

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "HH:MM" → minutes since local midnight. NaN on malformed input. */
export function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return NaN
  const h = Number(m[1]), min = Number(m[2])
  if (h > 23 || min > 59) return NaN
  return h * 60 + min
}

export function fmtTime(hhmm: string): string {
  const mins = toMinutes(hhmm)
  if (Number.isNaN(mins)) return hhmm
  const h = Math.floor(mins / 60), m = mins % 60
  const suffix = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`
}

/**
 * Evaluate a hall's status against a moment.
 *
 * A window whose close is at or before its open is treated as running
 * past midnight (e.g. 21:00 → 01:00). Late-night dining is common enough
 * on a campus that ignoring it would make the indicator wrong exactly
 * when someone most wants it.
 */
export function evaluateStatus(windows: readonly OpeningWindow[], now: Date): DiningStatus {
  if (windows.length === 0) return { state: 'no_hours' }

  const day     = now.getDay() as Weekday
  const nowMins = now.getHours() * 60 + now.getMinutes()

  /* Open right now? Check today's windows, plus yesterday's overnight
     windows that have not yet closed. */
  for (const w of windows.filter(x => x.day === day)) {
    const o = toMinutes(w.open), c = toMinutes(w.close)
    if (Number.isNaN(o) || Number.isNaN(c)) continue
    const overnight = c <= o
    const isOpen = overnight ? nowMins >= o || nowMins < c : nowMins >= o && nowMins < c
    if (isOpen) {
      const closeMins = overnight && nowMins >= o ? c + 1440 : c
      return { state: 'open', closesAt: w.close, minutesLeft: closeMins - nowMins }
    }
  }

  const yesterday = ((day + 6) % 7) as Weekday
  for (const w of windows.filter(x => x.day === yesterday)) {
    const o = toMinutes(w.open), c = toMinutes(w.close)
    if (Number.isNaN(o) || Number.isNaN(c) || c > o) continue   // not overnight
    if (nowMins < c) {
      return { state: 'open', closesAt: w.close, minutesLeft: c - nowMins }
    }
  }

  /* Opening later today? */
  const laterToday = windows
    .filter(x => x.day === day)
    .map(x => ({ w: x, o: toMinutes(x.open) }))
    .filter(x => !Number.isNaN(x.o) && x.o > nowMins)
    .sort((a, b) => a.o - b.o)[0]

  if (laterToday) {
    return {
      state: 'opens_later',
      opensAt: laterToday.w.open,
      minutesUntil: laterToday.o - nowMins,
    }
  }

  /* Next day with any window at all. Scans a full week so a hall open
     only on Saturdays still reports when it next opens. */
  for (let step = 1; step <= 7; step++) {
    const d = ((day + step) % 7) as Weekday
    const next = windows
      .filter(x => x.day === d)
      .map(x => ({ w: x, o: toMinutes(x.open) }))
      .filter(x => !Number.isNaN(x.o))
      .sort((a, b) => a.o - b.o)[0]
    if (next) {
      return {
        state: 'opens_next',
        opensAt: next.w.open,
        dayLabel: step === 1 ? 'tomorrow' : DAY_NAMES[d],
      }
    }
  }

  return { state: 'closed_today' }
}

/** One-line label for the status chip. */
export function describeStatus(s: DiningStatus): string {
  switch (s.state) {
    case 'open':
      return s.minutesLeft <= 30
        ? `Closing in ${s.minutesLeft} min`
        : `Open until ${fmtTime(s.closesAt)}`
    case 'opens_later':
      return s.minutesUntil <= 60
        ? `Opens in ${s.minutesUntil} min`
        : `Opens ${fmtTime(s.opensAt)}`
    case 'opens_next':   return `Opens ${fmtTime(s.opensAt)} ${s.dayLabel}`
    case 'closed_today': return 'Closed today'
    case 'no_hours':     return 'No hours set'
  }
}

/** Sort key — open halls first, then those opening soonest. */
export function sortRank(s: DiningStatus): number {
  switch (s.state) {
    case 'open':         return 0
    case 'opens_later':  return 1
    case 'opens_next':   return 2
    case 'closed_today': return 3
    case 'no_hours':     return 4
  }
}
