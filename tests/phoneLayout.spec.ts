/**
 * Zenith on a phone.
 *
 * Five screens — Home, Today, Habits, Tasks, Notes — in a fixed frame:
 * the top bar and bottom bar stay put, and only lists scroll. No sidebar,
 * nothing sideways, and every tap on the Today screen goes through the
 * same writes the full pages use, so these tests check the database as
 * well as the screen.
 *
 * The last suite runs at desktop size and checks the phone layout has
 * not leaked onto a computer.
 */

import { test, expect, type Page } from '@playwright/test'
import { injectAuth, waitForBridge } from './helpers/bridge'

const PHONE = { width: 390, height: 844 }

async function boot(page: Page) {
  await page.goto('/')
  await waitForBridge(page)
}

/*
 * Tabs are pressed by dispatching the click on the button itself. In
 * `next dev` the framework's own dev-tools badge sits in the bottom-left
 * corner — exactly over the Home tab — and swallows a positional click.
 * It does not exist in a production build.
 */
async function tab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Bottom navigation' })
    .getByRole('button', { name, exact: true })
    .dispatchEvent('click')
  await page.waitForTimeout(700)
}

async function noSidewaysOverflow(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const doc = document.documentElement
    const spill = [...document.querySelectorAll('body *')].filter(el => {
      /* The AI panel parks itself off-screen when closed; it is not page content. */
      if (el.closest('[class*=AiCopilot]')) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && (r.right > vw + 1 || r.left < -1)
    }).length
    return { spill, docW: doc.scrollWidth, docH: doc.scrollHeight, vw, vh: window.innerHeight }
  })
}

