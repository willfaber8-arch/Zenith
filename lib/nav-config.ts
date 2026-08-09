/* ════════════════════════════════════════════════════════════
   Zenith Navigation Taxonomy

   The sidebar TREE (categories, sub-headings, tints) lives here.
   The MODULES themselves live in lib/modules.ts — this file derives
   NAV_CONFIG from that registry rather than re-declaring every label
   and colour, so the two can no longer disagree.

   ViewId / CategoryId are re-exported below because ~7 modules import
   them from here; the definitions moved to lib/modules.ts to avoid a
   circular import.
   ════════════════════════════════════════════════════════════ */

import {
  MODULE_REGISTRY,
  type CategoryId,
  type ViewId,
} from '@/lib/modules'

export type { CategoryId, ViewId }

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

/* ── Derivation ──────────────────────────────────────────────
   Only ENABLED modules with a nav placement are listed, sorted by
   their declared order. A disabled module disappears from the
   sidebar without any change here. */

function linksFor(category: CategoryId, group?: string): NavLink[] {
  return MODULE_REGISTRY
    .filter(m => m.enabled && m.nav?.category === category && m.nav?.group === group)
    .sort((a, b) => (a.nav?.order ?? 0) - (b.nav?.order ?? 0))
    .map(m => ({ id: m.id, label: m.label, category, color: m.color }))
}

export const NAV_CONFIG: NavCategory[] = [
  {
    id: 'essentials',
    label: 'Zenith Essentials',
    bgTint: '#0e1018',            // Warm Deep Slate-Indigo
    subcategories: [
      { id: 'overview',   label: 'Overview',   links: linksFor('essentials', 'overview') },
      { id: 'scholastic', label: 'Scholastic', links: linksFor('essentials', 'scholastic') },
      { id: 'life',       label: 'Life',       links: linksFor('essentials', 'life') },
    ],
  },
  {
    id: 'creator',
    label: "Creator's Choice",
    bgTint: '#090f0b',            // Deep Obsidian-Green
    links: linksFor('creator'),
  },
  {
    id: 'vault',
    label: 'Personalized Vault',
    bgTint: '#0f1012',            // Warm Mineral Charcoal
    links: linksFor('vault'),
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
