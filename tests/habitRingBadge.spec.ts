/**
 * tests/habitRingBadge.spec.ts — today's habits, read from the sidebar.
 *
 * The Calendar's nav item carries a count of what's left to do. Habits
 * are the other shape — a fixed set for the day that fills up — so the
 * same slot carries a ring instead, and the number that matters is the
 * ratio rather than the remainder.
 *
 * The thing worth pinning down is that the ring agrees with the page it
 * links to: the denominator is what is *due today*, so an off-day habit
 * or a skipped one must not hold it below 100%.
 */

import { test, expect } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

/* A Wednesday, so "Mondays only" is genuinely not due. */
const NOON = new Date(2026, 8, 23, 12, 0, 0)

const ring = (page: import('@playwright/test').Page) =>
  page.getByRole('img', { name: /habits done today/ })

async function seedHabit(
  page: import('@playwright/test').Page,
  over: Record<string, unknown> = {},
) {
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

test.describe('the habit ring in the sidebar', () => {
  test.beforeEach(async ({ page, context }) => {
    await injectAuth(context)
    await context.addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
      /* The guided tour appears on a delay and would cover the sidebar
         partway through a longer test. */
      localStorage.setItem('zenith_tour_v2', JSON.stringify({ seenAt: Date.now() }))
    })
    await page.clock.install({ time: NOON })
    await page.clock.resume()
    await page.goto('/')
    await waitForBridge(page)
  })

  test('counts only what is due today, and fills as habits are ticked off', async ({ page }) => {
    await seedHabit(page, { name: 'Shave' })
    await seedHabit(page, { name: 'Read' })
    /* Mondays only — today is a Wednesday, so this is not due and must
       not sit in the denominator holding the ring below full. */
    await seedHabit(page, { name: 'Deep clean', frequency: 'specific_days', activeDays: [1] })

    await page.reload()
    await waitForBridge(page)

    await expect(ring(page)).toHaveAttribute('aria-label', '0 of 2 habits done today', {
      timeout: 15_000,
    })

    await navigateTo(page, 'Habits')
    await page.getByRole('button', { name: 'Add completion for Shave' }).click()

    await expect(ring(page)).toHaveAttribute('aria-label', '1 of 2 habits done today')

    await page.getByRole('button', { name: 'Add completion for Read' }).click()
    await expect(ring(page)).toHaveAttribute('aria-label', '2 of 2 habits done today')
  })

  test('a skipped habit stops being part of the day', async ({ page }) => {
    await seedHabit(page, { name: 'Shave' })
    await seedHabit(page, { name: 'Read' })

    await page.reload()
    await waitForBridge(page)
    await navigateTo(page, 'Habits')

    await expect(ring(page)).toHaveAttribute('aria-label', '0 of 2 habits done today', {
      timeout: 15_000,
    })

    await page.getByRole('button', { name: /^Skip Shave today/ }).click()

    /* Not 0 of 2 with one unreachable — skipping means "not required",
       so the day is one habit long now. */
    await expect(ring(page)).toHaveAttribute('aria-label', '0 of 1 habits done today')
  })

  test('is absent entirely when nothing is due', async ({ page }) => {
    await seedHabit(page, { name: 'Deep clean', frequency: 'specific_days', activeDays: [1] })

    await page.reload()
    await waitForBridge(page)
    await navigateTo(page, 'Habits')
    await expect(page.getByRole('button', { name: 'New Habit' }).first())
      .toBeVisible({ timeout: 15_000 })

    /* A ring out of nothing has no reading; an empty one would just
       look like a day you are behind on. */
    await expect(ring(page)).toHaveCount(0)
  })
})
