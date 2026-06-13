/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — University Configuration Registry
 * Phase 2 · Step 2.3 — Polymorphic University Search & Content Node
 *
 * Architecture:
 *   Each university is represented by two objects:
 *
 *   UniversityEntry — lightweight row in the lookup autocomplete.
 *     Lives entirely in this index module; always bundled.
 *
 *   UniversityConfig — heavyweight resource map with every link,
 *     description, category group, and metadata for that school.
 *     Lives in a dedicated file (e.g. ./cornell.ts) and loaded
 *     on-demand via dynamic import so only the active institution's
 *     data hits the browser bundle.
 *
 * Adding a new university:
 *   1. Create config/universities/<id>.ts  exporting a `UniversityConfig`
 *   2. Add an entry to UNIVERSITY_REGISTRY with hasData: true
 *   3. Add a `case '<id>'` to getUniversityConfig()
 * ════════════════════════════════════════════════════════════════
 */

/* ── Data types ─────────────────────────────────────────────── */

/** A single external resource link within a university's category. */
export interface UniLink {
  /** Stable identifier — never shown to the user */
  id:          string
  /** Prominent card heading */
  title:       string
  /** Two-sentence description of what the portal does */
  description: string
  /** Full external URL — always opened in a new tab */
  url:         string
  /** Optional micro-tag pill, e.g. "LMS", "Portal", "Jobs" */
  tag?:        string
}

/** The four resource tab sections in the hub. */
export type UniTab = 'academics' | 'career' | 'campus' | 'essentials'

/** A functional grouping of related university resource links. */
export interface UniCategory {
  id:    string
  label: string
  tab:   UniTab    // which resource tab this category belongs to
  links: UniLink[]
}

/** GPA grading scale used by the university. */
export type GpaScale = '4.3' | '4.0'

/** Complete data map for one institution — loaded on-demand. */
export interface UniversityConfig {
  /** Matches the id in UniversityEntry */
  id:           string
  /** Full official name, e.g. "Cornell University" */
  name:         string
  /** Abbreviated display name, e.g. "Cornell" */
  shortName:    string
  /** City, State, e.g. "Ithaca, NY" */
  location:     string
  /** GPA scale — 4.3 (Cornell) or 4.0 (most others) */
  gpaScale:     GpaScale
  /** University campus currency name, e.g. "Big Red Bucks" */
  currencyName?: string
  categories:   UniCategory[]
}

/** Lightweight entry used in the autocomplete registry. */
export interface UniversityEntry {
  id:        string
  name:      string
  shortName: string
  /**
   * true  → full UniversityConfig data file exists; loads the hub.
   * false → shows a Coming Soon message after selection.
   */
  hasData:   boolean
}

/* ── Autocomplete registry ──────────────────────────────────── */

/**
 * Master list of recognisable institutions.
 * The autocomplete dropdown filters against `name` and `shortName`.
 * Add entries freely — only those with `hasData: true` need a
 * corresponding config file.
 */
