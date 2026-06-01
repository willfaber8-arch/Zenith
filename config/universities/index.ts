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

/** A functional grouping of related university resource links. */
export interface UniCategory {
  id:    string
  label: string
  links: UniLink[]
}

/** Complete data map for one institution — loaded on-demand. */
export interface UniversityConfig {
  /** Matches the id in UniversityEntry */
  id:         string
  /** Full official name, e.g. "Cornell University" */
  name:       string
  /** Abbreviated display name, e.g. "Cornell" */
  shortName:  string
  /** City, State, e.g. "Ithaca, NY" */
  location:   string
  categories: UniCategory[]
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
  // ── Full data ─────────────────────────────────────────────
  { id: 'cornell',      name: 'Cornell University',                      shortName: 'Cornell',      hasData: true  },

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
  { id: 'northwestern', name: 'Northwestern University',                 shortName: 'Northwestern', hasData: false },
  { id: 'nyu',          name: 'New York University',                     shortName: 'NYU',          hasData: false },
  { id: 'princeton',    name: 'Princeton University',                    shortName: 'Princeton',    hasData: false },
  { id: 'stanford',     name: 'Stanford University',                     shortName: 'Stanford',     hasData: false },
  { id: 'tufts',        name: 'Tufts University',                        shortName: 'Tufts',        hasData: false },
  { id: 'uc-berkeley',  name: 'University of California, Berkeley',      shortName: 'UC Berkeley',  hasData: false },
  { id: 'ucla',         name: 'University of California, Los Angeles',   shortName: 'UCLA',         hasData: false },
  { id: 'uchicago',     name: 'University of Chicago',                   shortName: 'UChicago',     hasData: false },
  { id: 'umich',        name: 'University of Michigan',                  shortName: 'U-Mich',       hasData: false },
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
      case 'cornell': {
        const { CORNELL } = await import('./cornell')
        return CORNELL
      }
      // Future institutions slot in here as case blocks:
      // case 'mit': { const { MIT } = await import('./mit'); return MIT }
      default:
        return null
    }
  } catch {
    return null
  }
}
