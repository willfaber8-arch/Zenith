/**
 * tests/wellnessCheckin.spec.ts — the feelings check-in and past-day edits.
 *
 * Two things asked for together: a questionnaire about how you actually
 * feel (not just how school is going) that averages your answers and says
 * where to improve, and a way to edit a day once midnight has passed —
 * the form used to be welded to "today", so yesterday's entry became
 * read-only the moment the clock rolled over.
 */

import { test, expect, type Page } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

interface StoredLog {
  logDate: string; moodVector: string; qualitativeNotes: string
  stressLevel: number; energyLevel: number; emotions?: Record<string, number>
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

test.describe('Mental Wellness', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page.context())
    await page.context().addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
      localStorage.setItem('zenith_tour_v2', JSON.stringify({ seenAt: Date.now() }))
    })
    await page.goto('/')
    await waitForBridge(page)
    await navigateTo(page, 'Mental Wellness')
  })

  test('edits yesterday after midnight without touching today', async ({ page }) => {
    const yesterday = await isoDaysAgo(page, 1)
    // An entry already logged for yesterday, as if written before midnight.
    await page.evaluate(async (date) => {
      await window.__zenith!.db.mentalHealthLogs.add({
        logDate: date, stressLevel: 5, energyLevel: 5, qualitativeNotes: 'before',
        moodVector: 'neutral', createdAt: Date.now(),
      })
    }, yesterday)

    await page.getByRole('button', { name: 'Yesterday', exact: true }).click()
    await expect(page.getByText(/Editing yesterday/)).toBeVisible()
    await expect(page.locator('#mh-notes')).toHaveValue('before')

    await page.getByRole('button', { name: /^Stressed:/ }).click()
    await page.locator('#mh-notes').fill('after')
    await page.getByRole('button', { name: 'Update Entry' }).click()

    await expect.poll(async () => (await logs(page)).find(l => l.logDate === yesterday)?.qualitativeNotes)
      .toBe('after')
    const all = await logs(page)
    expect(all).toHaveLength(1)
    expect(all[0].moodVector).toBe('stressed')
  })

  test('the check-in walks every phase, saves, and names what to work on', async ({ page }) => {
    await page.getByRole('tab', { name: /Feelings check-in/ }).click()

    // Answer each phase: "Extremely" to the first question (happy, anxious,
    // energy, motivated), "Not at all" to the rest.
    for (let step = 0; step < 4; step++) {
      const questions = page.locator('fieldset')
      const n = await questions.count()
      for (let i = 0; i < n; i++) {
        await questions.nth(i).getByRole('button', { name: i === 0 ? 'Extremely' : 'Not at all' }).click()
      }
      await page.getByRole('button', { name: step === 3 ? 'See results' : 'Next', exact: true }).click()
    }

    await expect(page.getByText('Where to improve')).toBeVisible()
    await expect(page.getByText(/^Average wellbeing across 12 feelings/)).toBeVisible()

    const today = await isoDaysAgo(page, 0)
    await expect.poll(async () => Object.keys((await logs(page)).find(l => l.logDate === today)?.emotions ?? {}).length)
      .toBe(12)
    const row = (await logs(page)).find(l => l.logDate === today)!
    expect(row.emotions!.happy).toBe(4)
    expect(row.emotions!.anxious).toBe(4)
    // A check-in-only day still gets the numbers the rest of the page reads.
    expect(row.stressLevel).toBeGreaterThanOrEqual(1)
    expect(row.moodVector).toBeTruthy()

    // Anxiety at "Extremely" is the clearest low area.
    await expect(page.getByText(/^Anxiety/).first()).toBeVisible()
  })
})
