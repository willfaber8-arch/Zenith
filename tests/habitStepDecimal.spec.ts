/**
 * tests/habitStepDecimal.spec.ts — the step field you can actually type in.
 *
 * "Each tap adds" was a number input with `min={1}` whose onChange ran
 * `Math.max(1, Number(value))`. Clearing it produced "", Number("") is
 * 0, the clamp turned that into 1, and 1 went back into the box as fast
 * as it could be deleted — the field could not be emptied, so it could
 * not be retyped. And a decimal was unreachable even in principle,
 * because "0.5" cannot be typed without passing through "0" first.
 *
 * These drive the real form rather than the parser, because the bug was
 * in the round trip between the field and the state, which a unit test
 * of the parser alone would not have caught.
 */

import { test, expect } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

interface StoredHabit { name: string; stepAmount?: number; targetCompletions: number }

test.describe('the habit step field', () => {

  test.beforeEach(async ({ page, context }) => {
    await injectAuth(context)
    await context.addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
    })
    await page.goto('/')
    await waitForBridge(page)
    await navigateTo(page, 'Habits')
    /* The "+" glyph is aria-hidden, so the accessible name is just
       the words; two buttons carry it (toolbar and empty state). */
    await page.getByRole('button', { name: 'New Habit' }).first().click()
  })

  test('can be emptied', async ({ page }) => {
    const step = page.getByLabel('How much each tap adds')
    await expect(step).toBeVisible({ timeout: 15_000 })
    await expect(step).toHaveValue('1')

    await step.fill('')

    /* The whole complaint: this used to read "1" again immediately. */
    await expect(step).toHaveValue('')
  })

  test('takes a decimal, keystroke by keystroke', async ({ page }) => {
    const step = page.getByLabel('How much each tap adds')
    await expect(step).toBeVisible({ timeout: 15_000 })

    await step.fill('')
    /* Typed rather than filled, so the intermediate "0" and "0." have
       to survive — snapping either back to 1 makes 0.5 untypeable. */
    await step.pressSequentially('0.5', { delay: 40 })

    await expect(step).toHaveValue('0.5')
  })

  test('stores the decimal, and the habit completes on the right tap',
    async ({ page }) => {
      await page.getByLabel('Habit name').fill('Walk')
      const step = page.getByLabel('How much each tap adds')
      await step.fill('')
      await step.pressSequentially('0.5', { delay: 40 })
      await page.getByLabel('Daily goal', { exact: true }).fill('2')
      await page.getByRole('button', { name: 'Create Habit' }).click()

      const stored = await page.evaluate(async () => {
        const rows = await window.__zenith!.db.habits.toArray()
        return (rows as StoredHabit[]).map(h => ({
          name: h.name, stepAmount: h.stepAmount, target: h.targetCompletions,
        }))
      })
      const walk = stored.find(h => h.name === 'Walk')
      expect(walk).toBeTruthy()
      expect(walk!.stepAmount).toBe(0.5)
      expect(walk!.target).toBe(2)

      /* Four taps of 0.5 make 2 — and have to be seen to make exactly 2,
         because 0.5 is one of the fractions that sums cleanly while 0.1
         is not, and the readout is what tells you which you got. */
      const tap = page.getByRole('button', { name: 'Add completion for Walk' })
      for (let i = 0; i < 4; i++) await tap.click()

      /* The readout element reads "2/2 · Daily", so match the fraction
         within it rather than the whole string. The point is that it is
         a clean "2", not "1.9999999999999998". */
      await expect(page.getByText(/(^|\s)2\/2(\s|$)/).first())
        .toBeVisible({ timeout: 10_000 })

      const habit = await page.evaluate(async () => {
        const rows = await window.__zenith!.db.habits.toArray()
        return (rows as { name: string; streakCount: number }[])
          .find(h => h.name === 'Walk')
      })
      expect(habit!.streakCount).toBe(1)
    })

  test('an emptied step field means one, not nothing', async ({ page }) => {
    await page.getByLabel('Habit name').fill('Read')
    const step = page.getByLabel('How much each tap adds')
    await step.fill('')
    await page.getByLabel('Daily goal', { exact: true }).fill('3')
    await page.getByRole('button', { name: 'Create Habit' }).click()

    const stored = await page.evaluate(async () => {
      const rows = await window.__zenith!.db.habits.toArray()
      return (rows as StoredHabit[]).find(h => h.name === 'Read')
    })
    expect(stored!.stepAmount).toBe(1)
  })
})
