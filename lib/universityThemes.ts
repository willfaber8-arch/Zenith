/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — University Brand Themes
 *
 * Official brand colours for every university with a data file
 * (hasData: true in UNIVERSITY_REGISTRY). CMYK values are the
 * institutions' published print specs, kept for reference; the web
 * UI is driven by the equivalent hex/RGB.
 *
 * Each brand is turned into a free, runtime-applied ThemeDefinition
 * (`uni_<id>`) that swaps the periwinkle accent for the school's
 * primary colour while keeping the dark Zenith surface for
 * readability — the same pattern as the Crimson / Solar themes.
 *
 * Applied via gamesDb activeTheme + ThemeApplicator, which now also
 * resolves keys from UNIVERSITY_THEME_DEFINITIONS.
 * ════════════════════════════════════════════════════════════════
 */

import type { ThemeDefinition } from '@/lib/themeDefinitions'

export interface UniversityBrand {
  /** Matches the university id in UNIVERSITY_REGISTRY */
  id:            string
  /** Display name for the theme prompt */
  name:          string
  /** Primary brand colour — drives the accent */
  primaryHex:    string
  /** Secondary brand colour — shown as a second swatch */
  secondaryHex:  string
  /** Published CMYK spec for the primary colour, e.g. "0 / 100 / 79 / 22" */
  primaryCmyk:   string
  /** Published CMYK spec for the secondary colour */
  secondaryCmyk: string
}

/* ── Brand registry (18 schools with data) ─────────────────────── */

export const UNIVERSITY_BRANDS: Readonly<Record<string, UniversityBrand>> = {
  arkansas:        { id: 'arkansas',        name: 'University of Arkansas',  primaryHex: '#9D2235', secondaryHex: '#FFFFFF', primaryCmyk: '7 / 100 / 65 / 32',  secondaryCmyk: '0 / 0 / 0 / 0'   },
  asu:             { id: 'asu',             name: 'Arizona State',           primaryHex: '#8C1D40', secondaryHex: '#FFC627', primaryCmyk: '9 / 100 / 56 / 47',  secondaryCmyk: '0 / 18 / 100 / 0'},
  cornell:         { id: 'cornell',         name: 'Cornell',                 primaryHex: '#B31B1B', secondaryHex: '#222222', primaryCmyk: '0 / 100 / 79 / 22',  secondaryCmyk: '0 / 0 / 0 / 87'  },
  'cu-boulder':    { id: 'cu-boulder',      name: 'CU Boulder',              primaryHex: '#CFB87C', secondaryHex: '#000000', primaryCmyk: '13 / 19 / 57 / 2',   secondaryCmyk: '0 / 0 / 0 / 100' },
  'georgia-tech':  { id: 'georgia-tech',    name: 'Georgia Tech',            primaryHex: '#B3A369', secondaryHex: '#003057', primaryCmyk: '0 / 3 / 55 / 30',    secondaryCmyk: '100 / 70 / 22 / 65'},
  'loyola-chicago':{ id: 'loyola-chicago',  name: 'Loyola Chicago',          primaryHex: '#7A0019', secondaryHex: '#FFB81C', primaryCmyk: '20 / 100 / 73 / 36', secondaryCmyk: '0 / 27 / 100 / 0'},
  'michigan-state':{ id: 'michigan-state',  name: 'Michigan State',          primaryHex: '#18453B', secondaryHex: '#FFFFFF', primaryCmyk: '89 / 35 / 73 / 27',  secondaryCmyk: '0 / 0 / 0 / 0'   },
  northwestern:    { id: 'northwestern',    name: 'Northwestern',            primaryHex: '#4E2A84', secondaryHex: '#FFFFFF', primaryCmyk: '80 / 100 / 7 / 2',   secondaryCmyk: '0 / 0 / 0 / 0'   },
  'ohio-state':    { id: 'ohio-state',      name: 'Ohio State',              primaryHex: '#BB0000', secondaryHex: '#666666', primaryCmyk: '0 / 100 / 100 / 14', secondaryCmyk: '0 / 0 / 0 / 60'  },
  'penn-state':    { id: 'penn-state',      name: 'Penn State',              primaryHex: '#1E407C', secondaryHex: '#96BEE6', primaryCmyk: '100 / 71 / 10 / 50', secondaryCmyk: '40 / 13 / 0 / 0' },
  purdue:          { id: 'purdue',          name: 'Purdue',                  primaryHex: '#CEB888', secondaryHex: '#000000', primaryCmyk: '18 / 22 / 55 / 1',   secondaryCmyk: '0 / 0 / 0 / 100' },
  'texas-am':      { id: 'texas-am',        name: 'Texas A&M',               primaryHex: '#500000', secondaryHex: '#FFFFFF', primaryCmyk: '0 / 100 / 65 / 79',  secondaryCmyk: '0 / 0 / 0 / 0'   },
  uf:              { id: 'uf',              name: 'Florida',                 primaryHex: '#0021A5', secondaryHex: '#FA4616', primaryCmyk: '100 / 89 / 0 / 0',   secondaryCmyk: '0 / 80 / 95 / 0' },
  ucla:            { id: 'ucla',            name: 'UCLA',                    primaryHex: '#2774AE', secondaryHex: '#FFD100', primaryCmyk: '84 / 45 / 5 / 0',    secondaryCmyk: '0 / 16 / 100 / 0'},
  umich:           { id: 'umich',           name: 'Michigan',                primaryHex: '#00274C', secondaryHex: '#FFCB05', primaryCmyk: '100 / 82 / 42 / 38', secondaryCmyk: '0 / 18 / 100 / 0'},
  'ut-austin':     { id: 'ut-austin',       name: 'UT Austin',               primaryHex: '#BF5700', secondaryHex: '#FFFFFF', primaryCmyk: '0 / 70 / 100 / 15',  secondaryCmyk: '0 / 0 / 0 / 0'   },
  'uw-seattle':    { id: 'uw-seattle',      name: 'Washington',              primaryHex: '#4B2E83', secondaryHex: '#B7A57A', primaryCmyk: '87 / 100 / 9 / 2',   secondaryCmyk: '24 / 26 / 53 / 4'},
  'virginia-tech': { id: 'virginia-tech',   name: 'Virginia Tech',           primaryHex: '#861F41', secondaryHex: '#E5751F', primaryCmyk: '0 / 100 / 53 / 53',  secondaryCmyk: '0 / 65 / 100 / 0'},
}

