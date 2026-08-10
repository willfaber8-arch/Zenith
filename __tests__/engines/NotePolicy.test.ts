/**
 * __tests__/engines/NotePolicy.test.ts
 *
 * The consent ladder decides when Zenith writes to the user's task list
 * without being asked each time. The precedence rules are the whole
 * point, so they are tested exhaustively rather than by example.
 */

import { resolvePolicy, type NotePolicy, type GlobalPolicy } from '@/lib/notePolicy'

const NOTE: (NotePolicy | undefined)[] = [undefined, 'ask', 'never', 'auto']
const GLOBAL: GlobalPolicy[] = ['ask', 'always', 'never']

describe('resolvePolicy — the full matrix', () => {

  it.each([
    // note,        global,     expected
    [undefined,     'ask',      'prompt'],
    [undefined,     'always',   'auto'],
    [undefined,     'never',    'silent'],
    ['ask',         'ask',      'prompt'],
    ['ask',         'always',   'auto'],
    ['ask',         'never',    'silent'],
    ['never',       'ask',      'silent'],
    ['never',       'always',   'silent'],   // per-note off beats global on
    ['never',       'never',    'silent'],
    ['auto',        'ask',      'auto'],
    ['auto',        'always',   'auto'],
    ['auto',        'never',    'silent'],   // global off beats per-note on
  ] as [NotePolicy | undefined, GlobalPolicy, string][])(
    'note=%s global=%s → %s',
    (note, global, expected) => {
      expect(resolvePolicy(note, global)).toBe(expected)
    },
  )

  it('covers every combination', () => {
    // Guards against a future option being added to one enum and not the
    // other, which would silently fall through to a default.
    for (const n of NOTE) {
      for (const g of GLOBAL) {
        expect(['prompt', 'auto', 'silent']).toContain(resolvePolicy(n, g))
      }
    }
  })
})

describe('the two promises the ladder makes', () => {

  it('"deny" means this note is never asked about again', () => {
    expect(resolvePolicy('never', 'ask')).toBe('silent')
  })

  it('"always approve" stops asking everywhere', () => {
    expect(resolvePolicy(undefined, 'always')).toBe('auto')
    expect(resolvePolicy('ask', 'always')).toBe('auto')
  })

  it('turning it off for one note survives turning it on globally', () => {
    // If this failed, the per-note control would be a lie.
    expect(resolvePolicy('never', 'always')).toBe('silent')
  })

  it('a global off wins over a per-note auto', () => {
    // The restrictive-wins rule. Someone switching the whole feature off
    // means it, including for notes they previously set to auto.
    expect(resolvePolicy('auto', 'never')).toBe('silent')
  })

  it('never returns auto when the user has not opted in anywhere', () => {
    expect(resolvePolicy(undefined, 'ask')).not.toBe('auto')
  })
})
