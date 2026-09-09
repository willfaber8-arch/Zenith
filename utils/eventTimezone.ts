/**
 * utils/eventTimezone.ts — showing an event in a zone that is not yours.
 *
 * Events are stored as absolute instants, which is the right call: the
 * moment a class starts does not change when you fly. What does change
 * is which wall clock you want to read it against — a term abroad, a
 * call with someone six hours away, a flight that lands tomorrow.
 *
 * So the zone is a display concern, held per event, and never alters the
 * stored instant. Attaching one is a way of saying "show me this in
 * Madrid", not "move this event".
 *
 * Pure: everything here is Intl and arithmetic.
 */

/** A short list of zones that covers most of what a student needs. */
export const COMMON_ZONES: readonly { id: string; label: string }[] = [
  { id: 'America/New_York',    label: 'New York'   },
  { id: 'America/Chicago',     label: 'Chicago'    },
  { id: 'America/Denver',      label: 'Denver'     },
  { id: 'America/Los_Angeles', label: 'Los Angeles'},
  { id: 'Europe/London',       label: 'London'     },
  { id: 'Europe/Madrid',       label: 'Madrid'     },
  { id: 'Europe/Berlin',       label: 'Berlin'     },
  { id: 'Asia/Tokyo',          label: 'Tokyo'      },
  { id: 'Asia/Shanghai',       label: 'Shanghai'   },
  { id: 'Australia/Sydney',    label: 'Sydney'     },
]

/** The zone this browser is in. */
export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** True when the string names a zone this browser understands. */
export function isValidZone(zone: string): boolean {
  if (!zone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/**
 * The time an instant reads in a given zone.
 *
 * Falls back to the local reading rather than throwing: an event tagged
 * with a zone an older browser does not know should still be legible.
 */
export function formatInZone(
  ms:   number,
  zone: string,
  opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' },
): string {
  try {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: zone }).format(new Date(ms))
  } catch {
    return new Intl.DateTimeFormat(undefined, opts).format(new Date(ms))
  }
}

/** "GMT+2" style abbreviation, for labelling a reading. */
export function zoneAbbreviation(ms: number, zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, timeZoneName: 'short',
    }).formatToParts(new Date(ms))
    return parts.find(p => p.type === 'timeZoneName')?.value ?? zone
  } catch {
    return zone
  }
}

/**
 * How far ahead or behind a zone is, in minutes, at a given instant.
 *
 * Computed at that instant rather than in general, because the answer
 * changes across daylight saving — a call that is five hours apart in
 * January can be four in July, and a fixed offset would quietly be wrong
 * for half the year.
 */
export function offsetMinutes(ms: number, zone: string, from = localZone()): number {
  const read = (tz: string) => {
    try {
      const p = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }).formatToParts(new Date(ms))
      const get = (t: string) => Number(p.find(x => x.type === t)?.value ?? '0')
      /* Hour 24 is how some engines spell midnight; normalise it. */
      const h = get('hour') % 24
      return Date.UTC(get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'))
    } catch {
      return ms
    }
  }
  return Math.round((read(zone) - read(from)) / 60_000)
}

/**
 * "3:00 PM CEST · 6 hours ahead" — the whole reading in one line.
 *
 * Returns null when the zone matches the reader's own, because saying
 * an event is zero hours from where you already are is noise.
 */
export function describeInZone(ms: number, zone: string, from = localZone()): string | null {
  if (!zone || zone === from || !isValidZone(zone)) return null
  const mins = offsetMinutes(ms, zone, from)
  const time = formatInZone(ms, zone)
  const abbr = zoneAbbreviation(ms, zone)
  if (mins === 0) return `${time} ${abbr} · same time`

  const ahead = mins > 0
  const abs   = Math.abs(mins)
  const h     = Math.floor(abs / 60)
  const m     = abs % 60
  const span  = m === 0 ? `${h} hour${h === 1 ? '' : 's'}` : `${h}h ${m}m`
  return `${time} ${abbr} · ${span} ${ahead ? 'ahead' : 'behind'}`
}
