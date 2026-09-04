/**
 * University Schedule Generator
 *
 * Walks a semester day-by-day, skips break windows, and bulk-writes one
 * CalendarEvent per class meeting into IndexedDB in a single atomic
 * Dexie transaction.
 *
 * The generated events live in calendarEvents under a new CalendarFeed
 * row (label = "COURSE — CAMPUS"). Deleting that feed in the calendar
 * manager cascades-deletes every session it produced.
 *
 * The date arithmetic is separated from the database work: planSessions()
 * is pure and decides *when* the class meets, and this module's only
 * other job is writing what it returns. That split is what makes the
 * awkward cases — a class that meets at different hours on different
 * days, a semester abroad with its own breaks — testable without a
 * browser.
 */

import { db, type CalendarEvent, type CalendarFeed } from '@/lib/db'
import {
  UNIVERSITY_CALENDARS,
  type UniversityId,
  type BreakRange,
} from '@/utils/universityCalendars'

/* ── Public types ───────────────────────────────────────────────── */

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri'

export const DAY_KEYS: readonly DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri']

/**
 * One weekday the class meets, with the hours it meets *that* day.
 *
 * Times live per meeting rather than per course because plenty of
 * timetables are not uniform: a lecture at 09:05 on Monday and Wednesday
 * with the Friday section at 14:30 is an ordinary shape, and a single
 * start/end for the whole course cannot express it.
 */
export interface DayMeeting {
  day:       DayKey
  /** 24-hour "HH:MM" — the format <input type="time"> produces. */
  startTime: string
  endTime:   string
}

/**
 * The window the class runs inside, and the days it does not meet.
 *
 * Separate from the university entry so it can be edited. A term spent
 * abroad keeps none of the home campus's dates — different start, different
 * end, and holidays belonging to a different country — and a student on
 * exchange is exactly the person who cannot use the stock calendar.
 */
export interface SemesterWindow {
  label:         string
  semesterStart: string        // ISO "YYYY-MM-DD", first day of instruction
  semesterEnd:   string        // ISO "YYYY-MM-DD", last day of instruction
  breaks:        BreakRange[]
}

export interface CourseInput {
  courseName:   string
  meetings:     DayMeeting[]
  universityId: UniversityId
  /**
   * Replaces the campus's stock dates and breaks. Omitted, the
   * university's own calendar is used unchanged.
   */
  calendar?:    SemesterWindow
}

export interface GenerateResult {
  count:     number   // events written
  feedId:    number   // IDB PK of the created CalendarFeed row
  feedColor: string   // hex accent of the university
}

/** One resolved class meeting: a date plus the hours it runs that day. */
export interface PlannedSession {
  date:      string   // ISO "YYYY-MM-DD"
  startTime: string
  endTime:   string
}

/* ── Day-of-week mapping ────────────────────────────────────────── */

/* Date.getDay() → DayKey. Weekends are absent and so never match. */
const JS_DAY_MAP: Partial<Record<number, DayKey>> = {
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
}

/* ── Validation ─────────────────────────────────────────────────── */

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Parse "HH:MM" (24-hour) into minutes since midnight. */
export function parseHHMM(timeStr: string): number {
  const m = HHMM.exec(timeStr.trim())
  if (!m) throw new Error(`Invalid time value: "${timeStr}"`)
  return Number(m[1]) * 60 + Number(m[2])
}

function assertIsoDate(value: string, what: string): void {
  if (!ISO_DATE.test(value.trim())) {
    throw new Error(`${what} must be a date in YYYY-MM-DD form, got "${value}"`)
  }
}

/**
 * Check a set of meetings, returning the first problem in plain words.
 *
 * Returns null when there is nothing wrong. Reported rather than thrown
 * so the form can disable its button and say why, instead of letting a
 * generation run fail after the fact.
 */
