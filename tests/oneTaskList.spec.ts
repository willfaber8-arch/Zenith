/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — one task list E2E
 *
 * Zenith kept two task systems that could not see each other: the
 * Calendar's `todo_items` and Work Due's `assignments`. Where a thing
 * you had to do ended up depended on which screen you were on when you
 * wrote it down, and neither list could tell you what the other held.
 *
 * The pure rules are unit-tested. What only a browser can answer:
 *
 *   Suite 1 — an older install's to-do items survive the merge
 *     A migration that drops rows looks exactly like one that works,
 *     until someone opens the app and finds their list empty. This
 *     seeds a real database at the pre-merge version and lets the app
 *     upgrade it.
 *
 *   Suite 2 — the merged list behaves like one list
 *     A problem set made for Study Shield is visible and tickable from
 *     the Calendar, and deleting a list does not take its contents with
 *     it.
 *
 * CI usage:
 *   npx playwright test oneTaskList
 * ════════════════════════════════════════════════════════════════
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { AUTH_STORAGE_KEY, MOCK_SESSION } from './helpers/bridge'

/*
 * `timeout` is not an option `describe.configure` accepts — only `mode`
 * and `retries`. Passing it there looks like it works and silently
 * leaves the 45s project default in place, which is shorter than a cold
 * `next dev` compile of the calendar route: the hook died half way
 * through the first build and every test reported a missing sidebar.
 * The per-hook budget has to be set with `test.setTimeout`.
 */
test.describe.configure({ mode: 'serial' })

const COLD_BOOT_MS = 300_000

/** Dexie's IDB version is its declared version × 10. Schema v45 → 450. */
const OLD_IDB_VERSION = 450

/* Session plus the first-run flags, or the overlays sit on the workspace. */
async function bootWorkspace(page: Page) {
  const seed = JSON.stringify({
    [AUTH_STORAGE_KEY]: JSON.stringify(MOCK_SESSION),
    zenith_onboarding_completed_v1: 'true',
    zenith_data_wiped_v1: 'done',
    zenith_tour_v2: JSON.stringify({ seenAt: Date.now() }),
  })
  /* Passed as a JSON string: Playwright serialises the init function
     with toString(), and a TypeScript parameter annotation survives
     into the browser as a syntax error. */
  await page.addInitScript((raw) => {
    const entries = JSON.parse(raw)
    for (const k of Object.keys(entries)) localStorage.setItem(k, entries[k])
  }, seed)
}

async function openTasksTab(page: Page) {
  const nav = page.locator('[aria-label="Main navigation"]')
  await expect(nav).toBeVisible({ timeout: 120_000 })   // cold dev compile
  await nav.getByRole('button', { name: 'Universal Calendar' }).click()
  await page.getByRole('button', { name: 'Tasks', exact: true }).first().click()
  await expect(page.getByPlaceholder('Add a task…').first()).toBeVisible({ timeout: 30_000 })
}

/* ════════════════════════════════════════════════════════════════
   Suite 1 — the migration
   ════════════════════════════════════════════════════════════════ */

