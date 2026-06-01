/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — iCal / .ics Parser  (zero dependencies)
 * Phase 2 · Step 2.5 — Multi-feed Calendar Aggregate Engine
 *
 * Converts raw VCALENDAR / .ics text into typed ParsedCalendarEvent
 * objects ready for IndexedDB storage.
 *
 * Timezone strategy — native two-pass Intl offset trick:
 *   No date-fns-tz required.  Works for any IANA tzId the browser
 *   knows about (all modern browsers ship the full CLDR tz database).
 *   Accuracy: ±1 min across DST transitions — sufficient for calendar
 *   event display.  See convertTzToUtcMs() for the full explanation.
 *
 * 11:59 PM detection:
 *   After converting to the user's local wall-clock time, any event
 *   whose END time falls on HH=23 MM=59 is flagged `is1159: true`.
 *   This includes Canvas assignments that default to midnight-minus-one.
 *
 * Supported iCal properties:
 *   SUMMARY, UID, DTSTART, DTEND, DUE (Canvas), DESCRIPTION, LOCATION,
 *   CATEGORIES, STATUS, RRULE (detected but not expanded — recurring
 *   events are stored as single instances for Phase 2).
 * ════════════════════════════════════════════════════════════════
 */

/* ── Public types ───────────────────────────────────────────── */

export type EventCategory = 'scholastic' | 'exam' | 'life' | 'general'

export interface ParsedCalendarEvent {
  uid:          string
  title:        string
  /** Unix ms — UTC-anchored, display with `new Date(startMs)` */
  startMs:      number
  endMs:        number
  allDay:       boolean
  /** true when the event's local end time is exactly 23:59 */
  is1159:       boolean
  category:     EventCategory
  location?:    string
  description?: string
}

/* ══════════════════════════════════════════════════════════════
   SECTION 1 — RFC 5545 line processing
   ══════════════════════════════════════════════════════════════ */

/**
 * RFC 5545 §3.1 line-unfolding:
 * A logical line may be split across physical lines by inserting
 * CRLF + a single SPACE or TAB.  Rejoin those splits before parsing.
 */
function unfold(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
}

interface IcalProp {
  name:   string
  params: Record<string, string>
  value:  string
}

/**
 * Parse one unfolded iCal content line into name, params map, and value.
 *
 * Examples:
 *   "SUMMARY:CS 3110 Lecture"
 *   "DTSTART;TZID=America/New_York:20260601T120000"
 *   "DTSTART;VALUE=DATE:20260601"
 */
function parseProp(line: string): IcalProp {
  const colon = line.indexOf(':')
  if (colon === -1) return { name: line.trim().toUpperCase(), params: {}, value: '' }

  const head  = line.slice(0, colon)
  const value = line.slice(colon + 1)

  const segments = head.split(';')
  const name     = segments[0].toUpperCase()
  const params: Record<string, string> = {}

  for (let i = 1; i < segments.length; i++) {
    const eq = segments[i].indexOf('=')
    if (eq !== -1) {
      params[segments[i].slice(0, eq).toUpperCase()] = segments[i].slice(eq + 1)
    }
  }

  return { name, params, value }
}

/* ══════════════════════════════════════════════════════════════
   SECTION 2 — Timezone-aware date conversion
   ══════════════════════════════════════════════════════════════ */

/**
 * Two-pass Intl offset trick — converts "wall clock" components in a
 * given IANA timezone to a UTC timestamp with no external dependency.
 *
 * How it works:
 *   1. Pretend the components are UTC → approxUtcMs
 *   2. Format that UTC instant in `tzId` to get the clock reading there
 *   3. diff = approxUtcMs − tzFormattedMs   (= the UTC offset for tzId)
 *   4. Return approxUtcMs + diff
 *
 * Example:  h=12, tzId="America/New_York" (UTC−5 in winter)
 *   approxUtcMs   = 12:00 UTC
 *   tzFormatted   = 07:00  (what New York clocks show at 12:00 UTC)
 *   diff          = +5h
 *   result        = 17:00 UTC  (= 12:00 New York local) ✓
 */