test.describe('Zenith on a phone', () => {
  test.use({ viewport: PHONE, isMobile: true, hasTouch: true })

  test.beforeEach(async ({ context }) => {
    await injectAuth(context)
    await context.addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
      localStorage.setItem('zenith_tour_v2', JSON.stringify({ seenAt: Date.now() }))
      /* Keep the starter pack out of it — these tests bring their own habits. */
      localStorage.setItem('zenith_habits_general_seeded_v1', '1')
    })
  })

  test('is five tabs, no sidebar, and a top bar that names the page', async ({ page }) => {
    await boot(page)

    const bar = page.getByRole('navigation', { name: 'Bottom navigation' })
    await expect(bar.getByRole('button')).toHaveText(['Home', 'Today', 'Habits', 'Tasks', 'Notes'])
    await expect(page.locator('#sidebar')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Open navigation/ })).toHaveCount(0)

    for (const name of ['Today', 'Habits', 'Tasks', 'Notes', 'Home']) {
      await tab(page, name)
      await expect(page.locator('header h1').first()).toHaveText(name)
      await expect(bar.getByRole('button', { name, exact: true })).toHaveAttribute('aria-current', 'page')
    }
  })

  test('never scrolls the page itself, or sideways, on any screen', async ({ page }) => {
    await boot(page)
    /* Enough of everything that a careless layout would overflow. */
    await page.evaluate(async () => {
      const db = window.__zenith!.db
      const pad = (n: number) => String(n).padStart(2, '0')
      const d = new Date()
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      const now = Date.now()
      await db.habits.bulkAdd(Array.from({ length: 12 }, (_, i) => ({
        name: `A habit with a fairly long name ${i}`, frequency: 'daily', streakCount: 0,
        lastCompletedDate: null, category: i % 2 ? 'health' : 'life', activeDays: [],
        targetCompletions: 8, stepAmount: 1, stepLabel: 'glasses', createdAt: now + i,
      })) as never)
      await db.assignments.bulkAdd(Array.from({ length: 12 }, (_, i) => ({
        title: `Task number ${i} with a title long enough to need to wrap onto a second line`,
        dueDate: iso, status: 'pending', priority: 'medium', courseId: 'ME 3240',
        kind: 'task', createdAt: now, updatedAt: now,
      })) as never)
    })
    await page.reload()
    await waitForBridge(page)

    for (const name of ['Home', 'Today', 'Habits', 'Tasks', 'Notes']) {
      await tab(page, name)
      const m = await noSidewaysOverflow(page)
      expect(m.spill, `${name}: elements past the screen edge`).toBe(0)
      expect(m.docW, `${name}: page wider than the screen`).toBe(m.vw)
      expect(m.docH, `${name}: page taller than the screen`).toBe(m.vh)
    }
  })

  test('Home is four large buttons that go where they say', async ({ page }) => {
    await boot(page)
    const home = page.getByRole('navigation', { name: 'Home' })
    await expect(home.getByRole('button')).toHaveCount(4)

    for (const [tile, title] of [['Today', 'Today'], ['Habits', 'Habits'], ['Tasks', 'Tasks'], ['Notes', 'Notes']]) {
      await tab(page, 'Home')
      await home.getByRole('button', { name: new RegExp(`^${tile}`) }).click()
      await expect(page.locator('header h1').first()).toHaveText(title)
    }
  })

  /*
   * Away and straight back inside the router's 200ms fade used to leave
   * the page invisible and untappable — the fade-out started, the swap
   * was cancelled, and nothing ever faded it back in.
   */
  test('a quick tap away and back leaves the page usable', async ({ page }) => {
    await boot(page)
    const bar = page.getByRole('navigation', { name: 'Bottom navigation' })
    await bar.getByRole('button', { name: 'Today', exact: true }).dispatchEvent('click')
    await bar.getByRole('button', { name: 'Home',  exact: true }).dispatchEvent('click')
    await page.waitForTimeout(600)

    const tile = page.getByRole('navigation', { name: 'Home' }).getByRole('button', { name: /^Habits/ })
    await tile.click({ timeout: 4_000 })
    await expect(page.locator('header h1').first()).toHaveText('Habits')
  })

  test('ticks a habit off from Today, and a hold takes the tap back', async ({ page }) => {
    await boot(page)
    const habitId = await page.evaluate(() => window.__zenith!.db.habits.add({
      name: 'Drink water', frequency: 'daily', streakCount: 0, lastCompletedDate: null,
      category: 'health', activeDays: [], targetCompletions: 2, stepAmount: 1,
      stepLabel: 'glasses', createdAt: Date.now(),
    } as never))
    await page.reload()
    await waitForBridge(page)
    await tab(page, 'Today')

    const counts = () => page.evaluate(async (id) =>
      (await window.__zenith!.db.habitCompletions.where('habitId').equals(id).toArray()).map(c => c.count), habitId)
    const streak = () => page.evaluate(async (id) => (await window.__zenith!.db.habits.get(id))?.streakCount, habitId)

    const plus = page.getByRole('button', { name: 'Add progress to Drink water' })
    await plus.click()
    await expect.poll(counts).toEqual([1])
    await plus.click()
    await expect.poll(counts).toEqual([2])
    await expect.poll(streak).toBe(1)

    /* The finished habit stays on screen, ticked, so its undo is still in reach. */
    await expect(page.getByRole('button', { name: 'Drink water done' })).toBeVisible()

    const undo = page.getByRole('button', { name: /Hold to undo the last tap on Drink water/ })
    const box = (await undo.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(950)
    await page.mouse.up()
    await expect.poll(counts).toEqual([1])
    await expect.poll(streak).toBe(0)
  })

  test('checks a task off from Today, with an Undo that puts it back', async ({ page }) => {
    await boot(page)
    const taskId = await page.evaluate(() => {
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      return window.__zenith!.db.assignments.add({
        title: 'Buy stamps', dueDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        status: 'pending', priority: 'medium', courseId: '', kind: 'reminder',
        createdAt: Date.now(), updatedAt: Date.now(),
      } as never)
    })
    await page.reload()
    await waitForBridge(page)
    await tab(page, 'Today')

    const status = () => page.evaluate(async (id) => (await window.__zenith!.db.assignments.get(id))?.status, taskId)
    await page.getByRole('button', { name: 'Mark "Buy stamps" done' }).click()
    await expect.poll(status).toBe('completed')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(status).toBe('pending')
    await expect(page.getByRole('button', { name: 'Mark "Buy stamps" done' })).toBeVisible()
  })

  test('opens a note full-screen, and Back keeps what was typed', async ({ page }) => {
    await boot(page)
    const noteId = await page.evaluate(() => window.__zenith!.db.quickNotes.add({
      title: 'Groceries', body: 'eggs', category: 'idea',
      createdAt: Date.now(), updatedAt: Date.now(), archived: 0,
    } as never))
    await page.reload()
    await waitForBridge(page)
    await tab(page, 'Notes')

    const search = page.getByRole('searchbox', { name: 'Search notes' })
    await expect(search).toBeVisible()
    await page.getByRole('button', { name: /Groceries/ }).click()
    await expect(search).toBeHidden()

    const body = page.locator('textarea').first()
    await body.click()
    await page.keyboard.press('End')
    await page.keyboard.type(', oat milk')

    /* The bottom bar gets out of the keyboard's way while typing. */
    await expect.poll(() => page.evaluate(() =>
      getComputedStyle(document.querySelector('nav[aria-label="Bottom navigation"]')!).transform,
    )).not.toBe('none')

    /* Straight back, inside the autosave delay — nothing may be lost. */
    await page.getByRole('button', { name: 'Back to all notes' }).click()
    await expect(search).toBeVisible()
    await expect.poll(() => page.evaluate(async (id) =>
      (await window.__zenith!.db.quickNotes.get(id))?.body, noteId)).toBe('eggs, oat milk')
  })

  test('the avatar opens Settings', async ({ page }) => {
    await boot(page)
    await page.getByRole('button', { name: /Account menu/ }).click()
    await page.getByRole('menuitem', { name: /Settings/ }).click()
    await expect(page.locator('header h1').first()).toHaveText('Settings')
  })

  test('Tasks on a phone is the list alone — no calendar, no roadmap', async ({ page }) => {
    await boot(page)
    await tab(page, 'Tasks')
    await expect(page.getByPlaceholder('Add a task…')).toBeVisible()
    await expect(page.getByRole('button', { name: /Roadmap/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Week$/i })).toHaveCount(0)
  })
})

test.describe('Zenith on a computer', () => {
  test.beforeEach(async ({ context }) => {
    await injectAuth(context)
    await context.addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
      localStorage.setItem('zenith_tour_v2', JSON.stringify({ seenAt: Date.now() }))
    })
  })

  test('keeps its sidebar and top bar, and never mounts the phone’s', async ({ page }) => {
    await boot(page)
    await expect(page.locator('#sidebar')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Bottom navigation' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Account menu/ })).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Home' })).toHaveCount(0)
  })
})