/* ── Hex → rgba helper ──────────────────────────────────────────── */

function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Stable theme id for a university brand. */
export function uniThemeId(uniId: string): string {
  return `uni_${uniId}`
}

/** Build a ThemeDefinition from a brand's primary colour. */
function buildUniTheme(brand: UniversityBrand): ThemeDefinition {
  const p = brand.primaryHex
  return {
    label:  `${brand.name} Colors`,
    swatch: p,
    vars: {
      '--accent-purple':     p,
      '--accent-purple-dim': rgba(p, 0.35),
      '--border-subtle':     rgba(p, 0.12),
      '--bg-hover':          rgba(p, 0.06),
      '--bg-active':         rgba(p, 0.12),
      '--shadow-card':       `0 2px 24px ${rgba(p, 0.14)}, 0 0 0 1px ${rgba(p, 0.07)}`,
    },
  }
}

/**
 * All university themes keyed by `uni_<id>`.
 * Merged with THEME_DEFINITIONS by ThemeApplicator and the Shop.
 */
export const UNIVERSITY_THEME_DEFINITIONS: Readonly<Record<string, ThemeDefinition>> =
  Object.fromEntries(
    Object.values(UNIVERSITY_BRANDS).map(b => [uniThemeId(b.id), buildUniTheme(b)]),
  )

/** Look up a brand by university id (null if no brand defined). */
export function getUniversityBrand(uniId: string): UniversityBrand | null {
  return UNIVERSITY_BRANDS[uniId] ?? null
}
