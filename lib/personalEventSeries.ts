/**
 * lib/personalEventSeries.ts — an event that happens more than once.
 *
 * Your own events were a single row on a single day, so a standing
 * Tuesday seminar had to be typed in every week — which nobody does, so
 * it ends up not being in the calendar at all.
 *
 * A repeat is expanded into concrete rows here, sharing a `seriesUid`,
 * rather than stored as a rule evaluated when the grid draws. That is
 * the same shape imported iCal events already take (see utils/recurrence
 * and the note on expansion in CLAUDE.md), and it means every view,
 * drag, undo, export and search keeps working on rows. A second
 * representation is how a calendar starts disagreeing with itself about
 * what is on Tuesday.
 */

import { db, type PersonalEvent } from '@/lib/db'
import { expandOccurrences } from '@/utils/recurrence'
import { isRepeatPreset, ruleFor, type RepeatPreset } from '@/utils/taskRepeat'
import { parseHHMM } from '@/utils/scheduleGenerator'

/**
 * How far ahead a repeat is written out.
 *
 * Long enough that a term or a year of a standing commitment is really
 * there, short enough that "every day, forever" does not put tens of
 * thousands of rows in a local database to make one grid look right.
 */
export const MAX_EVENT_OCCURRENCES = 260

/** Two years, for a repeat with no end date. */
export const SERIES_HORIZON_YEARS = 2

