/**
 * Skipping a day.
 *
 * "Some days the habit isn't required" — shaving, a rest day, a habit
 * that genuinely doesn't apply today. A skip has to act as if the habit
 * was never scheduled that day at all: not done, not missed, invisible
 * to the streak, the consistency ratio and the grit average. Getting
 * that half right (excluding it from the schedule but not from the
 * streak-continuity chain, say) would either quietly erase a real
 * streak or quietly let a habit fall behind without anyone noticing.
 */

import {
  isHabitScheduledOn, isSkippedOn, previousScheduledDate,
} from '@/utils/habitSchedule'
import { detectBrokenStreaks, computeCompletionSeries } from '@/utils/habitAnalytics'
import { db, type Habit, type HabitCompletion } from '@/lib/db'
import { addHabitProgress } from '@/lib/habitSync'
import { toggleHabitSkip } from '@/lib/habitSync'

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 1, name: 'Shave', frequency: 'daily', activeDays: [],
  targetCompletions: 1, streakCount: 0, lastCompletedDate: null,
  category: 'General', createdAt: new Date(2026, 0, 1).getTime(),
  ...over,
} as Habit)

/* ── Pure schedule logic ─────────────────────────────────────────── */

describe('isHabitScheduledOn with a skip', () => {
  it('is false for a skipped date, whatever the frequency would say', () => {
    const daily = habit({ skippedDates: ['2026-09-18'] })
    expect(isHabitScheduledOn(daily, '2026-09-18')).toBe(false)
    expect(isHabitScheduledOn(daily, '2026-09-19')).toBe(true)

    const weekly = habit({
      frequency: 'specific_days', activeDays: [3], // Wednesday
      skippedDates: ['2026-09-16'],                // also a Wednesday
    })
    expect(isHabitScheduledOn(weekly, '2026-09-16')).toBe(false)
    expect(isHabitScheduledOn(weekly, '2026-09-23')).toBe(true)
  })

  it('leaves an unskipped date alone', () => {
    expect(isSkippedOn(habit({ skippedDates: ['2026-09-18'] }), '2026-09-19')).toBe(false)
    expect(isSkippedOn(habit(), '2026-09-18')).toBe(false)
  })
})

describe('previousScheduledDate walks straight past a skip', () => {
  it('for a daily habit', () => {
    const h = habit({ skippedDates: ['2026-09-17'] })
    // 2026-09-18 is a Friday; 17th (skipped) then 16th.
    expect(previousScheduledDate(h, '2026-09-18')).toBe('2026-09-16')
  })

  it('over more than one consecutive skipped day', () => {
    const h = habit({ skippedDates: ['2026-09-16', '2026-09-17'] })
    expect(previousScheduledDate(h, '2026-09-18')).toBe('2026-09-15')
  })

  it('for a specific-days habit, past its own off days as usual', () => {
    // Mon/Wed/Fri. Skip Friday the 18th; the walk should land on
    // Wednesday the 16th, not trip over Thu/Sat/Sun in between either.
    const h = habit({
      frequency: 'specific_days', activeDays: [1, 3, 5],
      skippedDates: ['2026-09-18'],
    })
    expect(previousScheduledDate(h, '2026-09-20')).toBe('2026-09-16')
  })

  it('for a biweekly habit, whose occurrence math is a single date', () => {
    const h = habit({
      frequency: 'biweekly', startDate: '2026-08-01',
      skippedDates: ['2026-08-29'],   // the occurrence 4 weeks in
    })
    // 2026-09-12 is the next occurrence after the skipped one.
    expect(previousScheduledDate(h, '2026-09-12')).toBe('2026-08-15')
  })

  it('for a monthly habit, same idea', () => {
    const h = habit({
      frequency: 'monthly', monthlyMode: 'date', startDate: '2026-06-10',
      skippedDates: ['2026-08-10'],
    })
    expect(previousScheduledDate(h, '2026-09-10')).toBe('2026-07-10')
  })
})

/* ── Streak continuity ───────────────────────────────────────────── */

