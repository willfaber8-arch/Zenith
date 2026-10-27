/**
 * The daily check-in: five sliders, and what they add up to.
 *
 * Asked for as "shorter, and it should actually calculate something".
 * So these pin the calculations: category scores that read the right way
 * round (stress is the one where more is worse), today against your own
 * usual, and links between how you feel and what you did — which must
 * only appear when there are enough days on both sides to mean anything.
 */

import {
  CHECKIN_QUESTIONS, toScore, wellbeingOf, categoryScores, overallScore, bandLabel,
  answersFromLog, hasFullCheckin, compareToUsual, describeDelta, wellbeingSeries,
  findLinks, buildFactorDays, habitDayStats, MIN_DAYS_PER_SIDE,
  type CheckinAnswers, type CheckinSource,
} from '@/utils/emotionCheckin'
import { isLoggableDate, nearestMood, MOOD_MAP } from '@/utils/mentalHealthLog'
import { addDaysISO } from '@/utils/localDate'
import type { Habit } from '@/lib/db'

const all = (v: number): CheckinAnswers => ({ mood: v, stress: v, energy: v, focus: v, connection: v })
const day = (logDate: string, checkin: CheckinAnswers): CheckinSource => ({ logDate, checkin })

describe('the questions', () => {
  it('are five, on one screen', () => {
    expect(CHECKIN_QUESTIONS.map(q => q.key)).toEqual(['mood', 'stress', 'energy', 'focus', 'connection'])
  })
})

describe('category scores', () => {
  it('maps 1–10 onto 0–100', () => {
    expect(toScore(1)).toBe(0)
    expect(toScore(10)).toBe(100)
    expect(toScore(5)).toBe(44)
  })

  it('counts stress the other way round for wellbeing — and shows it as stress', () => {
    expect(wellbeingOf('mood', 10)).toBe(100)
    expect(wellbeingOf('stress', 10)).toBe(0)
    expect(wellbeingOf('stress', 1)).toBe(100)
    const stress = categoryScores({ stress: 9 })[0]
    expect(stress.score).toBe(89)
    expect(stress.band).toBe('High')
    expect(stress.tone).toBe('bad')
  })

  it('names each band in the category\'s own terms', () => {
    expect(bandLabel('mood', 90)).toBe('Good')
    expect(bandLabel('mood', 10)).toBe('Very low')
    expect(bandLabel('stress', 10)).toBe('Low')
  })

  it('an overall score needs at least three answers', () => {
    expect(overallScore({ stress: 2, energy: 9 })).toBeNull()
    expect(overallScore({ mood: 10, stress: 1, energy: 10 })).toBe(100)
    expect(overallScore({ mood: 1, stress: 10, energy: 1 })).toBe(0)
  })

  it('ignores garbage rather than counting it as zero', () => {
    expect(categoryScores({ mood: NaN, energy: 'x' as unknown as number, focus: 10 }).map(c => c.key)).toEqual(['focus'])
    expect(categoryScores({ mood: 42 })[0].score).toBe(100)
  })
})

describe('reading a log', () => {
  it('reads slider answers as they are', () => {
    const log = { logDate: '2026-10-20', stressLevel: 3, energyLevel: 3, checkin: all(7) }
    expect(answersFromLog(log)).toEqual(all(7))
    expect(hasFullCheckin(log)).toBe(true)
  })

  it('maps an old twelve-question check-in onto the five categories', () => {
    const a = answersFromLog({
      logDate: '2026-10-01',
      emotions: { happy: 4, sad: 0, anxious: 4, overwhelmed: 4, angry: 4, energy: 0, rested: 0, focused: 2, connected: 4, lonely: 0 },
    })
    expect(a).toEqual({ mood: 10, stress: 10, energy: 1, focus: 6, connection: 10 })
  })

  it('a mood-only day still has its stress and energy', () => {
    const log = { logDate: '2026-09-01', stressLevel: 8, energyLevel: 2 }
    expect(answersFromLog(log)).toEqual({ stress: 8, energy: 2 })
    expect(hasFullCheckin(log)).toBe(false)
  })
})

describe('compared with your usual', () => {
  const date = '2026-10-27'
  const history = [1, 2, 3, 4, 5].map(n => day(addDaysISO(date, -n), all(5)))

  it('compares today with the days before it, never with itself', () => {
    const withToday = [...history, day(date, all(10))]
    const mood = compareToUsual(date, all(10), withToday).find(c => c.key === 'mood')!
    expect(mood.avg30).toBe(44)
    expect(mood.delta).toBe(56)
    expect(mood.better).toBe(true)
    expect(mood.notable).toBe(true)
    expect(describeDelta(mood)).toBe('56 above your usual')
  })

  it('more stress than usual is worse, not better', () => {
    const stress = compareToUsual(date, { stress: 9 }, history)[0]
    expect(stress.delta).toBeGreaterThan(0)
    expect(stress.better).toBe(false)
  })

  it('says nothing until there are enough days to call it usual', () => {
    const c = compareToUsual(date, all(9), history.slice(0, 2))[0]
    expect(c.delta).toBeNull()
    expect(describeDelta(c)).toBeNull()
  })

  it('a small difference is "about your usual"', () => {
    const c = compareToUsual(date, all(5), history)[0]
    expect(describeDelta(c)).toBe('About your usual')
  })

  it('the chart series is oldest first and skips days without an overall', () => {
    const s = wellbeingSeries([day('2026-10-26', all(10)), { logDate: '2026-10-25', stressLevel: 5, energyLevel: 5 }, day('2026-10-20', all(1))], date)
    expect(s.map(p => p.date)).toEqual(['2026-10-20', '2026-10-26'])
  })
})

