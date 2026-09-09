/**
 * The one task list, against a real database.
 *
 * Two behaviours here are the reason this file exists rather than a
 * pure test: unfiling a task depends on whether Dexie's `update()`
 * deletes a key set to `undefined` or ignores it, and deleting a list
 * has to be proven *not* to take its contents with it. Both are
 * answerable only by writing and reading back.
 */

import 'fake-indexeddb/auto'
import { db, type Assignment } from '@/lib/db'
import {
  createReminder, updateTask, deleteTask, deleteList, setDone, isDone, toggleProblem,
} from '@/lib/taskMutations'

beforeEach(async () => {
  await db.assignments.clear()
  await db.todo_categories.clear()
})

const newList = async (name: string): Promise<number> =>
  await db.todo_categories.add({ name, sortOrder: 0, createdAt: Date.now() } as never) as number

const get = async (id: number): Promise<Assignment | undefined> => db.assignments.get(id)

describe('creating a reminder', () => {
  it('stores it as a reminder in the given list', async () => {
    const list = await newList('Short Term')
    const id = await createReminder({ title: 'Buy stamps', listId: list })
    const row = await get(id!)
    expect(row?.kind).toBe('reminder')
    expect(row?.listId).toBe(list)
    expect(row?.status).toBe('pending')
  })

  it('accepts one with no deadline and no list', async () => {
    const id = await createReminder({ title: 'Email the registrar' })
    const row = await get(id!)
    expect(row?.dueDate).toBe('')
    expect(row?.listId).toBeUndefined()
  })

  it('refuses a blank title instead of writing an unreadable row', async () => {
    expect(await createReminder({ title: '   ' })).toBeNull()
    expect(await db.assignments.count()).toBe(0)
  })

  /* The gate that keeps a formerly local-only list off the network. */
  it('creates it below the priority the sync engine uploads', async () => {
    const id = await createReminder({ title: 'Groceries' })
    expect((await get(id!))?.priority).toBe('medium')
  })
})

describe('editing', () => {
  it('changes the title in place, keeping the same row', async () => {
    const id = await createReminder({ title: 'Read chpter 3' })
    await updateTask(id!, { title: 'Read chapter 3' })
    expect((await get(id!))?.title).toBe('Read chapter 3')
    expect(await db.assignments.count()).toBe(1)
  })

  it('does not un-tick something already done', async () => {
    const id = await createReminder({ title: 'Read chapter 3' })
    await db.assignments.update(id!, { status: 'completed' })
    await updateTask(id!, { title: 'Read chapter 4' })
    expect((await get(id!))?.status).toBe('completed')
  })

  /*
   * "No deadline now" has to reach the database as a real removal. If
   * it arrives as a field nobody mentioned, yesterday's date survives
   * an edit that looked like it cleared it.
   */
  it('actually clears a due date', async () => {
    const id = await createReminder({ title: 'Essay', dueDate: '2026-09-20' })
    await updateTask(id!, { dueDate: '' })
    expect((await get(id!))?.dueDate).toBe('')
  })

  it('moves a task between lists without duplicating it', async () => {
    const a = await newList('Short Term')
    const b = await newList('Long Term')
    const id = await createReminder({ title: 'Passport', listId: a })
    await updateTask(id!, { listId: b })
    expect((await get(id!))?.listId).toBe(b)
    expect(await db.assignments.count()).toBe(1)
  })

  /* Pins Dexie's behaviour: undefined deletes the key. */
  it('unfiles a task when the list is set to undefined', async () => {
    const a = await newList('Short Term')
    const id = await createReminder({ title: 'Passport', listId: a })
    await updateTask(id!, { listId: undefined })
    expect((await get(id!))?.listId).toBeUndefined()
  })
})

describe('completing', () => {
  it('round-trips done and not done', async () => {
    const id = await createReminder({ title: 'Stamps' })
    const row = (await get(id!))!
    await setDone(row, true)
    expect(isDone((await get(id!))!)).toBe(true)
    await setDone((await get(id!))!, false)
    expect(isDone((await get(id!))!)).toBe(false)
  })
})

describe('problem sets', () => {
  const seedSet = async (): Promise<number> => await db.assignments.add({
    title: 'PSet 4', dueDate: '2026-09-20', courseId: 'MATH', status: 'pending',
    priority: 'high', kind: 'problem_set',
    problems: [
      { id: 'p1', label: '1', done: false },
      { id: 'p2', label: '2', done: false },
    ],
    createdAt: Date.now(), updatedAt: Date.now(),
  } as never) as number

  it('closes the set when the last problem is ticked', async () => {
    const id = await seedSet()
    await toggleProblem((await get(id))!, 'p1')
    expect((await get(id))?.status).toBe('pending')

    const res = await toggleProblem((await get(id))!, 'p2')
    expect(res.justCompleted).toBe(true)
    expect((await get(id))?.status).toBe('completed')
  })

  /*
   * The other direction matters too: a set that says it is done while
   * visibly holding an unfinished problem is a list you stop believing.
   */
  it('reopens the set when a problem is un-ticked', async () => {
    const id = await seedSet()
    await toggleProblem((await get(id))!, 'p1')
    await toggleProblem((await get(id))!, 'p2')
    expect((await get(id))?.status).toBe('completed')

    await toggleProblem((await get(id))!, 'p2')
    expect((await get(id))?.status).toBe('pending')
  })
})

describe('deleting', () => {
  it('removes one task and nothing else', async () => {
    const keep = await createReminder({ title: 'Keep' })
    const kill = await createReminder({ title: 'Kill' })
    await deleteTask(kill!)
    expect((await db.assignments.toArray()).map(a => a.id)).toEqual([keep])
  })

  /*
   * The old to-do table cascaded — deleting a list destroyed everything
   * filed under it, silently and with no way back. Losing a heading
   * must not cost you the work under it.
   */
  it('never deletes the work inside a list', async () => {
    const list = await newList('Coursework')
    await createReminder({ title: 'Essay', listId: list })
    await createReminder({ title: 'Reading', listId: list })

    const moved = await deleteList(list)

    expect(moved).toBe(2)
    expect(await db.assignments.count()).toBe(2)
    const rows = await db.assignments.toArray()
    expect(rows.every(r => r.listId === undefined)).toBe(true)
    expect(await db.todo_categories.get(list)).toBeUndefined()
  })

  it('leaves other lists alone', async () => {
    const a = await newList('A')
    const b = await newList('B')
    await createReminder({ title: 'in A', listId: a })
    await createReminder({ title: 'in B', listId: b })

    await deleteList(a)

    const rows = await db.assignments.toArray()
    expect(rows.find(r => r.title === 'in B')?.listId).toBe(b)
  })
})
