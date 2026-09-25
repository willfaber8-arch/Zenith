/**
 * The starter habit pack is loaded once, however many times it is asked.
 *
 * `ensureGeneralHabitPreset` checked a "done" flag, then awaited a count
 * of the habits table, and only set the flag after that. Two calls in
 * flight together — React mounting an effect twice, or Zenith open in two
 * tabs on first run — both got past the check before either set the
 * flag, both counted zero, and both added the pack: every starter habit
 * appeared twice, with two "Loaded the General habit pack" toasts.
 */

import { db } from '@/lib/db'
import { ensureGeneralHabitPreset } from '@/lib/habitPresets'

beforeEach(async () => {
  localStorage.clear()
  await db.habits.clear()
})

describe('the General habit pack', () => {
  it('is added once when two first-run calls race', async () => {
    const [a, b] = await Promise.all([ensureGeneralHabitPreset(), ensureGeneralHabitPreset()])
    const names = (await db.habits.toArray()).map(h => h.name)

    expect(names.length).toBeGreaterThan(0)
    expect(new Set(names).size).toBe(names.length)   // no duplicates
    expect([a, b].filter(Boolean)).toHaveLength(1)    // one caller reports it
  })

  it('is added once even when the flag is lost but habits exist', async () => {
    /* A cleared localStorage must not seed on top of real habits. */
    await ensureGeneralHabitPreset()
    const before = await db.habits.count()
    localStorage.clear()
    await ensureGeneralHabitPreset()
    expect(await db.habits.count()).toBe(before)
  })

  it('never touches a table that already has habits', async () => {
    await db.habits.add({ name: 'Mine', frequency: 'daily', streakCount: 0,
      lastCompletedDate: null, category: 'general', activeDays: [],
      targetCompletions: 1, createdAt: Date.now() } as never)
    expect(await ensureGeneralHabitPreset()).toBe(false)
    expect((await db.habits.toArray()).map(h => h.name)).toEqual(['Mine'])
  })
})
