/**
 * Correcting a task instead of deleting it.
 *
 * The list could be added to, ticked off and deleted, never corrected —
 * a typo meant retyping the task. These rules are small, and each one
 * is here because getting it wrong destroys something.
 */

import { normaliseTaskEdit, isNoOpEdit, MAX_TITLE } from '@/utils/taskEdit'

const draft = (over: Partial<Parameters<typeof normaliseTaskEdit>[0]> = {}) =>
  ({ title: 'Read chapter 3', dueDate: '2026-09-12', categoryId: 1, ...over })

describe('normaliseTaskEdit', () => {
  it('accepts an ordinary edit', () => {
    const r = normaliseTaskEdit(draft())
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.patch).toEqual({
      title: 'Read chapter 3', dueDate: '2026-09-12', categoryId: 1,
    })
  })

  it('refuses an emptied title rather than blanking the task', () => {
    // A blank row renders as a line you can neither read nor find.
    for (const t of ['', '   ', '\n\t ']) {
      const r = normaliseTaskEdit(draft({ title: t }))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/needs a title/i)
    }
  })

  it('tidies whitespace without changing the words', () => {
    const r = normaliseTaskEdit(draft({ title: '  Read   chapter  3 ' }))
    expect(r.ok && r.patch.title).toBe('Read chapter 3')
  })

  it('clears the due date when the field is emptied', () => {
    // The difference that matters: "no due date now" has to reach the
    // database as a removal, not as a field nobody mentioned — otherwise
    // yesterday's deadline quietly stays.
    const r = normaliseTaskEdit(draft({ dueDate: '' }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.patch.dueDate).toBeUndefined()
  })

  it('refuses a date that is not a date', () => {
    for (const d of ['tomorrow', '12/09/2026', '2026-9-1']) {
      expect(normaliseTaskEdit(draft({ dueDate: d })).ok).toBe(false)
    }
  })

  it('refuses a task with no list to live in', () => {
    expect(normaliseTaskEdit(draft({ categoryId: NaN })).ok).toBe(false)
  })

  it('moves a task to another list', () => {
    const r = normaliseTaskEdit(draft({ categoryId: 7 }))
    expect(r.ok && r.patch.categoryId).toBe(7)
  })

  it('caps a pasted wall of text', () => {
    const r = normaliseTaskEdit(draft({ title: 'x'.repeat(MAX_TITLE + 500) }))
    expect(r.ok && r.patch.title.length).toBe(MAX_TITLE)
  })
})

describe('isNoOpEdit', () => {
  const current = { title: 'Read chapter 3', dueDate: '2026-09-12', categoryId: 1 }

  it('spots an edit that changed nothing', () => {
    const r = normaliseTaskEdit(draft())
    expect(r.ok && isNoOpEdit(r.patch, current)).toBe(true)
  })

  it('sees a changed title, date or list', () => {
    for (const d of [{ title: 'Read chapter 4' }, { dueDate: '2026-09-13' }, { categoryId: 2 }]) {
      const r = normaliseTaskEdit(draft(d))
      expect(r.ok && isNoOpEdit(r.patch, current)).toBe(false)
    }
  })

  it('treats a cleared date as a change', () => {
    const r = normaliseTaskEdit(draft({ dueDate: '' }))
    expect(r.ok && isNoOpEdit(r.patch, current)).toBe(false)
  })

  it('treats two ways of saying "no date" as the same', () => {
    const r = normaliseTaskEdit(draft({ dueDate: '' }))
    expect(r.ok && isNoOpEdit(r.patch, { title: 'Read chapter 3', categoryId: 1 })).toBe(true)
  })
})
