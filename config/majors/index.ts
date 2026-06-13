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
  { id: 'engineering',      name: 'Engineering',                    shortName: 'Eng',          hasData: true  },
  { id: 'business',         name: 'Business Administration',        shortName: 'Business',     hasData: true  },
  { id: 'architecture',     name: 'Architecture',                   shortName: 'Architecture', hasData: true  },

  { id: 'chemistry',            name: 'Chemistry',                      shortName: 'Chem',      hasData: true  },
  { id: 'education',            name: 'Education',                      shortName: 'Education', hasData: true  },
  { id: 'environmental-science',name: 'Environmental Science',          shortName: 'Env Sci',   hasData: true  },
  { id: 'finance',              name: 'Finance',                        shortName: 'Finance',   hasData: true  },
  { id: 'marketing',            name: 'Marketing',                      shortName: 'Marketing', hasData: true  },
  { id: 'mathematics',          name: 'Mathematics',                    shortName: 'Math',      hasData: true  },
  { id: 'nursing',              name: 'Nursing',                        shortName: 'Nursing',   hasData: true  },

  { id: 'biology',            name: 'Biology',                        shortName: 'Bio',          hasData: true  },
  { id: 'communications',     name: 'Communications & Media Studies',  shortName: 'Comm',         hasData: true  },
  { id: 'computer-science',   name: 'Computer Science',               shortName: 'CS',           hasData: true  },
  { id: 'criminal-justice',   name: 'Criminal Justice',               shortName: 'CJ',           hasData: true  },
  { id: 'economics',          name: 'Economics',                      shortName: 'Econ',         hasData: true  },
  { id: 'political-science',  name: 'Political Science',              shortName: 'Poli Sci',     hasData: true  },
  { id: 'pre-med',            name: 'Pre-Medicine (Pre-Med)',          shortName: 'Pre-Med',      hasData: true  },
  { id: 'psychology',         name: 'Psychology',                     shortName: 'Psych',        hasData: true  },

  // ── Coming soon (alphabetical) ─────────────────────────────
  { id: 'english',          name: 'English Literature',             shortName: 'Eng Lit',      hasData: false },
  { id: 'law',              name: 'Law (Pre-Law)',                   shortName: 'Law',          hasData: false },
  { id: 'neuroscience',     name: 'Neuroscience',                   shortName: 'Neuro',        hasData: false },
  { id: 'physics',          name: 'Physics',                        shortName: 'Phys',         hasData: false },
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
      case 'business': {
        const { BUSINESS } = await import('./business')
        return BUSINESS
      }
      case 'architecture': {
        const { ARCHITECTURE } = await import('./architecture')
        return ARCHITECTURE
      }
      case 'chemistry': {
        const { CHEMISTRY } = await import('./chemistry')
        return CHEMISTRY
      }
      case 'education': {
        const { EDUCATION } = await import('./education')
        return EDUCATION
      }
      case 'environmental-science': {
        const { ENVIRONMENTAL_SCIENCE } = await import('./environmental-science')
        return ENVIRONMENTAL_SCIENCE
      }
      case 'finance': {
        const { FINANCE } = await import('./finance')
        return FINANCE
      }
      case 'marketing': {
        const { MARKETING } = await import('./marketing')
        return MARKETING
      }
      case 'mathematics': {
        const { MATHEMATICS } = await import('./mathematics')
        return MATHEMATICS
      }
      case 'nursing': {
        const { NURSING } = await import('./nursing')
        return NURSING
      }
      case 'biology': {
        const { BIOLOGY } = await import('./biology')
        return BIOLOGY
      }
      case 'communications': {
        const { COMMUNICATIONS } = await import('./communications')
        return COMMUNICATIONS
      }
      case 'computer-science': {
        const { COMPUTER_SCIENCE } = await import('./computer-science')
        return COMPUTER_SCIENCE
      }
      case 'criminal-justice': {
        const { CRIMINAL_JUSTICE } = await import('./criminal-justice')
        return CRIMINAL_JUSTICE
      }
      case 'economics': {
        const { ECONOMICS } = await import('./economics')
        return ECONOMICS
      }
      case 'political-science': {
        const { POLITICAL_SCIENCE } = await import('./political-science')
        return POLITICAL_SCIENCE
      }
      case 'pre-med': {
        const { PRE_MED } = await import('./pre-med')
        return PRE_MED
      }
      case 'psychology': {
        const { PSYCHOLOGY } = await import('./psychology')
        return PSYCHOLOGY
      }
      default:
        return null
    }
  } catch {
    return null
  }
}
