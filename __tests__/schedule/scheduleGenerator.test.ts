/**
 * When a class actually meets.
 *
 * The awkward cases are the point: a course whose hours differ by day,
 * and a term abroad whose calendar has nothing to do with the home
 * campus's. Both used to be inexpressible.
 */

import {
  planSessions, validateMeetings, validateWindow, parseHHMM,
  windowForUniversity,
  type DayMeeting, type SemesterWindow,
} from '@/utils/scheduleGenerator'

/* A short window with known weekdays:
   2026-09-07 is a Monday, 2026-09-11 the Friday of that week. */
const week = (breaks: SemesterWindow['breaks'] = []): SemesterWindow => ({
  label: 'Test', semesterStart: '2026-09-07', semesterEnd: '2026-09-18', breaks,
})

const at = (day: DayMeeting['day'], startTime: string, endTime: string): DayMeeting =>
  ({ day, startTime, endTime })

describe('planSessions', () => {
  it('meets only on the chosen weekdays', () => {
    const out = planSessions([at('mon', '09:00', '09:50')], week())
    expect(out.map(s => s.date)).toEqual(['2026-09-07', '2026-09-14'])
  })

  it('never schedules a weekend', () => {
    const out = planSessions(
      [at('mon', '09:00', '10:00'), at('fri', '09:00', '10:00')], week())
    for (const s of out) {
      const dow = new Date(s.date + 'T12:00:00').getDay()
      expect(dow).toBeGreaterThanOrEqual(1)
      expect(dow).toBeLessThanOrEqual(5)
    }
  })

  it('gives each day its own hours', () => {
    // The whole point: MW at 09:05, the Friday section at 14:30.
    const out = planSessions([
      at('mon', '09:05', '09:55'),
      at('wed', '09:05', '09:55'),
      at('fri', '14:30', '15:45'),
    ], week())

    const fridays = out.filter(s => new Date(s.date + 'T12:00:00').getDay() === 5)
    const mondays = out.filter(s => new Date(s.date + 'T12:00:00').getDay() === 1)

    expect(fridays).toHaveLength(2)
    expect(mondays).toHaveLength(2)
    for (const f of fridays) expect([f.startTime, f.endTime]).toEqual(['14:30', '15:45'])
    for (const m of mondays) expect([m.startTime, m.endTime]).toEqual(['09:05', '09:55'])
  })

  it('skips break days', () => {
    const out = planSessions(
      [at('mon', '09:00', '10:00')],
      week([{ label: 'Reading week', from: '2026-09-14', to: '2026-09-18' }]),
    )
    expect(out.map(s => s.date)).toEqual(['2026-09-07'])
  })

  it('handles a break of a single day', () => {
    const out = planSessions(
      [at('mon', '09:00', '10:00')],
      week([{ label: 'Holiday', from: '2026-09-07', to: '2026-09-07' }]),
    )
    expect(out.map(s => s.date)).toEqual(['2026-09-14'])
  })

  it('treats break bounds as inclusive on both ends', () => {
    const out = planSessions(
      [at('mon', '09:00', '10:00'), at('tue', '09:00', '10:00'),
       at('wed', '09:00', '10:00'), at('thu', '09:00', '10:00'),
       at('fri', '09:00', '10:00')],
      week([{ label: 'Trip', from: '2026-09-08', to: '2026-09-10' }]),
    )
    const first = out.filter(s => s.date >= '2026-09-07' && s.date <= '2026-09-11')
    expect(first.map(s => s.date)).toEqual(['2026-09-07', '2026-09-11'])
  })

  it('includes both endpoints of the semester', () => {
    const out = planSessions([at('mon', '09:00', '10:00')], {
      label: 'T', semesterStart: '2026-09-07', semesterEnd: '2026-09-07', breaks: [],
    })
    expect(out.map(s => s.date)).toEqual(['2026-09-07'])
  })

  it('returns nothing when every meeting day falls inside a break', () => {
    // Empty is a legitimate answer, not a crash.
    const out = planSessions(
      [at('mon', '09:00', '10:00')],
      week([{ label: 'All of it', from: '2026-09-01', to: '2026-09-30' }]),
    )
    expect(out).toEqual([])
  })

  it('honours a calendar with nothing to do with the home campus', () => {
    // A term abroad: its own dates, its own holidays.
    const abroad: SemesterWindow = {
      label: 'Universidad de Sevilla',
      semesterStart: '2026-09-14',
      semesterEnd:   '2026-09-25',
      breaks: [{ label: 'Fiesta local', from: '2026-09-21', to: '2026-09-22' }],
    }
    const out = planSessions(
      [at('mon', '11:00', '12:30'), at('tue', '16:00', '17:30')], abroad)
    /* Mon 14th and Tue 15th run; the 21st and 22nd are the fiesta. */
    expect(out.map(s => s.date)).toEqual(['2026-09-14', '2026-09-15'])
    expect(out[1].startTime).toBe('16:00')
  })

  it('rejects a semester that ends before it starts', () => {
    expect(() => planSessions([at('mon', '09:00', '10:00')], {
      label: 'T', semesterStart: '2026-09-18', semesterEnd: '2026-09-07', breaks: [],
    })).toThrow(/ends before it starts/i)
  })

  it('rejects a class that ends before it starts', () => {
    expect(() => planSessions([at('mon', '10:00', '09:00')], week()))
      .toThrow(/end after it starts/i)
  })
})