export function validateMeetings(meetings: DayMeeting[]): string | null {
  if (meetings.length === 0) return 'Select at least one meeting day.'

  const seen = new Set<DayKey>()
  for (const m of meetings) {
    if (seen.has(m.day)) return `${m.day} is listed twice.`
    seen.add(m.day)

    let start: number
    let end: number
    try {
      start = parseHHMM(m.startTime)
      end   = parseHHMM(m.endTime)
    } catch {
      return 'Every meeting day needs a start and an end time.'
    }
    /*
     * An end at or before the start would write an event of zero or
     * negative length, which the week grid draws as an invisible sliver.
     * Better to refuse than to generate 40 of them.
     */
    if (end <= start) return 'A class has to end after it starts.'
  }
  return null
}

/** Check a semester window, returning the first problem in plain words. */
export function validateWindow(win: SemesterWindow): string | null {
  if (!ISO_DATE.test(win.semesterStart) || !ISO_DATE.test(win.semesterEnd)) {
    return 'Set both semester dates.'
  }
  if (win.semesterEnd < win.semesterStart) {
    return 'The semester ends before it starts.'
  }
  for (const b of win.breaks) {
    if (!ISO_DATE.test(b.from) || !ISO_DATE.test(b.to)) {
      return `“${b.label || 'A break'}” needs both dates.`
    }
    if (b.to < b.from) {
      return `“${b.label || 'A break'}” ends before it starts.`
    }
  }
  return null
}

/* ── Break-range check ──────────────────────────────────────────── */

/*
 * Lexicographic comparison is correct for zero-padded "YYYY-MM-DD",
 * so no Date parsing is needed to test range membership.
 */
function isInBreak(localDateStr: string, breaks: BreakRange[]): boolean {
  return breaks.some(b => localDateStr >= b.from && localDateStr <= b.to)
}

/* ── Local-date helpers ─────────────────────────────────────────── */

/*
 * Build "YYYY-MM-DD" from a Date using LOCAL components, not UTC.
 * toISOString() converts to UTC first, which shifts the day for anyone
 * east of Greenwich: local midnight is the previous day in UTC.
 */
