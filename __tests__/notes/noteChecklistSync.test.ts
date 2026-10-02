/**
 * A note's checklist and its task's steps as one list — the three-way
 * merge, line by line.
 */

import {
  mergeChecklist, initialLink, imperativesToChecklist, stepLabelFromLine,
  noteChecklist, sameBase, MAX_LINK_STEPS, type LinkItem, type StepLike,
} from '@/utils/noteChecklistSync'

let n = 0
const newId = () => `new${++n}`
beforeEach(() => { n = 0 })

const BODY = [
  'Groceries',
  '',
  '- [ ] Milk',
  '- [x] Eggs',
  '- [ ] Bread',
  '',
  'Notes after the list.',
].join('\n')

const base = (): LinkItem[] => [
  { stepId: 'a', label: 'Milk',  done: false },
  { stepId: 'b', label: 'Eggs',  done: true },
  { stepId: 'c', label: 'Bread', done: false },
]
const steps = (): StepLike[] => base().map(b => ({ id: b.stepId, label: b.label, done: b.done }))

const merge = (body: string, s: StepLike[], b: LinkItem[] = base()) =>
  mergeChecklist({ body, base: b, steps: s, newId })

describe('first link', () => {
  it('turns every checklist line into a step, ticked ones ticked', () => {
    const r = initialLink(BODY, newId)
    expect(r.body).toBe(BODY)
    expect(r.steps.map(s => [s.label, s.done])).toEqual([['Milk', false], ['Eggs', true], ['Bread', false]])
    expect(r.base.map(b => b.stepId)).toEqual(r.steps.map(s => s.id))
  })

  it('writes to-do lines as checkboxes, keeping the whole line', () => {
    const body = 'Weekend\nCall mom\ntodo: buy milk\nDon\'t forget to email Sam\nJust a thought'
    const r = initialLink(body, newId)
    expect(r.body).toBe('Weekend\n- [ ] Call mom\n- [ ] Buy milk\n- [ ] Email Sam\nJust a thought')
    expect(r.steps.map(s => s.label)).toEqual(['Call mom', 'Buy milk', 'Email Sam'])
  })

  it('leaves a note that already has checkboxes alone', () => {
    const body = '- [ ] Milk\nCall mom'
    expect(imperativesToChecklist(body)).toBe(body)
  })

  it('names a step by its whole line, not the words after the verb', () => {
    expect(stepLabelFromLine('  Call mom  ')).toBe('Call mom')
    expect(stepLabelFromLine('task: renew passport')).toBe('Renew passport')
  })
})

describe('nothing changed', () => {
  it('returns the body character for character and the same steps', () => {
    const r = merge(BODY, steps())
    expect(r.body).toBe(BODY)
    expect(r.noteChanged).toBe(false)
    expect(r.stepsChanged).toBe(false)
    expect(sameBase(base(), r.base)).toBe(true)
  })
})

describe('ticking', () => {
  it('a line ticked in the note ticks the step', () => {
    const r = merge(BODY.replace('- [ ] Milk', '- [x] Milk'), steps())
    expect(r.steps.find(s => s.id === 'a')!.done).toBe(true)
    expect(r.stepsChanged).toBe(true)
    expect(r.noteChanged).toBe(false)
  })

  it('a step ticked in the task ticks the line, touching only that line', () => {
    const s = steps(); s[2].done = true
    const r = merge(BODY, s)
    expect(r.body).toBe(BODY.replace('- [ ] Bread', '- [x] Bread'))
    expect(r.stepsChanged).toBe(false)
  })

  it('a step unticked in the task unticks the line', () => {
    const s = steps(); s[1].done = false
    expect(merge(BODY, s).body).toBe(BODY.replace('- [x] Eggs', '- [ ] Eggs'))
  })

  it('ticked on both sides at once is simply ticked', () => {
    const s = steps(); s[0].done = true
    const r = merge(BODY.replace('- [ ] Milk', '- [x] Milk'), s)
    expect(r.steps[0].done).toBe(true)
    expect(r.noteChanged).toBe(false)
    expect(r.stepsChanged).toBe(false)
  })

  it('keeps the indentation, bullet style and capital X of a line it rewrites', () => {
    const body = '  * [X] Milk\n1. [ ] Eggs'
    const b: LinkItem[] = [{ stepId: 'a', label: 'Milk', done: true }, { stepId: 'b', label: 'Eggs', done: false }]
    const s: StepLike[] = [{ id: 'a', label: 'Milk', done: false }, { id: 'b', label: 'Eggs', done: true }]
    expect(merge(body, s, b).body).toBe('  * [ ] Milk\n1. [x] Eggs')
  })
})

