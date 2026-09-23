/**
 * tests/eventOverlapVisual.spec.ts — two events at the same time, and
 * which one you can actually read.
 *
 * Reported as "the priority doesn't really work, the events blend
 * together still". The cascade was offsetting them correctly; the
 * problem was that every pill was drawn at 18% alpha, so you saw the
 * one behind — and the grid lines — straight through the one in front.
 * Offsetting only helps if the pill in front is solid.
 */

import { test, expect } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

const NOW = new Date(2026, 8, 23, 12, 0, 0)   // Wednesday
const H = 3_600_000

test.describe('overlapping events', () => {
  test.beforeEach(async ({ page, context }) => {
    await injectAuth(context)
    await context.addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
      localStorage.setItem('zenith_tour_v2', JSON.stringify({ seenAt: Date.now() }))
    })
    await page.clock.install({ time: NOW })
    await page.clock.resume()
    await page.goto('/')
    await waitForBridge(page)

    const todayStart = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()).getTime()
    await page.evaluate(async ({ todayStart, H }) => {
      const db = window.__zenith!.db
      await db.personalEvents.bulkAdd([
        {
          title: 'Team sync', startMs: todayStart + 14 * H, endMs: todayStart + 15 * H,
          allDay: 0, color: '#7c95ff', category: 'personal', createdAt: Date.now(),
        },
        {
          title: 'Investor call', startMs: todayStart + 14.5 * H, endMs: todayStart + 15 * H,
          allDay: 0, color: '#f87171', category: 'personal', createdAt: Date.now(),
          priority: 'high',
        },
      ] as never[])
    }, { todayStart, H })

    await navigateTo(page, 'Universal Calendar')
  })

  test('the pill in front is opaque, so nothing shows through it', async ({ page }) => {
    const call = page.getByRole('button', { name: /^Investor call,/ })
    await expect(call).toBeVisible({ timeout: 15_000 })

    /*
     * The actual regression: a translucent background is what let the
     * lower pill and the grid read through the upper one. Any alpha
     * below 1 here and they blend again, however well they are offset.
     */
    const alpha = await call.evaluate(el => {
      const bg = getComputedStyle(el).backgroundColor
      const m = /rgba?\([^)]*?(?:,\s*([\d.]+))?\)$/.exec(bg)
      return m?.[1] ? Number(m[1]) : 1
    })
    expect(alpha).toBe(1)
  })

  test('the higher-priority event is the one drawn on top', async ({ page }) => {
    const call = page.getByRole('button', { name: /^Investor call,/ })
    const sync = page.getByRole('button', { name: /^Team sync,/ })

    await expect(call).toHaveAttribute('aria-label', /1 of 2 overlapping/)
    await expect(sync).toHaveAttribute('aria-label', /2 of 2 overlapping/)

    const [front, behind] = await Promise.all([
      call.evaluate(el => Number(getComputedStyle(el).zIndex) || 0),
      sync.evaluate(el => Number(getComputedStyle(el).zIndex) || 0),
    ])
    expect(front).toBeGreaterThan(behind)
  })

  test('the covered event still has a sliver to grab, and comes forward on hover', async ({ page }) => {
    const call = page.getByRole('button', { name: /^Investor call,/ })
    const sync = page.getByRole('button', { name: /^Team sync,/ })

    const [frontBox, behindBox] = await Promise.all([call.boundingBox(), sync.boundingBox()])
    /* The one behind reaches further right than the one in front, and
       that strip is all of it you can see — but it is enough to click. */
    expect(behindBox!.x + behindBox!.width).toBeGreaterThan(frontBox!.x + frontBox!.width)

    const resting = await sync.evaluate(el => Number(getComputedStyle(el).zIndex) || 0)
    await sync.hover()
    const hovered = await sync.evaluate(el => Number(getComputedStyle(el).zIndex) || 0)
    expect(hovered).toBeGreaterThan(resting)
  })
})
