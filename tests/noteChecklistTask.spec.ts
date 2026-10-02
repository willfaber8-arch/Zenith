/**
 * tests/noteChecklistTask.spec.ts — a note's checklist filed as one task,
 * in a real browser, ticked from both ends.
 *
 *   · "Add" makes ONE undated task named after the note, a step per line,
 *     with the already-ticked line ticked
 *   · ticking a line in the note ticks the step
 *   · ticking a step in the Tasks tab ticks the line in the note
 */

import { test, expect, type Page } from '@playwright/test'
import { injectAuth, waitForBridge, navigateTo } from './helpers/bridge'

interface Row { id: number; title: string; dueDate: string; kind?: string; sourceNoteId?: number;
  problems?: { id: string; label: string; done: boolean }[] }

const tasks = (page: Page) => page.evaluate(async () =>
  await window.__zenith!.db.assignments.toArray()) as Promise<Row[]>
const noteBody = (page: Page, id: number) => page.evaluate(async (id) =>
  (await window.__zenith!.db.quickNotes.get(id))!.body, id)

test.describe('a note checklist as one task', () => {
  test.beforeEach(async ({ context }) => { await injectAuth(context) })

  test('files as one task and stays in step both ways', async ({ page }) => {
    await page.context().addInitScript(() => {
      localStorage.setItem('zenith_onboarding_completed_v1', 'true')
      localStorage.setItem('zenith_tutorial_v1', JSON.stringify({ sessionsShown: 9 }))
      localStorage.setItem('zenith_tour_v2', JSON.stringify({ seenAt: Date.now() }))
    })
    await page.goto('/')
    await waitForBridge(page)
    const noteId = await page.evaluate(async () => await window.__zenith!.db.quickNotes.add({
      title: 'Groceries', titleManual: true, category: 'idea',
      body: '- [ ] Milk\n- [x] Eggs\n- [ ] Bread',
      createdAt: Date.now(), updatedAt: Date.now(),
    } as never) as number)

    await navigateTo(page, 'Notes')
    await page.getByRole('button', { name: /Groceries/ }).first().click()

    const consent = page.getByRole('group', { name: 'Add to-dos to tasks' })
    await expect(consent).toContainText('one task with 3 steps')
    await consent.getByRole('button', { name: 'Add', exact: true }).click()

    await expect.poll(async () => (await tasks(page)).length).toBe(1)
    const [t] = await tasks(page)
    expect(t).toMatchObject({ title: 'Groceries', dueDate: '', kind: 'task', sourceNoteId: noteId })
    expect(t.problems!.map(p => [p.label, p.done])).toEqual([['Milk', false], ['Eggs', true], ['Bread', false]])

    const strip = page.getByRole('group', { name: 'Linked task' })
    await expect(strip).toContainText('1 of 3 done')
    await expect(consent).toHaveCount(0)

    /* Note → task. */
    await page.locator('label', { hasText: 'Milk' }).getByRole('checkbox').check()
    await expect.poll(async () => (await tasks(page))[0].problems![0].done).toBe(true)
    await expect(strip).toContainText('2 of 3 done')

    /* Task → note. */
    await strip.getByRole('button', { name: 'Open in Tasks' }).click()
    await page.getByRole('button', { name: /2 of 3 steps done/ }).click()
    // The last step finishes the task, which moves it out of the open list — so
    // click and read the result from the database rather than the checkbox.
    await page.locator('label', { hasText: 'Bread' }).getByRole('checkbox').click()
    await expect.poll(() => noteBody(page, noteId)).toBe('- [x] Milk\n- [x] Eggs\n- [x] Bread')
    expect(await page.evaluate(async () =>
      (await window.__zenith!.db.assignments.toArray())[0].status)).toBe('completed')
  })
})