describe('validateMeetings', () => {
  it('passes a well-formed set', () => {
    expect(validateMeetings([at('mon', '09:00', '09:50')])).toBeNull()
  })

  it('needs at least one day', () => {
    expect(validateMeetings([])).toMatch(/at least one/i)
  })

  it('catches a zero-length class', () => {
    // Would render as an invisible sliver in the week grid, forty times over.
    expect(validateMeetings([at('mon', '09:00', '09:00')])).toMatch(/end after it starts/i)
  })

  it('catches a duplicated day', () => {
    expect(validateMeetings([at('mon', '09:00', '10:00'), at('mon', '11:00', '12:00')]))
      .toMatch(/twice/i)
  })

  it('catches a missing time', () => {
    expect(validateMeetings([at('mon', '', '10:00')])).toMatch(/start and an end/i)
  })
})

describe('validateWindow', () => {
  const base = { label: 'T', semesterStart: '2026-09-07', semesterEnd: '2026-12-11' }

  it('passes a well-formed window', () => {
    expect(validateWindow({ ...base, breaks: [] })).toBeNull()
  })

  it('catches a break with no dates', () => {
    expect(validateWindow({ ...base, breaks: [{ label: 'Trip', from: '', to: '' }] }))
      .toMatch(/needs both dates/i)
  })

  it('catches an inverted break', () => {
    expect(validateWindow({ ...base,
      breaks: [{ label: 'Trip', from: '2026-10-10', to: '2026-10-01' }] }))
      .toMatch(/ends before it starts/i)
  })

  it('names the break it is complaining about', () => {
    const msg = validateWindow({ ...base,
      breaks: [{ label: 'Semana Santa', from: '2026-10-10', to: '2026-10-01' }] })
    expect(msg).toContain('Semana Santa')
  })

  it('catches a missing semester date', () => {
    expect(validateWindow({ ...base, semesterEnd: '', breaks: [] })).toMatch(/both semester dates/i)
  })
})

describe('parseHHMM', () => {
  it('reads a 24-hour time as minutes past midnight', () => {
    expect(parseHHMM('00:00')).toBe(0)
    expect(parseHHMM('09:05')).toBe(545)
    expect(parseHHMM('23:59')).toBe(1439)
  })

  it('refuses nonsense rather than guessing', () => {
    for (const bad of ['', '9:05', '24:00', '12:60', 'noon', '12']) {
      expect(() => parseHHMM(bad)).toThrow()
    }
  })
})

describe('windowForUniversity', () => {
  it('returns the campus calendar', () => {
    const w = windowForUniversity('CORNELL')
    expect(w.label).toMatch(/Cornell/)
    expect(w.semesterStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('copies the breaks so editing them cannot corrupt the registry', () => {
    const a = windowForUniversity('CORNELL')
    a.breaks[0].label = 'MUTATED'
    expect(windowForUniversity('CORNELL').breaks[0].label).not.toBe('MUTATED')
  })
})