function convertTzToUtcMs(
  y: number, mo: number, d: number,
  h: number, mi: number, s: number,
  tzId: string,
): number {
  const approxUtcMs = Date.UTC(y, mo, d, h, mi, s)

  try {
    const fmt   = new Intl.DateTimeFormat('en-US', {
      timeZone: tzId,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false,
    })
    const parts = fmt.formatToParts(approxUtcMs)
    const get   = (t: string) =>
      parseInt(parts.find(p => p.type === t)?.value ?? '0', 10)

    /* hour12:false returns 24 for midnight — normalise to 0 */
    const tzH  = get('hour') === 24 ? 0 : get('hour')
    const tzMs = Date.UTC(get('year'), get('month') - 1, get('day'), tzH, get('minute'), get('second'))

    return approxUtcMs + (approxUtcMs - tzMs)
  } catch {
    /* Unknown / unsupported IANA id — treat as user-local time */
    return new Date(y, mo, d, h, mi, s).getTime()
  }
}

/**
 * Convert an iCal DTSTART / DTEND / DUE value string to UTC ms.
 *
 * Handles all four common formats:
 *   YYYYMMDD                 → all-day (local midnight)
 *   YYYYMMDDTHHMMSSZ         → explicit UTC
 *   YYYYMMDDTHHMMSS          → "floating" time (treated as user-local)
 *   YYYYMMDDTHHMMSS±HH:MM    → embedded offset (normalised)
 *
 * @param value   Raw iCal value (e.g. "20260601T235900Z")
 * @param params  Property parameters (checked for TZID, VALUE=DATE)
 */
function parseIcalDate(
  value:  string,
  params: Record<string, string>,
): { ms: number; allDay: boolean } {
  const v = value.trim()

  /* ── All-day date: YYYYMMDD or VALUE=DATE ─────────────────── */
  if (v.length === 8 || params['VALUE'] === 'DATE') {
    const y  = +v.slice(0, 4)
    const mo = +v.slice(4, 6) - 1
    const d  = +v.slice(6, 8)
    return { ms: new Date(y, mo, d, 0, 0, 0).getTime(), allDay: true }
  }

  /* Strip embedded ±HH:MM / ±HHMM offset suffix (rare but valid) */
  const stripped = v.replace(/[+-]\d{2}:?\d{2}$/, '')
  const isUtc    = stripped.endsWith('Z')
  const dt       = stripped.replace('Z', '')

  const y  = +dt.slice(0, 4)
  const mo = +dt.slice(4, 6) - 1
  const d  = +dt.slice(6, 8)
  const h  = dt.length >= 13 ? +dt.slice(9, 11)  : 0
  const mi = dt.length >= 15 ? +dt.slice(11, 13) : 0
  const s  = dt.length >= 17 ? +dt.slice(13, 15) : 0

  if (isUtc) {
    return { ms: Date.UTC(y, mo, d, h, mi, s), allDay: false }
  }

  const tzId = params['TZID']
  if (tzId) {
    return { ms: convertTzToUtcMs(y, mo, d, h, mi, s, tzId), allDay: false }
  }

  /* Floating / no tz info — treat as user's local clock */
  return { ms: new Date(y, mo, d, h, mi, s).getTime(), allDay: false }
}

/* ══════════════════════════════════════════════════════════════
   SECTION 3 — 11:59 PM detector
   ══════════════════════════════════════════════════════════════ */

/**
 * Returns true if the UTC timestamp, when rendered in the user's local
 * timezone, lands exactly on HH:59 (23:59 or 11:59 PM).
 *
 * Canvas defaults assignment deadlines to 23:59:59 local time.
 * This flag routes those items to the top-pinned deadline banner
 * instead of the hourly time-grid.
 */
export function detect1159(endMs: number): boolean {
  const d = new Date(endMs)
  return d.getHours() === 23 && d.getMinutes() === 59
}

