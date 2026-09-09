/**
 * A way back from a bad drag.
 *
 * Direct manipulation needs undo, and the awkward part is that the
 * calendar keeps no other record of where an event used to be — the old
 * position exists only in the row that was just overwritten. So entries
 * carry rows as they were, and undoing is a write rather than an
 * inverse calculation.
 */

import {
  pushUndo, peekUndo, popUndo, planUndo, describeUndo, clearUndo,
  UNDO_LIMIT, type UndoEntry,
} from '@/utils/undoStack'

type Row = { id?: number; title?: string; startMs?: number }

const entry = (over: Partial<UndoEntry<Row>> = {}): UndoEntry<Row> => ({
  id: 'e' + Math.random(), label: 'move', at: Date.now(),
  table: 'calendarEvents', affectedIds: [1], before: [{ id: 1, title: 'A' }],
  ...over,
})

describe('the stack', () => {
  it('puts the newest change first', () => {
    const s = pushUndo(pushUndo([], entry({ label: 'first' })), entry({ label: 'second' }))
    expect(peekUndo(s)?.label).toBe('second')
  })

  it('pops the newest and leaves the rest', () => {
    const s = pushUndo(pushUndo([], entry({ label: 'older' })), entry({ label: 'newer' }))
    const { entry: got, rest } = popUndo(s)
    expect(got?.label).toBe('newer')
    expect(rest).toHaveLength(1)
    expect(peekUndo(rest)?.label).toBe('older')
  })

  it('pops safely from an empty stack', () => {
    // The button can be pressed on an empty history without crashing.
    expect(popUndo([])).toEqual({ entry: null, rest: [] })
    expect(peekUndo([])).toBeNull()
  })

  it('never grows past the limit', () => {
    // A deleted series is stored whole, so an unbounded stack would keep
    // every row of every deletion alive for the session.
    let s: UndoEntry<Row>[] = []
    for (let i = 0; i < UNDO_LIMIT + 12; i++) s = pushUndo(s, entry({ label: `m${i}` }))
    expect(s).toHaveLength(UNDO_LIMIT)
  })

  it('drops the oldest when it overflows, not the newest', () => {
    let s: UndoEntry<Row>[] = []
    for (let i = 0; i < UNDO_LIMIT + 3; i++) s = pushUndo(s, entry({ label: `m${i}` }))
    expect(peekUndo(s)?.label).toBe(`m${UNDO_LIMIT + 2}`)
    expect(s.some(e => e.label === 'm0')).toBe(false)
  })

  it('never mutates the stack it was given', () => {
    const original = [entry({ label: 'keep' })]
    const copy = [...original]
    pushUndo(original, entry({ label: 'new' }))
    popUndo(original)
    expect(original).toEqual(copy)
  })

  it('clears to empty', () => {
    expect(clearUndo()).toEqual([])
  })
})

describe('planUndo', () => {
  it('writes back the rows as they were', () => {
    const e = entry({
      affectedIds: [1, 2],
      before: [{ id: 1, startMs: 100 }, { id: 2, startMs: 200 }],
    })
    const plan = planUndo(e)
    expect(plan.restore).toHaveLength(2)
    expect(plan.remove).toEqual([])
  })

  it('deletes rows the action created', () => {
    // An id the action touched with no prior row did not exist before,
    // so undoing it means removing it.
    const e = entry({ affectedIds: [1, 2, 3], before: [{ id: 1 }] })
    expect(planUndo(e).remove).toEqual([2, 3])
  })

  it('restores every row of a deleted series', () => {
    // The inverse of deleting forty occurrences is the forty rows.
    const rows = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, title: 'CHEM' }))
    const e = entry({ label: 'delete of 40', affectedIds: rows.map(r => r.id), before: rows })
    const plan = planUndo(e)
    expect(plan.restore).toHaveLength(40)
    expect(plan.remove).toEqual([])
  })

  it('copes with a row that has no id', () => {
    const e = entry({ affectedIds: [5], before: [{ title: 'orphan' }] })
    expect(() => planUndo(e)).not.toThrow()
    expect(planUndo(e).remove).toEqual([5])
  })
})

describe('describeUndo', () => {
  it('says what pressing the button will do', () => {
    expect(describeUndo(entry({ label: 'move' }))).toBe('Undo move')
    expect(describeUndo(entry({ label: 'delete of 40' }))).toBe('Undo delete of 40')
  })

  it('says so when there is nothing to undo', () => {
    expect(describeUndo(null)).toMatch(/nothing/i)
  })
})