describe('detectBrokenStreaks respects a skip', () => {
  it('leaves a daily streak alive across a single skipped day', () => {
    // Completed the 16th, skipped the 17th, today is the 18th.
    const h = habit({
      streakCount: 5, lastCompletedDate: '2026-09-16',
      skippedDates: ['2026-09-17'],
    })
    expect(detectBrokenStreaks([h], '2026-09-18')).toEqual([])
  })

  it('leaves it alive across several skipped days in a row', () => {
    const h = habit({
      streakCount: 5, lastCompletedDate: '2026-09-14',
      skippedDates: ['2026-09-15', '2026-09-16', '2026-09-17'],
    })
    expect(detectBrokenStreaks([h], '2026-09-18')).toEqual([])
  })

  it('still catches a genuine miss — a scheduled day that was neither done nor skipped', () => {
    const h = habit({ streakCount: 5, lastCompletedDate: '2026-09-14' })
    expect(detectBrokenStreaks([h], '2026-09-18')).toEqual([
      { habitId: 1, name: 'Shave', lostStreak: 5 },
    ])
  })

  it('no longer flags a specific-days habit on its own off day', () => {
    // Mon/Wed/Fri, completed Monday the 14th. Tuesday the 15th is not
    // due — the old calendar-day gap would already call this broken.
    const h = habit({
      frequency: 'specific_days', activeDays: [1, 3, 5],
      streakCount: 3, lastCompletedDate: '2026-09-14',
    })
    expect(detectBrokenStreaks([h], '2026-09-15')).toEqual([])
  })
})

/* ── Grit / consistency ──────────────────────────────────────────── */

describe('computeCompletionSeries excludes a skipped day', () => {
  it('from the average, exactly as if the habit had no demand that day', () => {
    const completions: HabitCompletion[] = [
      { id: 1, habitId: 1, date: '2026-09-17', count: 1 },
    ]
    const skippedToday = habit({ skippedDates: ['2026-09-18'] })
    const points = computeCompletionSeries([skippedToday], completions, 2, '2026-09-18')

    // Yesterday: done in full → 100. Today: skipped → no demand → 0,
    // which is the series' "nothing was due" value, not a missed 0%.
    expect(points[0]).toMatchObject({ dateISO: '2026-09-17', score: 100 })
    expect(points[1]).toMatchObject({ dateISO: '2026-09-18', score: 0 })
  })
})

/* ── The write path (lib/habitSync.ts) ──────────────────────────── */

describe('toggleHabitSkip', () => {
  beforeEach(async () => {
    await db.habits.clear()
    await db.habitCompletions.clear()
  })

  async function makeHabit(over: Partial<Habit> = {}): Promise<number> {
    return db.habits.add({
      name: 'Shave', frequency: 'daily', streakCount: 0,
      lastCompletedDate: null, category: 'General', activeDays: [],
      targetCompletions: 1, createdAt: Date.now(), ...over,
    } as Habit) as Promise<number>
  }

  it('marks an empty day skipped, then reverses it', async () => {
    const id = await makeHabit()

    expect(await toggleHabitSkip(id, '2026-09-18')).toBe('skipped')
    let row = await db.habits.get(id)
    expect(row?.skippedDates).toEqual(['2026-09-18'])

    expect(await toggleHabitSkip(id, '2026-09-18')).toBe('unskipped')
    row = await db.habits.get(id)
    expect(row?.skippedDates).toEqual([])
  })

  it('refuses to skip a day that already has logged progress', async () => {
    const id = await makeHabit()
    await addHabitProgress(id, 1, '2026-09-18')

    expect(await toggleHabitSkip(id, '2026-09-18')).toBeNull()
    const row = await db.habits.get(id)
    expect(row?.skippedDates ?? []).toEqual([])

    // The completion itself is untouched — a refused skip is not a
    // silent delete.
    const completion = await db.habitCompletions
      .where('[habitId+date]').equals([id, '2026-09-18']).first()
    expect(completion?.count).toBe(1)
  })

  it('makes a tap on that day a no-op while skipped', async () => {
    const id = await makeHabit()
    await toggleHabitSkip(id, '2026-09-18')

    const result = await addHabitProgress(id, 1, '2026-09-18')
    expect(result).toBeNull()

    const completion = await db.habitCompletions
      .where('[habitId+date]').equals([id, '2026-09-18']).first()
    expect(completion).toBeUndefined()
  })

  it('leaves the streak untouched by the toggle itself', async () => {
    const id = await makeHabit({ streakCount: 5, lastCompletedDate: '2026-09-16' })
    await toggleHabitSkip(id, '2026-09-18')

    const row = await db.habits.get(id)
    expect(row?.streakCount).toBe(5)
    expect(row?.lastCompletedDate).toBe('2026-09-16')
  })

  it('end to end: a skipped day does not break a streak completed either side of it', async () => {
    const id = await makeHabit()

    await addHabitProgress(id, 1, '2026-09-16')
    let row = await db.habits.get(id)
    expect(row?.streakCount).toBe(1)

    await toggleHabitSkip(id, '2026-09-17')

    // The 18th's completion should still see the 16th as "yesterday's
    // occurrence" and continue the streak, not reset it to 1.
    await addHabitProgress(id, 1, '2026-09-18')
    row = await db.habits.get(id)
    expect(row?.streakCount).toBe(2)
  })
})
