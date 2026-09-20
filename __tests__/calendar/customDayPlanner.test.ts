/**
 * lib/personalEventSeries.ts's weekday picker — the calendar equivalent
 * of the University Schedule Replicator's "different hours on different
 * days" course meetings, for an ordinary event.
 */

import {
  planCustomDayOccurrences, validateCustomDayMeetings, type CustomDayMeeting,
} from '@/lib/personalEventSeries'

describe('validateCustomDayMeetings', () => {
  it('requires at least one day', () => {
    expect(validateCustomDayMeetings([])).toMatch(/at least one day/)
  })

  it('rejects the same day picked twice', () => {
    const m: CustomDayMeeting[] = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '10:00' },
      { dayOfWeek: 1, startTime: '14:00', endTime: '15:00' },
    ]
    expect(validateCustomDayMeetings(m)).toMatch(/twice/)
  })

  it('rejects an end at or before the start', () => {
    const m: CustomDayMeeting[] = [{ dayOfWeek: 2, startTime: '10:00', endTime: '09:00' }]
    expect(validateCustomDayMeetings(m)).toMatch(/end after it starts/)
  })

  it('accepts a clean set of days', () => {
    const m: CustomDayMeeting[] = [
      { dayOfWeek: 1, startTime: '18:00', endTime: '19:00' },
      { dayOfWeek: 4, startTime: '19:30', endTime: '21:00' },
    ]
    expect(validateCustomDayMeetings(m)).toBeNull()
  })
})

describe('planCustomDayOccurrences', () => {
  it('gives each selected weekday its own hours', () => {
    // Monday 18:00-19:00, Thursday 19:30-21:00 — the shape a single
    // start/end pair applied to a weekly rule cannot express.
    const meetings: CustomDayMeeting[] = [
      { dayOfWeek: 1, startTime: '18:00', endTime: '19:00' },
      { dayOfWeek: 4, startTime: '19:30', endTime: '21:00' },
    ]
    // 2026-09-21 is a Monday.
    const out = planCustomDayOccurrences(meetings, '2026-09-21', { untilDate: '2026-10-01' })

    const mon = new Date(out[0].startMs)
    expect(mon.getDay()).toBe(1)
    expect(mon.getHours()).toBe(18)
    expect(new Date(out[0].endMs).getHours()).toBe(19)

    const thu = out.find(o => new Date(o.startMs).getDay() === 4)!
    expect(new Date(thu.startMs).getHours()).toBe(19)
    expect(new Date(thu.startMs).getMinutes()).toBe(30)
    expect(new Date(thu.endMs).getHours()).toBe(21)
  })

  it('lands on the first matching weekday when the anchor date is not one of them', () => {
    // Anchor is Monday the 21st; only Wednesday is picked — same rule a
    // plain "every Monday" repeat already follows when created on a day
    // that is not itself Monday.
    const meetings: CustomDayMeeting[] = [{ dayOfWeek: 3, startTime: '09:00', endTime: '10:00' }]
    const out = planCustomDayOccurrences(meetings, '2026-09-21', { untilDate: '2026-10-01' })

    expect(out.length).toBeGreaterThan(0)
    expect(new Date(out[0].startMs).getDay()).toBe(3)
    expect(new Date(out[0].startMs).getDate()).toBe(23)   // the 23rd is the next Wednesday
  })

  it('stops at the until date, inclusive', () => {
    const meetings: CustomDayMeeting[] = [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }]
    // Three Mondays in range: the 21st, 28th, and Oct 5th is excluded by the until date.
    const out = planCustomDayOccurrences(meetings, '2026-09-21', { untilDate: '2026-09-28' })
    expect(out).toHaveLength(2)
  })

  it('defaults to a two-year horizon with no until date', () => {
    const meetings: CustomDayMeeting[] = [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }]
    const out = planCustomDayOccurrences(meetings, '2026-09-21')
    const last = new Date(out.at(-1)!.startMs)
    expect(last.getFullYear()).toBeLessThanOrEqual(2028)
    expect(out.length).toBeGreaterThan(50)   // roughly two years of Mondays
  })

  it('throws the same message validateCustomDayMeetings would report', () => {
    expect(() => planCustomDayOccurrences([], '2026-09-21')).toThrow(/at least one day/)
  })
})
