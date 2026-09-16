/**
 * One DNF used to make the session mean and worst read "DNF" forever.
 *
 * That is the right rule for a single competition average, where the
 * attempt either stands or does not. It is the wrong rule for a summary
 * of every solve you have ever done: one missed solve in March and the
 * mean still says DNF in June, which tells you nothing the DNF counter
 * beside it was not already saying — while hiding the number you wanted.
 */

import {
  mean, strictMean, worst, best, average, mo3, bestAverage,
  stdev, successRate, penaltyCount, longestStreak, sumEffective,
  effectiveMs, type StatSolve,
} from '@/utils/cubeStats'

const ok   = (ms: number): StatSolve => ({ timeMs: ms, penalty: 'OK' })
const p2   = (ms: number): StatSolve => ({ timeMs: ms, penalty: 'PLUS2' })
const dnf  = (ms = 20_000): StatSolve => ({ timeMs: ms, penalty: 'DNF' })

describe('a DNF no longer poisons the session summary', () => {
  it('means the solves that finished', () => {
    expect(mean([ok(10_000), ok(20_000), dnf()])).toBe(15_000)
  })

  it('reports the slowest solve that finished, not "DNF"', () => {
    expect(worst([ok(10_000), ok(30_000), dnf()])).toBe(30_000)
  })

  /* The whole point: it must not be permanent. */
  it('recovers on the very next good solve', () => {
    const afterDnf = [ok(12_000), dnf()]
    expect(mean(afterDnf)).toBe(12_000)
    expect(worst(afterDnf)).toBe(12_000)

    const andAnother = [...afterDnf, ok(14_000)]
    expect(mean(andAnother)).toBe(13_000)
    expect(worst(andAnother)).toBe(14_000)
  })

  it('stays honest with a DNF at the very start of a long session', () => {
    const solves = [dnf(), ...Array.from({ length: 50 }, (_, i) => ok(10_000 + i * 100))]
    expect(mean(solves)).not.toBeNull()
    expect(worst(solves)).toBe(14_900)
  })

  it('counts a +2 penalty in both', () => {
    expect(mean([p2(10_000), ok(14_000)])).toBe(13_000)   // 12s and 14s
    expect(worst([p2(10_000), ok(11_000)])).toBe(12_000)  // the +2 is slower
  })

  it('is null only when nothing finished', () => {
    expect(mean([dnf(), dnf()])).toBeNull()
    expect(worst([dnf(), dnf()])).toBeNull()
    expect(mean([])).toBeNull()
    expect(worst([])).toBeNull()
  })
})

describe('the WCA rules are untouched where they belong', () => {
  it('mo3 is still invalidated by one DNF', () => {
    expect(mo3([ok(10_000), ok(11_000), dnf()])).toBeNull()
    expect(strictMean([ok(10_000), dnf()])).toBeNull()
  })

  it('ao5 survives exactly one DNF, which it drops as the worst', () => {
    // best (10) and the DNF are trimmed; 11 + 12 + 13 over 3.
    const a = average([ok(10_000), ok(11_000), ok(12_000), ok(13_000), dnf()], 5)
    expect(a).toBe(12_000)
  })

  it('ao5 is a DNF with two of them', () => {
    expect(average([ok(10_000), ok(11_000), ok(12_000), dnf(), dnf()], 5)).toBeNull()
  })

  it('bestAverage skips the windows that are DNF and keeps the rest', () => {
    const solves = [ok(10_000), ok(11_000), ok(12_000), dnf(), dnf(),
                    ok(9_000), ok(9_500), ok(10_500), ok(9_900), ok(10_100)]
    expect(bestAverage(solves, 5)).not.toBeNull()
  })
})

describe('the other statistics still describe DNFs properly', () => {
  const solves = [ok(10_000), dnf(), p2(11_000), ok(12_000), dnf()]

  it('counts them', () => {
    expect(penaltyCount(solves, 'DNF')).toBe(2)
    expect(penaltyCount(solves, 'PLUS2')).toBe(1)
  })

  it('reports a success rate', () => {
    expect(successRate(solves)).toBe(60)
  })

  it('breaks the streak', () => {
    expect(longestStreak(solves)).toBe(2)
  })

  it('leaves them out of best, σ and the total', () => {
    expect(best(solves)).toBe(10_000)
    expect(stdev(solves)).not.toBeNull()
    expect(sumEffective(solves)).toBe(10_000 + 13_000 + 12_000)
    expect(effectiveMs(dnf())).toBeNull()
  })
})
