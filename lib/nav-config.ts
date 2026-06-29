/* ════════════════════════════════════════════════════════════
   Zenith Navigation Taxonomy
   Central source of truth for routes, categories, and
   the background-morph tint palette.
   ════════════════════════════════════════════════════════════ */

export type CategoryId = 'essentials' | 'creator' | 'vault'

export type ViewId =
  | 'home'
  | 'outlook'
  // Essentials → Scholastic
  | 'uni-hub'
  | 'study-shield'
  | 'vocab-builder'
  // Essentials → Life
  | 'calendar'
  | 'habits'
  | 'workouts'
  | 'wellness'
  | 'meal-planning'
  | 'world-events'
  | 'sports'
  | 'personal-brand'
  | 'subscriptions'
  | 'game-finder'
  | 'friends-network'
  | 'book-tracker'
  | 'tournament-hub'
  // Creator's Choice
  | 'aquascaping'
  | 'trail-hunter'
  | 'botanist'
  | 'games'
  // Personalized Vault
  | 'custom-links'
  | 'stats'
  // System
  | 'settings'
  | 'help'

export interface NavLink {
  id:       ViewId
  label:    string
  category: CategoryId
  color:    string   // unique hex accent per view — drives nav hover glow + widget top-edge
}

/** Convert a 6-digit hex color to an rgba() string */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
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
export const BG_HOME = '#0d0f12'

export const NAV_CONFIG: NavCategory[] = [
  {
    id: 'essentials',
    label: 'Zenith Essentials',
    bgTint: '#0e1018',            // Warm Deep Slate-Indigo
    subcategories: [
      {
        id: 'overview',
        label: 'Overview',
        links: [
          { id: 'outlook', label: 'Daily Outlook', category: 'essentials', color: '#7c95ff' },
        ],
      },
      {
        id: 'scholastic',
        label: 'Scholastic',
        links: [
          { id: 'uni-hub',       label: 'University Hub',  category: 'essentials', color: '#6366f1' },
          { id: 'study-shield',  label: 'Study Shield',    category: 'essentials', color: '#38bdf8' },
          { id: 'vocab-builder', label: 'Vocab Builder',   category: 'essentials', color: '#06b6d4' },
        ],
      },
      {
        id: 'life',
        label: 'Life',
        links: [
          { id: 'habits',        label: 'Habits',             category: 'essentials', color: '#f87171' },
          { id: 'calendar',      label: 'Universal Calendar', category: 'essentials', color: '#60a5fa' },
          { id: 'meal-planning', label: 'Meal Planning',      category: 'essentials', color: '#86efac' },
          { id: 'wellness',      label: 'Mental Wellness',    category: 'essentials', color: '#f9a8d4' },
          { id: 'book-tracker',  label: 'Library',    category: 'essentials', color: '#f97316' },
        ],
      },
    ],
  },
  {
    id: 'creator',
    label: "Creator's Choice",
    bgTint: '#090f0b',            // Deep Obsidian-Green
    links: [
      { id: 'aquascaping',   label: 'Aquascaping Engine', category: 'creator', color: '#059669' },
      { id: 'trail-hunter',  label: 'Trail Hunter',       category: 'creator', color: '#22c55e' },
      { id: 'botanist',      label: 'Botanist Guide',     category: 'creator', color: '#4ade80' },
      { id: 'games',         label: 'Arcade Hub',         category: 'creator', color: '#a3e635' },
      { id: 'sports',        label: 'Sports Tracker',     category: 'creator', color: '#34d399' },
      { id: 'world-events',  label: 'World Events',       category: 'creator', color: '#818cf8' },
      { id: 'personal-brand',label: 'Personal Brand Hub', category: 'creator', color: '#fbbf24' },
      { id: 'game-finder',   label: 'Game Hub',           category: 'creator', color: '#c084fc' },
    ],
  },
  {
    id: 'vault',
    label: 'Personalized Vault',
    bgTint: '#0f1012',            // Warm Mineral Charcoal
    links: [
      { id: 'custom-links', label: 'Custom Link Manager', category: 'vault', color: '#94a3b8' },
      { id: 'stats',        label: 'Stats & Analytics',   category: 'vault', color: '#f59e0b' },
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

export const CATEGORY_HOVER_BG: Record<CategoryId, string> = {
  essentials: 'rgba(124, 149, 255, 0.12)',
  creator:    'rgba(99,  163, 137, 0.12)',   /* botanical sage green */
  vault:      'rgba(155, 163, 196, 0.15)',
}

export const CATEGORY_ACTIVE_BG: Record<CategoryId, string> = {
  essentials: 'rgba(124, 149, 255, 0.18)',
  creator:    'rgba(99,  163, 137, 0.18)',   /* botanical sage green */
  vault:      'rgba(155, 163, 196, 0.22)',
}

export const CATEGORY_BORDER: Record<CategoryId, string> = {
  essentials: 'rgba(124, 149, 255, 0.55)',
  creator:    'rgba(99,  163, 137, 0.55)',   /* botanical sage green */
  vault:      'rgba(155, 163, 196, 0.60)',
}
