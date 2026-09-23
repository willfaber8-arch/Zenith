/**
 * tests/seriesTimeEdit.spec.ts — fixing the time on something that repeats.
 *
 * Reported as: "I made a freetime event to repeat everyday, but I set it
 * at the wrong time — if I wanted to change it I'd have to adjust every
 * single future event." Exactly so: a series edit carried the title, the
 * colour and the category to every occurrence, and dropped the one field
 * anyone actually wanted to fix.
 *
 * These drive the real form: change the hour on one occurrence, pick a
 * scope, and watch the rest of the week follow — while the dates stay
 * where they were, the past stays as it happened, and a drag still means
 * only the block you dragged.
 */

import { test, expect, type Page } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

const NOW = new Date(2026, 8, 23, 12, 0, 0)   // Wednesday
const H = 3_600_000

interface StoredEvent { title: string; startMs: number; endMs: number }

/** A daily 3–4pm "Free time", `before` days behind and `after` ahead. */
async function seedDailyRepeat(page: Page, before = 0, after = 4) {
  await page.evaluate(async ({ before, after }) => {
    const db = window.__zenith!.db
    const rows = []
    for (let i = -before; i <= after; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      d.setHours(15, 0, 0, 0)
      rows.push({
        title: 'Free time',
        startMs: d.getTime(),
        endMs:   d.getTime() + 3_600_000,
        allDay: 0, color: '#52cca3', category: 'life',
        seriesUid: 'freetime', createdAt: Date.now(),
      })
    }
    await db.personalEvents.bulkAdd(rows as never[])
  }, { before, after })
}

/** Every occurrence's hour and day-of-month, in time order. */
async function readSeries(page: Page) {
  return page.evaluate(async () => {
    const rows = await window.__zenith!.db.personalEvents.toArray() as StoredEvent[]
    return rows
      .sort((a, b) => a.startMs - b.startMs)
      .map(r => ({ hour: new Date(r.startMs).getHours(), day: new Date(r.startMs).getDate() }))
  })
}

/**
 * Open the editor on a specific occurrence. `index` counts across the
 * week's day columns, which render in order — so it equals however many
 * days were seeded behind today.
 */
async function openOccurrence(page: Page, index = 0) {
  const pills = page.getByRole('button', { name: /^Free time,/ })
  await expect(pills.first()).toBeVisible({ timeout: 15_000 })
  await pills.nth(index).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
}

