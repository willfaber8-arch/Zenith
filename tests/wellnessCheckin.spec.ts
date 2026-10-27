/**
 * tests/wellnessCheckin.spec.ts — the daily check-in, end to end.
 *
 * Five sliders and a journal on one screen; saving shows what they add up
 * to (category scores, your usual, links to what else you did that day);
 * and any earlier day can be opened and changed, including yesterday once
 * midnight has passed.
 */

import { test, expect, type Page } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

interface StoredLog {
  logDate: string; moodVector: string; qualitativeNotes: string
  stressLevel: number; energyLevel: number; checkin?: Record<string, number>
}

async function logs(page: Page): Promise<StoredLog[]> {
  return page.evaluate(async () =>
    (await window.__zenith!.db.mentalHealthLogs.toArray()) as StoredLog[])
}

async function isoDaysAgo(page: Page, n: number): Promise<string> {
  return page.evaluate((n) => {
    const d = new Date(); d.setDate(d.getDate() - n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, n)
}

async function open(page: Page) {
  await injectAuth(page.context())
  await page.context().addInitScript(() => {
    localStorage.setItem('zenith_onboarding_completed_v1', 'true')
    localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
    localStorage.setItem('zenith_tour_v2', JSON.stringify({ seenAt: Date.now() }))
  })
  await page.goto('/')
  await waitForBridge(page)
}

test.describe('Mental Wellness check-in', () => {
  test('five sliders save, and the results say what they add up to', async ({ page }) => {
    await open(page)
    await navigateTo(page, 'Mental Wellness')

    await expect(page.locator('input[type="range"]')).toHaveCount(5)
    await page.locator('#ci-mood').fill('9')
    await page.locator('#ci-stress').fill('8')
    await page.locator('#ci-energy').fill('3')
    await page.locator('#ci-focus').fill('6')
    await page.locator('#ci-connection').fill('7')
    await page.getByRole('button', { name: 'Save check-in' }).click()

    const today = await isoDaysAgo(page, 0)
    await expect.poll(async () => (await logs(page)).find(l => l.logDate === today)?.checkin)
      .toEqual({ mood: 9, stress: 8, energy: 3, focus: 6, connection: 7 })
    const row = (await logs(page)).find(l => l.logDate === today)!
    // The sliders are the log's stress and energy, so everything else that reads them keeps working.
    expect(row.stressLevel).toBe(8)
    expect(row.energyLevel).toBe(3)
    expect(row.moodVector).toBeTruthy()

    const results = page.getByRole('region', { name: 'Check-in results' })
    await expect(results.getByText(/^Overall wellbeing/)).toBeVisible()
    await expect(results.getByText('High', { exact: true })).toBeVisible()   // stress 78
    await expect(results.getByText('What lines up with how you feel')).toBeVisible()
  })

  test('shows a link once there are enough days on both sides', async ({ page }) => {
    await open(page)
    // Ten days of check-ins; workouts on alternate days, which were the better ones.
    const days = await Promise.all(Array.from({ length: 10 }, (_, i) => isoDaysAgo(page, i + 1)))
    await page.evaluate(async (days) => {
      const db = window.__zenith!.db
      for (const [i, d] of days.entries()) {
        const good = i % 2 === 0
        await db.mentalHealthLogs.add({
          logDate: d, stressLevel: 4, energyLevel: good ? 9 : 3, qualitativeNotes: '', moodVector: 'neutral',
          createdAt: Date.now(), checkin: { mood: 6, stress: 4, energy: good ? 9 : 3, focus: 6, connection: 6 },
        })
        if (good) {
          await db.cardioSessions.add({
            activityType: 'run', durationMinutes: 30, vitalityEarned: 35, logDate: d, completedAt: Date.now(),
          })
        }
      }
    }, days)

    await navigateTo(page, 'Mental Wellness')
    await page.getByRole('button', { name: 'Save check-in' }).click()

    // Today's own check-in (energy 5, no workout) joins the days without.
    await expect(page.getByText('On days you work out, your energy averages 63 points higher.')).toBeVisible()
    await expect(page.getByText('5 days with · 6 without')).toBeVisible()
  })

  test('edits yesterday after midnight without touching today', async ({ page }) => {
    await open(page)
    const yesterday = await isoDaysAgo(page, 1)
    await page.evaluate(async (date) => {
      await window.__zenith!.db.mentalHealthLogs.add({
        logDate: date, stressLevel: 5, energyLevel: 5, qualitativeNotes: 'before',
        moodVector: 'neutral', createdAt: Date.now(),
      })
    }, yesterday)
    await navigateTo(page, 'Mental Wellness')

    await page.getByRole('button', { name: 'Yesterday', exact: true }).click()
    await expect(page.getByText(/Editing yesterday/)).toBeVisible()
    await expect(page.locator('#mh-notes')).toHaveValue('before')
    // A day logged before the sliders opens on what it recorded.
    await expect(page.locator('#ci-stress')).toHaveValue('5')

    await page.locator('#ci-stress').fill('9')
    await page.locator('#mh-notes').fill('after')
    await page.getByRole('button', { name: 'Update check-in' }).click()

    await expect.poll(async () => (await logs(page)).find(l => l.logDate === yesterday)?.qualitativeNotes)
      .toBe('after')
    const all = await logs(page)
    expect(all).toHaveLength(1)
    expect(all[0].stressLevel).toBe(9)
    expect(all[0].checkin?.stress).toBe(9)
  })
})
