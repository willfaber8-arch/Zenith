/**
 * __tests__/engines/MathText.test.ts
 *
 * Only the splitter is tested here — it is the part that can silently
 * eat someone's text. KaTeX's own rendering is not our code to verify.
 */

import { splitMath, hasMath } from '@/components/MathText'

describe('hasMath', () => {
  it.each([
    ['plain prose', false],
    ['costs $5 today', false],           // one lone $ is not math
    ['let $x = 1$ hold', true],
    ['block: $$a^2 + b^2$$', true],
  ])('%s → %s', (input, expected) => {
    expect(hasMath(input)).toBe(expected)
  })
})

describe('splitMath', () => {
  it('returns plain text untouched', () => {
    expect(splitMath('just words')).toEqual([{ kind: 'text', value: 'just words' }])
  })

  it('splits an inline expression', () => {
    expect(splitMath('let $x$ be')).toEqual([
      { kind: 'text', value: 'let ' },
      { kind: 'math', value: 'x', display: false },
      { kind: 'text', value: ' be' },
    ])
  })

  it('recognises a display block', () => {
    const out = splitMath('$$E = mc^2$$')
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ kind: 'math', value: 'E = mc^2', display: true })
  })

  it('does not mistake a display block for two inline spans', () => {
    // $$ must be matched first, or "$$a$$" parses as $ + $a$ + $.
    const out = splitMath('$$a$$')
    expect(out.filter(s => s.kind === 'math')).toHaveLength(1)
    expect((out[0] as { display: boolean }).display).toBe(true)
  })

  it('leaves a lone dollar sign alone', () => {
    // Someone writing about money must not lose the rest of their note.
    expect(splitMath('it cost $5 and I paid')).toEqual([
      { kind: 'text', value: 'it cost $5 and I paid' },
    ])
  })

  it('does not let inline math span a newline', () => {
    const out = splitMath('cost $5\nand $6 more')
    expect(out.every(s => s.kind === 'text')).toBe(true)
  })

  it('handles several expressions in one line', () => {
    const out = splitMath('$a$ then $b$')
    expect(out.filter(s => s.kind === 'math').map(s => (s as { value: string }).value))
      .toEqual(['a', 'b'])
  })

  it('reassembles losslessly for plain text', () => {
    const src = 'no math at all, just $ and prose'
    const rebuilt = splitMath(src).map(s => s.kind === 'text' ? s.value : `$${s.value}$`).join('')
    expect(rebuilt).toBe(src)
  })

  it('handles an empty string', () => {
    expect(splitMath('')).toEqual([])
  })
})
