/**
 * utils/eventOverlap.ts — events that happen at the same time.
 *
 * The week grid drew every event at the full width of its day column,
 * so two things scheduled over each other did not look like two
 * things — their pills sat exactly on top of one another and blended
 * into whichever one happened to paint last. There was no way to tell
 * a real double-booking from a single event, and no way to reach the
 * one underneath.
 *
 * The fix is a small cascade rather than a full column-packing layout
 * (the "Tuesday has three lanes" grid other calendars build): events
 * that overlap are ranked within their cluster, the top-ranked one
 * stays fully visible exactly where it always sat, and each one behind
 * it is nudged sideways just enough to leave a sliver of itself on
 * screen — enough to see it is there and to click it. Hover brings
 * whichever one you are pointing at fully forward; see EventPillEl.
 *
 * Pure — the geometry lives here; painting pixels from it lives in the
 * component.
 */

export interface OverlapEvent {
  id:       number
  startMs:  number
  endMs:    number
  /** Higher wins the top of the stack. Absent counts as 'normal'. */
  priority?: string
}

export interface OverlapLayout {
  /** 0 = the one drawn on top and left fully visible by default. */
  stackIndex:  number
  /** How many events — including this one — share this cluster. */
  clusterSize: number
}

const PRIORITY_RANK: Record<string, number> = { high: 2, normal: 1, low: 0 }

function priorityRank(p?: string): number {
  return PRIORITY_RANK[p ?? 'normal'] ?? 1
}

/**
 * Rank the events within one already-overlapping cluster.
 *
 * Priority decides the top of the stack outright — that is the whole
 * point of giving an event one, and it would not "always show on top"
 * if a plain scheduling accident could still outrank it. Below that,
 * the event starting soonest sits closer to the top: of two things
 * fighting for the same slot, the one coming up first is the one that
 * is actually "closer". Duration and id are last-resort tie-breaks so
 * the order never depends on array iteration order.
 */
function rankCluster<T extends OverlapEvent>(cluster: T[]): T[] {
  return [...cluster].sort((a, b) =>
    priorityRank(b.priority) - priorityRank(a.priority)
    || a.startMs - b.startMs
    || (a.endMs - a.startMs) - (b.endMs - b.startMs)
    || a.id - b.id,
  )
}

/**
 * Group events into overlap clusters and rank each event within its
 * own cluster.
 *
 * A cluster is a maximal run of events where each overlaps the next —
 * the standard "merge overlapping intervals" sweep, extended to also
 * record which original event landed where rather than just the
 * merged span. Two events that do not directly overlap but both
 * overlap a third all land in one cluster, because on screen they are
 * all fighting over the same few pixels of the day column and have to
 * be ranked against each other, not just against their nearer neighbour.
 *
 * Events with zero or negative duration are treated as a 20-minute
 * slot for the purpose of detecting overlap, matching the minimum
 * height EventPillEl already gives a zero-length event — otherwise a
 * point-in-time event could sit invisibly "inside" a longer one
 * without ever being flagged as sharing its space.
 */
export function layoutOverlaps<T extends OverlapEvent>(events: T[]): Map<number, OverlapLayout> {
  const out = new Map<number, OverlapLayout>()
  if (events.length === 0) return out

  const MIN_SPAN_MS = 20 * 60_000
  const sorted = [...events].sort((a, b) => a.startMs - b.startMs)

  let cluster: T[] = [sorted[0]]
  let clusterEnd = Math.max(sorted[0].endMs, sorted[0].startMs + MIN_SPAN_MS)

  const flush = () => {
    const ranked = rankCluster(cluster)
    ranked.forEach((e, i) => out.set(e.id, { stackIndex: i, clusterSize: ranked.length }))
  }

  for (let i = 1; i < sorted.length; i++) {
    const e = sorted[i]
    if (e.startMs < clusterEnd) {
      cluster.push(e)
      clusterEnd = Math.max(clusterEnd, e.endMs, e.startMs + MIN_SPAN_MS)
    } else {
      flush()
      cluster = [e]
      clusterEnd = Math.max(e.endMs, e.startMs + MIN_SPAN_MS)
    }
  }
  flush()

  return out
}
