/**
 * __tests__/engines/NoteTaskDetector.test.ts
 *
 * The detector's job is to be useful without being annoying. A missed
 * task costs a click; a false positive — offering to file "Remember that
 * trip to Prague" as a to-do — is what makes someone turn the feature
 * off. So the false-positive cases below matter more than the recall
 * cases, and are tested harder.
 */

import {
  detectTasks, pendingTasks, markLineDone, toggleLine,
  checklistProgress, normalise,
} from '@/lib/engines/NoteTaskDetector'

describe('checkbox detection', () => {

  it('finds unchecked items', () => {
    const t = detectTasks('- [ ] Call the dentist\n- [ ] Book train tickets')
    expect(t).toHaveLength(2)
    expect(t[0].text).toBe('Call the dentist')
    expect(t[0].via).toBe('checkbox')
    expect(t[0].done).toBe(false)
  })

  it('marks ticked items done rather than dropping them', () => {
    const t = detectTasks('- [x] Done thing\n- [ ] Open thing')
    expect(t).toHaveLength(2)
    expect(t[0].done).toBe(true)
    expect(t[1].done).toBe(false)
  })

  it.each(['-', '*', '+', '1.', '2)'])('accepts "%s" as a bullet', marker => {
    expect(detectTasks(`${marker} [ ] A task`)).toHaveLength(1)
  })

  it('accepts an uppercase X', () => {
    expect(detectTasks('- [X] Done')[0].done).toBe(true)
  })

  it('records the line index', () => {
    const t = detectTasks('# Heading\n\n- [ ] Third line task')
    expect(t[0].line).toBe(2)
  })

  it('ignores checkboxes inside a code fence', () => {
    const body = 'Example:\n```md\n- [ ] not a real task\n```\n- [ ] real task'
    const t = detectTasks(body)
    expect(t).toHaveLength(1)
    expect(t[0].text).toBe('real task')
  })
})

describe('imperative detection', () => {

  it('finds imperative lines when no checkboxes exist', () => {
    const t = detectTasks('Call mum about the weekend\nBuy milk')
    expect(t).toHaveLength(2)
    expect(t[0].via).toBe('imperative')
  })

  it('handles "TODO:" prefixes', () => {
    expect(detectTasks('TODO: ship the release')[0].text).toBe('ship the release')
  })

  it('handles "remember to" and "need to"', () => {
    const t = detectTasks("Remember to renew the parking permit\nNeed to email Sam")
    expect(t).toHaveLength(2)
  })

  it('stays quiet once the note uses checkboxes', () => {
    // Someone using checkbox syntax has told us how they mark tasks.
    // Inferring extra ones from their prose is second-guessing them.
    const body = '- [ ] The real task\nCall someone about something else'
    const t = detectTasks(body)
    expect(t).toHaveLength(1)
    expect(t[0].via).toBe('checkbox')
  })
})

describe('false positives — the cases that make people disable this', () => {

  it('does not treat prose as a task', () => {
    expect(detectTasks(
      'Had a good conversation today about the project direction.',
    )).toHaveLength(0)
  })

  it('does not fire on a past-tense recollection', () => {
    expect(detectTasks('Remembered that time in Prague')).toHaveLength(0)
  })

  it('ignores headings', () => {
    expect(detectTasks('## Call notes from Tuesday')).toHaveLength(0)
  })

  it('ignores blockquotes', () => {
    expect(detectTasks('> Buy low, sell high')).toHaveLength(0)
  })

  it('ignores an imperative buried mid-sentence', () => {
    expect(detectTasks(
      'The plan is that we call the vendor next week.',
    )).toHaveLength(0)
  })

  it('rejects fragments and punctuation lines', () => {
    expect(detectTasks('- [ ] \n- [ ] ...\n- [ ] ok')).toHaveLength(1)
  })

  it('rejects an over-long line as prose', () => {
    expect(detectTasks(`Call ${'x'.repeat(300)}`)).toHaveLength(0)
  })

  it('returns nothing for an empty or blank note', () => {
    expect(detectTasks('')).toEqual([])
    expect(detectTasks('   \n\n  ')).toEqual([])
  })
})

describe('pendingTasks', () => {

  it('excludes completed items', () => {
    expect(pendingTasks('- [x] Done\n- [ ] Open')).toHaveLength(1)
  })

  it('excludes tasks already created, ignoring punctuation and case', () => {
    const body = '- [ ] Call mum\n- [ ] Buy milk'
    expect(pendingTasks(body, ['call mum.'])).toHaveLength(1)
    expect(pendingTasks(body, ['CALL  MUM'])).toHaveLength(1)
  })

  it('returns everything when nothing has been created', () => {
    expect(pendingTasks('- [ ] A\n- [ ] B')).toHaveLength(2)
  })
})

describe('write-back', () => {

  it('ticks the addressed line only', () => {
    const body = '- [ ] One\n- [ ] Two'
    expect(markLineDone(body, 1)).toBe('- [ ] One\n- [x] Two')
  })

  it('ticks by index, not by text — duplicate lines stay independent', () => {
    // Matching on text would flip both, which is the obvious wrong
    // implementation and silently loses a task.
    const body = '- [ ] Same\n- [ ] Same'
    expect(toggleLine(body, 0)).toBe('- [x] Same\n- [ ] Same')
  })

  it('toggles back off', () => {
    expect(toggleLine('- [x] Done', 0)).toBe('- [ ] Done')
  })

  it('leaves the body untouched for an out-of-range or non-checkbox line', () => {
    const body = 'plain text'
    expect(toggleLine(body, 0)).toBe(body)
    expect(toggleLine(body, 99)).toBe(body)
    expect(markLineDone(body, -1)).toBe(body)
  })

  it('preserves surrounding content exactly', () => {
    const body = '# Title\n\n- [ ] Task\n\nTrailing prose.'
    expect(toggleLine(body, 2)).toBe('# Title\n\n- [x] Task\n\nTrailing prose.')
  })
})

describe('checklistProgress', () => {

  it('counts done against total', () => {
    expect(checklistProgress('- [x] a\n- [ ] b\n- [x] c'))
      .toEqual({ done: 2, total: 3 })
  })

  it('reports zero for a note with no checklist', () => {
    expect(checklistProgress('Call someone')).toEqual({ done: 0, total: 0 })
  })
})

describe('normalise', () => {
  it('collapses case and punctuation', () => {
    expect(normalise('Call Mum!')).toBe(normalise('call  mum'))
  })
})
