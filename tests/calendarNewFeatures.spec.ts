/**
 * tests/calendarNewFeatures.spec.ts — three additions to the Universal
 * Calendar's New Event form.
 *
 * 1. A weekday picker (mirroring the Course Schedule replicator) that
 *    can give each selected day its own hours, not just one shared pair.
 * 2. Overlapping events no longer blend into each other: they cascade,
 *    the soonest-starting one stays on top by default, a priority can
 *    override that, and hovering a covered one brings it fully forward.
 * 3. Editing an occurrence that is part of a series can now be scoped to
 *    "this event", "this and following", or "all events" — the same
 *    three-way choice delete already offered two of.
 */

import { test, expect } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

/* Wednesday, fixed so "this week" is deterministic. */
const NOW = new Date(2026, 8, 23, 12, 0, 0)
const H = 3_600_000

interface StoredPersonalEvent {
  id: number
  title: string
  startMs: number
  endMs: number
  priority?: string
  seriesUid?: string
}

async function openCalendar(page: import('@playwright/test').Page) {
  await navigateTo(page, 'Universal Calendar')
}

async function commonSetup(
  { page, context }: { page: import('@playwright/test').Page; context: import('@playwright/test').BrowserContext },
) {
  await injectAuth(context)
  await context.addInitScript(() => {
    localStorage.setItem('zenith_onboarding_completed_v1', 'true')
    localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
  })
  await page.clock.install({ time: NOW })
  await page.clock.resume()
  await page.goto('/')
  await waitForBridge(page)
}

