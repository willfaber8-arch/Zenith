/**
 * The first-run database audit, against a real database.
 *
 * The audit's job is to repair rows that would otherwise break the app.
 * The risk it carries is the mirror image: a stale rule quietly rewrites
 * data that was never broken, and because a repair run reports success
 * either way, nothing about the outcome looks wrong.
 */

import 'fake-indexeddb/auto'
import { db } from '@/lib/db'
import { auditAssignments } from '@/utils/dbAuditEngine'

beforeEach(async () => { await db.assignments.clear() })

const seed = (extra: Record<string, unknown>) => db.assignments.add({
  title: 'PSet 4', dueDate: '2026-09-20', courseId: 'MATH', status: 'pending',
  priority: 'high', createdAt: Date.now(), updatedAt: Date.now(), ...extra,
} as never) as Promise<number>

describe('auditing assignments', () => {
  /*
   * The descriptor's enum was ['Academic', 'Life'] — values from a
   * schema the app has not written since. Everything it writes now
   * ('scholastic' from Study Shield, 'life' from a reminder) failed the
   * check, and with no default configured the recovery value was the
   * first allowed entry: every assignment in the database came out of a
   * "repair" labelled Academic.
   */
  it('leaves the categories the app actually writes alone', async () => {
    const a = await seed({ category: 'scholastic' })
    const b = await seed({ category: 'life' })

    await auditAssignments()

    expect((await db.assignments.get(a))?.category).toBe('scholastic')
    expect((await db.assignments.get(b))?.category).toBe('life')
  })

  it('does not invent a category for a row that never had one', async () => {
    const id = await seed({})
    await auditAssignments()
    expect((await db.assignments.get(id))?.category).toBeUndefined()
  })

  it('still repairs a category of the wrong type', async () => {
    const id = await seed({ category: 42 })
    const res = await auditAssignments()
    expect(typeof (await db.assignments.get(id))?.category).toBe('string')
    expect(res.rowsPatched).toBe(1)
  })

  /* The rules that do earn their keep still have to work. */
  it('still resets a status outside the pipeline', async () => {
    const id = await seed({ status: 'banana' })
    await auditAssignments()
    expect((await db.assignments.get(id))?.status).toBe('pending')
  })

  it('still resets a priority it does not recognise', async () => {
    const id = await seed({ priority: 'urgent-ish' })
    await auditAssignments()
    expect((await db.assignments.get(id))?.priority).toBe('medium')
  })

  it('reports a clean table as clean', async () => {
    await seed({ category: 'scholastic' })
    const res = await auditAssignments()
    expect(res.rowsPatched).toBe(0)
    expect(res.issues).toHaveLength(0)
  })
})