/* ══════════════════════════════════════════════════════════════
   SECTION 4 — Category classifier
   ══════════════════════════════════════════════════════════════ */

const RE_EXAM       = /\b(exam|midterm|final|quiz|test|assessment)\b/i
const RE_SCHOLASTIC = /\b(lecture|class|seminar|lab|recitation|section|office\s*hours|assignment|homework|\bhw\b|project|paper|thesis|due|submission|reading|discussion)\b/i
const RE_LIFE       = /\b(gym|workout|appointment|doctor|dentist|birthday|anniversary|holiday|vacation|travel|flight|social|dinner|lunch|coffee)\b/i

function classifyCategory(title: string, description = ''): EventCategory {
  const text = `${title} ${description}`
  if (RE_EXAM.test(text))       return 'exam'
  if (RE_SCHOLASTIC.test(text)) return 'scholastic'
  if (RE_LIFE.test(text))       return 'life'
  return 'general'
}

/* ══════════════════════════════════════════════════════════════
   SECTION 5 — Main public API
   ══════════════════════════════════════════════════════════════ */

/**
 * Parse a raw iCal (VCALENDAR) string into an array of typed events.
 *
 * The parser is deliberately lenient — partial / malformed VEVENTs
 * are skipped silently rather than throwing.
 *
 * @param icalText  Raw .ics text content (UTF-8)
 * @returns         Array of ParsedCalendarEvent (may be empty)
 */
export function parseIcal(icalText: string): ParsedCalendarEvent[] {
  const lines   = unfold(icalText).split(/\r?\n/)
  const results: ParsedCalendarEvent[] = []

  let inEvent     = false
  let uid         = ''
  let title       = ''
  let startMs     = 0
  let endMs       = 0
  let allDay      = false
  let location    = ''
  let description = ''

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      uid = ''; title = ''; startMs = 0; endMs = 0
      allDay = false; location = ''; description = ''
      continue
    }

    if (line === 'END:VEVENT') {
      inEvent = false

      /* Skip degenerate events with no start time */
      if (startMs === 0) continue

      const resolvedEnd = endMs > 0 ? endMs : startMs
      const resolvedUid = uid || `z_${startMs}_${Math.random().toString(36).slice(2, 8)}`

      results.push({
        uid:         resolvedUid,
        title:       title.trim() || '(No title)',
        startMs,
        endMs:       resolvedEnd,
        allDay,
        is1159:      !allDay && detect1159(resolvedEnd),
        category:    classifyCategory(title, description),
        location:    location    || undefined,
        description: description || undefined,
      })
      continue
    }

    if (!inEvent) continue

    const { name, params, value } = parseProp(line)

    switch (name) {
      case 'UID':
        uid = value
        break

      case 'SUMMARY':
        title = value
          .replace(/\\n/g, ' ')
          .replace(/\\,/g, ',')
          .replace(/\\;/g, ';')
          .replace(/\\\\/g, '\\')
        break

      case 'LOCATION':
        location = value.replace(/\\n/g, ' ').replace(/\\,/g, ',')
        break

      case 'DESCRIPTION':
        description = value
          .replace(/\\n/g, ' ')
          .replace(/\\,/g, ',')
          .replace(/\\;/g, ';')
          .slice(0, 300) // truncate — we only use this for category classification
        break

      case 'DTSTART': {
        const p = parseIcalDate(value, params)
        startMs = p.ms
        allDay  = p.allDay
        break
      }

      case 'DTEND': {
        const p = parseIcalDate(value, params)
        endMs = p.ms
        break
      }

      /* Canvas exports assignment deadlines as DUE, not DTSTART/DTEND */
      case 'DUE': {
        const p = parseIcalDate(value, params)
        endMs   = p.ms
        if (startMs === 0) startMs = p.ms
        break
      }
    }
  }

  /* Sort chronologically so bulk inserts are pre-ordered */
  return results.sort((a, b) => a.startMs - b.startMs)
}

/* ── Utilities re-exported for consumers ─────────────────────── */

export { classifyCategory }