function newSeriesUid(): string {
  return `pe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export interface CreateResult {
  /** Rows written — 1 for a one-off. */
  count: number
  seriesUid?: string
}

/**
 * Add an event, once or repeating.
 *
 * `repeat` is a RepeatPreset from utils/taskRepeat; anything else, including
 * 'none' and undefined, writes the single row it always did.
 */
export async function createPersonalEvent(
  data: Omit<PersonalEvent, 'id'>,
  repeat?: string,
  opts: { until?: number } = {},
): Promise<CreateResult> {
  if (!db) return { count: 0 }

  const preset: RepeatPreset | null =
    isRepeatPreset(repeat) && repeat !== 'none' ? repeat : null
  const rule = preset ? ruleFor(preset) : null

  if (!rule) {
    await db.personalEvents.add(data as PersonalEvent)
    return { count: 1 }
  }

  const start = new Date(data.startMs)
  const horizonMs = new Date(
    start.getFullYear() + SERIES_HORIZON_YEARS, start.getMonth(), start.getDate(),
  ).getTime()

  const occurrences = expandOccurrences(
    data.startMs,
    data.endMs,
    opts.until !== undefined ? { ...rule, until: opts.until } : rule,
    [],
    { maxOccurrences: MAX_EVENT_OCCURRENCES, horizonMs },
  )

  /* One row is not a series — it would make the UI ask "this or all?"
     about an event that has no siblings. */
  if (occurrences.length <= 1) {
    await db.personalEvents.add(data as PersonalEvent)
    return { count: 1 }
  }

  const seriesUid = newSeriesUid()
  const rows = occurrences.map(o => ({
    ...data,
    startMs: o.startMs,
    endMs:   o.endMs,
    seriesUid,
    repeat:  preset,
  })) as PersonalEvent[]

  await db.personalEvents.bulkAdd(rows)
  return { count: rows.length, seriesUid }
}

/**
 * Turn an event you already made into a repeating one.
 *
 * The picker used to appear only while creating, so an event made
 * yesterday could never be made to repeat — you had to delete it and
 * type it again. That is the shape of a missing feature, not a
 * decision, and it is what someone means when they say there is no
 * repeat option on their events.
 *
 * The original row is kept as the first occurrence rather than deleted
 * and rewritten, so its id survives: undo snapshots, and anything else
 * holding onto it, still point at something real.
 */
export async function repeatExistingEvent(
  rowId: number,
  data:  Omit<PersonalEvent, 'id'>,
  repeat: string,
  opts: { until?: number } = {},
): Promise<CreateResult> {
  if (!db) return { count: 0 }

  const preset: RepeatPreset | null =
    isRepeatPreset(repeat) && repeat !== 'none' ? repeat : null
  const rule = preset ? ruleFor(preset) : null

  if (!rule) {
    await db.personalEvents.update(rowId, data as Partial<PersonalEvent>)
    return { count: 1 }
  }

  const start = new Date(data.startMs)
  const horizonMs = new Date(
    start.getFullYear() + SERIES_HORIZON_YEARS, start.getMonth(), start.getDate(),
  ).getTime()

  const occurrences = expandOccurrences(
    data.startMs, data.endMs,
    opts.until !== undefined ? { ...rule, until: opts.until } : rule,
    [],
    { maxOccurrences: MAX_EVENT_OCCURRENCES, horizonMs },
  )

  if (occurrences.length <= 1) {
    await db.personalEvents.update(rowId, data as Partial<PersonalEvent>)
    return { count: 1 }
  }

  const seriesUid = newSeriesUid()

  /* The one you edited becomes occurrence one, keeping its id. */
  const [first, ...rest] = occurrences
  await db.personalEvents.update(rowId, {
    ...data, startMs: first.startMs, endMs: first.endMs, seriesUid, repeat: preset,
  } as Partial<PersonalEvent>)

  if (rest.length > 0) {
    await db.personalEvents.bulkAdd(rest.map(o => ({
      ...data, startMs: o.startMs, endMs: o.endMs, seriesUid, repeat: preset,
    })) as PersonalEvent[])
  }

  return { count: occurrences.length, seriesUid }
}

/* ── Custom days: a weekday picker with its own time per day ─────
 *
 * The presets above cover "every day" shapes; they cannot express "my
 * study group meets Monday at 6 and Thursday at 7:30" — one weekly
 * rule with one time cannot hold two different hours. This is the same
 * problem the University Schedule Replicator already solved for class
 * timetables (utils/scheduleGenerator.ts's DayMeeting + planSessions),
 * so the shape here matches it deliberately: a list of (day, start,
 * end) triples, walked one calendar day at a time rather than run
 * through the single-time-per-occurrence RRULE engine.
 */

/** One weekday a custom-repeat event meets, with that day's own hours. */
export interface CustomDayMeeting {
  /** 0 = Sunday … 6 = Saturday, matching Date#getDay(). */
  dayOfWeek: number
  /** 24-hour "HH:MM" — the format <input type="time"> produces. */
  startTime: string
  endTime:   string
}

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * Check a set of custom-day meetings, returning the first problem in
 * plain words, or null when there is nothing wrong.
 */
export function validateCustomDayMeetings(meetings: CustomDayMeeting[]): string | null {
  if (meetings.length === 0) return 'Pick at least one day.'

  const seen = new Set<number>()
  for (const m of meetings) {
    if (seen.has(m.dayOfWeek)) return 'A day is listed twice.'
    seen.add(m.dayOfWeek)

    if (!HHMM_RE.test(m.startTime) || !HHMM_RE.test(m.endTime)) {
      return 'Every selected day needs a start and an end time.'
    }
    if (parseHHMM(m.endTime) <= parseHHMM(m.startTime)) {
      return 'An event has to end after it starts.'
    }
  }
  return null
}

function toLocalDateKey(d: Date): string {
  const y  = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

function buildLocalMs(dateKey: string, timeStr: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  const mins = parseHHMM(timeStr)
  return new Date(y, m - 1, d, Math.floor(mins / 60), mins % 60, 0, 0).getTime()
}

/**
 * Work out every date a custom-day repeat lands on, and at what hours.
 *
 * Walks forward one calendar day at a time from `anchorDate` — which is
 * simply the date the user had open when they picked the days, not
 * necessarily one of the selected weekdays itself. When it is not, the
 * series' first real occurrence is whichever selected day comes next,
 * exactly like a plain "every Monday" repeat created on a Saturday
 * already lands on the following Monday rather than inventing a
 * Saturday occurrence — one rule for both, not a special case here.
 *
 * Pure: no Dexie, no DOM, no clock. Bounded by both a occurrence count
 * and a horizon date so "every day, forever" cannot be asked to plan
 * an unbounded list.
 */
export function planCustomDayOccurrences(
  meetings: CustomDayMeeting[],
  anchorDate: string,
  opts: { untilDate?: string; maxOccurrences?: number } = {},
): { startMs: number; endMs: number }[] {
  const problem = validateCustomDayMeetings(meetings)
  if (problem) throw new Error(problem)

  const byDow = new Map<number, CustomDayMeeting>()
  for (const m of meetings) byDow.set(m.dayOfWeek, m)

  const [ay, am, ad] = anchorDate.split('-').map(Number)
  const cursor = new Date(ay, am - 1, ad, 0, 0, 0, 0)

  const horizonMs = opts.untilDate
    ? (() => {
        const [uy, um, ud] = opts.untilDate!.split('-').map(Number)
        return new Date(uy, um - 1, ud, 23, 59, 59, 999).getTime()
      })()
    : new Date(ay + SERIES_HORIZON_YEARS, am - 1, ad).getTime()

  const max = opts.maxOccurrences ?? MAX_EVENT_OCCURRENCES
  const out: { startMs: number; endMs: number }[] = []

  while (out.length < max && cursor.getTime() <= horizonMs) {
    const meet = byDow.get(cursor.getDay())
    if (meet) {
      const dateKey = toLocalDateKey(cursor)
      out.push({
        startMs: buildLocalMs(dateKey, meet.startTime),
        endMs:   buildLocalMs(dateKey, meet.endTime),
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

/** Marks a series as produced by the weekday picker rather than a preset. */
export const CUSTOM_DAYS_REPEAT = 'custom'

/**
 * Add an event that repeats on specific weekdays, each with its own
 * hours — the picker's write path, parallel to createPersonalEvent's
 * preset one.
 */
export async function createCustomDayEvent(
  data: Omit<PersonalEvent, 'id' | 'startMs' | 'endMs'>,
  anchorDate: string,
  meetings: CustomDayMeeting[],
  opts: { untilDate?: string } = {},
): Promise<CreateResult> {
  if (!db) return { count: 0 }

  const occurrences = planCustomDayOccurrences(meetings, anchorDate, opts)
  if (occurrences.length === 0) return { count: 0 }

  if (occurrences.length === 1) {
    await db.personalEvents.add({ ...data, ...occurrences[0] } as PersonalEvent)
    return { count: 1 }
  }

  const seriesUid = newSeriesUid()
  const rows = occurrences.map(o => ({
    ...data, startMs: o.startMs, endMs: o.endMs, seriesUid, repeat: CUSTOM_DAYS_REPEAT,
  })) as PersonalEvent[]

  await db.personalEvents.bulkAdd(rows)
  return { count: rows.length, seriesUid }
}

/** Turn an event you already made into a custom weekday repeat. */
export async function repeatExistingEventCustomDays(
  rowId: number,
  data: Omit<PersonalEvent, 'id' | 'startMs' | 'endMs'>,
  anchorDate: string,
  meetings: CustomDayMeeting[],
  opts: { untilDate?: string } = {},
): Promise<CreateResult> {
  if (!db) return { count: 0 }

  const occurrences = planCustomDayOccurrences(meetings, anchorDate, opts)
  if (occurrences.length === 0) return { count: 0 }

  if (occurrences.length === 1) {
    await db.personalEvents.update(rowId, { ...data, ...occurrences[0] } as Partial<PersonalEvent>)
    return { count: 1 }
  }

  const seriesUid = newSeriesUid()
  const [first, ...rest] = occurrences

  await db.personalEvents.update(rowId, {
    ...data, startMs: first.startMs, endMs: first.endMs, seriesUid, repeat: CUSTOM_DAYS_REPEAT,
  } as Partial<PersonalEvent>)

  if (rest.length > 0) {
    await db.personalEvents.bulkAdd(rest.map(o => ({
      ...data, startMs: o.startMs, endMs: o.endMs, seriesUid, repeat: CUSTOM_DAYS_REPEAT,
    })) as PersonalEvent[])
  }

  return { count: occurrences.length, seriesUid }
}
