/**
 * University Schedule Generator — Phase 10.3
 *
 * Walks a semester day-by-day, skips break windows, and bulk-writes
 * one CalendarEvent per valid class meeting into IndexedDB via a single
 * atomic Dexie transaction.
 *
 * The generated events live in the calendarEvents table under a new
 * CalendarFeed row (label = "COURSE — UNIVERSITY").  Users can remove
 * an entire generated schedule by deleting that feed in the iCal Feeds
 * tab, which cascades-deletes all associated events via deleteFeed().
 */

import { db, type CalendarEvent, type CalendarFeed } from '@/lib/db'
import {
  UNIVERSITY_CALENDARS,
  type UniversityId,
  type BreakRange,
} from '@/utils/universityCalendars'

/* ── Public types ───────────────────────────────────────────────── */

export type SelectedDays = {
  mon: boolean
  tue: boolean
  wed: boolean
  thu: boolean
  fri: boolean
}

export type CourseInput = {
  courseName:   string
  selectedDays: SelectedDays
  /** 24-hour "HH:MM", e.g. "10:10" — matches the HTML <input type="time"> format */
  startTime:    string
  /** 24-hour "HH:MM", e.g. "11:00" */
  endTime:      string
  universityId: UniversityId
}

export type GenerateResult = {
  count:     number   // events written
  feedId:    number   // IDB PK of the created CalendarFeed row
  feedColor: string   // hex accent of the university
}

/* ── Day-of-week mapping ────────────────────────────────────────── */

/* JS Date.getDay() → selectedDays key (weekends not mapped — skipped) */
const JS_DAY_MAP: Partial<Record<number, keyof SelectedDays>> = {
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
}

function isDaySelected(jsDay: number, selected: SelectedDays): boolean {
  const key = JS_DAY_MAP[jsDay]
  return key !== undefined && selected[key]
}

/* ── Break-range check ──────────────────────────────────────────── */

/*
 * ISO date string lexicographic comparison is safe here:
 * "YYYY-MM-DD" format sorts correctly without Date parsing.
 */
function isInBreak(localDateStr: string, breaks: BreakRange[]): boolean {
  return breaks.some(b => localDateStr >= b.from && localDateStr <= b.to)
}

/* ── Local-date helpers ─────────────────────────────────────────── */

/*
 * Build a "YYYY-MM-DD" string from a Date using LOCAL time components,
 * not UTC.  toISOString() converts to UTC first, which causes a
 * day-shift for users in UTC+ timezones (midnight local = prior-day UTC).
 */
function toLocalDateStr(d: Date): string {
  const y   = d.getFullYear()
  const mo  = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/*
 * Parse "HH:MM" (24-hour) into { hours, minutes }.
 * HTML <input type="time"> always produces this format.
 */
function parseHHMM(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) throw new Error(`Invalid time value: "${timeStr}"`)
  return { hours: h, minutes: m }
}

/*
 * Build a UTC-ms timestamp for a class slot using the LOCAL Date
 * constructor so the event renders at the correct wall-clock time
 * in the user's timezone inside CalendarView.
 */
function buildSlotMs(localDateStr: string, timeStr: string): number {
  const [year, month, day] = localDateStr.split('-').map(Number)
  const { hours, minutes } = parseHHMM(timeStr)
  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime()
}

/* ── Main generator ─────────────────────────────────────────────── */

/**
 * Generates a full semester's worth of recurring class events and
 * writes them into IndexedDB in a single atomic Dexie transaction.
 *
 * Typical run: ~120–160 events per 3-credit course. The transaction
 * completes in < 200 ms on modern hardware — no batching needed.
 */
export async function generateUniversitySchedule(
  input: CourseInput,
): Promise<GenerateResult> {
  if (!db) throw new Error('IndexedDB not available — ensure this runs client-side.')

  const uniCal = UNIVERSITY_CALENDARS[input.universityId]
  if (!uniCal) throw new Error(`Unknown university ID: ${input.universityId}`)

  const name = input.courseName.trim()
  if (!name) throw new Error('Course name is required.')

  const anyDay = Object.values(input.selectedDays).some(Boolean)
  if (!anyDay) throw new Error('Select at least one meeting day.')

  /* Validate time values up-front (throws if malformed) */
  parseHHMM(input.startTime)
  parseHHMM(input.endTime)

  const feedLabel = `${name} — ${uniCal.label}`
  const now       = Date.now()

  /* Build the events array synchronously before opening the transaction */
  const [sy, sm, sd] = uniCal.semesterStart.split('-').map(Number)
  const [ey, em, ed] = uniCal.semesterEnd.split('-').map(Number)

  /* Midnight-local cursor to avoid DST edge cases during iteration */
  const cursor = new Date(sy, sm - 1, sd, 0, 0, 0, 0)
  const endDay = new Date(ey, em - 1, ed, 23, 59, 59, 999)

  /* Deterministic UID prefix — safe for dedup if ever re-run */
  const uidPrefix = `sched-${input.universityId}-${name.replace(/\W+/g, '_')}`

  const eventRows: Array<Omit<CalendarEvent, 'id'> & { feedId: 0 }> = []

  while (cursor <= endDay) {
    const jsDay       = cursor.getDay()
    const localDate   = toLocalDateStr(cursor)

    if (isDaySelected(jsDay, input.selectedDays) && !isInBreak(localDate, uniCal.breaks)) {
      eventRows.push({
        feedId:      0,                           // filled in during transaction
        uid:         `${uidPrefix}-${localDate}`,
        title:       name,
        startMs:     buildSlotMs(localDate, input.startTime),
        endMs:       buildSlotMs(localDate, input.endTime),
        allDay:      0,
        is1159:      0,
        category:    'scholastic',
        description: `${uniCal.label} · ${input.universityId}`,
      })
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  /* Atomic transaction: create feed row → bulk-insert events → ensure a
     matching Course Intensity Profile exists so the class flows straight into
     the Cognitive Forecast without being re-entered there. */
  const { feedId, count } = await db.transaction(
    'rw',
    [db.calendarFeeds, db.calendarEvents, db.courseIntensityProfiles],
    async () => {
      const fid = (await db.calendarFeeds.add({
        label:         feedLabel,
        url:           '',          // locally-generated; no remote URL
        color:         uniCal.color,
        isActive:      1,
        lastFetchedAt: now,
        createdAt:     now,
      } as CalendarFeed)) as number

      /* Patch the feedId onto every event row */
      const finalRows = eventRows.map(r => ({ ...r, feedId: fid }))

      if (finalRows.length > 0) {
        await db.calendarEvents.bulkAdd(finalRows as CalendarEvent[])
      }

      /* Auto-register the course in the intensity matrix (default 5/5/5).
         courseCode = the class name so the matcher (which scans event titles)
         links these generated events to the profile automatically. Skip if a
         profile for this course already exists (re-runs, edits). */
      const existingProfile = await db.courseIntensityProfiles
        .where('courseCode').equals(name).first()
      if (!existingProfile) {
        await db.courseIntensityProfiles.add({
          courseCode:            name,
          courseName:            uniCal.label,
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
