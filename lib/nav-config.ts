/* ════════════════════════════════════════════════════════════
   Zenith Navigation Taxonomy — Phase 0 · Step 0.3
   Central source of truth for routes, categories, and
   the background-morph tint palette.
   ════════════════════════════════════════════════════════════ */

export type CategoryId = 'essentials' | 'creator' | 'vault'

export type ViewId =
  | 'home'
  // Essentials → Scholastic
  | 'study-shield'
  | 'gpa-calc'
  | 'uni-hub'
  | 'major-hub'
  | 'course-matrix'
  | 'character'
  | 'grit-analytics'
  | 'quest-matrix'
  | 'focus-rooms'
  // Essentials → Life
  | 'calendar'
  | 'workouts'
  | 'burn-rate'
  | 'slope-day'
  // Creator's Choice
  | 'aquascaping'
  | 'trail-hunter'
  | 'botanist'
  // Personalized Vault
  | 'custom-links'

export interface NavLink {
  id: ViewId
  label: string
  category: CategoryId
}

export interface NavSubCategory {
  id: string
  label: string
  links: NavLink[]
}

export interface NavCategory {
  id: CategoryId
  label: string
  /** Very dark, low-saturation background tint for this category */
  bgTint: string
  subcategories?: NavSubCategory[]
  links?: NavLink[]
}

/** Default background — matches --bg-main in globals.css */
export const BG_HOME = '#0b0d13'

export const NAV_CONFIG: NavCategory[] = [
  {
    id: 'essentials',
    label: 'Zenith Essentials',
    bgTint: '#0d1020',            // Deep Slate-Indigo
    subcategories: [
      {
        id: 'scholastic',
        label: 'Scholastic',
        links: [
          { id: 'study-shield',   label: 'Study Shield',       category: 'essentials' },
          { id: 'gpa-calc',       label: 'GPA Calculator',     category: 'essentials' },
          { id: 'uni-hub',        label: 'University Hub',     category: 'essentials' },
          { id: 'major-hub',      label: 'Major Hub',          category: 'essentials' },
          { id: 'course-matrix',  label: 'Cognitive Load Map', category: 'essentials' },
          { id: 'character',        label: 'Character Sheet',    category: 'essentials' },
          { id: 'grit-analytics', label: 'Grit Analytics',     category: 'essentials' },
          { id: 'quest-matrix',  label: 'Quest Matrix',       category: 'essentials' },
          { id: 'focus-rooms',   label: 'Focus Rooms',        category: 'essentials' },
        ],
      },
      {
        id: 'life',
        label: 'Life',
        links: [
          { id: 'calendar',  label: 'Universal Calendar',  category: 'essentials' },
          { id: 'workouts',  label: 'Workouts',            category: 'essentials' },
          { id: 'burn-rate', label: 'BRB Burn Rate',       category: 'essentials' },
          { id: 'slope-day', label: 'Slope Day',           category: 'essentials' },
        ],
      },
    ],
  },
  {
    id: 'creator',
    label: "Creator's Choice",
    bgTint: '#090f0b',            // Deep Obsidian-Green
    links: [
      { id: 'aquascaping',  label: 'Aquascaping Engine',  category: 'creator' },
      { id: 'trail-hunter', label: 'Trail Hunter',        category: 'creator' },
      { id: 'botanist',     label: 'Botanist Guide',      category: 'creator' },
    ],
  },
  {
    id: 'vault',
    label: 'Personalized Vault',
    bgTint: '#101010',            // Minimal Charcoal-Grey
    links: [
      { id: 'custom-links', label: 'Custom Link Manager', category: 'vault' },
    ],
  },
]

export function getCategoryBg(categoryId: CategoryId | null): string {
  if (!categoryId) return BG_HOME
  return NAV_CONFIG.find(c => c.id === categoryId)?.bgTint ?? BG_HOME
}

/** Per-category accent color for active nav item text / dot */
export const CATEGORY_ACCENT: Record<CategoryId, string> = {
  essentials: 'var(--accent-purple)',
  creator:    'var(--accent-green)',
  vault:      'var(--text-muted)',
}

/**
 * Hover background per category — Step 0.4 micro-interaction spec.
 * Low opacity so the tint is felt, not shouted.
 */
export const CATEGORY_HOVER_BG: Record<CategoryId, string> = {
  essentials: 'rgba(124, 149, 255, 0.12)',   // Soft Indigo-Periwinkle
  creator:    'rgba(82,  204, 163, 0.12)',   // Organic Sage-Emerald
  vault:      'rgba(155, 163, 196, 0.15)',   // Balanced Charcoal-Silver
}

/**
 * Active background — slightly higher opacity than hover to act as
 * a persistent anchor against the morphed page background.
 */
export const CATEGORY_ACTIVE_BG: Record<CategoryId, string> = {
  essentials: 'rgba(124, 149, 255, 0.18)',
  creator:    'rgba(82,  204, 163, 0.18)',
  vault:      'rgba(155, 163, 196, 0.22)',
}

/**
 * Active left-border accent rendered as an inset box-shadow so
 * it never causes layout shift.
 */
export const CATEGORY_BORDER: Record<CategoryId, string> = {
  essentials: 'rgba(124, 149, 255, 0.55)',
  creator:    'rgba(82,  204, 163, 0.55)',
  vault:      'rgba(155, 163, 196, 0.60)',
}
