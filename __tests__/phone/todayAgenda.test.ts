/**
 * What the phone's Today screen — and the Today tile on its Home — say
 * today holds.
 *
 * The rules are in `planAgenda` so they can be checked without a
 * database, and so the tile and the screen cannot count differently:
 * both read the same hook, which is this function over live queries.
 */

import { planAgenda, type AgendaInput } from '@/lib/hooks/useTodayAgenda'
import type { Assignment, CalendarEvent, CalendarFeed, LocalCalendar, PersonalEvent } from '@/lib/db'

const at = (d: number, h = 0, m = 0) => new Date(2026, 8, d, h, m).getTime()   // September 2026
const START = at(25)
const END   = at(26)

const task = (over: Partial<Assignment>): Assignment => ({
  id: Math.floor(Math.random() * 1e6), title: 'x', dueDate: '2026-09-25', status: 'pending',
  priority: 'medium', courseId: '', createdAt: 0, updatedAt: 0, ...over,
} as Assignment)

const personalEv = (over: Partial<PersonalEvent>): PersonalEvent => ({
  id: Math.floor(Math.random() * 1e6), title: 'e', startMs: at(25, 9), endMs: at(25, 10),
  allDay: 0, color: '#7c95ff', category: 'personal', createdAt: 0, ...over,
} as PersonalEvent)

const feedEv = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: Math.floor(Math.random() * 1e6), feedId: 1, uid: 'u', title: 'f', startMs: at(25, 14), endMs: at(25, 15),
  allDay: 0, is1159: 0, category: 'general', ...over,
} as CalendarEvent)

const feed = (over: Partial<CalendarFeed> = {}): CalendarFeed =>
  ({ id: 1, label: 'Class', url: 'x', color: '#52cca3', isActive: 1, lastFetchedAt: 0, createdAt: 0, ...over } as CalendarFeed)

const cal = (over: Partial<LocalCalendar> = {}): LocalCalendar =>
  ({ id: 1, name: 'General', color: '#7c95ff', isVisible: 1, createdAt: 0, ...over })

const input = (over: Partial<AgendaInput>): AgendaInput => ({
  openTasks: [], personal: [], imported: [], feeds: [feed()], calendars: [cal()],
  iso: '2026-09-25', start: START, end: END, ...over,
})

describe('tasks on the Today screen', () => {
  it('shows what is due today and what is overdue, oldest first', () => {
    const r = planAgenda(input({ openTasks: [
      task({ title: 'today', dueDate: '2026-09-25' }),
      task({ title: 'late',  dueDate: '2026-09-20' }),
      task({ title: 'later', dueDate: '2026-09-28' }),
    ]}))
    expect(r.tasks.map(t => t.title)).toEqual(['late', 'today'])
    expect(r.overdue).toBe(1)
  })

  it('leaves undated tasks to the Tasks screen', () => {
    const r = planAgenda(input({ openTasks: [task({ title: 'someday', dueDate: '' })] }))
    expect(r.tasks).toEqual([])
  })
})

describe('events on the Today screen', () => {
  it('lists today’s events, all-day first, then by time', () => {
    const r = planAgenda(input({
      personal: [
        personalEv({ title: 'gym', startMs: at(25, 17), endMs: at(25, 18) }),
        personalEv({ title: 'birthday', startMs: at(25), endMs: at(26), allDay: 1 }),
      ],
      imported: [feedEv({ title: 'lecture', startMs: at(25, 9), endMs: at(25, 10) })],
    }))
    expect(r.events.map(e => e.title)).toEqual(['birthday', 'lecture', 'gym'])
  })

  it('includes an event still running from an earlier day, not one that ended', () => {
    const r = planAgenda(input({ personal: [
      personalEv({ title: 'trip',      startMs: at(23, 8), endMs: at(27, 20) }),
      personalEv({ title: 'yesterday', startMs: at(24),    endMs: at(25), allDay: 1 }),
      personalEv({ title: 'tomorrow',  startMs: at(26, 9), endMs: at(26, 10) }),
    ]}))
    expect(r.events.map(e => e.title)).toEqual(['trip'])
  })

  it('draws what the calendar draws: hidden calendars and switched-off feeds stay hidden', () => {
    const r = planAgenda(input({
      calendars: [cal({ id: 1 }), cal({ id: 2, isVisible: 0, createdAt: 5 })],
      feeds: [feed({ id: 1 }), feed({ id: 2, isActive: 0 })],
      personal: [
        personalEv({ title: 'shown',  calendarId: 1 }),
        personalEv({ title: 'hidden', calendarId: 2 }),
      ],
      imported: [
        feedEv({ title: 'on',  feedId: 1 }),
        feedEv({ title: 'off', feedId: 2 }),
        feedEv({ title: 'orphan', feedId: 99 }),
      ],
    }))
    expect(r.events.map(e => e.title).sort()).toEqual(['on', 'shown'])
  })

  it('colours an event by its own colour, then its calendar, then its feed', () => {
    const r = planAgenda(input({
      calendars: [cal({ color: '#aaaaaa' })],
      personal: [
        personalEv({ title: 'own', color: '#123456' }),
        personalEv({ title: 'inherits', color: undefined as unknown as string, startMs: at(25, 11), endMs: at(25, 12) }),
      ],
      imported: [feedEv({ title: 'feed' })],
    }))
    const colour = Object.fromEntries(r.events.map(e => [e.title, e.color]))
    expect(colour).toEqual({ own: '#123456', inherits: '#aaaaaa', feed: '#52cca3' })
  })
})

describe('loading', () => {
  it('is not loaded until every query has answered', () => {
    expect(planAgenda(input({ feeds: undefined })).loaded).toBe(false)
    expect(planAgenda(input({})).loaded).toBe(true)
  })
})
