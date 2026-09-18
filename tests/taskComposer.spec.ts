/**
 * tests/taskComposer.spec.ts — one place to write something down.
 *
 * The Tasks tab used to put an add-row at the foot of every list, so
 * the number of places to type a task grew with the number of lists and
 * each one held its own half-finished draft. Which box you had started
 * typing in was the only thing that decided where the task landed, and
 * it was invisible until you pressed Enter.
 *
 * There is one composer now, and the list is a field on it. These tests
 * hold that shape: exactly one entry point however many lists exist,
 * and the priority and course that previously only existed in Study
 * Shield's panel actually reaching the row that gets written.
 */

import { test, expect } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

interface StoredTask {
  title: string; priority: string; courseId: string
  listId?: number; kind?: string
}

async function openTasksTab(page: import('@playwright/test').Page) {
  await navigateTo(page, 'Universal Calendar')
  await page.getByRole('button', { name: 'Tasks', exact: true }).click()
}

test.describe('the task composer', () => {

  test.beforeEach(async ({ page, context }) => {
    await injectAuth(context)
    await context.addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
    })
    await page.goto('/')
    await waitForBridge(page)
  })

  test('there is exactly one of it, whatever the lists', async ({ page }) => {
    await openTasksTab(page)

    /* The tab seeds Short Term and Long Term, and Unfiled is always a
       heading — three boxes under the old layout, three add-rows. */
    const addInputs = page.getByPlaceholder('Add a task…')
    await expect(addInputs).toHaveCount(1, { timeout: 15_000 })

    /* Adding a fourth list must not add a fourth way to type a task. */
    await page.getByRole('button', { name: '+ New List' }).click()
    await page.getByPlaceholder('List name…').fill('Someday')
    await page.getByRole('button', { name: 'Add list' }).click()

    /* exact — the delete control beside it is named "Delete list Someday". */
    await expect(page.getByRole('button', { name: 'Someday', exact: true })).toBeVisible()
    await expect(addInputs).toHaveCount(1)
  })

  test('files into the list you pick, with the priority and course you set',
    async ({ page }) => {
      await openTasksTab(page)

      await expect(page.getByPlaceholder('Add a task…')).toBeVisible({ timeout: 15_000 })

      await page.getByPlaceholder('Add a task…').fill('Rewrite chapter 3')
      await page.getByLabel('Priority').selectOption('critical')
      await page.getByLabel('Course — optional').fill('PHYS 2213')
      await page.getByLabel('Which list to file this in').selectOption({ label: 'Long Term' })
      await page.getByRole('button', { name: 'Add', exact: true }).click()

      /* The fields the Calendar's quick-add never had have to survive
         the trip: anything added here used to arrive Medium and
         untagged no matter what, because there was nowhere to say
         otherwise. */
      const written = await page.evaluate(async () => {
        const rows = await window.__zenith!.db.assignments.toArray()
        return rows.map((r: StoredTask) => ({
          title: r.title, priority: r.priority,
          courseId: r.courseId, listId: r.listId ?? null,
        }))
      }) as { title: string; priority: string; courseId: string; listId: number | null }[]

      const row = written.find(r => r.title === 'Rewrite chapter 3')
      expect(row).toBeTruthy()
      expect(row!.priority).toBe('critical')
      expect(row!.courseId).toBe('PHYS 2213')
      expect(row!.listId).not.toBeNull()

      /* And it is filed where it was told, not where the cursor was. */
      const lists = await page.evaluate(async () =>
        window.__zenith!.db.todo_categories.toArray()) as { id: number; name: string }[]
      expect(lists.find(l => l.id === row!.listId)?.name).toBe('Long Term')
    })

  test('keeps the filing but clears the item after adding', async ({ page }) => {
    await openTasksTab(page)

    const title = page.getByPlaceholder('Add a task…')
    await expect(title).toBeVisible({ timeout: 15_000 })

    await title.fill('Book flights')
    await page.getByLabel('Priority').selectOption('high')
    await page.getByLabel('Which list to file this in').selectOption({ label: 'Long Term' })
    await page.getByRole('button', { name: 'Add', exact: true }).click()

    /* Adding three things to one list at one priority should not mean
       re-picking the list and the priority three times — only the title
       and date, which belong to the item, are cleared. */
    await expect(title).toHaveValue('')
    await expect(page.getByLabel('Priority')).toHaveValue('high')
    await expect(page.getByLabel('Which list to file this in'))
      .not.toHaveValue('0')
  })
})

test.describe('Study Shield', () => {

  test('no longer carries a second task list', async ({ page, context }) => {
    await injectAuth(context)
    await context.addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
    })
    await page.goto('/')
    await waitForBridge(page)

    await navigateTo(page, 'Study Shield')

    /* The point of the move: one place tasks live. A Work tab here
       would be the second one again. */
    const tabs = page.getByRole('tab')
    await expect(tabs.first()).toBeVisible({ timeout: 15_000 })
    const labels = await tabs.allInnerTexts()
    expect(labels).not.toContain('Work')
    expect(labels).not.toContain('Task Roadmap')
    expect(labels).toContain('Review')
  })
})

test.describe('tasks that existed before the reorganisation', () => {

  test('are all still there, and all still reachable', async ({ page, context }) => {
    await injectAuth(context)
    await context.addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
    })
    await page.goto('/')
    await waitForBridge(page)

    /*
     * Seeded the way they would already exist: every kind, filed and
     * unfiled, open and done. Two screens used to write these rows and
     * one of those screens is gone — the rows it wrote are ordinary
     * rows in `assignments` and have to stay readable from the one that
     * remains, including the completed ones behind "Show done".
     */
    await page.evaluate(async () => {
      const db = window.__zenith!.db
      const now = Date.now()
      /* `as const` on the union fields: a widened `string` does not
         satisfy Dexie's InsertType and fails the typecheck CI runs. */
      const base = {
        status: 'pending' as const, priority: 'medium' as const,
        category: 'scholastic', kind: 'task' as const,
        courseId: '', dueDate: '',
        createdAt: now, updatedAt: now,
      }
      await db.assignments.bulkAdd([
        { ...base, title: 'Filed task',          listId: 1 },
        { ...base, title: 'Unfiled task' },
        { ...base, title: 'A reminder',          kind: 'reminder' as const, category: 'life' },
        { ...base, title: 'A problem set',       kind: 'problem_set' as const, problems: [] },
        { ...base, title: 'Already done',        status: 'completed' as const, completedAt: now },
        { ...base, title: 'Filed in a dead list', listId: 9999 },
      ])
    })

    await page.reload()
    await waitForBridge(page)

    /* Nothing was dropped on the way through. */
    const titles = await page.evaluate(async () => {
      const rows = await window.__zenith!.db.assignments.toArray()
      return (rows as { title: string }[]).map(r => r.title).sort()
    })
    expect(titles).toEqual([
      'A problem set', 'A reminder', 'Already done', 'Filed in a dead list',
      'Filed task', 'Unfiled task',
    ])

    await openTasksTab(page)
    await expect(page.getByPlaceholder('Add a task…')).toBeVisible({ timeout: 15_000 })

    /* And every open one is on screen — a row whose list no longer
       exists has to surface under Unfiled rather than vanish with it. */
    for (const t of ['Filed task', 'Unfiled task', 'A reminder',
                     'A problem set', 'Filed in a dead list']) {
      await expect(page.getByText(t, { exact: true })).toBeVisible()
    }

    /* The completed one is hidden, not deleted. */
    await expect(page.getByText('Already done', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Show done' }).click()
    await expect(page.getByText('Already done', { exact: true })).toBeVisible()
  })
})