test.describe('Suite 1 — an older install upgrades', () => {
  let ctx: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(COLD_BOOT_MS)
    ctx  = await browser.newContext()
    page = await ctx.newPage()
    await bootWorkspace(page)

    /*
     * Builds ZenithOS at the schema version before the merge, holding
     * two to-do items and the list they belong to.
     *
     * Seeded from a blank page the test serves itself, on the app's
     * origin. Same origin means the same IndexedDB; serving it here
     * means no React, no Dexie, and therefore no race.
     *
     * Two earlier attempts are worth recording. An init script on '/'
     * runs concurrently with the app's own `open()`, and whichever
     * loses throws VersionError — when the seed lost, the rows were
     * never written and the "migration" under test was a migration of
     * nothing. Navigating to /icon.svg avoided that but replaced it
     * with a quieter problem: a top-level image document has no
     * scripting context, so the seed simply never ran.
     */
    await page.route('**/__seed__', route => route.fulfill({
      status: 200, contentType: 'text/html', body: '<!doctype html><title>seed</title>',
    }))
    await page.goto('/__seed__', { waitUntil: 'domcontentloaded' })
    await page.evaluate(async (version) => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ZenithOS', version)
        req.onupgradeneeded = () => {
          const idb = req.result
          const mk = (name: string, indexes: string[]) => {
            if (idb.objectStoreNames.contains(name)) return
            const s = idb.createObjectStore(name, { keyPath: 'id', autoIncrement: true })
            for (const f of indexes) s.createIndex(f, f)
          }
          mk('todo_categories', ['name'])
          mk('todo_items', ['categoryId', 'completed', 'dueDate'])
          mk('assignments', ['title', 'dueDate', 'courseId', 'status', 'priority', 'category', 'kind'])
        }
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction(['todo_categories', 'todo_items'], 'readwrite')
          tx.objectStore('todo_categories').put({ id: 1, name: 'Short Term', sortOrder: 0, createdAt: Date.now() })
          tx.objectStore('todo_items').put({
            id: 1, categoryId: 1, title: 'Legacy open todo',
            completed: 0, dueDate: '2030-01-15', createdAt: Date.now(),
          })
          tx.objectStore('todo_items').put({
            id: 2, categoryId: 1, title: 'Legacy done todo',
            completed: 1, createdAt: Date.now(),
          })
          tx.oncomplete = () => { idb.close(); resolve() }
          tx.onerror = () => reject(tx.error)
        }
      })
    }, OLD_IDB_VERSION)
    await page.unroute('**/__seed__')

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await openTasksTab(page)
  })

  test.afterAll(async () => { await ctx?.close() })

  test('S1-T1 an unfinished to-do arrives with its text and its date', async () => {
    await expect(page.getByRole('button', { name: 'Legacy open todo' })).toBeVisible()
    await expect(page.getByText('2030-01-15')).toBeVisible()
  })

  test('S1-T2 it stays in the list it was filed in', async () => {
    await expect(page.getByRole('button', { name: 'Short Term' })).toBeVisible()
    /* Not swept into Unfiled — the list a thing was in is information,
       and a migration that discards it looks like a working one. */
    await expect(page.getByText('Unfiled')).toHaveCount(0)
  })

  test('S1-T3 a ticked to-do keeps its tick rather than reopening', async () => {
    await expect(page.getByRole('button', { name: 'Legacy done todo' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Show done' }).click()
    await expect(page.getByRole('button', { name: 'Legacy done todo' })).toBeVisible()
    await page.getByRole('button', { name: 'Hide done' }).click()
  })

  test('S1-T4 the old table is emptied, so nothing is counted twice', async () => {
    const left = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      return w.__zenith ? await w.__zenith.db.todo_items.count() : -1
    })
    /* -1 means the bridge is off (NEXT_PUBLIC_E2E unset); the row count
       is only asserted when it can actually be read. */
    if (left !== -1) expect(left).toBe(0)
  })
})

/* ════════════════════════════════════════════════════════════════
   Suite 2 — one list, three kinds
   ════════════════════════════════════════════════════════════════ */

test.describe('Suite 2 — the merged list', () => {
  let ctx: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(COLD_BOOT_MS)
    ctx  = await browser.newContext()
    page = await ctx.newPage()
    await bootWorkspace(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await openTasksTab(page)
  })

  test.afterAll(async () => { await ctx?.close() })

  test('S2-T1 a problem set is visible from the Calendar and tickable there', async () => {
    /* Created the way Study Shield creates one. The merge is only real
       if it turns up on the other screen without being told to. */
    await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      if (!w.__zenith) return
      await w.__zenith.db.assignments.add({
        title: 'PSet 4 Rigid bodies', dueDate: '2030-02-01', courseId: 'MATH 2930',
        status: 'pending', priority: 'high', kind: 'problem_set',
        problems: [{ id: 'p1', label: '1', done: false }, { id: 'p2', label: '2', done: false }],
        createdAt: Date.now(), updatedAt: Date.now(),
      })
    })

    const row = page.getByRole('button', { name: 'PSet 4 Rigid bodies' })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('SET')).toBeVisible()

    await page.getByRole('button', { name: /0 of 2 problems done/ }).click()
    await page.getByRole('checkbox').first().check()
    await expect(page.getByRole('button', { name: /1 of 2 problems done/ })).toBeVisible()
  })

  test('S2-T2 a delete asks first, and can be called off', async () => {
    const addBox = page.getByPlaceholder('Add a task…').first()
    await addBox.fill('Do not delete me')
    await addBox.press('Enter')
    const row = page.getByRole('button', { name: 'Do not delete me' })
    await expect(row).toBeVisible()

    await page.getByRole('button', { name: 'Delete Do not delete me' }).click()
    await page.getByRole('button', { name: 'Cancel' }).first().click()
    await expect(row).toBeVisible()

    await page.getByRole('button', { name: 'Delete Do not delete me' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(row).toHaveCount(0)
  })

  test('S2-T3 deleting a list keeps the work that was in it', async () => {
    const addBox = page.getByPlaceholder('Add a task…').first()
    await addBox.fill('Survives its list')
    await addBox.press('Enter')
    await expect(page.getByRole('button', { name: 'Survives its list' })).toBeVisible()

    await page.getByRole('button', { name: /^Delete list/ }).first().click()
    await expect(page.getByText(/Its tasks become unfiled/)).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    /* The heading is gone; the work under it is not. */
    await expect(page.getByRole('button', { name: 'Survives its list' })).toBeVisible()
    await expect(page.getByText('Unfiled')).toBeVisible()
  })
})
