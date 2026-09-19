/**
 * tests/habitSkip.spec.ts — skipping a habit for the day.
 *
 * "Some days the habit isn't required" (shaving, a rest day). Skipping
 * has to act as if the habit was never scheduled that day: the tap
 * button gives way to a quiet indicator instead of a warning, today's
 * "X/Y done" ratio stops counting it, and undoing it puts the row back
 * exactly where an untouched day already looks.
 */

import { test, expect } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

const NOON = new Date(2026, 8, 18, 12, 0, 0)
const TODAY_ISO = '2026-09-18'

interface StoredHabit { name: string; skippedDates?: string[] }

async function seedHabit(page: import('@playwright/test').Page, over: Record<string, unknown> = {}) {
  await page.evaluate(async (extra) => {
    const db = window.__zenith!.db
    await db.habits.add({
      name: 'Shave', frequency: 'daily', streakCount: 0,
      lastCompletedDate: null, category: 'General', activeDays: [],
      targetCompletions: 1, stepAmount: 1,
      createdAt: new Date(2026, 0, 1).getTime(),
      ...extra,
    })
  }, over)
}

test.describe('skipping a habit', () => {

  test.beforeEach(async ({ page, context }) => {
    await injectAuth(context)
    await context.addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
    })
    await page.clock.install({ time: NOON })
    await page.clock.resume()
    await page.goto('/')
    await waitForBridge(page)
  })

  test('replaces the tap button with an undo-able badge, and back', async ({ page }) => {
    await seedHabit(page)
    await navigateTo(page, 'Habits')

    const tapButton  = page.getByRole('button', { name: 'Add completion for Shave' })
    const skipButton = page.getByRole('button', { name: /^Skip Shave today/ })
    await expect(tapButton).toBeVisible({ timeout: 15_000 })
    await expect(skipButton).toBeVisible()

    await skipButton.click()

    // The tap button is gone — nothing to log against a day that isn't
    // required — and a distinct, undo-able badge sits in its place.
    await expect(tapButton).toHaveCount(0)
    const undoButton = page.getByRole('button', { name: /^Skipped today/ })
    await expect(undoButton).toBeVisible()

    const skipped = await page.evaluate(async () => {
      const rows = await window.__zenith!.db.habits.toArray()
      return (rows as StoredHabit[]).find(h => h.name === 'Shave')?.skippedDates
    })
    expect(skipped).toEqual([TODAY_ISO])

    await undoButton.click()

    await expect(tapButton).toBeVisible()
    await expect(undoButton).toHaveCount(0)

    const unskipped = await page.evaluate(async () => {
      const rows = await window.__zenith!.db.habits.toArray()
      return (rows as StoredHabit[]).find(h => h.name === 'Shave')?.skippedDates
    })
    expect(unskipped).toEqual([])
  })

  test('takes the habit out of the daily ratio while skipped', async ({ page }) => {
    await seedHabit(page)
    await navigateTo(page, 'Habits')

    const ratio = page.locator('[aria-live="polite"]').getByText(/done today$/)
    await expect(ratio).toHaveText('0/1 done today', { timeout: 15_000 })

    await page.getByRole('button', { name: /^Skip Shave today/ }).click()

    // Not "0 done out of 1 required" — the requirement itself is gone.
    await expect(ratio).toHaveText('0/0 done today')
  })

  test('is not offered once something is logged, and does not reappear on a completed habit', async ({ page }) => {
    await seedHabit(page)
    await navigateTo(page, 'Habits')

    await page.getByRole('button', { name: 'Add completion for Shave' }).click()

    // Completed now — nothing left to decide, so no skip control and
    // the tap button itself shows the finished state.
    await expect(page.getByRole('button', { name: /^Skip Shave today/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Skipped today/ })).toHaveCount(0)
  })

  test('leaves an existing streak untouched by the toggle itself', async ({ page }) => {
    await seedHabit(page, { streakCount: 4, lastCompletedDate: '2026-09-17' })
    await navigateTo(page, 'Habits')

    await expect(page.getByRole('button', { name: 'Add completion for Shave' }))
      .toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /^Skip Shave today/ }).click()
    await expect(page.getByRole('button', { name: /^Skipped today/ })).toBeVisible()

    const habit = await page.evaluate(async () => {
      const rows = await window.__zenith!.db.habits.toArray()
      return (rows as { name: string; streakCount: number; lastCompletedDate: string | null }[])
        .find(h => h.name === 'Shave')
    })
    expect(habit?.streakCount).toBe(4)
    expect(habit?.lastCompletedDate).toBe('2026-09-17')
  })
})