describe('adding', () => {
  it('a line added to the note becomes a new step in its place', () => {
    const body = BODY.replace('- [x] Eggs', '- [x] Eggs\n- [ ] Butter')
    const r = merge(body, steps())
    expect(r.steps.map(s => s.label)).toEqual(['Milk', 'Eggs', 'Butter', 'Bread'])
    expect(r.steps[2].id).toBe('new1')
    expect(r.body).toBe(body)
  })

  it('a step added in the task joins the note after the last checklist line', () => {
    const s = [...steps(), { id: 'd', label: 'Butter', done: false }]
    const r = merge(BODY, s)
    expect(r.body).toBe(BODY.replace('- [ ] Bread', '- [ ] Bread\n- [ ] Butter'))
    expect(r.base.map(b => b.stepId)).toEqual(['a', 'b', 'c', 'd'])
    expect(r.stepsChanged).toBe(false)
  })

  it('a ticked step added in the task arrives ticked', () => {
    const r = merge(BODY, [...steps(), { id: 'd', label: 'Jam', done: true }])
    expect(r.body).toContain('- [x] Jam')
  })

  it('when the note has no checklist left, new steps go at the end', () => {
    const body = 'Just prose now'
    const r = merge(body, [{ id: 'z', label: 'Tea', done: false }], [])
    expect(r.body).toBe('Just prose now\n\n- [ ] Tea')
  })
})

describe('deleting', () => {
  it('a line deleted from the note removes the step', () => {
    const r = merge(BODY.replace('- [x] Eggs\n', ''), steps())
    expect(r.steps.map(s => s.id)).toEqual(['a', 'c'])
  })

  it('a step deleted in the task removes the line', () => {
    const r = merge(BODY, steps().filter(s => s.id !== 'a'))
    expect(r.body).toBe(BODY.replace('- [ ] Milk\n', ''))
    expect(r.base.map(b => b.stepId)).toEqual(['b', 'c'])
  })

  it('a step deleted in the task is kept if the note ticked it meanwhile', () => {
    const body = BODY.replace('- [ ] Milk', '- [x] Milk')
    const r = merge(body, steps().filter(s => s.id !== 'a'))
    expect(r.body).toBe(body)
    expect(r.steps[0]).toMatchObject({ id: 'a', label: 'Milk', done: true })
  })

  it('a line deleted from the note is put back if the task ticked it meanwhile', () => {
    const s = steps(); s[2].done = true
    const r = merge(BODY.replace('- [ ] Bread\n', ''), s)
    expect(r.body).toContain('- [x] Bread')
    expect(r.steps.map(x => x.id)).toContain('c')
  })
})

describe('renaming', () => {
  it('a step renamed in the task renames the line', () => {
    const s = steps(); s[0].label = 'Oat milk'
    expect(merge(BODY, s).body).toBe(BODY.replace('- [ ] Milk', '- [ ] Oat milk'))
  })

  it('a line renamed in the note keeps the step, its id and its extra fields', () => {
    const s: StepLike[] = steps(); s[0].note = 'the blue carton'
    const r = merge(BODY.replace('- [ ] Milk', '- [ ] Oat milk'), s)
    expect(r.steps[0]).toEqual({ id: 'a', label: 'Oat milk', done: false, note: 'the blue carton' })
  })

  it('matches lines regardless of case and punctuation', () => {
    const r = merge(BODY.replace('- [ ] Milk', '- [ ] milk.'), steps())
    expect(r.steps[0]).toMatchObject({ id: 'a', label: 'milk.' })
  })

  it('two lines with the same text stay two steps', () => {
    const body = '- [ ] Call\n- [x] Call'
    const b: LinkItem[] = [{ stepId: 'a', label: 'Call', done: false }, { stepId: 'b', label: 'Call', done: true }]
    const s: StepLike[] = [{ id: 'a', label: 'Call', done: true }, { id: 'b', label: 'Call', done: true }]
    expect(merge(body, s, b).body).toBe('- [x] Call\n- [x] Call')
  })
})

describe('limits', () => {
  it('never drops a step the task already has to stay under the cap', () => {
    const many: StepLike[] = Array.from({ length: MAX_LINK_STEPS }, (_, i) => ({ id: `s${i}`, label: `Item ${i}`, done: false }))
    const b: LinkItem[] = many.map(s => ({ stepId: s.id, label: s.label, done: s.done }))
    const body = many.map(s => `- [ ] ${s.label}`).join('\n') + '\n- [ ] One too many'
    const r = merge(body, many, b)
    expect(r.steps).toHaveLength(MAX_LINK_STEPS)
    expect(r.steps.map(s => s.id)).toEqual(many.map(s => s.id))
    expect(r.body).toBe(body)                                   // the extra line stays in the note
  })

  it('ignores checkboxes inside a code fence', () => {
    expect(noteChecklist('```\n- [ ] not a task\n```\n- [ ] real')).toHaveLength(1)
  })
})
