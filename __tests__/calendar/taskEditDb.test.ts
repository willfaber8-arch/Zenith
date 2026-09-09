/**
 * Writing a task edit, against a real database.
 *
 * One question here cannot be answered by reading the types: does
 * `update()` with an `undefined` value remove the field, or ignore it?
 * If it ignores it, clearing a due date silently leaves yesterday's
 * deadline in place — the edit appears to work and does not.
 */

import 'fake-indexeddb/auto'
import { db } from '@/lib/db'
import { normaliseTaskEdit } from '@/utils/taskEdit'

beforeEach(async () => {
  await db.todo_items.clear()
  await db.todo_categories.clear()
})

async function seedTask(dueDate?: string): Promise<number> {
  const catId = await db.todo_categories.add({
    name: 'Schoolwork', sortOrder: 0, createdAt: Date.now(),
  } as never) as number
  return await db.todo_items.add({
    categoryId: catId, title: 'Read chapter 3', completed: 0,
    dueDate, createdAt: Date.now(),
  } as never) as number
}

describe('applying an edit', () => {
  it('changes the title in place, keeping the same row', async () => {
    const id = await seedTask('2026-09-12')
    const r = normaliseTaskEdit({ title: 'Read chapter 4', dueDate: '2026-09-12', categoryId: 1 })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    await db.todo_items.update(id, r.patch)
    const row = await db.todo_items.get(id)
    expect(row?.title).toBe('Read chapter 4')
    expect(row?.id).toBe(id)                    // edited, not replaced
    expect(await db.todo_items.count()).toBe(1)
  })

  it('keeps the completed flag through an edit', async () => {
    // Correcting a typo must not un-tick something already done.
    const id = await seedTask()
    await db.todo_items.update(id, { completed: 1 })
    const r = normaliseTaskEdit({ title: 'Fixed title', dueDate: '', categoryId: 1 })
    if (r.ok) await db.todo_items.update(id, r.patch)
    expect((await db.todo_items.get(id))?.completed).toBe(1)
  })

  it('actually removes the due date when it is cleared', async () => {
    // The behaviour worth checking rather than assuming: an `undefined`
    // in an update must delete the field, or the deadline silently
    // survives an edit that looked like it removed it.
    const id = await seedTask('2026-09-12')
    const r = normaliseTaskEdit({ title: 'Read chapter 3', dueDate: '', categoryId: 1 })
    if (!r.ok) throw new Error('expected a valid edit')

    await db.todo_items.update(id, r.patch)
    const row = await db.todo_items.get(id)
    expect(row?.dueDate).toBeUndefined()
  })

  it('sets a due date on a task that had none', async () => {
    const id = await seedTask()
    const r = normaliseTaskEdit({ title: 'Read chapter 3', dueDate: '2026-10-01', categoryId: 1 })
    if (r.ok) await db.todo_items.update(id, r.patch)
    expect((await db.todo_items.get(id))?.dueDate).toBe('2026-10-01')
  })

  it('moves a task to another list without duplicating it', async () => {
    const id = await seedTask()
    const other = await db.todo_categories.add({
      name: 'Personal', sortOrder: 1, createdAt: Date.now(),
    } as never) as number

    const r = normaliseTaskEdit({ title: 'Read chapter 3', dueDate: '', categoryId: other })
    if (r.ok) await db.todo_items.update(id, r.patch)

    expect((await db.todo_items.get(id))?.categoryId).toBe(other)
    expect(await db.todo_items.count()).toBe(1)
  })
})
