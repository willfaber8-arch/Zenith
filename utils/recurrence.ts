/**
 * utils/recurrence.ts — turning a repeat rule into actual dates.
 *
 * The parser recognised RRULE and dropped it, so a class that meets every
 * Monday from January to December arrived as one event in January. The
 * import reported a healthy count and the calendar was empty, which is
 * the worst way for something to fail: it looks like it worked.
 *
 * Almost everything in a real calendar repeats, so this is not an edge
 * case — it is most of the data.
 *
 * Occurrences are expanded into concrete dates at import rather than
 * computed on the fly. That costs some rows, and buys the thing the
 * whole feature rests on: every occurrence is an ordinary event you can
 * move, edit or delete on its own.
 *
 * Pure — no Dexie, no DOM, no clock beyond what is passed in.
 */

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export interface RecurrenceRule {
  freq:     Frequency
  interval: number
  /** Total occurrences including the first. Mutually exclusive with `until`. */
  count?:   number
  /** Last moment an occurrence may start, inclusive. */
  until?:   number
  /** Weekdays for WEEKLY rules: 0 = Sunday … 6 = Saturday. */
  byDay?:   number[]
}

/**
 * A ceiling on how far a single rule may be expanded.
 *
 * A daily rule with no COUNT and no UNTIL is legal and means "forever".
 * Something has to stop, and it should stop at a number that is
 * generous for a real calendar and still bounded.
 */
export const MAX_OCCURRENCES = 750

/** How far ahead an endless rule is materialised. */
export const OPEN_ENDED_YEARS = 2

const DAY_CODES: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
}

/* ── Parsing ────────────────────────────────────────────────────── */

/**
 * Read an RRULE property value.
 *
 * Returns null for anything unrecognised rather than guessing — an
 * unparsed rule leaves the event as a single occurrence, which is the
 * old behaviour and strictly better than inventing dates.
 */
export function parseRRule(
  value: string,
  parseDate: (raw: string) => number | null = defaultDateParse,
): RecurrenceRule | null {
  if (!value) return null

  const parts = new Map<string, string>()
  for (const chunk of value.split(';')) {
    const i = chunk.indexOf('=')
    if (i < 0) continue
    parts.set(chunk.slice(0, i).trim().toUpperCase(), chunk.slice(i + 1).trim())
  }

  const freqRaw = (parts.get('FREQ') ?? '').toUpperCase()
  if (freqRaw !== 'DAILY' && freqRaw !== 'WEEKLY'
   && freqRaw !== 'MONTHLY' && freqRaw !== 'YEARLY') return null

  const intervalRaw = Number(parts.get('INTERVAL') ?? '1')
  const interval = Number.isFinite(intervalRaw) && intervalRaw >= 1
    ? Math.floor(intervalRaw)
    : 1

  const rule: RecurrenceRule = { freq: freqRaw, interval }

  const countRaw = Number(parts.get('COUNT'))
  if (Number.isFinite(countRaw) && countRaw > 0) rule.count = Math.floor(countRaw)

  const untilRaw = parts.get('UNTIL')
  if (untilRaw) {
    const ms = parseDate(untilRaw)
    if (ms !== null) rule.until = ms
  }

  const byDayRaw = parts.get('BYDAY')
  if (byDayRaw) {
    const days: number[] = []
    for (const token of byDayRaw.split(',')) {
      /* Strip an ordinal prefix such as "2TH" — the weekday still tells
         us which days are involved, and honouring the ordinal properly
         is more machinery than a first pass needs. */
      const code = token.trim().toUpperCase().replace(/^[+-]?\d+/, '')
      const dow  = DAY_CODES[code]
      if (dow !== undefined && !days.includes(dow)) days.push(dow)
    }
    if (days.length > 0) rule.byDay = days.sort((a, b) => a - b)
  }

  return rule
}

