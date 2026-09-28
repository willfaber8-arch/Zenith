/**
 * tests/cubeTimerPhases.spec.ts — the Cube Timer's csTimer-style additions,
 * with real key presses in a real browser.
 *
 *   · phases are off unless switched on, so a normal solve still stops on
 *     the first press
 *   · with CFOP on, four presses record Cross / F2L / OLL / PLL splits
 *   · a typed time and a note are stored on the solve
 *   · a solve recorded before any of this is untouched and still listed
 */

import { test, expect, type Page } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

const SESSION = 'sess-e2e'
const CFOP = ['Cross', 'F2L', 'OLL', 'PLL']

interface StoredSolve {
  id: string; timeMs: number; penalty: string; splits?: number[]
  phaseNames?: string[]; note?: string; entry?: string; createdAt: number
}

const solves = (page: Page) => page.evaluate(async () =>
  (await window.__zenith!.db.cube_solves.toArray()).sort((a, b) => a.createdAt - b.createdAt),
) as Promise<StoredSolve[]>

/** Hold Space past the ready delay and release: the clock starts. */
async function startClock(page: Page) {
  await page.keyboard.down('Space')
  await page.waitForTimeout(450)
  await page.keyboard.up('Space')
  await page.waitForTimeout(120)
}

async function open(page: Page, phases?: string[]) {
  await page.context().addInitScript(({ session, phases }) => {
    localStorage.setItem('zenith_onboarding_completed_v1', 'true')
    localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
    localStorage.setItem('zenith_cube_sessions_v1', JSON.stringify([{ id: session, name: 'E2E' }]))
    localStorage.setItem('zenith_cube_session_v1', session)
    if (phases) {
      localStorage.setItem('zenith_cube_options_v1', JSON.stringify({
        phases: { '333': { enabled: true, names: phases } },
      }))
    }
  }, { session: SESSION, phases })
  await page.goto('/')
  await waitForBridge(page)
  /* A solve from before splits and notes existed. */
  await page.evaluate(async (session) => {
    await window.__zenith!.db.cube_solves.put({
      id: 'old-solve', sessionId: session, puzzle: '333', timeMs: 15_430, penalty: 'OK',
      scramble: "R U R' U'", createdAt: Date.now() - 86_400_000,
    })
  }, SESSION)
  await navigateTo(page, 'Cube Timer')
  await expect(page.getByText('Hold Space, release to start')).toBeVisible()
}

test.describe('Cube Timer — phases, typed times, notes', () => {
  test.beforeEach(async ({ context }) => { await injectAuth(context) })

  test('with phases off, the first press stops the clock as before', async ({ page }) => {
    await open(page)
    await startClock(page)
    await page.keyboard.press('Space')
    await expect.poll(async () => (await solves(page)).length).toBe(2)
    const s = (await solves(page))[1]
    expect(s.splits).toBeUndefined()
    expect(s.phaseNames).toBeUndefined()
  })

  test('with CFOP on, four presses record Cross, F2L, OLL and PLL', async ({ page }) => {
    await open(page, CFOP)
    await startClock(page)
    await expect(page.getByText('Cross — press to finish this phase')).toBeVisible()

    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(150)
      await page.keyboard.press('Space')
    }
    await expect(page.getByText('PLL — press to stop')).toBeVisible()
    expect((await solves(page)).length).toBe(1)          // still running after three presses

    await page.waitForTimeout(150)
    await page.keyboard.press('Space')
    await expect.poll(async () => (await solves(page)).length).toBe(2)

    const s = (await solves(page))[1]
    expect(s.phaseNames).toEqual(CFOP)
    expect(s.splits).toHaveLength(4)
    for (let i = 1; i < 4; i++) expect(s.splits![i]).toBeGreaterThan(s.splits![i - 1])
    expect(s.splits![3]).toBe(s.timeMs)                 // the last split is the solve's time

    /* The breakdown appears with the last solve. */
    await expect(page.getByText(/^Cross\s/).first()).toBeVisible()
  })

  test('a typed time and a note are stored; the old solve is untouched', async ({ page }) => {
    await open(page)
    const before = (await solves(page)).find(s => s.id === 'old-solve')

    await page.getByLabel('Type a time').fill('12.34+')
    await expect(page.getByText('= 14.34+')).toBeVisible()
    await page.getByLabel('Type a time').press('Enter')
    await expect.poll(async () => (await solves(page)).length).toBe(2)
    const typed = (await solves(page))[1]
    expect(typed).toMatchObject({ timeMs: 12_340, penalty: 'PLUS2', entry: 'typed' })

    /* Open the typed solve in the list and give it a note. */
    await page.getByRole('button', { name: /14\.34\+/ }).first().click()
    const note = page.getByLabel('Note for this solve')
    await note.fill('stackmat at club')
    await note.press('Enter')
    await expect.poll(async () => (await solves(page))[1].note).toBe('stackmat at club')

    expect((await solves(page)).find(s => s.id === 'old-solve')).toEqual(before)
    await expect(page.getByRole('button', { name: /15\.43/ }).first()).toBeVisible()
  })

  test('the Advanced Stats card shows each tab without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await open(page)
    for (const tab of ['Phases', 'Distribution', 'Records', 'Progress']) {
      await page.getByRole('tab', { name: tab }).click()
      await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true')
    }
    expect(errors).toEqual([])
  })
})
