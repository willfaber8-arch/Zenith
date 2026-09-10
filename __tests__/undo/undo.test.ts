/**
 * Putting things back, against a real database.
 *
 * The question these answer is whether a restore actually restores —
 * same rows, same primary keys, so whatever pointed at them still
 * does. A "successful" undo that recreates a note under a new id looks
 * identical in the list and has quietly broken every reference to it.
 */

import 'fake-indexeddb/auto'
import { db } from '@/lib/db'
import { captureRows, restoreEntry, countLabel } from '@/lib/undo'

beforeEach(async () => {
  await db.quickNotes.clear()
  await db.assignments.clear()
})

const note = (title: string) => db.quickNotes.add({
  title, body: `body of ${title}`, category: 'idea',
  updatedAt: Date.now(), createdAt: Date.now(),
} as never) as Promise<number>

describe('capturing rows', () => {
  it('refuses to capture nothing', () => {
    expect(captureRows('quickNotes', [], 'delete')).toBeNull()
  })

  it('refuses a table that does not exist rather than throwing', () => {
    expect(captureRows('not_a_table', [{ id: 1 }], 'delete')).toBeNull()
  })

  it('keeps the rows as they were', async () => {
    const id = await note('Lecture 9')
    const row = await db.quickNotes.get(id)
    const entry = captureRows('quickNotes', [row!], 'delete')
    expect(entry?.before[0]).toMatchObject({ id, title: 'Lecture 9' })
  })
})

describe('undoing a delete', () => {
  it('brings the row back with the same id', async () => {
    const id = await note('Lecture 9')
    const row = await db.quickNotes.get(id)
    const entry = captureRows('quickNotes', [row!], 'delete')!

    await db.quickNotes.delete(id)
    expect(await db.quickNotes.get(id)).toBeUndefined()

    await restoreEntry(entry)
    const back = await db.quickNotes.get(id)
    expect(back?.id).toBe(id)          // the same row, not a copy
    expect(back?.title).toBe('Lecture 9')
    expect(back?.body).toBe('body of Lecture 9')
  })

  it('brings back several at once', async () => {
    const a = await note('One'), b = await note('Two')
    const rows = await db.quickNotes.bulkGet([a, b])
    const entry = captureRows('quickNotes', rows.filter(Boolean) as never[], 'delete')!

    await db.quickNotes.bulkDelete([a, b])
    expect(await db.quickNotes.count()).toBe(0)

    await restoreEntry(entry)
    expect(await db.quickNotes.count()).toBe(2)
  })

  /*
   * Undoing an *edit* has to overwrite rather than fail on a row that
   * still exists — one code path for both kinds of undo is what keeps
   * them from drifting apart.
   */
  it('overwrites a row that is still there, restoring its old values', async () => {
    const id = await note('Original')
    const row = await db.quickNotes.get(id)
    const entry = captureRows('quickNotes', [row!], 'edit')!

    await db.quickNotes.update(id, { title: 'Changed' })
    expect((await db.quickNotes.get(id))?.title).toBe('Changed')

    await restoreEntry(entry)
    expect((await db.quickNotes.get(id))?.title).toBe('Original')
  })

  it('works on a different table without being told how', async () => {
    const id = await db.assignments.add({
      title: 'PSet 4', dueDate: '2026-09-20', courseId: 'MATH',
      status: 'pending', priority: 'high',
      createdAt: Date.now(), updatedAt: Date.now(),
    } as never) as number
    const row = await db.assignments.get(id)
    const entry = captureRows('assignments', [row!], 'delete')!

    await db.assignments.delete(id)
    await restoreEntry(entry)
    expect((await db.assignments.get(id))?.title).toBe('PSet 4')
  })

  it('restores nothing, harmlessly, for a table that has gone away', async () => {
    const entry = { id: 'x', label: 'delete', at: Date.now(),
                    table: 'not_a_table', affectedIds: [1], before: [{ id: 1 }] }
    await expect(restoreEntry(entry)).resolves.toBe(0)
  })
})

describe('counting for the message', () => {
  it('says one thing in the singular', () => {
    expect(countLabel(1, 'note')).toBe('1 note')
    expect(countLabel(3, 'note')).toBe('3 notes')
  })

  it('takes an irregular plural', () => {
    expect(countLabel(2, 'entry', 'entries')).toBe('2 entries')
  })
})