/** "YYYYMMDD" or "YYYYMMDDTHHMMSSZ" → ms, or null. */
function defaultDateParse(raw: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?Z?$/.exec(raw.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  return Date.UTC(
    Number(y), Number(mo) - 1, Number(d),
    Number(h ?? 0), Number(mi ?? 0), Number(s ?? 0),
  )
}

/* ── Expansion ──────────────────────────────────────────────────── */

export interface Occurrence {
  startMs: number
  endMs:   number
}

/**
 * Step a date forward by one interval of the rule's frequency.
 *
 * Calendar-aware rather than arithmetic: adding a month to 31 January
 * must not land in March, and adding days across a daylight-saving
 * boundary must keep the same wall-clock time. Both fall out of using
 * the local Date setters instead of adding milliseconds.
 */
function step(from: Date, rule: RecurrenceRule): Date {
  const d = new Date(from.getTime())
  switch (rule.freq) {
    case 'DAILY':   d.setDate(d.getDate() + rule.interval); break
    case 'WEEKLY':  d.setDate(d.getDate() + 7 * rule.interval); break
    case 'MONTHLY': {
      const day = d.getDate()
      d.setDate(1)
      d.setMonth(d.getMonth() + rule.interval)
      /* Clamp to the last day of the shorter month rather than spilling
         into the next one. */
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      d.setDate(Math.min(day, lastDay))
      break
    }
    case 'YEARLY':  d.setFullYear(d.getFullYear() + rule.interval); break
  }
  return d
}

/** Every date in the week containing `weekStart` that the rule names. */
function weekdayOccurrences(base: Date, byDay: number[]): Date[] {
  const sunday = new Date(base.getTime())
  sunday.setDate(sunday.getDate() - sunday.getDay())
  return byDay.map(dow => {
    const d = new Date(sunday.getTime())
    d.setDate(d.getDate() + dow)
    d.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds())
    return d
  })
}

/**
 * Expand a repeat rule into concrete occurrences.
 *
 * The first occurrence is always the event's own start, exactly as an
 * RRULE means it. Dates listed in EXDATE are skipped — that is how a
 * calendar says "this one week is cancelled", and dropping them would
 * resurrect meetings that were called off.
 */
export function expandOccurrences(
  startMs:  number,
  endMs:    number,
  rule:     RecurrenceRule | null,
  exDates:  number[] = [],
  opts:     { maxOccurrences?: number; horizonMs?: number } = {},
): Occurrence[] {
  const duration = Math.max(0, endMs - startMs)
  if (!rule) return [{ startMs, endMs }]

  const max = opts.maxOccurrences ?? MAX_OCCURRENCES
  const horizon = opts.horizonMs
    ?? new Date(new Date(startMs).getFullYear() + OPEN_ENDED_YEARS,
                new Date(startMs).getMonth(),
                new Date(startMs).getDate()).getTime()

  /* Compare by day for EXDATE: a cancellation is usually written as a
     date, and matching to the millisecond would never fire. */
  const excluded = new Set(exDates.map(dayKey))

  const out: Occurrence[] = []
  const seen = new Set<number>()

  const push = (ms: number): boolean => {
    if (out.length >= max) return false
    if (rule.until !== undefined && ms > rule.until) return false
    if (ms > horizon) return false
    if (seen.has(ms) || excluded.has(dayKey(ms))) return true   // skip, keep going
    seen.add(ms)
    out.push({ startMs: ms, endMs: ms + duration })
    return true
  }

  const countLimit = rule.count ?? Infinity
  let cursor = new Date(startMs)
  let guard = 0

  while (out.length < max && out.length < countLimit && guard++ < max * 4) {
    if (rule.freq === 'WEEKLY' && rule.byDay && rule.byDay.length > 0) {
      let anyInRange = false
      for (const d of weekdayOccurrences(cursor, rule.byDay)) {
        const ms = d.getTime()
        if (ms < startMs) continue          // before the series begins
        if (out.length >= countLimit) break
        if (!push(ms)) { anyInRange = false; break }
        anyInRange = true
      }
      /* Stop when a whole interval produced nothing — the rule has run
         past its UNTIL or the horizon. */
      if (!anyInRange && out.length > 0) break
      if (!anyInRange && cursor.getTime() > horizon) break
    } else {
      if (!push(cursor.getTime())) break
    }
    cursor = step(cursor, rule)
    if (cursor.getTime() > horizon) break
  }

  /* An entirely excluded or out-of-range series still owes the caller
     its own start, or the event would vanish from the calendar. */
  if (out.length === 0 && !excluded.has(dayKey(startMs))) {
    out.push({ startMs, endMs })
  }

  return out.sort((a, b) => a.startMs - b.startMs)
}

/** Local Y-M-D key, so an exclusion matches whatever time it carries. */
function dayKey(ms: number): number {
  const d = new Date(ms)
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}
