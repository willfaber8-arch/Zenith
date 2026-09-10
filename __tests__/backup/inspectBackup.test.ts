/**
 * Reading a backup before trusting it.
 *
 * Restoring clears every table before it writes. Choosing a file used
 * to trigger that immediately, so the file picker's OK button was the
 * point of no return for the whole database. `inspectBackup` is what
 * makes the question askable: it has to describe the file accurately
 * and refuse a bad one *without* touching anything.
 */

import { inspectBackup } from '@/utils/dbImporter'

const payload = (tables: Record<string, unknown[]>) => JSON.stringify({
  version: 1, exportedAt: 1_760_000_000_000, schemaVersion: 46, tables,
})

describe('inspecting a backup', () => {
  it('counts the rows and the tables that hold them', () => {
    const s = inspectBackup(payload({
      habits: [{ id: 1 }, { id: 2 }],
      assignments: [{ id: 1 }],
    }))
    expect(s.rowCount).toBe(3)
    expect(s.tableCount).toBe(2)
  })

  /* An empty table is not something you would recognise your data by. */
  it('ignores tables with nothing in them', () => {
    const s = inspectBackup(payload({ habits: [{ id: 1 }], quickNotes: [] }))
    expect(s.tableCount).toBe(1)
    expect(s.largest.map(t => t.name)).toEqual(['habits'])
  })

  it('names the biggest tables first, so the file is recognisable', () => {
    const s = inspectBackup(payload({
      small: [{}], big: [{}, {}, {}], mid: [{}, {}],
    }))
    expect(s.largest.map(t => t.name)).toEqual(['big', 'mid', 'small'])
  })

  it('reports when the backup was taken', () => {
    expect(inspectBackup(payload({ habits: [{}] })).exportedAt).toBe(1_760_000_000_000)
  })

  it('carries the schema version when the file records one', () => {
    expect(inspectBackup(payload({ habits: [{}] })).schemaVersion).toBe(46)
    const older = JSON.stringify({ version: 1, exportedAt: 1, tables: { habits: [{}] } })
    expect(inspectBackup(older).schemaVersion).toBeNull()
  })

  /*
   * Refusing here rather than mid-restore is the point: a malformed
   * file must never get as far as clearing a table.
   */
  it('refuses a file that is not JSON', () => {
    expect(() => inspectBackup('not json at all')).toThrow(/valid Zenith OS backup/)
  })

  it('refuses JSON that is not a backup', () => {
    expect(() => inspectBackup('{"hello":"world"}')).toThrow(/backup format/)
    expect(() => inspectBackup('[1,2,3]')).toThrow(/backup format/)
  })

  it('refuses a backup whose tables are an array rather than an object', () => {
    expect(() => inspectBackup(JSON.stringify({ version: 1, exportedAt: 1, tables: [] })))
      .toThrow(/backup format/)
  })

  it('accepts a backup that is simply empty', () => {
    const s = inspectBackup(payload({}))
    expect(s.rowCount).toBe(0)
    expect(s.tableCount).toBe(0)
  })
})
