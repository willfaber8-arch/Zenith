/**
 * Unit tests for the note editor's text transforms.
 *
 * Written against the engine rather than the component because every
 * interesting case here is a selection edge case, and driving those
 * through a textarea would test jsdom's selection model more than it
 * tests ours.
 *
 * Notation: `¦` marks a caret and `«...»` marks a selection in the
 * fixtures below, expanded by `at()`. Deliberately not `|` and `[]`,
 * which collide with Markdown checkbox and link syntax — the first
 * version of this file used those and silently mangled every checklist
 * fixture into something else before the engine ever saw it.
 */

import {
  parseLine, renderLine, lineHasMark,
  toggleInline, hasInlineMark, toggleLineMark,
  insertLink, insertBlock, continueList, noteStats,
  type EditState,
} from '@/lib/engines/markdownEditing'

/** Build an EditState from a string using `¦` for the caret and `«»` for a range. */
function at(spec: string): EditState {
  if (spec.includes('«')) {
    const selStart = spec.indexOf('«')
    const selEnd   = spec.indexOf('»') - 1
    return { text: spec.replace(/[«»]/g, ''), selStart, selEnd }
  }
  const i = spec.indexOf('¦')
  if (i < 0) throw new Error(`fixture has no caret or selection: ${spec}`)
  return { text: spec.replace('¦', ''), selStart: i, selEnd: i }
}

/** Render an EditState back to the same notation, for readable assertions. */
function show(s: EditState): string {
  if (s.selStart === s.selEnd) {
    return s.text.slice(0, s.selStart) + '¦' + s.text.slice(s.selStart)
  }
  return s.text.slice(0, s.selStart) + '«' + s.text.slice(s.selStart, s.selEnd)
       + '»' + s.text.slice(s.selEnd)
}

/* ── Line parsing ──────────────────────────────────────────────────── */

describe('parseLine / renderLine', () => {
  const cases: Array<[string, string]> = [
    ['plain text',        'plain'],
    ['- bullet',          'bullet'],
    ['* star',            'bullet'],
    ['1. one',            'number'],
    ['3) three',          'number'],
    ['- [ ] todo',        'checklist'],
    ['- [x] done',        'checklist'],
    ['2. [ ] numbered todo', 'checklist'],
    ['> quoted',          'quote'],
    ['## heading',        'heading'],
  ]

  it.each(cases)('classifies %j as %s', (line, kind) => {
    expect(parseLine(line).kind).toBe(kind)
  })

  it('round-trips every shape unchanged', () => {
    for (const [line] of cases) {
      expect(renderLine(parseLine(line))).toBe(line.replace('3)', '3.'))
    }
  })

  it('reads a checkbox tick', () => {
    expect(parseLine('- [x] done').checked).toBe(true)
    expect(parseLine('- [ ] todo').checked).toBe(false)
    expect(parseLine('- [X] shouty').checked).toBe(true)
  })

  it('keeps indentation', () => {
    expect(parseLine('    - nested').indent).toBe('    ')
    expect(renderLine(parseLine('    - nested'))).toBe('    - nested')
  })

  it('prefers the checkbox reading over the bullet reading', () => {
    // `- [ ] x` matches the bullet pattern too; the more specific one wins.
    expect(parseLine('- [ ] x').kind).toBe('checklist')
    expect(parseLine('- [ ] x').content).toBe('x')
  })
})

/* ── Line marks ────────────────────────────────────────────────────── */

