/**
 * Breaking a task into steps.
 *
 * The storage already existed — `Assignment.problems` is a list of
 * labelled, tickable items, and nothing about it is problem-set-shaped.
 * What is new is the rules around editing that list, and the naming
 * that decides whether it reads as "problems" or "steps".
 */

import {
  addSubtask, removeSubtask, renameSubtask, progressOf, parseSubtaskLines,
  listLabel, itemNoun, MAX_STEPS, MAX_LABEL, type SubtaskLike,
} from '@/utils/subtasks'

const step = (id: string, label: string, done = false): SubtaskLike => ({ id, label, done })

describe('naming', () => {
  it('calls them problems on a problem set and steps everywhere else', () => {
    expect(listLabel('problem_set')).toBe('Problems')
    expect(listLabel('task')).toBe('Steps')
    expect(listLabel('reminder')).toBe('Steps')
    expect(itemNoun('problem_set')).toBe('problem')
    expect(itemNoun('task')).toBe('step')
  })
})

describe('progress', () => {
  /*
   * A task with no steps is not a task that is 0% done. Returning null
   * rather than a zeroed object is what stops an empty progress bar
   * appearing on every ordinary task and saying something untrue.
   */
  it('is absent when there are no steps at all', () => {
    expect(progressOf([])).toBeNull()
    expect(progressOf(undefined)).toBeNull()
    expect(progressOf(null)).toBeNull()
  })

  it('counts what is done', () => {
    expect(progressOf([step('a', 'x', true), step('b', 'y')]))
      .toEqual({ done: 1, total: 2, pct: 50 })
  })

  it('reaches 100 when everything is ticked', () => {
    expect(progressOf([step('a', 'x', true)])?.pct).toBe(100)
  })
})

describe('adding', () => {
  it('appends, keeping what was there', () => {
    const r = addSubtask([step('a', 'first')], 'second')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.items.map(i => i.label)).toEqual(['first', 'second'])
  })

  it('starts a list from nothing', () => {
    const r = addSubtask(undefined, 'only')
    expect(r.ok && r.items).toHaveLength(1)
  })

  /*
   * An unreadable row in a checklist is worse than a missing one: it
   * still has to be ticked before the task can close.
   */
  it('refuses a blank step', () => {
    expect(addSubtask([], '   ').ok).toBe(false)
    expect(addSubtask([], '').ok).toBe(false)
  })

  it('gives each step its own id', () => {
    const a = addSubtask([], 'one')
    const b = a.ok ? addSubtask(a.items, 'two') : null
    if (b?.ok) expect(b.items[0].id).not.toBe(b.items[1].id)
  })

  it('stops at the ceiling rather than growing without limit', () => {
    const full = Array.from({ length: MAX_STEPS }, (_, i) => step(`s${i}`, `step ${i}`))
    const r = addSubtask(full, 'one too many')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain(String(MAX_STEPS))
  })

  it('trims a label that would run away', () => {
    const r = addSubtask([], 'x'.repeat(MAX_LABEL + 50))
    expect(r.ok && r.items[0].label.length).toBe(MAX_LABEL)
  })
})

describe('removing and renaming', () => {
  const items = [step('a', 'first'), step('b', 'second', true)]

  it('removes one, leaving the rest alone', () => {
    expect(removeSubtask(items, 'a').map(i => i.id)).toEqual(['b'])
  })

  it('ignores an id that is not there', () => {
    expect(removeSubtask(items, 'zzz')).toHaveLength(2)
  })

  it('renames in place, keeping the tick', () => {
    const out = renameSubtask(items, 'b', 'renamed')
    expect(out.find(i => i.id === 'b')).toMatchObject({ label: 'renamed', done: true })
  })

  /* Same reason as refusing a blank add — an emptied label must not
     become a row nobody can read. */
  it('treats an emptied rename as a no-op, not a wipe', () => {
    expect(renameSubtask(items, 'a', '  ').find(i => i.id === 'a')?.label).toBe('first')
  })
})

describe('pasting a list in', () => {
  it('makes one step per line', () => {
    expect(parseSubtaskLines('book flights\nbook hotel\nrenew passport'))
      .toEqual(['book flights', 'book hotel', 'renew passport'])
  })

  /*
   * People paste the bullets along with the list. A step labelled
   * "- buy milk" is a step someone has to go back and edit.
   */
  it('strips the bullets that come with a pasted list', () => {
    expect(parseSubtaskLines('- one\n* two\n• three\n1. four\n2) five'))
      .toEqual(['one', 'two', 'three', 'four', 'five'])
  })

  it('drops blank lines rather than making empty steps', () => {
    expect(parseSubtaskLines('one\n\n   \ntwo')).toEqual(['one', 'two'])
  })

  it('does not mistake a hyphenated word for a bullet', () => {
    expect(parseSubtaskLines('re-read chapter 3')).toEqual(['re-read chapter 3'])
  })

  it('stops at the ceiling', () => {
    const many = Array.from({ length: MAX_STEPS + 20 }, (_, i) => `s${i}`).join('\n')
    expect(parseSubtaskLines(many)).toHaveLength(MAX_STEPS)
  })
})
