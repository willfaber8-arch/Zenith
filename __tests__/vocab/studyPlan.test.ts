/**
 * How a vocab session is put together.
 *
 * These are the decisions that set how hard a session is: which wrong
 * answers you are offered, when a missed card comes back, and what a
 * given performance is worth to the scheduler.
 */

import {
  buildPlan, similarity, pickDistractors, requeueIndex, gradeFor,
  isShelved, shelfUntil, ACTIVITY_ORDER, REQUEUE_GAP,
} from '@/lib/engines/studyPlan'

describe('buildPlan', () => {
  it('always runs look, recognise, produce in that order', () => {
    expect(buildPlan(['type', 'learn', 'mc'])).toEqual(['learn', 'mc', 'type'])
    expect(buildPlan(['mc', 'learn'])).toEqual(['learn', 'mc'])
  })

  it('supports a typing-only session', () => {
    expect(buildPlan(['type'])).toEqual(['type'])
  })

  it('never hands back an empty session', () => {
    // Unchecking everything should leave the hardest activity standing
    // rather than a session with nothing in it.
    expect(buildPlan([])).toEqual(['type'])
  })

  it('ignores duplicates', () => {
    expect(buildPlan(['mc', 'mc', 'mc'])).toEqual(['mc'])
  })
})

describe('similarity', () => {
  it('scores identical strings 1 and unrelated ones near 0', () => {
    expect(similarity('abstruse', 'abstruse')).toBe(1)
    expect(similarity('abstruse', 'zzzz')).toBeLessThan(0.1)
  })

  it('rates near-misses above unrelated words', () => {
    const near = similarity('abstruse', 'obtuse')
    const far  = similarity('abstruse', 'penguin')
    expect(near).toBeGreaterThan(far)
  })

  it('is case and whitespace insensitive', () => {
    expect(similarity(' Casa ', 'casa')).toBe(1)
  })

  it('handles empty and single-character input without dividing by zero', () => {
    expect(similarity('', 'casa')).toBe(0)
    expect(similarity('a', 'b')).toBe(0)
    expect(Number.isFinite(similarity('a', 'a'))).toBe(true)
  })
})

describe('pickDistractors', () => {
  const pool = [
    'obtuse', 'abstract', 'abstain', 'abstruse-ish',
    'penguin', 'kettle', 'marathon', 'wardrobe', 'saxophone', 'volcano',
  ]

  it('prefers words that look like the answer', () => {
    // Random distractors make the question a process of elimination;
    // near ones make you actually know the word.
    const picked = pickDistractors('abstruse', pool, 3, () => 0.01)
    const nearCount = picked.filter(p =>
      ['obtuse', 'abstract', 'abstain', 'abstruse-ish'].includes(p)).length
    expect(nearCount).toBeGreaterThanOrEqual(2)
  })

  it('never offers the answer as a distractor', () => {
    const picked = pickDistractors('penguin', [...pool, 'penguin'], 3)
    expect(picked).not.toContain('penguin')
  })

  it('returns distinct options', () => {
    const picked = pickDistractors('abstruse', pool, 3)
    expect(new Set(picked).size).toBe(picked.length)
  })

  it('does not always return the same three', () => {
    // Taking the top N every time makes the clusters themselves
    // memorable, which is its own way of scoring without knowing.
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) seen.add(pickDistractors('abstruse', pool, 3).join('|'))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('copes with a pool smaller than asked for', () => {
    expect(pickDistractors('a', ['b', 'c'], 3).sort()).toEqual(['b', 'c'])
    expect(pickDistractors('a', [], 3)).toEqual([])
  })
})

describe('requeueIndex', () => {
  it('brings a missed card back a few later, not immediately', () => {
    // Answering the question you were just shown the answer to tests
    // nothing at all.
    expect(requeueIndex(0, 20)).toBe(REQUEUE_GAP + 1)
    expect(requeueIndex(5, 20)).toBe(5 + REQUEUE_GAP + 1)
  })

  it('clamps to the end when the round is nearly over', () => {
    expect(requeueIndex(18, 20)).toBe(20)
    expect(requeueIndex(19, 20)).toBe(20)
  })
})

describe('gradeFor', () => {
  const both = ACTIVITY_ORDER

  it('grades a clean recall highest', () => {
    expect(gradeFor({ mcCorrectFirst: true, typeResult: 'exact' }, both)).toBe(5)
  })

  it('treats close enough as a pass, not a triumph', () => {
    expect(gradeFor({ mcCorrectFirst: true, typeResult: 'close' }, both)).toBe(4)
  })

  it('grades half-right as a struggle', () => {
    expect(gradeFor({ mcCorrectFirst: true,  typeResult: 'wrong' }, both)).toBe(2)
    expect(gradeFor({ mcCorrectFirst: false, typeResult: 'exact' }, both)).toBe(2)
  })

  it('grades all-wrong as a failure', () => {
    expect(gradeFor({ mcCorrectFirst: false, typeResult: 'wrong' }, both)).toBe(0)
  })

  it('caps a recognition-only session below a typed recall', () => {
    // Picking one of four is a weaker signal than producing the word,
    // even when the distractors are hard.
    expect(gradeFor({ mcCorrectFirst: true, typeResult: null }, ['mc'])).toBe(4)
    expect(gradeFor({ mcCorrectFirst: false, typeResult: null }, ['mc'])).toBe(0)
  })

  it('grades a typing-only session on the typing alone', () => {
    expect(gradeFor({ mcCorrectFirst: false, typeResult: 'exact' }, ['type'])).toBe(5)
    expect(gradeFor({ mcCorrectFirst: false, typeResult: 'close' }, ['type'])).toBe(4)
    expect(gradeFor({ mcCorrectFirst: false, typeResult: 'wrong' }, ['type'])).toBe(0)
  })

  it('grades nothing when nothing was asked', () => {
    // A browse is not evidence. Writing a low grade for it would let
    // flipping through cards quietly damage their schedule.
    expect(gradeFor({ mcCorrectFirst: false, typeResult: null }, ['learn'])).toBeNull()
  })
})

describe('shelving', () => {
  it('counts a card as shelved until its date passes', () => {
    const now = 1_000_000_000
    expect(isShelved({ shelvedUntil: now + 1000 }, now)).toBe(true)
    expect(isShelved({ shelvedUntil: now - 1000 }, now)).toBe(false)
    expect(isShelved({ shelvedUntil: now }, now)).toBe(false)
  })

  it('treats a card that was never shelved as active', () => {
    expect(isShelved({}, Date.now())).toBe(false)
    expect(isShelved({ shelvedUntil: undefined }, Date.now())).toBe(false)
  })

  it('shelves for a week by default', () => {
    const now = 1_000_000_000
    expect(shelfUntil(now)).toBe(now + 7 * 86_400_000)
    expect(shelfUntil(now, 1)).toBe(now + 86_400_000)
  })
})
