'use client'

/**
 * lib/hooks/useTodayAgenda.ts — what today holds: tasks due and events.
 *
 * The phone's Today screen and the Today tile on its Home screen both
 * read this, so the tile can never say "2 due" beside a screen that
 * lists three. Habits are not in here — they have their own rules about
 * what "today" means (the cutoff, skips, limits) and all of those live
 * in `useHabits`, which callers read directly.
 *
 * What counts:
 *
 *   · Tasks: anything still open that is due today or earlier. Overdue
 *     work is the most important thing on a glance screen, so it is
 *     not hidden just because its day has passed. Undated tasks are
 *     left out — they belong on the Tasks screen, not on a list of
 *     what today holds.
 *   · Events: whatever the calendar itself would draw today — personal
 *     events on a visible calendar, and imported events from a feed that
 *     is switched on. An event that started before today and is still
 *     going (a multi-day trip) counts; one that finished yesterday does
 *     not.
 *
 * "Today" here is the calendar day. Tasks and events roll over at
 * midnight; only habits use the configurable cutoff (CLAUDE.md rule 90).
 */

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db, type Assignment, type PersonalEvent, type CalendarEvent,
  type CalendarFeed, type LocalCalendar,
} from '@/lib/db'
import { toLocalDateStr } from '@/utils/localDate'

/* How far back to look for an event still running today. Anything that
   started more than this long ago and is still going is vanishingly rare. */
const LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000

const OPEN = ['pending', 'in_progress', 'overdue'] as const

export interface AgendaEvent {
  key:     string
  title:   string
  startMs: number
  endMs:   number
  allDay:  boolean
  color:   string
}

export interface TodayAgenda {
  /** Open tasks due today or earlier, overdue first, then by date. */
  tasks:    Assignment[]
  overdue:  number
  /** Today's events in time order, all-day ones first. */
  events:   AgendaEvent[]
  /** False until every query has answered at least once. */
  loaded:   boolean
}

function dayBounds(now = new Date()): [number, number] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return [start.getTime(), end.getTime()]
}

export function useTodayAgenda(): TodayAgenda {
  const iso = toLocalDateStr(new Date())
  const [start, end] = dayBounds()

  const openTasks = useLiveQuery(
    () => db?.assignments.where('status').anyOf([...OPEN]).toArray() ?? Promise.resolve([]),
    [],
  )

  const personal = useLiveQuery(
    () => db?.personalEvents.where('startMs').between(start - LOOKBACK_MS, end, true, false).toArray()
      ?? Promise.resolve([]),
    [start, end],
  )
  const imported = useLiveQuery(
    () => db?.calendarEvents.where('startMs').between(start - LOOKBACK_MS, end, true, false).toArray()
      ?? Promise.resolve([]),
    [start, end],
  )
  const feeds     = useLiveQuery(() => db?.calendarFeeds.toArray() ?? Promise.resolve([]), [])
  const calendars = useLiveQuery(() => db?.localCalendars.toArray() ?? Promise.resolve([]), [])

  return useMemo<TodayAgenda>(() => planAgenda({
    openTasks, personal, imported, feeds, calendars, iso, start, end,
  }), [openTasks, personal, imported, feeds, calendars, iso, start, end])
}

export interface AgendaInput {
  openTasks: Assignment[]    | undefined
  personal:  PersonalEvent[] | undefined
  imported:  CalendarEvent[] | undefined
  feeds:     CalendarFeed[]  | undefined
  calendars: LocalCalendar[] | undefined
  /** Today's calendar date, YYYY-MM-DD. */
  iso:   string
  /** Local midnight today, and local midnight tomorrow. */
  start: number
  end:   number
}

/**
 * The rules, apart from the queries — pure, so they can be tested
 * without a database. `undefined` inputs are queries still loading.
 */
export function planAgenda(input: AgendaInput): TodayAgenda {
  const { openTasks, personal, imported, feeds, calendars, iso, start, end } = input
  const loaded = openTasks !== undefined && personal !== undefined
    && imported !== undefined && feeds !== undefined && calendars !== undefined

  const tasks = (openTasks ?? [])
    .filter(t => typeof t.dueDate === 'string' && t.dueDate !== '' && t.dueDate <= iso)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const overdue = tasks.filter(t => t.dueDate < iso).length

  /* Mirrors CalendarView: an event is drawn when its feed or calendar
     is switched on, in that feed's or calendar's colour. */
  const feedById = new Map((feeds ?? []).map(f => [f.id, f]))
  const calById  = new Map((calendars ?? []).map(c => [c.id, c]))
  const defaultCal = (calendars ?? [])
    .slice()
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))[0]

  const runsToday = (s: number, e: number) => s < end && Math.max(e, s + 1) > start

  const events: AgendaEvent[] = []
  for (const pe of personal ?? []) {
    if (!runsToday(pe.startMs, pe.endMs)) continue
    const cal = (pe.calendarId != null ? calById.get(pe.calendarId) : undefined) ?? defaultCal
    if (cal && cal.isVisible === 0) continue
    events.push({
      key: `p${pe.id}`, title: pe.title, startMs: pe.startMs, endMs: pe.endMs,
      allDay: pe.allDay === 1, color: pe.color ?? cal?.color ?? 'var(--accent-purple)',
    })
  }
  for (const ce of imported ?? []) {
    if (!runsToday(ce.startMs, ce.endMs)) continue
    const feed = feedById.get(ce.feedId)
    if (!feed || feed.isActive === 0) continue
    events.push({
      key: `c${ce.id}`, title: ce.title, startMs: ce.startMs, endMs: ce.endMs,
      allDay: ce.allDay === 1, color: feed.color,
    })
  }
  events.sort((a, b) =>
    (a.allDay === b.allDay ? 0 : a.allDay ? -1 : 1) || a.startMs - b.startMs)

  return { tasks, overdue, events, loaded }
}
