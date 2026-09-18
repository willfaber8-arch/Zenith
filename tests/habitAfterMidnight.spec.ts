/**
 * tests/habitAfterMidnight.spec.ts — a habit ticked off at 1am counts.
 *
 * Zenith deliberately holds the day open past midnight: with the cutoff
 * set to 4am, a habit ticked at 01:00 is written under yesterday's date,
 * because that is the day the person was still working through.
 *
 * The write always did that. The reading did not. The grit chart, the
 * completion ring and the trend series all asked the calendar what day
 * it was, so they looked for the tick on a date it was never written to
 * and found nothing. From the outside that is indistinguishable from the
 * tick having done nothing at all — which is exactly how it was reported.
 *
 * The clock is installed before any page script runs, so React, Dexie
 * and every date helper in the app agree on the hour.
 */

import { test, expect } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

/** 01:00 — inside the grace window, so the habit day is the day before. */
const LATE_NIGHT = new Date(2026, 8, 18, 1, 0, 0)
const HABIT_DAY  = '2026-09-17'

test.describe('ticking a habit after midnight', () => {

  test('moves the grit score instead of leaving it flat', async ({ page, context }) => {
    await injectAuth(context)
    await context.addInitScript(() => {
      localStorage.setItem('zenith_day_cutoff_v1', '4')
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
    })
    /* install() freezes time until it is resumed; the app's entrance
       animations and Dexie's own timers need it running, so start the
       clock at 1am and then let it tick normally. */
    await page.clock.install({ time: LATE_NIGHT })
    await page.clock.resume()

    await page.goto('/')
    await waitForBridge(page)

    /* One habit, nothing done yet. */
    await page.evaluate(async () => {
      /* A fresh BrowserContext per test means a fresh IndexedDB, so
         this adds to an empty table — nothing here clears anything. */
      const db = window.__zenith!.db
      await db.habits.add({
        name: 'Read', frequency: 'daily', streakCount: 0,
        lastCompletedDate: null, category: 'Life', activeDays: [],
        targetCompletions: 1, stepAmount: 1,
        createdAt: new Date(2026, 0, 1).getTime(),
      })
    })

    await navigateTo(page, 'Habits')

    const score = page.locator('[aria-label^="Current Grit Score"]')
    await expect(score).toBeVisible({ timeout: 15_000 })
    const before = await score.textContent()

    /* Tick it off the way a person would. */
    await page.getByRole('button', { name: 'Add completion for Read' }).click()

    /* The completion lands on the day that is still open, not on the
       calendar date — that part was already correct. */
    await expect.poll(async () => page.evaluate(async () => {
      const rows = await window.__zenith!.db.habitCompletions.toArray()
      return rows.map((r: { date: string }) => r.date)
    }), { timeout: 10_000 }).toEqual([HABIT_DAY])

    /* And the score the user is looking at has to move because of it. */
    await expect.poll(async () => score.textContent(), { timeout: 10_000 })
      .not.toBe(before)

    const after = Number((await score.textContent())?.replace(/[^\d.]/g, ''))
    expect(after).toBeGreaterThan(0)
  })
})