test.describe('changing the time on a daily repeat', () => {
  test.beforeEach(async ({ page, context }) => {
    await injectAuth(context)
    await context.addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
      localStorage.setItem('zenith_tour_v2', JSON.stringify({ seenAt: Date.now() }))
      localStorage.setItem('zenith_series_backfill_v1', '1')
    })
    await page.clock.install({ time: NOW })
    await page.clock.resume()
    await page.goto('/')
    await waitForBridge(page)
  })

  test('one edit moves every occurrence, and each keeps its own date', async ({ page }) => {
    await seedDailyRepeat(page)
    await navigateTo(page, 'Universal Calendar')

    const before = await readSeries(page)
    expect(before.every(r => r.hour === 15)).toBe(true)

    await openOccurrence(page)
    await page.getByRole('button', { name: 'All events' }).click()
    await page.getByLabel('Start time').fill('16:00')
    await page.getByLabel('End time').fill('17:00')

    /* The form says what it is about to do, before it does it. */
    await expect(page.getByText(/occurrences move to .*4:00/i)).toBeVisible()

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText(/Updated 5 occurrences\./)).toBeVisible()

    const after = await readSeries(page)
    expect(after.every(r => r.hour === 16)).toBe(true)
    /* Every occurrence stayed on its own day — the failure mode the old
       code was avoiding by dropping times altogether. */
    expect(after.map(r => r.day)).toEqual(before.map(r => r.day))
  })

  test('"This event" still changes only the one in front of you', async ({ page }) => {
    await seedDailyRepeat(page)
    await navigateTo(page, 'Universal Calendar')

    await openOccurrence(page)
    await page.getByLabel('Start time').fill('16:00')
    await page.getByLabel('End time').fill('17:00')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText('Event updated.')).toBeVisible()

    const after = await readSeries(page)
    expect(after.filter(r => r.hour === 16)).toHaveLength(1)
    expect(after.filter(r => r.hour === 15)).toHaveLength(4)
  })

  test('occurrences that already happened keep the time they happened at', async ({ page }) => {
    await seedDailyRepeat(page, 2, 2)      // two behind, today, two ahead
    await navigateTo(page, 'Universal Calendar')

    await openOccurrence(page, 2)   // today, with two behind it
    await page.getByRole('button', { name: 'All events' }).click()
    await page.getByLabel('Start time').fill('16:00')
    await page.getByLabel('End time').fill('17:00')

    await expect(page.getByText(/2 that already happened keep their original time/)).toBeVisible()

    await page.getByRole('button', { name: 'Save Changes' }).click()
    /* Five rows are written — the title and category belong to the whole
       series and reach the past too. Only three of them *move*, which is
       what the sentence above the button promised and what matters. */
    await expect(page.getByText(/Updated 5 occurrences\./)).toBeVisible()

    const after = await readSeries(page)
    expect(after.map(r => r.hour)).toEqual([15, 15, 16, 16, 16])
  })

  test('changing the date asks what it means, and defaults to just this one', async ({ page }) => {
    await seedDailyRepeat(page)
    await navigateTo(page, 'Universal Calendar')

    const before = await readSeries(page)

    await openOccurrence(page)
    await page.getByRole('button', { name: 'All events' }).click()

    /* Push this occurrence a week out. */
    const nextWeek = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 7)
    const iso = `${nextWeek.getFullYear()}-`
      + `${String(nextWeek.getMonth() + 1).padStart(2, '0')}-`
      + `${String(nextWeek.getDate()).padStart(2, '0')}`
    await page.getByLabel('Date *').fill(iso)

    const onlyThis = page.getByRole('button', { name: /Only this one/ })
    await expect(onlyThis).toBeVisible()
    await expect(onlyThis).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: /Shift them all by 7 days/ })).toBeVisible()

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText(/Updated|Event updated/)).toBeVisible()

    /* Only the edited occurrence moved; the pattern stayed put. */
    const after = await readSeries(page)
    const movedOut = after.filter(r => !before.some(b => b.day === r.day))
    expect(movedOut).toHaveLength(1)
  })

  test('shifting them all moves the whole pattern', async ({ page }) => {
    await seedDailyRepeat(page)
    await navigateTo(page, 'Universal Calendar')

    const before = await readSeries(page)

    await openOccurrence(page)
    await page.getByRole('button', { name: 'All events' }).click()

    const tomorrow = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 1)
    const iso = `${tomorrow.getFullYear()}-`
      + `${String(tomorrow.getMonth() + 1).padStart(2, '0')}-`
      + `${String(tomorrow.getDate()).padStart(2, '0')}`
    await page.getByLabel('Date *').fill(iso)
    await page.getByRole('button', { name: /Shift them all by 1 day/ }).click()

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText(/Updated 5 occurrences\./)).toBeVisible()

    const after = await readSeries(page)
    expect(after.map(r => r.day)).toEqual(before.map(r => r.day + 1))
  })

  test('a long series asks once before it rewrites the lot', async ({ page }) => {
    await seedDailyRepeat(page, 0, 20)     // 21 occurrences
    await navigateTo(page, 'Universal Calendar')

    await openOccurrence(page)
    await page.getByRole('button', { name: 'All events' }).click()
    await page.getByLabel('Start time').fill('16:00')
    await page.getByLabel('End time').fill('17:00')
    await page.getByRole('button', { name: 'Save Changes' }).click()

    /* Nothing written yet — it asks first. */
    await expect(page.getByText(/That’s 21 events\./)).toBeVisible()
    expect((await readSeries(page)).every(r => r.hour === 15)).toBe(true)

    await page.getByRole('button', { name: /Change all 21/ }).click()
    await expect(page.getByText(/Updated 21 occurrences\./)).toBeVisible()
    expect((await readSeries(page)).every(r => r.hour === 16)).toBe(true)
  })

  test('backing out of that question writes nothing', async ({ page }) => {
    await seedDailyRepeat(page, 0, 20)
    await navigateTo(page, 'Universal Calendar')

    await openOccurrence(page)
    await page.getByRole('button', { name: 'All events' }).click()
    await page.getByLabel('Start time').fill('16:00')
    await page.getByLabel('End time').fill('17:00')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.getByRole('button', { name: 'Go back' }).click()

    /* Back to the form, with the edit intact and nothing committed. */
    await expect(page.getByLabel('Start time')).toHaveValue('16:00')
    expect((await readSeries(page)).every(r => r.hour === 15)).toBe(true)
  })
})
