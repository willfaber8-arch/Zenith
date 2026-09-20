/**
 * Undoing a habit tap.
 *
 * A tap can't be reversed by running its own arithmetic backwards: once
 * the count has moved, whether it continued a streak or started a fresh
 * one after a break is a decision that has already been made and thrown
 * away, and there is no way to tell the two apart from where things
 * stand afterward. So undo works by snapshot instead — capture the
 * row(s) right before the tap, put them back exactly — the same shape
 * as the calendar's captureUndo/applyUndo. These tests are about proving
 * that restoration is exact: the streak, the all-time high, and whether
 * a same-day completion row exists at all.
 */

import { db, type Habit } from '@/lib/db'
import { addHabitProgress, captureHabitTap, revertHabitTap } from '@/lib/habitSync'

const makeHabit = (over: Partial<Habit> = {}): Promise<number> =>
  db.habits.add({
    name: 'Read', frequency: 'daily', streakCount: 0,
    lastCompletedDate: null, category: 'General', activeDays: [],
    targetCompletions: 20, stepAmount: 5, allTimeHighStreak: 0,
    createdAt: Date.now(), ...over,
  } as Habit) as Promise<number>

beforeEach(async () => {
  await db.habits.clear()
  await db.habitCompletions.clear()
})

describe('captureHabitTap', () => {
  it('returns null for a habit that does not exist', async () => {
    expect(await captureHabitTap(999, '2026-09-18')).toBeNull()
  })

  it('records no prior completion when the day is untouched', async () => {
    const id = await makeHabit()
    const snap = await captureHabitTap(id, '2026-09-18')
    expect(snap?.completionBefore).toBeNull()
    expect(snap?.habitBefore.streakCount).toBe(0)
  })

  it('records the exact completion row when one already exists', async () => {
    const id = await makeHabit()
    await addHabitProgress(id, 5, '2026-09-18')
    const snap = await captureHabitTap(id, '2026-09-18')
    expect(snap?.completionBefore?.count).toBe(5)
  })
})

describe('revertHabitTap', () => {
  it('deletes the completion row a first tap of the day created', async () => {
    const id = await makeHabit()
    const snap = await captureHabitTap(id, '2026-09-18')
    await addHabitProgress(id, 5, '2026-09-18')

    let row = await db.habitCompletions
      .where('[habitId+date]').equals([id, '2026-09-18']).first()
    expect(row?.count).toBe(5)

    await revertHabitTap(snap!)

    row = await db.habitCompletions
      .where('[habitId+date]').equals([id, '2026-09-18']).first()
    expect(row).toBeUndefined()
  })

  it('rolls a second tap back to the count the first one left', async () => {
    const id = await makeHabit()
    await addHabitProgress(id, 5, '2026-09-18')       // 5/20

    const snap = await captureHabitTap(id, '2026-09-18')
    await addHabitProgress(id, 5, '2026-09-18')       // 10/20 — the tap to undo

    let row = await db.habitCompletions
      .where('[habitId+date]').equals([id, '2026-09-18']).first()
    expect(row?.count).toBe(10)

    await revertHabitTap(snap!)

    row = await db.habitCompletions
      .where('[habitId+date]').equals([id, '2026-09-18']).first()
    expect(row?.count).toBe(5)
  })

  it('undoes the streak increment when the reverted tap was the one that completed the habit', async () => {
    const id = await makeHabit({ targetCompletions: 5, stepAmount: 5 })
    const snap = await captureHabitTap(id, '2026-09-18')
    const result = await addHabitProgress(id, 5, '2026-09-18')   // completes it
    expect(result?.completedNow).toBe(true)

    let habit = await db.habits.get(id)
    expect(habit?.streakCount).toBe(1)
    expect(habit?.lastCompletedDate).toBe('2026-09-18')

    await revertHabitTap(snap!)

    habit = await db.habits.get(id)
    expect(habit?.streakCount).toBe(0)
    expect(habit?.lastCompletedDate).toBeNull()
  })

  it('does not touch the streak when the reverted tap was not the one that completed it', async () => {
    const id = await makeHabit({ targetCompletions: 20, stepAmount: 5 })
    await addHabitProgress(id, 5, '2026-09-18')   // 5/20 — not complete yet

    const snap = await captureHabitTap(id, '2026-09-18')
    await addHabitProgress(id, 5, '2026-09-18')   // 10/20 — still not complete

    let habit = await db.habits.get(id)
    expect(habit?.streakCount).toBe(0)

    await revertHabitTap(snap!)

    habit = await db.habits.get(id)
    expect(habit?.streakCount).toBe(0)
    const row = await db.habitCompletions
      .where('[habitId+date]').equals([id, '2026-09-18']).first()
    expect(row?.count).toBe(5)
  })

  it('restores a streak that continued from a prior day, not just resets it', async () => {
    const id = await makeHabit({ targetCompletions: 5, stepAmount: 5 })
    await addHabitProgress(id, 5, '2026-09-16')   // day 1: streak -> 1
    await addHabitProgress(id, 5, '2026-09-17')   // day 2: streak -> 2

    const snap = await captureHabitTap(id, '2026-09-18')
    await addHabitProgress(id, 5, '2026-09-18')   // day 3: streak -> 3

    let habit = await db.habits.get(id)
    expect(habit?.streakCount).toBe(3)

    await revertHabitTap(snap!)

    habit = await db.habits.get(id)
    // Back to exactly where day 2 left it — not zeroed, not left at 3.
    expect(habit?.streakCount).toBe(2)
    expect(habit?.lastCompletedDate).toBe('2026-09-17')
  })

  it('restores the all-time-high streak too, not just the current one', async () => {
    const id = await makeHabit({ targetCompletions: 5, stepAmount: 5 })
    // A habit already mid-streak, with a record equal to where it stands.
    await db.habits.update(id, {
      streakCount: 2, lastCompletedDate: '2026-09-17', allTimeHighStreak: 2,
    })

    const snap = await captureHabitTap(id, '2026-09-18')
    await addHabitProgress(id, 5, '2026-09-18')   // continues to streak 3 — a new record

    let habit = await db.habits.get(id)
    expect(habit?.streakCount).toBe(3)
    expect(habit?.allTimeHighStreak).toBe(3)

    await revertHabitTap(snap!)

    habit = await db.habits.get(id)
    expect(habit?.streakCount).toBe(2)
    expect(habit?.allTimeHighStreak).toBe(2)
  })
})
