/**
 * tests/eventSeriesBackfill.spec.ts — old events, edited as the series
 * they always were.
 *
 * Reported as "the save for future events doesn't work — if I click on
 * one it won't change the rest", about events that predate the edit
 * scope shipping. They were right about the cause being grouping: a
 * generated course schedule wrote one independent row per class
 * session and never stamped a `seriesUid`, so the app had no way to
 * know the forty rows were one class. The scope picker never appeared,
 * and every scope reached exactly one row.
 *
 * This drives the repair through the UI the way it actually runs: open
 * the calendar, let the backfill happen, then edit one occurrence and
 * watch the later ones follow.
 */

import { test, expect } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

const NOW = new Date(2026, 8, 23, 12, 0, 0)   // Wednesday
const H = 3_600_000

interface StoredEvent { title: string; startMs: number; seriesUid?: string }

/**
 * A course schedule exactly as the generator used to write it: one row
 * per session, sharing a feed and a title, with no seriesUid anywhere.
 */
async function seedLegacySchedule(page: import('@playwright/test').Page) {
  const monday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - 2).getTime()
  await page.evaluate(async ({ monday, H }) => {
    const db = window.__zenith!.db
    const feedId = await db.calendarFeeds.add({
      label: 'CHEM 2090 — Cornell', url: '', color: '#b31b1b',
      isActive: 1, lastFetchedAt: Date.now(), createdAt: Date.now(),
    }) as number

    /* Mon/Wed/Fri of this week, 10:10–11:00 — the shape planSessions
       produces, minus the grouping it never wrote. */
    await db.calendarEvents.bulkAdd([0, 2, 4].map(offset => ({
      feedId,
      uid:      `sched-CORNELL-CHEM_2090-day${offset}`,
      title:    'CHEM 2090',
      startMs:  monday + offset * 24 * H + 10 * H + 10 * 60_000,
      endMs:    monday + offset * 24 * H + 11 * H,
      allDay:   0, is1159: 0, category: 'scholastic',
    })))
  }, { monday, H })
}

test.describe('events that were never grouped', () => {
  test.beforeEach(async ({ page, context }) => {
    await injectAuth(context)
    await context.addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
      /* The guided tour appears on a delay and would cover the sidebar
         partway through a longer test. */
      localStorage.setItem('zenith_tour_v2', JSON.stringify({ seenAt: Date.now() }))
    })
    await page.clock.install({ time: NOW })
    await page.clock.resume()
    await page.goto('/')
    await waitForBridge(page)
  })

  test('a legacy course schedule becomes editable as one series', async ({ page }) => {
    await seedLegacySchedule(page)

    /* Every row starts ungrouped — this is the state the bug lives in. */
    const before = await page.evaluate(async () =>
      (await window.__zenith!.db.calendarEvents.toArray() as StoredEvent[])
        .map(r => r.seriesUid ?? null))
    expect(before).toEqual([null, null, null])

    await navigateTo(page, 'Universal Calendar')

    /* Opening the calendar repairs the grouping, and says so. */
    await expect(page.getByText(/Grouped 3 older events into 1 repeat/))
      .toBeVisible({ timeout: 15_000 })

    const after = await page.evaluate(async () =>
      (await window.__zenith!.db.calendarEvents.toArray() as StoredEvent[])
        .map(r => r.seriesUid ?? null))
    expect(new Set(after).size).toBe(1)
    expect(after[0]).toBeTruthy()

    /* The middle occurrence, deliberately: editing the first one would
       reach the whole run and look identical to "all events", proving
       nothing about the scope actually under test. Day columns render
       in order, so index 1 is Wednesday. */
    const pills = page.getByRole('button', { name: /^CHEM 2090,/ })
    await expect(pills).toHaveCount(3)
    await pills.nth(1).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()

    const futureBtn = page.getByRole('button', { name: 'This & following' })
    await expect(futureBtn).toBeVisible()
    await futureBtn.click()
    await expect(futureBtn).toHaveAttribute('aria-pressed', 'true')

    const title = page.getByLabel('Title *')
    await title.fill('CHEM 2090 — Baker 200')
    await expect(title).toHaveValue('CHEM 2090 — Baker 200')
    await page.getByRole('button', { name: 'Save Changes' }).click()

    await expect(page.getByText('Updated 2 occurrences.')).toBeVisible()

    /* Monday untouched, Wednesday and Friday moved — which is what
       "this and following" says on the label. */
    const titles = await page.evaluate(async () =>
      (await window.__zenith!.db.calendarEvents.toArray() as StoredEvent[])
        .sort((a, b) => a.startMs - b.startMs)
        .map(r => r.title))
    expect(titles).toEqual([
      'CHEM 2090',
      'CHEM 2090 — Baker 200',
      'CHEM 2090 — Baker 200',
    ])
  })

  test('does not group a calendar of genuinely unrelated events', async ({ page }) => {
    const monday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - 2).getTime()
    await page.evaluate(async ({ monday, H }) => {
      const db = window.__zenith!.db
      const feedId = await db.calendarFeeds.add({
        label: 'Personal iCal', url: 'https://example.invalid/f.ics', color: '#7c95ff',
        isActive: 1, lastFetchedAt: Date.now(), createdAt: Date.now(),
      }) as number
      await db.calendarEvents.bulkAdd(
        ['Dentist', 'Haircut', 'Car service'].map((title, i) => ({
          feedId, uid: `one-off-${i}`, title,
          startMs: monday + i * 24 * H + 9 * H,
          endMs:   monday + i * 24 * H + 10 * H,
          allDay: 0, is1159: 0, category: 'general',
        })))
    }, { monday, H })

    await navigateTo(page, 'Universal Calendar')
    await expect(page.getByRole('button', { name: '+ New Event' }))
      .toBeVisible({ timeout: 15_000 })

    /* Three different things on three days are not a repeat, and
       putting "All 3" in front of a delete button would be a worse bug
       than the one being fixed. */
    const uids = await page.evaluate(async () =>
      (await window.__zenith!.db.calendarEvents.toArray() as StoredEvent[])
        .map(r => r.seriesUid ?? null))
    expect(uids).toEqual([null, null, null])
    await expect(page.getByText(/Grouped \d+ older events/)).toHaveCount(0)
  })
})
