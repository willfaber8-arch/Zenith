/**
 * Overlapping events used to draw at the exact same position and blend
 * into each other. These pin the ranking the cascade is built from —
 * priority first, then whichever event is "closer" (starts soonest).
 */

import { layoutOverlaps } from '@/utils/eventOverlap'

const T = (h: number, m = 0) => new Date(2026, 8, 21, h, m).getTime()

describe('layoutOverlaps', () => {
  it('gives a lone event a cluster of one, on top', () => {
    const out = layoutOverlaps([{ id: 1, startMs: T(9), endMs: T(10) }])
    expect(out.get(1)).toEqual({ stackIndex: 0, clusterSize: 1 })
  })

  it('does not cluster events that do not overlap', () => {
    const out = layoutOverlaps([
      { id: 1, startMs: T(9),  endMs: T(10) },
      { id: 2, startMs: T(10), endMs: T(11) },   // back-to-back, not overlapping
    ])
    expect(out.get(1)).toEqual({ stackIndex: 0, clusterSize: 1 })
    expect(out.get(2)).toEqual({ stackIndex: 0, clusterSize: 1 })
  })

  it('puts the earlier-starting event on top by default', () => {
    const out = layoutOverlaps([
      { id: 1, startMs: T(9, 30), endMs: T(10, 30) },
      { id: 2, startMs: T(9),     endMs: T(10) },      // starts sooner — "closer"
    ])
    expect(out.get(2)).toEqual({ stackIndex: 0, clusterSize: 2 })
    expect(out.get(1)).toEqual({ stackIndex: 1, clusterSize: 2 })
  })

  it('lets an explicit priority win over start time', () => {
    const out = layoutOverlaps([
      { id: 1, startMs: T(9),     endMs: T(10),   priority: 'high' },
      { id: 2, startMs: T(8, 45), endMs: T(9, 45) },   // starts sooner, but not high priority
    ])
    expect(out.get(1)).toEqual({ stackIndex: 0, clusterSize: 2 })
    expect(out.get(2)).toEqual({ stackIndex: 1, clusterSize: 2 })
  })

  it('ranks low priority beneath an unset (normal) one', () => {
    const out = layoutOverlaps([
      { id: 1, startMs: T(9), endMs: T(10), priority: 'low' },
      { id: 2, startMs: T(9), endMs: T(10) },
    ])
    expect(out.get(2)?.stackIndex).toBe(0)
    expect(out.get(1)?.stackIndex).toBe(1)
  })

  it('chains transitively-overlapping events into one cluster', () => {
    // 1: 9-10, 2: 9:30-10:30, 3: 10:15-11. 1 & 3 never directly overlap,
    // but both overlap 2, so all three are fighting over the same pixels.
    const out = layoutOverlaps([
      { id: 1, startMs: T(9),      endMs: T(10) },
      { id: 2, startMs: T(9, 30),  endMs: T(10, 30) },
      { id: 3, startMs: T(10, 15), endMs: T(11) },
    ])
    expect(out.get(1)?.clusterSize).toBe(3)
    expect(out.get(2)?.clusterSize).toBe(3)
    expect(out.get(3)?.clusterSize).toBe(3)
    // Earliest start wins the top absent any priority.
    expect(out.get(1)?.stackIndex).toBe(0)
  })

  it('treats a zero-length event as a 20-minute slot for overlap purposes', () => {
    const out = layoutOverlaps([
      { id: 1, startMs: T(9), endMs: T(9) },          // a point-in-time reminder
      { id: 2, startMs: T(9, 10), endMs: T(9, 40) },  // sits inside that 20-minute slot
    ])
    expect(out.get(1)?.clusterSize).toBe(2)
    expect(out.get(2)?.clusterSize).toBe(2)
  })

  it('starts a fresh cluster once a gap actually opens up', () => {
    const out = layoutOverlaps([
      { id: 1, startMs: T(9),  endMs: T(10) },
      { id: 2, startMs: T(9, 30), endMs: T(10, 30) },  // overlaps 1
      { id: 3, startMs: T(12), endMs: T(13) },         // clear of both
    ])
    expect(out.get(1)?.clusterSize).toBe(2)
    expect(out.get(2)?.clusterSize).toBe(2)
    expect(out.get(3)).toEqual({ stackIndex: 0, clusterSize: 1 })
  })
})
