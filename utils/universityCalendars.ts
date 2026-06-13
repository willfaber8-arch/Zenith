/**
 * University Academic Calendar Dictionary — Phase 10.3
 *
 * Static reference map for 5 universities covering Fall 2026.
 * Each entry defines the operational semester window and every
 * official break/holiday range during which classes do NOT meet.
 *
 * All dates are ISO "YYYY-MM-DD" strings and are compared
 * lexicographically in the schedule generator — the zero-padded
 * format guarantees this is safe and correct.
 */

export type UniversityId =
  | 'CORNELL'
  | 'ARKANSAS'
  | 'TEXAS_TECH'
  | 'UNC_CHAPEL_HILL'
  | 'RICE'

/** A closed date range [from, to] during which classes are cancelled. */
export interface BreakRange {
  label: string   // human-readable name shown in the UI
  from:  string   // ISO "YYYY-MM-DD" — first excluded day (inclusive)
  to:    string   // ISO "YYYY-MM-DD" — last excluded day (inclusive)
}

export interface UniversityCalendar {
  label:         string          // display name for the institution
  semesterStart: string          // ISO date — first day of instruction
  semesterEnd:   string          // ISO date — last day of instruction (not finals)
  color:         string          // hex accent for the generated calendar feed
  breaks:        BreakRange[]    // ordered list of exclusion windows
}

export const UNIVERSITY_CALENDARS: Record<UniversityId, UniversityCalendar> = {

  /* ── Cornell University — Fall 2026 ───────────────────────────── */
  CORNELL: {
    label:         'Cornell University',
    semesterStart: '2026-08-25',
    semesterEnd:   '2026-12-13',
    color:         '#b31b1b',  // Cornell Red
    breaks: [
      { label: 'Fall Break',          from: '2026-10-10', to: '2026-10-13' },
      { label: 'Thanksgiving Week',   from: '2026-11-25', to: '2026-11-29' },
    ],
  },

  /* ── University of Arkansas — Fall 2026 ───────────────────────── */
  ARKANSAS: {
    label:         'University of Arkansas',
    semesterStart: '2026-08-17',
    semesterEnd:   '2026-12-11',
    color:         '#9d2235',  // Arkansas Cardinal
    breaks: [
      { label: 'Labor Day',           from: '2026-09-07', to: '2026-09-07' },
      { label: 'Thanksgiving Break',  from: '2026-11-23', to: '2026-11-27' },
    ],
  },

  /* ── Texas Tech University — Fall 2026 ────────────────────────── */
  TEXAS_TECH: {
    label:         'Texas Tech University',
    semesterStart: '2026-08-24',
    semesterEnd:   '2026-12-12',
    color:         '#cc0000',  // Raider Red
    breaks: [
      { label: 'Labor Day',             from: '2026-09-07', to: '2026-09-07' },
      { label: 'Thanksgiving Vacation', from: '2026-11-23', to: '2026-11-27' },
    ],
  },

  /* ── UNC Chapel Hill — Fall 2026 ──────────────────────────────── */
  UNC_CHAPEL_HILL: {
    label:         'UNC Chapel Hill',
    semesterStart: '2026-08-20',
    semesterEnd:   '2026-12-08',
    color:         '#4b9cd3',  // Carolina Blue
    breaks: [
      { label: 'Fall Break',          from: '2026-10-15', to: '2026-10-16' },
      { label: 'Thanksgiving Recess', from: '2026-11-25', to: '2026-11-29' },
    ],
  },

  /* ── Rice University — Fall 2026 ──────────────────────────────── */
  RICE: {
    label:         'Rice University',
    semesterStart: '2026-08-24',
    semesterEnd:   '2026-12-06',
    color:         '#003c71',  // Rice Blue
    breaks: [
      { label: 'Mid-Term Break',      from: '2026-10-12', to: '2026-10-13' },
      { label: 'Thanksgiving Recess', from: '2026-11-25', to: '2026-11-27' },
    ],
  },
}

/** Ordered list for dropdown rendering. */
export const UNIVERSITY_ID_LIST: UniversityId[] = [
  'CORNELL',
  'ARKANSAS',
  'TEXAS_TECH',
  'UNC_CHAPEL_HILL',
  'RICE',
]
