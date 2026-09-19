/**
 * tests/plantWatering.spec.ts — watering a plant, end to end.
 *
 * Two things asked for together: a linked habit actually advances when
 * a plant is watered, and the button gives clear, brief feedback that
 * the tap landed — a swap to "Watered!", then back to normal, driven by
 * real component state rather than the data change alone (which on a
 * plant nowhere near due barely moves the progress bar).
 */

import { test, expect } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

interface StoredHabit {
  name: string; autoSource?: string; streakCount: number
  lastCompletedDate: string | null
}

test.describe('watering a plant', () => {

  test.beforeEach(async ({ page, context }) => {
    await injectAuth(context)
    await context.addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
    })
    await page.goto('/')
    await waitForBridge(page)

    await page.evaluate(async () => {
      const db = window.__zenith!.db
      await db.houseplants.add({
        plantName: 'Fern', species: 'Nephrolepis exaltata',
        lastWateredDate: '2026-09-01', wateringIntervalDays: 7,
        location: 'Living Room',
      })
      await db.habits.add({
        name: 'Water the plants', frequency: 'daily', streakCount: 0,
        lastCompletedDate: null, category: 'Life', activeDays: [],
        targetCompletions: 1, stepAmount: 1, autoSource: 'plant',
        createdAt: new Date(2026, 0, 1).getTime(),
      })
    })

    await navigateTo(page, 'Botanist Guide')
  })

  test('advances a habit linked to "Plant watered"', async ({ page }) => {
    await page.getByRole('button', { name: /^Water Now/ }).first().click()

    await expect.poll(async () => page.evaluate(async () => {
      const rows = await window.__zenith!.db.habits.toArray()
      return (rows as StoredHabit[]).find(h => h.name === 'Water the plants')?.streakCount
    })).toBe(1)

    const habit = await page.evaluate(async () => {
      const rows = await window.__zenith!.db.habits.toArray()
      return (rows as StoredHabit[]).find(h => h.name === 'Water the plants')
    })
    expect(habit?.lastCompletedDate).not.toBeNull()
  })

  test('updates lastWateredDate on the plant itself', async ({ page }) => {
    await page.getByRole('button', { name: /^Water Now/ }).first().click()

    const today = await page.evaluate(() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })

    await expect.poll(async () => page.evaluate(async () => {
      const rows = await window.__zenith!.db.houseplants.toArray()
      return (rows as { plantName: string; lastWateredDate: string }[])
        .find(p => p.plantName === 'Fern')?.lastWateredDate
    })).toBe(today)
  })

  test('confirms with a button swap that clears on its own', async ({ page }) => {
    const waterBtn = page.getByRole('button', { name: /^Water Now/ }).first()
    await waterBtn.click()

    await expect(page.getByRole('button', { name: /^Watered!/ }).first())
      .toBeVisible()
    await expect(waterBtn).toHaveCount(0)

    // And it is not permanent — the row settles back to its normal
    // state rather than being stuck announcing an action from seconds ago.
    await expect(page.getByRole('button', { name: /^Water Now/ }).first())
      .toBeVisible({ timeout: 3_000 })
  })

  test('says so in a toast as well', async ({ page }) => {
    await page.getByRole('button', { name: /^Water Now/ }).first().click()
    await expect(page.getByText('Watered "Fern".')).toBeVisible()
  })
})
