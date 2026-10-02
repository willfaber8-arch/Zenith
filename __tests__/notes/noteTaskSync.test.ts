/**
 * A note's checklist filed as one task, and the two kept in step —
 * against a real database, through the same writes the Tasks tab uses.
 */

import 'fake-indexeddb/auto'
import { db, type Assignment, type QuickNote } from '@/lib/db'
import { linkNoteToTask, syncNoteTask, unlinkNote } from '@/lib/noteTaskSync'
import { toggleProblem, setSubtasks, setDone, deleteTask } from '@/lib/taskMutations'
import { pendingTasks } from '@/lib/engines/NoteTaskDetector'

beforeEach(async () => {
  await db.assignments.clear()
  await db.quickNotes.clear()
})

const addNote = async (body: string, title = 'Groceries'): Promise<number> =>
  await db.quickNotes.add({
    title, body, category: 'idea', createdAt: 1, updatedAt: 1, titleManual: true,
  } as QuickNote) as number

const note = async (id: number) => (await db.quickNotes.get(id))!
const task = async (id: number) => (await db.assignments.get(id))!

const BODY = 'Groceries\n- [ ] Milk\n- [x] Eggs\n- [ ] Bread'

describe('filing a checklist', () => {
  it('makes one undated task named after the note, a step per line, ticked ones ticked', async () => {
    const id = await addNote(BODY)
    const r = await linkNoteToTask(id)
    expect(r).toMatchObject({ steps: 3, title: 'Groceries' })
    expect(await db.assignments.count()).toBe(1)

    const t = await task(r!.taskId)
    expect(t).toMatchObject({ title: 'Groceries', dueDate: '', kind: 'task', status: 'pending', sourceNoteId: id })
    expect(t.problems!.map(p => [p.label, p.done])).toEqual([['Milk', false], ['Eggs', true], ['Bread', false]])
    expect((await note(id)).taskLink?.taskId).toBe(r!.taskId)
  })

  it('groups plain to-do lines too, writing them into the note as checkboxes', async () => {
    const id = await addNote('Saturday\nCall mom\nbuy stamps\nA thought')
    const r = await linkNoteToTask(id)
    expect((await task(r!.taskId)).problems!.map(p => p.label)).toEqual(['Call mom', 'Buy stamps'])
    expect((await note(id)).body).toBe('Saturday\n- [ ] Call mom\n- [ ] Buy stamps\nA thought')
  })

  it('a list that is all ticked arrives as a finished task', async () => {
    const id = await addNote('- [x] One\n- [x] Two')
    const r = await linkNoteToTask(id)
    expect((await task(r!.taskId)).status).toBe('completed')
  })

  it('filing twice never makes a second task', async () => {
    const id = await addNote(BODY)
    const a = await linkNoteToTask(id)
    const b = await linkNoteToTask(id)
    expect(b!.taskId).toBe(a!.taskId)
    expect(await db.assignments.count()).toBe(1)
  })

  it('names the task "Checklist" when the note has no name', async () => {
    const id = await addNote('- [ ] a', 'Untitled note')
    expect((await linkNoteToTask(id))!.title).toBe('Checklist')
  })
})

describe('kept in step', () => {
  const linked = async () => {
    const id = await addNote(BODY)
    const r = await linkNoteToTask(id)
    return { id, taskId: r!.taskId }
  }

  it('ticking a step in the Tasks tab ticks the line in the note', async () => {
    const { id, taskId } = await linked()
    const t = await task(taskId)
    await toggleProblem(t, t.problems![0].id)
    expect((await note(id)).body).toBe('Groceries\n- [x] Milk\n- [x] Eggs\n- [ ] Bread')
  })

  it('ticking the last line in the note finishes the task; unticking reopens it', async () => {
    const { id, taskId } = await linked()
    await db.quickNotes.update(id, { body: 'Groceries\n- [x] Milk\n- [x] Eggs\n- [x] Bread' })
    await syncNoteTask(id)
    expect((await task(taskId)).status).toBe('completed')

    await db.quickNotes.update(id, { body: 'Groceries\n- [x] Milk\n- [ ] Eggs\n- [x] Bread' })
    await syncNoteTask(id)
    const t = await task(taskId)
    expect(t.status).toBe('pending')
    expect(t.completedAt).toBeUndefined()
  })

  it('a line added to the note joins the task as a step', async () => {
    const { id, taskId } = await linked()
    await db.quickNotes.update(id, { body: BODY + '\n- [ ] Butter' })
    await syncNoteTask(id)
    expect((await task(taskId)).problems!.map(p => p.label)).toEqual(['Milk', 'Eggs', 'Bread', 'Butter'])
  })

  it('a step added and one removed in the Tasks tab reach the note', async () => {
    const { id, taskId } = await linked()
    const t = await task(taskId)
    await setSubtasks(t, [...t.problems!.slice(1), { id: 'new', label: 'Jam', done: false }])
    expect((await note(id)).body).toBe('Groceries\n- [x] Eggs\n- [ ] Bread\n- [ ] Jam')
  })

  it('ticking the whole task off ticks every line', async () => {
    const { id, taskId } = await linked()
    await setDone(await task(taskId), true)
    expect((await note(id)).body).toBe('Groceries\n- [x] Milk\n- [x] Eggs\n- [x] Bread')
    expect((await task(taskId)).problems!.every(p => p.done)).toBe(true)
  })

  it('the task follows the note\'s name, until the task is renamed', async () => {
    const { id, taskId } = await linked()
    await db.quickNotes.update(id, { title: 'Weekly shop' })
    await syncNoteTask(id)
    expect((await task(taskId)).title).toBe('Weekly shop')

    await db.assignments.update(taskId, { title: 'Costco run' })
    await db.quickNotes.update(id, { title: 'Shop' })
    await syncNoteTask(id)
    expect((await task(taskId)).title).toBe('Costco run')
  })

  it('a note with nothing to change writes nothing', async () => {
    const { id, taskId } = await linked()
    const before = { n: await note(id), t: await task(taskId) }
    await syncNoteTask(id)
    expect(await note(id)).toEqual(before.n)
    expect(await task(taskId)).toEqual(before.t)
  })
})

describe('unlinking', () => {
  it('deleting the task drops the link and does not offer the lines again', async () => {
    const id = await addNote(BODY)
    const r = await linkNoteToTask(id)
    await deleteTask(r!.taskId)
    expect(await syncNoteTask(id)).toEqual({ unlinked: true })
    const n = await note(id)
    expect(n.taskLink).toBeUndefined()
    expect(pendingTasks(n.body, n.createdTasks ?? [])).toEqual([])
  })

  it('unlink leaves both as they are and stops them following each other', async () => {
    const id = await addNote(BODY)
    const r = await linkNoteToTask(id)
    await unlinkNote(id)
    const t: Assignment = await task(r!.taskId)
    await toggleProblem(t, t.problems![0].id)
    expect((await note(id)).body).toBe(BODY)
    expect((await note(id)).taskLink).toBeUndefined()
  })
})
