/**
 * lib/shopBackgrounds.ts — 10 purchasable ambient background patterns.
 *
 * These are standalone shop items (category: 'background') that apply
 * independently of the active theme. They use the active theme's accent
 * colour at very low opacity so they can never clash with the palette.
 *
 * Applied by ThemeApplicator via --body-bg-image / --body-bg-size / --body-bg-repeat.
 * Theme Forge overrides these with its own backdrop picker when active.
 */

import { withAlpha } from '@/lib/themeColor'
import type { BackdropSpec } from '@/lib/backdrops'

export type ShopBackgroundId =
  | 'bg_default'
  | 'bg_zigzag'
  | 'bg_stars'
  | 'bg_honeycomb'
  | 'bg_bubbles'
  | 'bg_triangles'
  | 'bg_chevrons'
  | 'bg_waves'
  | 'bg_circuit'
  | 'bg_constellation'
  | 'bg_diamonds'

/** The accent-agnostic baseline texture — what shows when no background is
 *  equipped. Mirrors the fallback in globals.css / ThemeBackground so the
 *  shop swatch and "Default" card preview match the real default exactly. */
export const DEFAULT_BG_SPEC: BackdropSpec = {
  image:  'radial-gradient(circle, rgba(150, 160, 190, 0.18) 1px, transparent 1px)',
  size:   '18px 18px',
  repeat: 'repeat',
}

export interface ShopBackgroundPreset {
  id:    ShopBackgroundId
  label: string
  hint:  string
  build: (accent: string, bg: string) => BackdropSpec
}

