/**
 * tests/rightClick.spec.ts — right-click acts as a left click, in a real
 * browser, except where a right-click already means something.
 */

import { test, expect, type Page } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

async function open(page: Page) {
  await page.context().addInitScript(() => {
    localStorage.setItem('zenith_onboarding_completed_v1', 'true')
    localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
    localStorage.setItem('zenith_tour_v2', JSON.stringify({ seenAt: Date.now() }))
  })
  await page.goto('/')
  await waitForBridge(page)
}

const nav = (page: Page) => page.locator('[aria-label="Main navigation"]')

test.describe('right-click acts as a left click', () => {
  test.beforeEach(async ({ context }) => { await injectAuth(context) })

  test('right-clicking a sidebar item opens it', async ({ page }) => {
    await open(page)
    await nav(page).getByRole('button', { name: 'Settings' }).click({ button: 'right' })
    await expect(page.getByRole('heading', { name: 'Mouse' })).toBeVisible()
  })

  test('in Minesweeper, right-click still places a flag and never reveals the cell', async ({ page }) => {
    await open(page)
    await navigateTo(page, 'Arcade')
    await page.getByRole('button', { name: 'Launch Minesweeper session' }).click()

    const cells = page.getByRole('gridcell')
    await expect(cells.first()).toBeVisible()
    await cells.first().click()                                   // the first left-click starts the game

    /* A cell still hidden after the opening reveal, tracked by position:
       its label changes once it is flagged. */
    const i = await cells.evaluateAll(els => els.findIndex(el => !(el as HTMLButtonElement).disabled))
    expect(i).toBeGreaterThanOrEqual(0)
    const target = cells.nth(i)

    await target.click({ button: 'right' })
    await expect(target).toHaveAttribute('aria-pressed', 'true')  // flagged…
    await expect(target).toBeEnabled()                            // …not revealed

    await target.click({ button: 'right' })                       // and a second right-click unflags
    await expect(target).not.toHaveAttribute('aria-pressed', 'true')
  })

  test('switched off in Settings, a right-click is a right-click again', async ({ page }) => {
    await open(page)
    await nav(page).getByRole('button', { name: 'Settings' }).click()
    const row = page.locator('label', { hasText: 'Right-click acts as a left click' })
    await row.getByRole('switch').click()
    await expect(row.getByRole('switch')).toHaveAttribute('aria-checked', 'false')

    await nav(page).getByRole('button', { name: 'Notes' }).click({ button: 'right' })
    await page.waitForTimeout(700)
    await expect(page.getByRole('heading', { name: 'Mouse' })).toBeVisible()   // still on Settings
    expect(await page.evaluate(() => localStorage.getItem('zenith_right_click_v1'))).toBe('native')
  })
})
