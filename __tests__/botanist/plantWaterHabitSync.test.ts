/**
 * Watering a plant can advance a habit.
 *
 * The Botanist Guide has always been its own island — the watering
 * schedule lived only in `db.houseplants`, invisible to the habit
 * tracker even though "water the plants" is exactly the kind of thing
 * someone would want tracked as a habit. `syncHabitSource('plant', 1)`
 * is the same shared engine every other auto-linked tracker (Workouts,
 * Pomodoro, the Polyglot Vault, the Library, Mental Wellness) already
 * routes through — these pin that a habit set to auto-fill from
 * "Plant watered" is actually reachable from it, and that an unrelated
 * habit is left alone.
 */

import { db, type Habit } from '@/lib/db'
import { syncHabitSource, habitSourceMeta, HABIT_SOURCES } from '@/lib/habitSync'

const habit = (over: Partial<Habit> = {}): Promise<number> =>
  db.habits.add({
    name: 'Water the plants', frequency: 'daily', streakCount: 0,
    lastCompletedDate: null, category: 'Life', activeDays: [],
    targetCompletions: 1, stepAmount: 1, createdAt: Date.now(),
    ...over,
  } as Habit) as Promise<number>

beforeEach(async () => {
  await db.habits.clear()
  await db.habitCompletions.clear()
})

describe('the plant auto-source is registered', () => {
  it('is in the picker list, with a hint naming the Botanist Guide', () => {
    const meta = habitSourceMeta('plant')
    expect(meta).toBeDefined()
    expect(meta?.label).toMatch(/plant/i)
    expect(meta?.hint).toMatch(/Botanist Guide/)
    expect(HABIT_SOURCES.map(s => s.id)).toContain('plant')
  })
})

describe('syncHabitSource("plant", …)', () => {
  it('advances a habit linked to it', async () => {
    const id = await habit({ autoSource: 'plant' })

    const completed = await syncHabitSource('plant', 1)

    expect(completed).toEqual(['Water the plants'])
    const row = await db.habits.get(id)
    expect(row?.streakCount).toBe(1)
    expect(row?.lastCompletedDate).not.toBeNull()
  })

  it('leaves a habit linked to a different source untouched', async () => {
    const id = await habit({ autoSource: 'cardio' })

    await syncHabitSource('plant', 1)

    const row = await db.habits.get(id)
    expect(row?.streakCount).toBe(0)
    expect(row?.lastCompletedDate).toBeNull()
  })

  it('does nothing when no habit is linked', async () => {
    // No habits seeded at all — the call has to be a safe no-op, not
    // an error, since most people watering a plant won't have one.
    await expect(syncHabitSource('plant', 1)).resolves.toEqual([])
  })

  it('respects a goal higher than one watering', async () => {
    // "Water the plants 3 times this week" — one watering is progress,
    // not automatically a completion.
    const id = await habit({ autoSource: 'plant', targetCompletions: 3 })

    const completed = await syncHabitSource('plant', 1)

    expect(completed).toEqual([])
    const row = await db.habits.get(id)
    expect(row?.streakCount).toBe(0)
  })
})
