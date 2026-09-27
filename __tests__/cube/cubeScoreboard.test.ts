/**
 * The personal scoreboard — fastest singles and best averages.
 *
 * The one promise that matters most: the scoreboard's #1 is exactly the
 * "best" the stats table already shows, so the two can never disagree.
 */
import {
  topSingles, topAverages, trimmedInWindow, bestAverage, best, average,
  type StatSolve,
} from '@/utils/cubeStats'

const ok  = (s: number): StatSolve => ({ timeMs: s * 1000, penalty: 'OK' })
const p2  = (s: number): StatSolve => ({ timeMs: s * 1000, penalty: 'PLUS2' })
const dnf = (s = 10): StatSolve => ({ timeMs: s * 1000, penalty: 'DNF' })

describe('fastest singles', () => {
  it('ranks by effective time, fastest first, and leaves DNFs off', () => {
    const solves = [ok(12), dnf(5), ok(9), p2(8), ok(11)]
    expect(topSingles(solves, 10)).toEqual([
      { index: 2, ms: 9000 },
      { index: 3, ms: 10000 },      // 8 + 2
      { index: 4, ms: 11000 },
      { index: 0, ms: 12000 },
    ])
  })

  it('gives a tie to the earlier solve, and stops at n', () => {
    expect(topSingles([ok(10), ok(10), ok(9)], 2)).toEqual([
      { index: 2, ms: 9000 }, { index: 0, ms: 10000 },
    ])
  })

  it('#1 is the PB single', () => {
    const solves = [ok(14), p2(9), ok(12.5), dnf(3), ok(11)]
    expect(topSingles(solves, 1)[0].ms).toBe(best(solves))
  })
})

describe('best averages', () => {
  const streak = [ok(20), ok(20), ok(10), ok(10), ok(10), ok(10), ok(10), ok(10), ok(20), ok(20)]

  it('#1 is exactly the best average the stats table shows', () => {
    for (const size of [5, 12]) {
      const solves = Array.from({ length: 40 }, (_, i) => ok(10 + ((i * 7) % 11) / 3))
      expect(topAverages(solves, size, 1)[0].ms).toBe(bestAverage(solves, size))
    }
  })

  it('does not let one hot streak fill the board with overlapping copies', () => {
    const board = topAverages(streak, 5, 5)
    /* No two listed windows share a solve. */
    const seen = new Set<number>()
    for (const r of board) for (let i = r.start; i < r.start + r.size; i++) {
      expect(seen.has(i)).toBe(false); seen.add(i)
    }
    /* Six rolling ao5s here are all "the streak"; the board lists it once. */
    expect(board).toHaveLength(1)
    expect(topAverages(streak, 5, 10, { distinct: false })).toHaveLength(6)
  })

  it('can list every rolling window when asked', () => {
    const all = topAverages(streak, 5, 10, { distinct: false })
    expect(all).toHaveLength(6)                         // windows 0..5
    expect(all[0].ms).toBe(10000)
  })

  it('never ranks a DNF average, and each value matches `average` on its window', () => {
    const solves = [ok(10), dnf(), dnf(), ok(11), ok(12), ok(13), ok(9), ok(10), ok(11)]
    const board = topAverages(solves, 5, 10, { distinct: false })
    for (const r of board) {
      expect(r.ms).toBe(average(solves.slice(r.start, r.start + r.size), r.size))
    }
    /* Windows starting at 0 or 1 hold both DNFs (indices 1 and 2). */
    expect(board.some(r => r.start <= 1)).toBe(false)
    expect(board.some(r => r.start === 2)).toBe(true)   // one DNF is just the trimmed worst
  })

  it('is empty when there are too few solves', () => {
    expect(topAverages([ok(10), ok(11)], 5, 5)).toEqual([])
  })
})

describe('the solves an average trims', () => {
  it('marks the best and the worst, as a results sheet would', () => {
    expect([...trimmedInWindow([ok(12), ok(9), ok(11), ok(15), ok(10)])].sort()).toEqual([1, 3])
  })
  it('a DNF is the worst', () => {
    expect([...trimmedInWindow([ok(12), ok(9), dnf(), ok(15), ok(10)])].sort()).toEqual([1, 2])
  })
  it('equal times trim two different solves, the same two `average` drops', () => {
    expect([...trimmedInWindow([ok(10), ok(10), ok(10), ok(10), ok(10)])].sort()).toEqual([0, 1])
  })
  it('a mean of 3 trims nothing', () => {
    expect(trimmedInWindow([ok(1), ok(2), ok(3)]).size).toBe(0)
  })
})