test.describe('the New Event weekday picker', () => {
  test.beforeEach(commonSetup)

  test('writes one row per selected day, each keeping its own hours', async ({ page }) => {
    await openCalendar(page)
    await page.getByRole('button', { name: '+ New Event' }).click()

    await page.getByLabel('Title *').fill('Study group')
    await page.getByLabel('Repeats').selectOption({ label: 'Choose specific days…' })

    await page.getByRole('button', { name: 'Monday' }).click()
    await page.getByRole('button', { name: 'Wednesday' }).click()

    await page.getByLabel('Different times per day').check()
    await page.getByLabel('Monday start time').fill('18:00')
    await page.getByLabel('Monday end time').fill('19:00')
    await page.getByLabel('Wednesday start time').fill('07:30')
    await page.getByLabel('Wednesday end time').fill('08:15')

    await page.getByRole('button', { name: 'Add Event' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const rows = await page.evaluate(async () => {
      const all = await window.__zenith!.db.personalEvents.toArray()
      return (all as StoredPersonalEvent[])
        .filter(r => r.title === 'Study group')
        .map(r => ({
          startMs: r.startMs, endMs: r.endMs,
          dow: new Date(r.startMs).getDay(),
          startHM: new Date(r.startMs).toTimeString().slice(0, 5),
          endHM: new Date(r.endMs).toTimeString().slice(0, 5),
        }))
    })

    /* Two years of Mondays and Wednesdays is a lot of rows — the point
       here is that each day kept the hours it was given, not the count. */
    expect(rows.length).toBeGreaterThan(2)
    expect(rows.every(r => r.dow === 1 || r.dow === 3)).toBe(true)
    for (const r of rows.filter(r => r.dow === 1)) {
      expect(r.startHM).toBe('18:00')
      expect(r.endHM).toBe('19:00')
    }
    for (const r of rows.filter(r => r.dow === 3)) {
      expect(r.startHM).toBe('07:30')
      expect(r.endHM).toBe('08:15')
    }
  })
})

test.describe('event priority', () => {
  test.beforeEach(commonSetup)

  test('is written when raised, and left off the row when left at Normal', async ({ page }) => {
    await openCalendar(page)

    await page.getByRole('button', { name: '+ New Event' }).click()
    await page.getByLabel('Title *').fill('Board meeting')
    await page.getByRole('button', { name: 'High', exact: true }).click()
    await page.getByRole('button', { name: 'Add Event' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.getByRole('button', { name: '+ New Event' }).click()
    await page.getByLabel('Title *').fill('Coffee with Sam')
    await page.getByRole('button', { name: 'Add Event' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const rows = await page.evaluate(async () => {
      const all = await window.__zenith!.db.personalEvents.toArray()
      return (all as StoredPersonalEvent[]).map(r => ({ title: r.title, priority: r.priority }))
    })
    expect(rows.find(r => r.title === 'Board meeting')?.priority).toBe('high')
    expect(rows.find(r => r.title === 'Coffee with Sam')?.priority).toBeUndefined()
  })
})

test.describe('overlapping events', () => {
  test.beforeEach(commonSetup)

  async function seedOverlap(page: import('@playwright/test').Page) {
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
  }

  test('does not merge — both pills stay in the DOM and say how many overlap', async ({ page }) => {
    await seedOverlap(page)
    await openCalendar(page)

    const sync = page.getByRole('button', { name: /^Team sync,/ })
    const call = page.getByRole('button', { name: /^Investor call,/ })
    await expect(sync).toBeVisible()
    await expect(call).toBeVisible()

    /* Two things scheduled over each other must not collapse into one
       control — each pill is independently clickable. */
    const syncLabel = await sync.getAttribute('aria-label')
    const callLabel = await call.getAttribute('aria-label')
    expect(syncLabel).toContain('overlapping')
    expect(callLabel).toContain('overlapping')
  })

  test('priority wins the top of the stack over the later, higher-priority event', async ({ page }) => {
    await seedOverlap(page)
    await openCalendar(page)

    const call = page.getByRole('button', { name: /^Investor call,/ })
    /* High priority is "1 of 2" — on top — even though it starts later
       than the normal-priority event beneath it. */
    await expect(call).toHaveAttribute('aria-label', /1 of 2 overlapping/)

    const sync = page.getByRole('button', { name: /^Team sync,/ })
    await expect(sync).toHaveAttribute('aria-label', /2 of 2 overlapping/)
  })

  test('hovering the covered pill brings it fully to the front', async ({ page }) => {
    await seedOverlap(page)
    await openCalendar(page)

    const sync = page.getByRole('button', { name: /^Team sync,/ })
    const restingZ = await sync.evaluate(el => getComputedStyle(el).zIndex)

    await sync.hover()
    const hoveredZ = await sync.evaluate(el => getComputedStyle(el).zIndex)

    expect(Number(hoveredZ)).toBeGreaterThan(Number(restingZ) || 0)
  })
})

test.describe('edit scope', () => {
  test.beforeEach(commonSetup)

  test('"This & following" leaves earlier occurrences alone', async ({ page }) => {
    const todayStart = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()).getTime()
    const WEEK = 7 * 24 * H

    await page.evaluate(async ({ todayStart, WEEK, H }) => {
      const db = window.__zenith!.db
      const seriesUid = 'weekly-standup'
      await db.personalEvents.bulkAdd([
        { title: 'Standup', startMs: todayStart - WEEK + 14 * H, endMs: todayStart - WEEK + 15 * H,
          allDay: 0, color: '#7c95ff', category: 'personal', createdAt: Date.now(), seriesUid },
        { title: 'Standup', startMs: todayStart + 14 * H, endMs: todayStart + 15 * H,
          allDay: 0, color: '#7c95ff', category: 'personal', createdAt: Date.now(), seriesUid },
        { title: 'Standup', startMs: todayStart + WEEK + 14 * H, endMs: todayStart + WEEK + 15 * H,
          allDay: 0, color: '#7c95ff', category: 'personal', createdAt: Date.now(), seriesUid },
      ] as never[])
    }, { todayStart, WEEK, H })

    await openCalendar(page)

    await page.getByRole('button', { name: /^Standup,/ }).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()

    const futureBtn = page.getByRole('button', { name: 'This & following' })
    await expect(futureBtn).toBeVisible()
    await futureBtn.click()
    await expect(futureBtn).toHaveAttribute('aria-pressed', 'true')

    const titleField = page.getByLabel('Title *')
    await titleField.fill('Standup — moved to Slack huddle')
    await expect(titleField).toHaveValue('Standup — moved to Slack huddle')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    /*
     * The modal closes as soon as onSave is *called*, not once its
     * (unawaited) write resolves — closing is the right thing for the
     * UI to do quickly, but it means the dialog disappearing is not
     * proof the write landed. Waiting for the toast is: it is the one
     * signal that only fires after applyEventPatch has actually
     * finished.
     */
    await expect(page.getByText('Updated 2 occurrences.')).toBeVisible()

    const rows = await page.evaluate(async () => {
      const all = await window.__zenith!.db.personalEvents.toArray()
      return (all as StoredPersonalEvent[])
        .sort((a, b) => a.startMs - b.startMs)
        .map(r => r.title)
    })
    expect(rows).toEqual([
      'Standup',                              // last week — untouched
      'Standup — moved to Slack huddle',      // today
      'Standup — moved to Slack huddle',      // next week
    ])
  })
})