describe('toggleLineMark', () => {
  it('adds a checklist marker to a plain line', () => {
    const out = toggleLineMark(at('milk¦'), 'checklist')
    expect(out.text).toBe('- [ ] milk')
  })

  it('removes it again — the button is a toggle', () => {
    const out = toggleLineMark(at('- [ ] milk¦'), 'checklist')
    expect(out.text).toBe('milk')
  })

  it('converts a bullet into a checklist without duplicating the marker', () => {
    expect(toggleLineMark(at('- milk¦'), 'checklist').text).toBe('- [ ] milk')
  })

  it('does not un-tick a done item when re-applying the mark', () => {
    // Reached via a multi-line selection where not every line is a checklist.
    const s = at('«- [x] done\nplain»')
    const out = toggleLineMark(s, 'checklist')
    expect(out.text).toBe('- [x] done\n- [ ] plain')
  })

  it('applies across every line the selection touches', () => {
    const out = toggleLineMark(at('«one\ntwo\nthree»'), 'bullet')
    expect(out.text).toBe('- one\n- two\n- three')
  })

  it('only removes when every touched line already has the mark', () => {
    // Half-marked block: pressing the button finishes the job.
    const out = toggleLineMark(at('«- one\ntwo»'), 'bullet')
    expect(out.text).toBe('- one\n- two')
  })

  it('numbers an ordered list from one', () => {
    const out = toggleLineMark(at('«a\nb\nc»'), 'number')
    expect(out.text).toBe('1. a\n2. b\n3. c')
  })

  it('swaps one line mark for another rather than stacking them', () => {
    const out = toggleLineMark(at('> quoted¦'), 'bullet')
    expect(out.text).toBe('- quoted')
  })

  it('replaces a heading level instead of appending hashes', () => {
    expect(toggleLineMark(at('# one¦'), 'h2').text).toBe('## one')
    expect(toggleLineMark(at('## two¦'), 'h2').text).toBe('two')
  })

  it('keeps the selection over the same logical text', () => {
    const out = toggleLineMark(at('«one\ntwo»'), 'bullet')
    expect(out.text.slice(out.selStart, out.selEnd)).toBe('- one\n- two')
  })

  it('leaves indentation alone', () => {
    expect(toggleLineMark(at('    deep¦'), 'checklist').text).toBe('    - [ ] deep')
  })
})

/* ── Inline marks ──────────────────────────────────────────────────── */

describe('toggleInline', () => {
  it('wraps a selection', () => {
    expect(show(toggleInline(at('say «hello» there'), 'bold')))
      .toBe('say **«hello»** there')
  })

  it('unwraps a selection that is already wrapped', () => {
    expect(toggleInline(at('say «**hello**» there'), 'bold').text)
      .toBe('say hello there')
  })

  it('unwraps when the markers sit just outside the selection', () => {
    // Double-clicking a bolded word selects the word, not the asterisks.
    expect(toggleInline(at('say **«hello»** there'), 'bold').text)
      .toBe('say hello there')
  })

  it('inserts a pair and parks the caret inside when nothing is selected', () => {
    expect(show(toggleInline(at('say ¦'), 'bold'))).toBe('say **¦**')
  })

  it('pushes trailing whitespace outside the markers', () => {
    // `**foo **` is not bold in any parser, and double-click often
    // includes the trailing space.
    expect(toggleInline(at('«foo »bar'), 'bold').text).toBe('**foo** bar')
  })

  it('refuses to mark a whitespace-only selection', () => {
    const s = at('a«   »b')
    expect(toggleInline(s, 'bold')).toEqual(s)
  })

  it.each([
    ['bold',   '**'],
    ['italic', '*'],
    ['strike', '~~'],
    ['code',   '`'],
  ] as const)('uses %s token %s', (mark, tok) => {
    expect(toggleInline(at('«x»'), mark).text).toBe(`${tok}x${tok}`)
  })

  it('round-trips: applying twice returns the original text', () => {
    const start = at('say «hello» there')
    const once  = toggleInline(start, 'bold')
    const twice = toggleInline(once, 'bold')
    expect(twice.text).toBe(start.text)
  })
})

describe('hasInlineMark', () => {
  it('sees markers inside the selection', () => {
    expect(hasInlineMark(at('«**x**»'), 'bold')).toBe(true)
  })
  it('sees markers outside the selection', () => {
    expect(hasInlineMark(at('**«x»**'), 'bold')).toBe(true)
  })
  it('is false for unmarked text', () => {
    expect(hasInlineMark(at('«x»'), 'bold')).toBe(false)
  })
})

/* ── Insertions ────────────────────────────────────────────────────── */