export const SHOP_BACKGROUND_PRESETS: readonly ShopBackgroundPreset[] = [
  {
    id: 'bg_zigzag',
    label: 'Zigzag',
    hint: 'Sharp sawtooth repeating wave',
    build: (a) => ({
      image: [
        `linear-gradient(135deg, ${withAlpha(a, 0.08)} 25%, transparent 25%)`,
        `linear-gradient(225deg, ${withAlpha(a, 0.08)} 25%, transparent 25%)`,
        `linear-gradient(315deg, ${withAlpha(a, 0.08)} 25%, transparent 25%)`,
        `linear-gradient(45deg,  ${withAlpha(a, 0.08)} 25%, transparent 25%)`,
      ].join(','),
      size:   '16px 16px',
      repeat: 'repeat',
    }),
  },
  {
    id: 'bg_stars',
    label: 'Star Field',
    hint: 'Sparse sparkling star points',
    build: (a) => ({
      image: [
        `radial-gradient(circle, ${withAlpha(a, 0.30)} 1px, transparent 1px)`,
        `radial-gradient(circle, ${withAlpha(a, 0.14)} 1.5px, transparent 1.5px)`,
        `radial-gradient(circle, ${withAlpha(a, 0.07)} 2px, transparent 2px)`,
      ].join(','),
      size:   '120px 80px, 200px 130px, 160px 100px',
      repeat: 'repeat',
    }),
  },
  {
    id: 'bg_honeycomb',
    label: 'Honeycomb',
    hint: 'Interlocking hexagonal lattice',
    build: (a) => ({
      image: [
        `repeating-linear-gradient( 60deg, ${withAlpha(a, 0.06)} 0, ${withAlpha(a, 0.06)} 1px, transparent 1px, transparent 18px)`,
        `repeating-linear-gradient(-60deg, ${withAlpha(a, 0.06)} 0, ${withAlpha(a, 0.06)} 1px, transparent 1px, transparent 18px)`,
        `repeating-linear-gradient(  0deg, ${withAlpha(a, 0.03)} 0, ${withAlpha(a, 0.03)} 1px, transparent 1px, transparent 18px)`,
      ].join(','),
      size:   'auto',
      repeat: 'repeat',
    }),
  },
  {
    id: 'bg_bubbles',
    label: 'Bubbles',
    hint: 'Soft floating circle clusters',
    build: (a) => ({
      image: [
        `radial-gradient(circle 18px at 20% 30%, ${withAlpha(a, 0.07)} 0%, transparent 100%)`,
        `radial-gradient(circle 28px at 70% 55%, ${withAlpha(a, 0.05)} 0%, transparent 100%)`,
        `radial-gradient(circle 14px at 45% 75%, ${withAlpha(a, 0.08)} 0%, transparent 100%)`,
        `radial-gradient(circle 22px at 88% 20%, ${withAlpha(a, 0.05)} 0%, transparent 100%)`,
        `radial-gradient(circle 10px at 60% 12%, ${withAlpha(a, 0.09)} 0%, transparent 100%)`,
      ].join(','),
      size:   '160px 160px',
      repeat: 'repeat',
    }),
  },
  {
    id: 'bg_triangles',
    label: 'Triangle Mesh',
    hint: 'Interlocking triangular grid',
    build: (a) => ({
      image: [
        `linear-gradient( 60deg, ${withAlpha(a, 0.06)} 1px, transparent 1px)`,
        `linear-gradient(120deg, ${withAlpha(a, 0.06)} 1px, transparent 1px)`,
        `linear-gradient(  0deg, ${withAlpha(a, 0.04)} 1px, transparent 1px)`,
      ].join(','),
      size:   '24px 24px',
      repeat: 'repeat',
    }),
  },
  {
    id: 'bg_chevrons',
    label: 'Chevrons',
    hint: 'Repeating directional arrows',
    build: (a) => ({
      image: [
        `linear-gradient(135deg, ${withAlpha(a, 0.07)} 25%, transparent 25%)`,
        `linear-gradient(225deg, ${withAlpha(a, 0.07)} 25%, transparent 25%)`,
      ].join(','),
      size:   '22px 11px',
      repeat: 'repeat',
    }),
  },
  {
    id: 'bg_waves',
    label: 'Waves',
    hint: 'Overlapping horizontal ripples',
    build: (a) => ({
      image: [
        `repeating-linear-gradient(  0deg, transparent, transparent  9px, ${withAlpha(a, 0.04)} 9px, ${withAlpha(a, 0.04)} 10px)`,
        `repeating-linear-gradient( 35deg, transparent, transparent 13px, ${withAlpha(a, 0.03)} 13px, ${withAlpha(a, 0.03)} 14px)`,
        `repeating-linear-gradient(-35deg, transparent, transparent 13px, ${withAlpha(a, 0.03)} 13px, ${withAlpha(a, 0.03)} 14px)`,
      ].join(','),
      size:   'auto',
      repeat: 'repeat',
    }),
  },
  {
    id: 'bg_circuit',
    label: 'Circuit Board',
    hint: 'PCB-style right-angle traces',
    build: (a) => ({
      image: [
        `linear-gradient(   ${withAlpha(a, 0.06)} 1px, transparent 1px)`,
        `linear-gradient(90deg, ${withAlpha(a, 0.06)} 1px, transparent 1px)`,
        `linear-gradient(   ${withAlpha(a, 0.025)} 1px, transparent 1px)`,
        `linear-gradient(90deg, ${withAlpha(a, 0.025)} 1px, transparent 1px)`,
      ].join(','),
      size:   '80px 80px, 80px 80px, 16px 16px, 16px 16px',
      repeat: 'repeat',
    }),
  },
  {
    id: 'bg_constellation',
    label: 'Constellation',
    hint: 'Distant star clusters with faint halos',
    build: (a) => ({
      image: [
        `radial-gradient(circle, ${withAlpha(a, 0.28)} 1.5px, transparent 1.5px)`,
        `radial-gradient(circle, ${withAlpha(a, 0.09)} 3px,   transparent 3px)`,
        `radial-gradient(circle, ${withAlpha(a, 0.06)} 0.5px, transparent 0.5px)`,
      ].join(','),
      size:   '200px 200px, 200px 200px, 60px 60px',
      repeat: 'repeat',
    }),
  },
  {
    id: 'bg_diamonds',
    label: 'Diamonds',
    hint: 'Rotated square lattice',
    build: (a) => ({
      image: [
        `linear-gradient( 45deg, ${withAlpha(a, 0.07)} 25%, transparent 25%)`,
        `linear-gradient(-45deg, ${withAlpha(a, 0.07)} 25%, transparent 25%)`,
        `linear-gradient( 45deg, transparent 75%, ${withAlpha(a, 0.07)} 75%)`,
        `linear-gradient(-45deg, transparent 75%, ${withAlpha(a, 0.07)} 75%)`,
      ].join(','),
      size:   '28px 28px',
      repeat: 'repeat',
    }),
  },
]

export const SHOP_BACKGROUND_MAP: Readonly<Record<ShopBackgroundId, ShopBackgroundPreset>> =
  Object.fromEntries(SHOP_BACKGROUND_PRESETS.map(p => [p.id, p])) as Record<ShopBackgroundId, ShopBackgroundPreset>

export function isShopBackgroundId(id: string): id is ShopBackgroundId {
  return id in SHOP_BACKGROUND_MAP
}

export function resolveShopBackground(id: string, accent: string, bg: string): BackdropSpec | null {
  /* bg_default is the "no background equipped" sentinel — return the neutral
     baseline texture so swatches/previews can render it like any other. */
  if (id === 'bg_default') return DEFAULT_BG_SPEC
  const preset = SHOP_BACKGROUND_MAP[id as ShopBackgroundId]
  return preset ? preset.build(accent, bg) : null
}
