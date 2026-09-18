/**
 * Habit amounts that are not whole numbers.
 *
 * The step field was a `type="number"` with `min={1}` whose onChange ran
 * `Math.max(1, Number(value))`. Two things followed. Clearing it gave
 * "", which Number reads as 0, which the clamp turned back into 1 — so
 * backspace put a 1 in as fast as it could be deleted and the field
 * could not be edited at all. And a decimal was unreachable, because
 * "0.5" cannot be typed without passing through "0".
 *
 * Allowing decimals brings binary floating point, which is the part
 * that is not cosmetic: ten steps of 0.1 sum to 0.9999999999999999, so
 * a goal of 1 would never be met and the streak would never increment.
 */

import { roundAmount, formatAmount, parseAmount, AMOUNT_PRECISION } from '@/utils/habitAmount'
import { db, type Habit } from '@/lib/db'
import { addHabitProgress } from '@/lib/habitSync'

describe('parseAmount', () => {
  it('reads plain and decimal amounts', () => {
    expect(parseAmount('1')).toBe(1)
    expect(parseAmount('0.5')).toBe(0.5)
    expect(parseAmount('20')).toBe(20)
    expect(parseAmount('  2.25  ')).toBe(2.25)
  })

  it('returns null for a field being typed into rather than a value', () => {
    // The old code turned each of these into 1 and wrote it straight
    // back into the box, which is what made the field feel locked.
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('   ')).toBeNull()
    expect(parseAmount('.')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('-')).toBeNull()
  })

  it('accepts the intermediate states of typing a decimal', () => {
    // Typing "0.5" passes through "0" and "0.". Rejecting either would
    // put the field back where it started.
    expect(parseAmount('0')).toBe(0)
    expect(parseAmount('0.')).toBe(0)
    expect(parseAmount('0.5')).toBe(0.5)
  })
})

describe('roundAmount', () => {
  it('leaves whole numbers exactly as they were', () => {
    // Every habit that existed before decimals has an integer step and
    // an integer goal, and has to keep behaving identically.
    for (const n of [0, 1, 5, 20, 140, 1000]) expect(roundAmount(n)).toBe(n)
  })

  it('removes the error that stops a goal from ever being reached', () => {
    let count = 0
    for (let i = 0; i < 10; i++) count = roundAmount(count + 0.1)

    expect(count).toBe(1)
    expect(count >= 1).toBe(true)

    /* Without the rounding this is the value, and it is short. */
    let raw = 0
    for (let i = 0; i < 10; i++) raw = raw + 0.1
    expect(raw).toBeLessThan(1)
  })

  it('keeps three decimals', () => {
    expect(AMOUNT_PRECISION).toBe(3)
    expect(roundAmount(0.125)).toBe(0.125)
    expect(roundAmount(1 / 3)).toBe(0.333)
  })
})

describe('formatAmount', () => {
  it('prints a whole amount whole', () => {
    expect(formatAmount(20)).toBe('20')
    expect(formatAmount(1)).toBe('1')
  })

  it('prints a fraction without the noise', () => {
    expect(formatAmount(0.1 + 0.2)).toBe('0.3')
    expect(formatAmount(1.5)).toBe('1.5')
    expect(formatAmount(2.25)).toBe('2.25')
  })
})

describe('a habit whose step is a fraction', () => {

  beforeEach(async () => {
    await db.habits.clear()
    await db.habitCompletions.clear()
    localStorage.clear()
  })

  async function makeHabit(over: Partial<Habit> = {}): Promise<number> {
    return db.habits.add({
      name: 'Walk', frequency: 'daily', streakCount: 0,
      lastCompletedDate: null, category: 'Life', activeDays: [],
      targetCompletions: 1, stepAmount: 0.1, stepLabel: 'mi',
      createdAt: Date.now(), ...over,
    } as Habit) as Promise<number>
  }

  it('reaches its goal on the tap that should reach it', async () => {
    const id = await makeHabit()

    let completedOn: number | null = null
    for (let i = 1; i <= 10; i++) {
      const r = await addHabitProgress(id, 0.1, '2026-09-18')
      if (r?.completedNow) completedOn = i
    }

    /* The tenth tap, not never. Unrounded the sum is
       0.9999999999999999 and the habit stays unfinished forever while
       displaying a full-looking count. */
    expect(completedOn).toBe(10)

    const row = await db.habitCompletions
      .where('[habitId+date]').equals([id, '2026-09-18']).first()
    expect(row?.count).toBe(1)
  })

  it('increments the streak, so the day is actually credited', async () => {
    const id = await makeHabit()
    for (let i = 0; i < 10; i++) await addHabitProgress(id, 0.1, '2026-09-18')

    const habit = await db.habits.get(id)
    expect(habit?.streakCount).toBe(1)
    expect(habit?.lastCompletedDate).toBe('2026-09-18')
  })

  it('stores a partial count as a clean number', async () => {
    const id = await makeHabit()
    for (let i = 0; i < 3; i++) await addHabitProgress(id, 0.1, '2026-09-18')

    const row = await db.habitCompletions
      .where('[habitId+date]').equals([id, '2026-09-18']).first()
    expect(row!.count).toBe(0.3)
    expect(formatAmount(row!.count)).toBe('0.3')
  })

  it('leaves a whole-number habit behaving exactly as before', async () => {
    const id = await makeHabit({ targetCompletions: 20, stepAmount: 5, stepLabel: 'oz' })

    for (let i = 0; i < 3; i++) await addHabitProgress(id, 5, '2026-09-18')
    let habit = await db.habits.get(id)
    expect(habit?.streakCount).toBe(0)

    const r = await addHabitProgress(id, 5, '2026-09-18')
    expect(r?.completedNow).toBe(true)
    expect(r?.newCount).toBe(20)

    habit = await db.habits.get(id)
    expect(habit?.streakCount).toBe(1)
  })
})
