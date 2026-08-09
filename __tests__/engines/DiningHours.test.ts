/**
 * __tests__/engines/DiningHours.test.ts
 *
 * The clock is injected, so the cases that are normally untestable —
 * midnight, overnight service, a hall open only one day a week — are the
 * ones tested hardest. A dining indicator that is wrong is worse than
 * absent: you walk somewhere closed.
 */

import {
  evaluateStatus, describeStatus, sortRank, toMinutes, fmtTime,
  type OpeningWindow, type Weekday,
} from '@/lib/engines/DiningHours'

/** Local Date at a given weekday and time. 2026-08-09 is a Sunday. */
function at(day: Weekday, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2026, 7, 9 + day, h, m, 0, 0)
}

const win = (day: Weekday, open: string, close: string): OpeningWindow => ({ day, open, close })

describe('toMinutes / fmtTime', () => {
  it.each([['00:00', 0], ['07:30', 450], ['23:59', 1439]])('%s → %i', (s, n) => {
    expect(toMinutes(s)).toBe(n)
  })

  it.each(['', '7:5', '25:00', '12:60', 'noon'])('rejects %s', bad => {
    expect(Number.isNaN(toMinutes(bad))).toBe(true)
  })

  it.each([['00:00', '12am'], ['09:00', '9am'], ['12:00', '12pm'], ['13:30', '1:30pm'], ['20:00', '8pm']])(
    '%s renders as %s', (input, expected) => expect(fmtTime(input)).toBe(expected))
})

describe('open right now', () => {
  const hours = [win(1, '07:00', '20:00')]   // Mondays

  it('is open mid-service', () => {
    const s = evaluateStatus(hours, at(1, '12:00'))
    expect(s.state).toBe('open')
    if (s.state === 'open') expect(s.minutesLeft).toBe(480)
  })

  it('is open at the opening minute', () => {
    expect(evaluateStatus(hours, at(1, '07:00')).state).toBe('open')
  })

  it('is CLOSED at the closing minute', () => {
    // Exclusive upper bound: at 20:00 it has closed, not "closing".
    expect(evaluateStatus(hours, at(1, '20:00')).state).not.toBe('open')
  })

  it('warns when closing soon', () => {
    expect(describeStatus(evaluateStatus(hours, at(1, '19:45')))).toMatch(/Closing in 15 min/)
  })
})

describe('overnight service', () => {
  // Late-night dining: 21:00 Friday through 01:00 Saturday.
  const hours = [win(5, '21:00', '01:00')]

  it('is open before midnight', () => {
    expect(evaluateStatus(hours, at(5, '23:30')).state).toBe('open')
  })

  it('is still open after midnight, on the following day', () => {
    // The window belongs to Friday; at 00:30 it is Saturday. Ignoring
    // this is what makes a late-night indicator wrong exactly when it
    // matters most.
    expect(evaluateStatus(hours, at(6, '00:30')).state).toBe('open')
  })

  it('is closed after the overnight window ends', () => {
    expect(evaluateStatus(hours, at(6, '01:30')).state).not.toBe('open')
  })

  it('is closed before it opens', () => {
    expect(evaluateStatus(hours, at(5, '20:00')).state).not.toBe('open')
  })
})

describe('opening later', () => {
  const hours = [win(1, '07:00', '10:00'), win(1, '17:00', '20:00')]

  it('reports the next window today', () => {
    const s = evaluateStatus(hours, at(1, '12:00'))
    expect(s.state).toBe('opens_later')
    if (s.state === 'opens_later') expect(s.opensAt).toBe('17:00')
  })

  it('counts minutes when opening within the hour', () => {
    expect(describeStatus(evaluateStatus(hours, at(1, '16:30')))).toMatch(/Opens in 30 min/)
  })

  it('picks the earliest upcoming window, not the first listed', () => {
    const reversed = [win(1, '17:00', '20:00'), win(1, '07:00', '10:00')]
    const s = evaluateStatus(reversed, at(1, '06:00'))
    if (s.state === 'opens_later') expect(s.opensAt).toBe('07:00')
  })
})

describe('opening on another day', () => {
  it('says tomorrow when the next day has service', () => {
    const s = evaluateStatus([win(2, '08:00', '18:00')], at(1, '21:00'))
    expect(s.state).toBe('opens_next')
    if (s.state === 'opens_next') expect(s.dayLabel).toBe('tomorrow')
  })

  it('names the day when it is further out', () => {
    // Open Saturdays only, asked on Monday.
    const s = evaluateStatus([win(6, '10:00', '14:00')], at(1, '12:00'))
    expect(s.state).toBe('opens_next')
    if (s.state === 'opens_next') expect(s.dayLabel).toBe('Saturday')
  })

  it('wraps around the week', () => {
    // Open Sundays only, asked on Saturday evening.
    const s = evaluateStatus([win(0, '10:00', '14:00')], at(6, '20:00'))
    expect(s.state).toBe('opens_next')
    if (s.state === 'opens_next') expect(s.dayLabel).toBe('tomorrow')
  })
})

describe('degenerate input', () => {
  it('reports no hours for an empty schedule', () => {
    expect(evaluateStatus([], at(1, '12:00')).state).toBe('no_hours')
  })

  it('ignores malformed windows rather than crashing', () => {
    const s = evaluateStatus(
      [{ day: 1, open: 'noon', close: 'later' }, win(1, '07:00', '20:00')],
      at(1, '12:00'),
    )
    expect(s.state).toBe('open')
  })

  it('never throws for any weekday and hour', () => {
    const hours = [win(1, '07:00', '20:00'), win(5, '21:00', '01:00')]
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        expect(() => evaluateStatus(hours, at(d as Weekday, `${String(h).padStart(2, '0')}:00`))).not.toThrow()
      }
    }
  })
})

describe('sortRank', () => {
  it('puts open halls first and unknown ones last', () => {
    const ranks = [
      evaluateStatus([win(1, '07:00', '20:00')], at(1, '12:00')),  // open
      evaluateStatus([win(1, '17:00', '20:00')], at(1, '12:00')),  // opens later
      evaluateStatus([win(2, '08:00', '18:00')], at(1, '21:00')),  // opens next
      evaluateStatus([], at(1, '12:00')),                          // no hours
    ].map(sortRank)

    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(ranks[0]).toBeLessThan(ranks[3])
  })
})
