/**
 * Advanced stats: phase breakdown, distribution, PB history, progress.
 *
 * Built on the same effectiveMs/average as the stats table, so the tests
 * pin the cases where a careless version would disagree with it.
 */
import {
  phaseBreakdown, distribution, pbHistory, shareUnder, dailySeries, rollingAverages,
  type AnalyticSolve,
} from '@/utils/cubeAnalytics'
import { average, bestAverage, rollingSeries } from '@/utils/cubeStats'

const CFOP = ['Cross', 'F2L', 'OLL', 'PLL']
const T0 = new Date(2026, 8, 20, 18, 0).getTime()
let n = 0
const solve = (secs: number, extra: Partial<AnalyticSolve> = {}): AnalyticSolve =>
  ({ timeMs: Math.round(secs * 1000), penalty: 'OK', createdAt: T0 + (n++) * 60_000, ...extra })
const split = (...phaseSecs: number[]): Partial<AnalyticSolve> => {
  let acc = 0
  return { splits: phaseSecs.map(p => (acc += Math.round(p * 1000))), phaseNames: CFOP }
}
beforeEach(() => { n = 0 })

describe('phase breakdown', () => {
  const solves = [
    solve(14, split(2, 8, 2, 2)),
    solve(12, split(2, 6, 2, 2)),
    solve(13, split(3, 6, 2, 2)),
    solve(40, { ...split(10, 10, 10, 10), penalty: 'DNF' }),   // a DNF has no meaningful split
    solve(11),                                                  // timed without phases
  ]
  const b = phaseBreakdown(solves)!

  it('averages each phase over the phased, finished solves', () => {
    expect(b.count).toBe(3)
    expect(b.names).toEqual(CFOP)
    expect(b.phases.map(p => Math.round(p.mean))).toEqual([2333, 6667, 2000, 2000])
    expect(b.phases.map(p => p.best)).toEqual([2000, 6000, 2000, 2000])
  })

  it('shares sum to one, and the focus is the phase furthest from its best', () => {
    expect(b.phases.reduce((a, p) => a + p.share, 0)).toBeCloseTo(1, 10)
    expect(b.names[b.focus]).toBe('F2L')
  })

  it('judges room to improve against a pace you sustained, not one lucky phase', () => {
    /* 14 solves: OLL steady at 2.5s; F2L steady at 7s but with one 1.0s fluke. */
    const run = Array.from({ length: 14 }, (_, i) => solve(13, split(2, i === 3 ? 1 : 7, 2.5, 1.5)))
    /* Make OLL genuinely the slack phase: its average drifts well above its best ao12. */
    run.push(...Array.from({ length: 6 }, () => solve(16, split(2, 7, 5.5, 1.5))))
    const r = phaseBreakdown(run)!
    expect(r.phases[1].best).toBe(1000)                    // the fluke is still the best single…
    expect(r.names[r.focus]).toBe('OLL')                   // …but it no longer decides the focus
  })

  it('never mixes set-ups: prefers the current one, else the most common', () => {
    const roux = { phaseNames: ['FB', 'SB', 'CMLL', 'LSE'] }
    const mixed = [...solves, solve(15, { ...split(4, 4, 4, 3), ...roux })]
    expect(phaseBreakdown(mixed)!.names).toEqual(CFOP)
    expect(phaseBreakdown(mixed, roux.phaseNames)!.names).toEqual(roux.phaseNames)
  })

  it('is null with no phased solves', () => {
    expect(phaseBreakdown([solve(10), solve(11)])).toBeNull()
  })
})

describe('distribution', () => {
  it('buckets finished times on whole-second edges and counts DNFs apart', () => {
    const d = distribution([solve(10.2), solve(10.9), solve(12.5), solve(11), solve(9, { penalty: 'DNF' })])!
    expect(d.widthMs).toBe(250)
    const secs = distribution([solve(10.2), solve(10.9), solve(15.5), solve(21)], 12)!
    expect(secs.widthMs).toBe(1000)
    expect(secs.buckets[0]).toEqual({ fromMs: 10_000, toMs: 11_000, count: 2 })
    expect(secs.buckets.find(b => b.fromMs === 13_000)!.count).toBe(0)   // gaps are kept
    expect(d.dnfCount).toBe(1)
    expect(secs.buckets.reduce((a, b) => a + b.count, 0)).toBe(4)
  })
  it('counts a +2 on its penalised time', () => {
    const d = distribution([solve(9.5, { penalty: 'PLUS2' }), solve(9.5)], 5)!
    expect(d.buckets.map(b => b.count).filter(Boolean)).toEqual([1, 1])
  })
})

describe('PB history', () => {
  const solves = [12, 13, 11.5, 11.5, 14, 10.8, 12, 12, 12, 12, 9.9].map(s => solve(s))

  it('lists each strictly faster single, with what it beat', () => {
    expect(pbHistory(solves, 'single').map(r => [r.index, r.ms, r.prevMs])).toEqual([
      [0, 12000, null], [2, 11500, 12000], [5, 10800, 11500], [10, 9900, 10800],
    ])
  })

  it('the last ao5 record is the best ao5 the stats table shows', () => {
    const recs = pbHistory(solves, 'ao5')
    expect(recs[recs.length - 1].ms).toBe(bestAverage(solves, 5))
  })
})

describe('progress', () => {
  it('share under a target counts a DNF as not under', () => {
    expect(shareUnder([solve(9), solve(11), solve(8, { penalty: 'DNF' }), solve(9.5, { penalty: 'PLUS2' })], 10_000)).toBe(0.25)
    expect(shareUnder([], 10_000)).toBeNull()
  })

  it('groups by local day, oldest first', () => {
    const late = new Date(2026, 8, 20, 23, 50).getTime()
    const next = new Date(2026, 8, 21, 0, 10).getTime()
    const days = dailySeries([
      solve(10, { createdAt: late }), solve(12, { createdAt: late + 1 }),
      solve(9, { createdAt: next }), solve(0, { createdAt: next + 1, penalty: 'DNF' }),
    ])
    expect(days.map(d => [d.date, d.count, d.mean, d.best])).toEqual([
      ['2026-09-20', 2, 11000, 10000],
      ['2026-09-21', 2, 9000, 9000],
    ])
    expect(days[0].sd).toBe(1000)
    expect(days[1].sd).toBeNull()
  })
})

it('the chart rolling series is unchanged by the speed fix', () => {
  const solves = Array.from({ length: 40 }, (_, i) => solve(10 + ((i * 7) % 5), i % 13 === 4 ? { penalty: 'DNF' } : {}))
  /* What rollingSeries used to compute: the aoN of the whole prefix. */
  const prefix = (k: number) => solves.map((_, i) => (i + 1 < k ? null : average(solves.slice(0, i + 1), k)))
  for (const k of [5, 12]) {
    expect(rollingSeries(solves, k)).toEqual(prefix(k))
    expect(rollingAverages(solves, k)).toEqual(prefix(k))
  }
})
