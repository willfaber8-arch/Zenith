/**
 * A task that comes back.
 *
 * The behaviour worth pinning is what "next" means when you tick a
 * chore late. Get it wrong in one direction and the task reappears with
 * a date already in the past; get it wrong in the other and three
 * missed weeks arrive at once as three separate obligations.
 */

import {
  nextDueDate, advanceOnComplete, presetOf, ruleFor, isRepeatPreset,
  REPEAT_LABEL, REPEAT_BADGE,
} from '@/utils/taskRepeat'

/* 2026-09-08 is a Tuesday; 2026-09-11 a Friday. */
const TUE = '2026-09-08'
const on  = (iso: string, h = 12) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, h)
}

describe('reading the preset off a task', () => {
  it('treats an absent or unknown value as not repeating', () => {
    expect(presetOf({})).toBe('none')
    expect(presetOf({ repeat: undefined })).toBe('none')
    expect(presetOf({ repeat: 'every other thursday' })).toBe('none')
  })

  it('reads the ones it knows', () => {
    expect(presetOf({ repeat: 'weekly' })).toBe('weekly')
    expect(isRepeatPreset('weekdays')).toBe(true)
    expect(isRepeatPreset('hourly')).toBe(false)
  })

  it('has a label and a badge for every preset', () => {
    for (const p of ['none', 'daily', 'weekdays', 'weekly', 'fortnightly', 'monthly', 'yearly'] as const) {
      expect(REPEAT_LABEL[p]).toBeTruthy()
      expect(typeof REPEAT_BADGE[p]).toBe('string')
    }
    expect(REPEAT_BADGE.none).toBe('')   // the common case stays unlabelled
  })

  it('gives no rule for "none"', () => {
    expect(ruleFor('none')).toBeNull()
  })
})

describe('the next date, ticked on time', () => {
  it('moves a weekly task on by a week', () => {
    expect(nextDueDate(TUE, 'weekly', on(TUE))).toBe('2026-09-15')
  })

  it('moves a daily task on by a day', () => {
    expect(nextDueDate(TUE, 'daily', on(TUE))).toBe('2026-09-09')
  })

  it('moves a fortnightly task on by two weeks', () => {
    expect(nextDueDate(TUE, 'fortnightly', on(TUE))).toBe('2026-09-22')
  })

  it('moves a monthly task on by a month', () => {
    expect(nextDueDate(TUE, 'monthly', on(TUE))).toBe('2026-10-08')
  })

  it('moves a yearly task on by a year', () => {
    expect(nextDueDate(TUE, 'yearly', on(TUE))).toBe('2027-09-08')
  })
})

describe('ticked late', () => {
  /*
   * The whole point. Bins were due Tuesday and you did them Friday.
   * Next Tuesday is the answer — not last Tuesday, which is already
   * gone, and not a queue of the Tuesdays you missed.
   */
  it('skips to the next future occurrence, not the one just missed', () => {
    expect(nextDueDate(TUE, 'weekly', on('2026-09-11'))).toBe('2026-09-15')
  })

  it('never returns a date in the past, however late you are', () => {
    const next = nextDueDate(TUE, 'weekly', on('2026-11-20'))!
    expect(next > '2026-11-20').toBe(true)
  })

  it('does not accumulate the weeks you missed', () => {
    /* Six weeks late is still one next occurrence, not six. */
    const next = nextDueDate(TUE, 'weekly', on('2026-10-20'))
    expect(next).toBe('2026-10-27')
  })
})

describe('weekdays', () => {
  it('goes Friday to Monday, skipping the weekend', () => {
    expect(nextDueDate('2026-09-11', 'weekdays', on('2026-09-11'))).toBe('2026-09-14')
  })

  it('goes Monday to Tuesday inside the week', () => {
    expect(nextDueDate('2026-09-14', 'weekdays', on('2026-09-14'))).toBe('2026-09-15')
  })

  it('never lands on a weekend', () => {
    let d = '2026-09-14'
    for (let i = 0; i < 12; i++) {
      d = nextDueDate(d, 'weekdays', on(d))!
      const day = new Date(...(d.split('-').map(Number) as [number, number, number]))
      const dow = new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8))).getDay()
      expect(dow).toBeGreaterThanOrEqual(1)
      expect(dow).toBeLessThanOrEqual(5)
      expect(day).toBeInstanceOf(Date)
    }
  })
})

describe('advancing a task on completion', () => {
  it('leaves a one-off task alone, so it completes normally', () => {
    expect(advanceOnComplete({ dueDate: TUE })).toBeNull()
    expect(advanceOnComplete({ dueDate: TUE, repeat: 'none' })).toBeNull()
  })

  it('moves a repeating task to its next date', () => {
    expect(advanceOnComplete({ dueDate: TUE, repeat: 'weekly' }, on(TUE)))
      .toEqual({ dueDate: '2026-09-15' })
  })

  /*
   * A repeating task with no date has nothing to advance from. Better
   * to complete it like anything else than to invent a schedule.
   */
  it('completes normally when there is no date to advance', () => {
    expect(advanceOnComplete({ dueDate: '', repeat: 'weekly' })).toBeNull()
  })

  it('completes normally when the date cannot be read', () => {
    expect(advanceOnComplete({ dueDate: 'someday', repeat: 'weekly' })).toBeNull()
  })
})

describe('month ends', () => {
  /*
   * Not asserting a specific answer for 31 January + 1 month — there
   * isn't a single right one. What must hold is that it produces a
   * real, later date rather than an invalid one that silently becomes
   * March.
   */
  it('gives a real later date from the 31st', () => {
    const next = nextDueDate('2026-01-31', 'monthly', on('2026-01-31'))
    expect(next).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(next! > '2026-01-31').toBe(true)
    const [y, m, d] = next!.split('-').map(Number)
    const real = new Date(y, m - 1, d)
    expect(real.getMonth()).toBe(m - 1)   // the day did not overflow the month
  })
})

describe('ticked early', () => {
  /*
   * Caught by running it rather than by reasoning about it: with the
   * cutoff at "today", a chore due in 2030 ticked in 2026 advanced to
   * the 2030 date it already had — the first occurrence after today is
   * the one it is sitting on. The next date has to clear the due date
   * as well as today.
   */
  it('moves a future task on from its own due date, not to it', () => {
    const next = nextDueDate('2030-03-05', 'weekly', on('2026-09-09'))
    expect(next).toBe('2030-03-12')
    expect(next).not.toBe('2030-03-05')
  })

  it('advances a future daily task by one day', () => {
    expect(nextDueDate('2030-03-05', 'daily', on('2026-09-09'))).toBe('2030-03-06')
  })

  it('still handles the late case the other way round', () => {
    expect(nextDueDate(TUE, 'weekly', on('2026-09-11'))).toBe('2026-09-15')
  })
})
