/**
 * tests/habitUndoTap.spec.ts — going back on a habit tap.
 *
 * There was no way to reverse an accidental "+" press short of editing
 * the habit's streak by hand. The fix sits next to the Skip button (the
 * same slot, since the two conditions never overlap): a control that
 * only fires after being *held*, not tapped — a second tap would be the
 * same gesture as the mistake it is meant to undo, so it has to be a
 * different one to actually protect against anything.
 */

import { test, expect } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

interface StoredHabit {
  name: string
  streakCount: number
  lastCompletedDate: string | null
}
interface StoredCompletion { habitId: number; date: string; count: number }

async function seedHabit(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const db = window.__zenith!.db
    await db.habits.add({
      name: 'Shave', frequency: 'daily', streakCount: 0,
      lastCompletedDate: null, category: 'General', activeDays: [],
      targetCompletions: 1, stepAmount: 1,
      createdAt: new Date(2026, 0, 1).getTime(),
    })
  })
}

async function holdButton(
  button: import('@playwright/test').Locator, ms: number,
) {
  const box = await button.boundingBox()
  if (!box) throw new Error('button has no bounding box')
  await button.page().mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await button.page().mouse.down()
  await button.page().waitForTimeout(ms)
  await button.page().mouse.up()
}

test.describe('undoing a habit tap', () => {
  test.beforeEach(async ({ page, context }) => {
    await injectAuth(context)
    await context.addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
    })
    await page.goto('/')
    await waitForBridge(page)
    await seedHabit(page)
    await navigateTo(page, 'Habits')
  })

  test('a full hold restores the count and the streak it had just crossed', async ({ page }) => {
    const tapButton = page.getByRole('button', { name: 'Add completion for Shave' })
    await expect(tapButton).toBeVisible({ timeout: 15_000 })
    await tapButton.click()

    const undoButton = page.getByRole('button', { name: 'Hold to undo the last tap on Shave' })
    // The control appearing is itself proof the write landed — it only
    // renders once a snapshot exists, which increment() only produces
    // after the completion actually wrote.
    await expect(undoButton).toBeVisible()

    const habitAfterTap = await page.evaluate(async () => {
      const rows = await window.__zenith!.db.habits.toArray()
      return (rows as StoredHabit[]).find(h => h.name === 'Shave')
    })
    expect(habitAfterTap?.streakCount).toBe(1)

    await holdButton(undoButton, 900)

    await expect(page.getByText('Undid the last tap on "Shave".')).toBeVisible()

    const [habit, completions] = await page.evaluate(async () => {
      const db = window.__zenith!.db
      const rows = await db.habits.toArray()
      const comps = await db.habitCompletions.toArray()
      return [rows.find((h: StoredHabit) => h.name === 'Shave'), comps]
    }) as [StoredHabit | undefined, StoredCompletion[]]

    expect(habit?.streakCount).toBe(0)
    expect(habit?.lastCompletedDate).toBeNull()
    // The tap that created today's completion row is gone, not zeroed —
    // a leftover 0-count row would still read as "touched today".
    expect(completions).toHaveLength(0)

    // The row is back to looking untouched: the tap button returns, and
    // so does Skip, which only offers itself before anything is logged.
    await expect(tapButton).toBeVisible()
    await expect(page.getByRole('button', { name: "Skip Shave today — won't count as missed" }))
      .toBeVisible()
    await expect(undoButton).toHaveCount(0)
  })

  test('releasing before the hold completes does nothing', async ({ page }) => {
    const tapButton = page.getByRole('button', { name: 'Add completion for Shave' })
    await expect(tapButton).toBeVisible({ timeout: 15_000 })
    await tapButton.click()

    const undoButton = page.getByRole('button', { name: 'Hold to undo the last tap on Shave' })
    await expect(undoButton).toBeVisible()

    // Well under the 700ms threshold.
    await holdButton(undoButton, 200)

    // Give any (wrongly) queued write a moment to land before asserting
    // it didn't.
    await page.waitForTimeout(400)

    const habit = await page.evaluate(async () => {
      const rows = await window.__zenith!.db.habits.toArray()
      return (rows as StoredHabit[]).find(h => h.name === 'Shave')
    })
    expect(habit?.streakCount).toBe(1)
    // The control is still there — a mis-hold doesn't burn the one
    // undo this tap gets.
    await expect(undoButton).toBeVisible()
  })
})