describe('insertLink', () => {
  it('uses a selected URL as the target and selects nothing', () => {
    const out = insertLink(at('«https://example.com»'))
    expect(out.text).toBe('[](https://example.com)')
    expect(out.selStart).toBe(1)
  })

  it('uses selected prose as the label and selects the url slot', () => {
    const out = insertLink(at('see «the docs» here'))
    expect(out.text).toBe('see [the docs](url) here')
    expect(out.text.slice(out.selStart, out.selEnd)).toBe('url')
  })

  it('offers both halves when nothing is selected', () => {
    const out = insertLink(at('¦'))
    expect(out.text).toBe('[text](url)')
    expect(out.text.slice(out.selStart, out.selEnd)).toBe('text')
  })
})

describe('insertBlock', () => {
  it('puts the block on its own line', () => {
    expect(insertBlock(at('above¦'), '---').text).toBe('above\n---\n')
  })
  it('does not add a leading blank line when already at line start', () => {
    expect(insertBlock(at('above\n¦'), '---').text).toBe('above\n---\n')
  })
})

/* ── Enter continuation ────────────────────────────────────────────── */

describe('continueList', () => {
  it('opens the next checklist item', () => {
    const out = continueList(at('- [ ] milk¦'))
    expect(out?.text).toBe('- [ ] milk\n- [ ] ')
  })

  it('resets the checkbox on the new item', () => {
    const out = continueList(at('- [x] milk¦'))
    expect(out?.text).toBe('- [x] milk\n- [ ] ')
  })

  it('increments an ordered list', () => {
    expect(continueList(at('3. third¦'))?.text).toBe('3. third\n4. ')
  })

  it('carries the bullet character over', () => {
    expect(continueList(at('* star¦'))?.text).toBe('* star\n* ')
  })

  it('leaves the list when the item is empty', () => {
    // This is how you get out of a list without reaching for the mouse.
    expect(continueList(at('- [ ] ¦'))?.text).toBe('')
    expect(continueList(at('- ¦'))?.text).toBe('')
  })

  it('returns null on a plain line so Enter stays Enter', () => {
    expect(continueList(at('just text¦'))).toBeNull()
  })

  it('returns null on a heading — headings are not a list', () => {
    expect(continueList(at('# title¦'))).toBeNull()
  })

  it('returns null mid-line so splitting an item behaves normally', () => {
    expect(continueList(at('- mi¦lk'))).toBeNull()
  })

  it('returns null when there is a selection', () => {
    expect(continueList(at('- «milk»'))).toBeNull()
  })

  it('places the caret after the new marker, ready to type', () => {
    const out = continueList(at('- [ ] milk¦'))!
    expect(out.selStart).toBe(out.text.length)
    expect(out.selStart).toBe(out.selEnd)
  })
})

/* ── Stats ─────────────────────────────────────────────────────────── */

describe('noteStats', () => {
  it('counts words, characters and lines', () => {
    expect(noteStats('one two\nthree')).toEqual({ words: 3, chars: 13, lines: 2 })
  })
  it('reports zero for an empty note rather than one empty word', () => {
    expect(noteStats('')).toEqual({ words: 0, chars: 0, lines: 0 })
    expect(noteStats('   ').words).toBe(0)
  })
})

/* ── Interop with the existing detector ────────────────────────────── */

describe('interop with NoteTaskDetector', () => {
  it('emits checkboxes the detector recognises', async () => {
    const { detectTasks } = await import('@/lib/engines/NoteTaskDetector')
    const body = toggleLineMark(at('buy milk¦'), 'checklist').text
    const found = detectTasks(body)
    expect(found).toHaveLength(1)
    expect(found[0].text).toBe('buy milk')
    expect(found[0].via).toBe('checkbox')
  })

  it('emits ticked boxes the detector reads as done', async () => {
    const { checklistProgress } = await import('@/lib/engines/NoteTaskDetector')
    const body = '- [x] a\n- [ ] b'
    expect(checklistProgress(body)).toEqual({ done: 1, total: 2 })
  })

  it('agrees with lineHasMark about what a checklist line is', () => {
    expect(lineHasMark('- [ ] x', 'checklist')).toBe(true)
    expect(lineHasMark('- x', 'checklist')).toBe(false)
    expect(lineHasMark('- x', 'bullet')).toBe(true)
  })
})