export const UNIVERSITY_REGISTRY: UniversityEntry[] = [
  // ── Full data (alphabetical by id) ────────────────────────
  { id: 'arkansas',      name: 'University of Arkansas',                  shortName: 'U of A',       hasData: true  },
  { id: 'asu',           name: 'Arizona State University',                shortName: 'ASU',          hasData: true  },
  { id: 'cornell',       name: 'Cornell University',                      shortName: 'Cornell',      hasData: true  },
  { id: 'cu-boulder',    name: 'University of Colorado Boulder',          shortName: 'CU Boulder',   hasData: true  },
  { id: 'georgia-tech',  name: 'Georgia Institute of Technology',         shortName: 'Georgia Tech', hasData: true  },
  { id: 'loyola-chicago',name: 'Loyola University Chicago',               shortName: 'Loyola Chicago',hasData: true },
  { id: 'michigan-state',name: 'Michigan State University',               shortName: 'MSU',          hasData: true  },
  { id: 'northwestern',  name: 'Northwestern University',                 shortName: 'Northwestern', hasData: true  },
  { id: 'ohio-state',    name: 'Ohio State University',                   shortName: 'Ohio State',   hasData: true  },
  { id: 'penn-state',    name: 'Pennsylvania State University',           shortName: 'Penn State',   hasData: true  },
  { id: 'purdue',        name: 'Purdue University',                       shortName: 'Purdue',       hasData: true  },
  { id: 'texas-am',      name: 'Texas A&M University',                    shortName: 'Texas A&M',    hasData: true  },
  { id: 'uf',            name: 'University of Florida',                   shortName: 'UF',           hasData: true  },
  { id: 'ucla',          name: 'University of California, Los Angeles',   shortName: 'UCLA',         hasData: true  },
  { id: 'umich',         name: 'University of Michigan',                  shortName: 'U-Mich',       hasData: true  },
  { id: 'ut-austin',     name: 'University of Texas at Austin',           shortName: 'UT Austin',    hasData: true  },
  { id: 'uw-seattle',    name: 'University of Washington',                shortName: 'UW',           hasData: true  },
  { id: 'virginia-tech', name: 'Virginia Tech',                           shortName: 'Virginia Tech',hasData: true  },

  // ── Coming soon (alphabetical) ────────────────────────────
  { id: 'brown',        name: 'Brown University',                        shortName: 'Brown',        hasData: false },
  { id: 'caltech',      name: 'California Institute of Technology',      shortName: 'Caltech',      hasData: false },
  { id: 'cmu',          name: 'Carnegie Mellon University',              shortName: 'CMU',          hasData: false },
  { id: 'columbia',     name: 'Columbia University',                     shortName: 'Columbia',     hasData: false },
  { id: 'dartmouth',    name: 'Dartmouth College',                       shortName: 'Dartmouth',    hasData: false },
  { id: 'duke',         name: 'Duke University',                         shortName: 'Duke',         hasData: false },
  { id: 'georgetown',   name: 'Georgetown University',                   shortName: 'Georgetown',   hasData: false },
  { id: 'harvard',      name: 'Harvard University',                      shortName: 'Harvard',      hasData: false },
  { id: 'jhu',          name: 'Johns Hopkins University',                shortName: 'JHU',          hasData: false },
  { id: 'mit',          name: 'Massachusetts Institute of Technology',   shortName: 'MIT',          hasData: false },
  { id: 'nyu',          name: 'New York University',                     shortName: 'NYU',          hasData: false },
  { id: 'princeton',    name: 'Princeton University',                    shortName: 'Princeton',    hasData: false },
  { id: 'stanford',     name: 'Stanford University',                     shortName: 'Stanford',     hasData: false },
  { id: 'tufts',        name: 'Tufts University',                        shortName: 'Tufts',        hasData: false },
  { id: 'uc-berkeley',  name: 'University of California, Berkeley',      shortName: 'UC Berkeley',  hasData: false },
  { id: 'uchicago',     name: 'University of Chicago',                   shortName: 'UChicago',     hasData: false },
  { id: 'upenn',        name: 'University of Pennsylvania',              shortName: 'Penn',         hasData: false },
  { id: 'vanderbilt',   name: 'Vanderbilt University',                   shortName: 'Vanderbilt',   hasData: false },
  { id: 'yale',         name: 'Yale University',                         shortName: 'Yale',         hasData: false },
]

/* ── On-demand config loader ────────────────────────────────── */

/**
 * Dynamically imports the UniversityConfig for the given id.
 * Returns null if no config exists for that id.
 *
 * The dynamic import keeps each school's resource map out of
 * the main bundle — only the active institution is ever fetched.
 */
export async function getUniversityConfig(
  id: string,
): Promise<UniversityConfig | null> {
  try {
    switch (id) {
      case 'arkansas': {
        const { ARKANSAS } = await import('./arkansas')
        return ARKANSAS
      }
      case 'asu': {
        const { ASU } = await import('./asu')
        return ASU
      }
      case 'cornell': {
        const { CORNELL } = await import('./cornell')
        return CORNELL
      }
      case 'cu-boulder': {
        const { CU_BOULDER } = await import('./cu-boulder')
        return CU_BOULDER
      }
      case 'georgia-tech': {
        const { GEORGIA_TECH } = await import('./georgia-tech')
        return GEORGIA_TECH
      }
      case 'loyola-chicago': {
        const { LOYOLA_CHICAGO } = await import('./loyola-chicago')
        return LOYOLA_CHICAGO
      }
      case 'michigan-state': {
        const { MICHIGAN_STATE } = await import('./michigan-state')
        return MICHIGAN_STATE
      }
      case 'northwestern': {
        const { NORTHWESTERN } = await import('./northwestern')
        return NORTHWESTERN
      }
      case 'ohio-state': {
        const { OHIO_STATE } = await import('./ohio-state')
        return OHIO_STATE
      }
      case 'penn-state': {
        const { PENN_STATE } = await import('./penn-state')
        return PENN_STATE
      }
      case 'purdue': {
        const { PURDUE } = await import('./purdue')
        return PURDUE
      }
      case 'texas-am': {
        const { TEXAS_AM } = await import('./texas-am')
        return TEXAS_AM
      }
      case 'uf': {
        const { UF } = await import('./uf')
        return UF
      }
      case 'ucla': {
        const { UCLA } = await import('./ucla')
        return UCLA
      }
      case 'umich': {
        const { UMICH } = await import('./umich')
        return UMICH
      }
      case 'ut-austin': {
        const { UT_AUSTIN } = await import('./ut-austin')
        return UT_AUSTIN
      }
      case 'uw-seattle': {
        const { UW_SEATTLE } = await import('./uw-seattle')
        return UW_SEATTLE
      }
      case 'virginia-tech': {
        const { VIRGINIA_TECH } = await import('./virginia-tech')
        return VIRGINIA_TECH
      }
      default:
        return null
    }
  } catch {
    return null
  }
}