function toLocalDateStr(d: Date): string {
  const y   = d.getFullYear()
  const mo  = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/*
 * Build a UTC-ms timestamp from a local date and wall-clock time, via
 * the local Date constructor so the event renders at the hour the class
 * actually starts in the reader's timezone.
 */
function buildSlotMs(localDateStr: string, timeStr: string): number {
  const [year, month, day] = localDateStr.split('-').map(Number)
  const mins = parseHHMM(timeStr)
  return new Date(year, month - 1, day, Math.floor(mins / 60), mins % 60, 0, 0).getTime()
}

/* ── The planner (pure) ─────────────────────────────────────────── */

/**
 * Work out every date the class meets, and at what hours.
 *
 * Walks the semester one day at a time. A day produces a session when
 * the course meets on that weekday and the date falls outside every
 * break. Each session carries the times belonging to *its own* weekday,
 * so a Monday-and-Friday course with different Friday hours comes out
 * right without the caller doing anything.
 *
 * Pure: no Dexie, no DOM, no clock. Given the same input it returns the
 * same list, which is what makes it worth testing directly.
 */
export function planSessions(
  meetings: DayMeeting[],
  win: SemesterWindow,
): PlannedSession[] {
  const meetingProblem = validateMeetings(meetings)
  if (meetingProblem) throw new Error(meetingProblem)
  const windowProblem = validateWindow(win)
  if (windowProblem) throw new Error(windowProblem)

  const byDay = new Map<DayKey, DayMeeting>()
  for (const m of meetings) byDay.set(m.day, m)

  const [sy, sm, sd] = win.semesterStart.split('-').map(Number)
  const [ey, em, ed] = win.semesterEnd.split('-').map(Number)

  /* Midnight-local cursor, so a DST shift mid-semester cannot skip or
     double a day as the walk crosses it. */
  const cursor = new Date(sy, sm - 1, sd, 0, 0, 0, 0)
  const endDay = new Date(ey, em - 1, ed, 0, 0, 0, 0)

  const out: PlannedSession[] = []
  while (cursor.getTime() <= endDay.getTime()) {
    const key  = JS_DAY_MAP[cursor.getDay()]
    const meet = key ? byDay.get(key) : undefined
    if (meet) {
      const date = toLocalDateStr(cursor)
      if (!isInBreak(date, win.breaks)) {
        out.push({ date, startTime: meet.startTime, endTime: meet.endTime })
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

/** The stock calendar for a campus, as an editable window. */
export function windowForUniversity(id: UniversityId): SemesterWindow {
  const cal = UNIVERSITY_CALENDARS[id]
  if (!cal) throw new Error(`Unknown university ID: ${id}`)
  return {
    label:         cal.label,
    semesterStart: cal.semesterStart,
    semesterEnd:   cal.semesterEnd,
    /* Copied, not shared — the caller is going to edit these. */
    breaks:        cal.breaks.map(b => ({ ...b })),
  }
}

/* ── Main generator ─────────────────────────────────────────────── */

/**
 * Generate a semester of class events and write them to IndexedDB in a
 * single atomic transaction.
 *
 * Typical run is 120–160 events for a three-credit course, which the
 * transaction completes well inside a frame — no batching needed.
 */
export async function generateUniversitySchedule(
  input: CourseInput,
): Promise<GenerateResult> {
  if (!db) throw new Error('IndexedDB not available — ensure this runs client-side.')

  const uniCal = UNIVERSITY_CALENDARS[input.universityId]
  if (!uniCal) throw new Error(`Unknown university ID: ${input.universityId}`)

  const name = input.courseName.trim()
  if (!name) throw new Error('Course name is required.')

  const win = input.calendar ?? windowForUniversity(input.universityId)
  assertIsoDate(win.semesterStart, 'Semester start')
  assertIsoDate(win.semesterEnd,   'Semester end')

  const sessions  = planSessions(input.meetings, win)
  const campus    = win.label.trim() || uniCal.label
  const feedLabel = `${name} — ${campus}`
  const now       = Date.now()

  /* Deterministic UID — stable if the same course is ever regenerated. */
  const uidPrefix = `sched-${input.universityId}-${name.replace(/\W+/g, '_')}`

  const eventRows = sessions.map(s => ({
    feedId:      0,                       // filled in inside the transaction
    uid:         `${uidPrefix}-${s.date}`,
    title:       name,
    startMs:     buildSlotMs(s.date, s.startTime),
    endMs:       buildSlotMs(s.date, s.endTime),
    allDay:      0 as const,
    is1159:      0 as const,
    category:    'scholastic',
    description: `${campus} · ${input.universityId}`,
  }))

  /* One transaction: feed row → events → intensity profile. A feed with
     no events would show up in the manager as a calendar nobody made. */
  const { feedId, count } = await db.transaction(
    'rw',
    [db.calendarFeeds, db.calendarEvents, db.courseIntensityProfiles],
    async () => {
      const fid = (await db.calendarFeeds.add({
        label:         feedLabel,
        url:           '',          // locally generated; nothing to fetch
        color:         uniCal.color,
        isActive:      1,
        lastFetchedAt: now,
        createdAt:     now,
      } as CalendarFeed)) as number

      const finalRows = eventRows.map(r => ({ ...r, feedId: fid }))
      if (finalRows.length > 0) {
        await db.calendarEvents.bulkAdd(finalRows as CalendarEvent[])
      }

      /* Register the course in the intensity matrix so it flows into the
         Cognitive Forecast without being typed in twice. courseCode is the
         class name because the matcher scans event titles. */
      const existingProfile = await db.courseIntensityProfiles
        .where('courseCode').equals(name).first()
      if (!existingProfile) {
        await db.courseIntensityProfiles.add({
          courseCode:            name,
          courseName:            campus,
          mathIntensity:         5,
          codingIntensity:       5,
          memorizationIntensity: 5,
          createdAt:             now,
          updatedAt:             now,
        })
      }

      return { feedId: fid, count: finalRows.length }
    },
  )

  return { count, feedId, feedColor: uniCal.color }
}
