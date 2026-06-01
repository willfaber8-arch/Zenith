/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Major Configuration Registry
 * Phase 2 · Step 2.4 — Major-Specific Link Matrix & Resource Hub
 *
 * Architecture mirrors config/universities/:
 *
 *   MajorEntry  — lightweight row for the autocomplete registry.
 *     Always bundled; never grows large.
 *
 *   MajorConfig — heavyweight resource map for a specific major.
 *     Lives in a dedicated file (e.g. ./engineering.ts) and loaded
 *     on-demand so only the active major's data enters the bundle.
 *
 * Adding a new major:
 *   1. Create config/majors/<id>.ts exporting a `MajorConfig`
 *   2. Add an entry to MAJOR_REGISTRY with hasData: true
 *   3. Add a `case '<id>'` to getMajorConfig()
 * ════════════════════════════════════════════════════════════════
 */

/* ── Data types ─────────────────────────────────────────────── */

/** A single external resource link within a major's category. */
export interface MajorLink {
  id:          string
  title:       string
  description: string
  url:         string
  tag?:        string
}

/** A functional grouping of related major resource links. */
export interface MajorCategory {
  id:    string
  label: string
  links: MajorLink[]
}

/** Complete data map for one major track — loaded on-demand. */
export interface MajorConfig {
  id:         string
  name:       string
  shortName:  string
  /** Academic department or school, e.g. "College of Engineering" */
  department: string
  categories: MajorCategory[]
}

/** Lightweight entry used in the autocomplete selector. */
export interface MajorEntry {
  id:        string
  name:      string
  shortName: string
  /**
   * true  → full MajorConfig data file exists; loads the hub.
   * false → shows a Coming Soon message after selection.
   */
  hasData:   boolean
}

/* ── Autocomplete registry ──────────────────────────────────── */

export const MAJOR_REGISTRY: MajorEntry[] = [
  // ── Full data ──────────────────────────────────────────────
  { id: 'engineering',      name: 'Engineering',                    shortName: 'Eng',     hasData: true  },

  // ── Coming soon (alphabetical) ─────────────────────────────
  { id: 'biology',          name: 'Biology',                        shortName: 'Bio',     hasData: false },
  { id: 'business',         name: 'Business Administration',        shortName: 'Bus',     hasData: false },
  { id: 'chemistry',        name: 'Chemistry',                      shortName: 'Chem',    hasData: false },
  { id: 'computer-science', name: 'Computer Science',               shortName: 'CS',      hasData: false },
  { id: 'economics',        name: 'Economics',                      shortName: 'Econ',    hasData: false },
  { id: 'english',          name: 'English Literature',             shortName: 'Eng Lit', hasData: false },
  { id: 'law',              name: 'Law (Pre-Law)',                   shortName: 'Law',     hasData: false },
  { id: 'mathematics',      name: 'Mathematics',                    shortName: 'Math',    hasData: false },
  { id: 'neuroscience',     name: 'Neuroscience',                   shortName: 'Neuro',   hasData: false },
  { id: 'physics',          name: 'Physics',                        shortName: 'Phys',    hasData: false },
  { id: 'pre-med',          name: 'Pre-Medicine (Pre-Med)',          shortName: 'Pre-Med', hasData: false },
  { id: 'psychology',       name: 'Psychology',                     shortName: 'Psych',   hasData: false },
]

/* ── On-demand config loader ────────────────────────────────── */

export async function getMajorConfig(
  id: string,
): Promise<MajorConfig | null> {
  try {
    switch (id) {
      case 'engineering': {
        const { ENGINEERING } = await import('./engineering')
        return ENGINEERING
      }
      // Future majors slot in here:
      // case 'computer-science': { const { CS } = await import('./computer-science'); return CS }
      default:
        return null
    }
  } catch {
    return null
  }
}