describe('links to your other data', () => {
  // Ten days: the even ones had a workout and felt better.
  const dates = Array.from({ length: 10 }, (_, i) => addDaysISO('2026-10-01', i))
  const workout = new Set(dates.filter((_, i) => i % 2 === 0))
  const history = dates.map((d, i) => day(d, i % 2 === 0
    ? { mood: 6, stress: 4, energy: 9, focus: 6, connection: 6 }
    : { mood: 6, stress: 4, energy: 3, focus: 6, connection: 6 }))

  it('reports the metric that moves most, as a plain sentence', () => {
    const [link] = findLinks(history, { workout })
    expect(link.factor).toBe('workout')
    expect(link.metric).toBe('energy')
    expect(link.diff).toBe(67)
    expect(link.better).toBe(true)
    expect(link.sentence).toBe('On days you work out, your energy averages 67 points higher.')
    expect(link.withDays).toBe(5)
    expect(link.withoutDays).toBe(5)
  })

  it('needs enough days on both sides', () => {
    const few = new Set(dates.slice(0, MIN_DAYS_PER_SIDE - 1))
    expect(findLinks(history, { workout: few })).toEqual([])
  })

  it('stays quiet about small differences', () => {
    const flat = dates.map(d => day(d, all(6)))
    expect(findLinks(flat, { workout })).toEqual([])
  })

  it('a link with more stress is marked as the worse side', () => {
    const busy = new Set(dates.slice(0, 5))
    const h = dates.map((d, i) => day(d, { ...all(6), stress: i < 5 ? 9 : 3 }))
    const [link] = findLinks(h, { busy })
    expect(link.metric).toBe('stress')
    expect(link.better).toBe(false)
    expect(link.sentence).toBe('On days with 3+ tasks due, your stress averages 67 points higher.')
  })

  it('only counts check-in days inside the window', () => {
    expect(findLinks(history, { workout }, { from: '2026-10-08' })).toEqual([])
  })
})

describe('building the factor days', () => {
  it('a busy day is three or more tasks due; habits kept means most of them', () => {
    const f = buildFactorDays({
      workoutDates: ['2026-10-01'], focusDates: [], readingDates: [],
      taskDueDates: ['2026-10-02', '2026-10-02T23:59', '2026-10-02', '2026-10-03', 'garbage'],
      habitDays: [
        { date: '2026-10-01', scheduled: 4, done: 3 },
        { date: '2026-10-02', scheduled: 4, done: 2 },
        { date: '2026-10-03', scheduled: 0, done: 0 },
      ],
    })
    expect([...f.busy!]).toEqual(['2026-10-02'])
    expect([...f.habits!]).toEqual(['2026-10-01'])
    expect(f.workout!.has('2026-10-01')).toBe(true)
  })

  it('habit days follow the schedule, the creation date and stay-under goals', () => {
    const base = { frequency: 'daily', streakCount: 0, lastCompletedDate: null, category: '', activeDays: [] } as unknown as Habit
    const habits = [
      { ...base, id: 1, name: 'walk', targetCompletions: 1, createdAt: new Date(2026, 9, 1).getTime() },
      { ...base, id: 2, name: 'no soda', targetCompletions: 0, goalType: 'at_most', createdAt: new Date(2026, 9, 1).getTime() },
      { ...base, id: 3, name: 'new', targetCompletions: 1, createdAt: new Date(2026, 9, 3).getTime() },
      { ...base, id: 4, name: 'skipped', targetCompletions: 1, createdAt: new Date(2026, 9, 1).getTime(), skippedDates: ['2026-10-02'] },
    ] as Habit[]
    const stats = habitDayStats(habits, [
      { habitId: 1, date: '2026-10-02', count: 1 },
      { habitId: 2, date: '2026-10-02', count: 2 },
    ], '2026-10-02', '2026-10-03')
    expect(stats[0]).toEqual({ date: '2026-10-02', scheduled: 2, done: 1 })
    expect(stats[1]).toEqual({ date: '2026-10-03', scheduled: 4, done: 1 })
  })
})

describe('saving', () => {
  it('a check-in always has a mood the calendar can show', () => {
    for (let s = 1; s <= 10; s++) for (let e = 1; e <= 10; e++) {
      expect(MOOD_MAP[nearestMood(s, e).key]).toBeDefined()
    }
  })

  it('any past day stays editable, the future does not', () => {
    expect(isLoggableDate('2026-10-26', '2026-10-27')).toBe(true)
    expect(isLoggableDate('2026-10-28', '2026-10-27')).toBe(false)
    expect(isLoggableDate('yesterday', '2026-10-27')).toBe(false)
  })
})
