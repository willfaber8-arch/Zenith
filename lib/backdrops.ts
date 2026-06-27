/**
 * lib/backdrops.ts — ambient body backdrop patterns for the Theme Forge.
 *
 * Each backdrop is generated FROM the theme's accent colour at a very low
 * alpha, so the texture can never clash with the palette — it is always a
 * faint tint of the accent itself. Output feeds three themeable CSS vars:
 *   --body-bg-image · --body-bg-size · --body-bg-repeat
 */

import { withAlpha } from '@/lib/themeColor'

export type BackdropId =
  | 'dots' | 'grid' | 'diagonal' | 'crosshatch' | 'glow' | 'topglow' | 'plain'

export interface BackdropSpec {
  image:  string
  size:   string
  repeat: string
}

export interface BackdropPreset {
  id:    BackdropId
  label: string
  hint:  string
  build: (accent: string, bg: string) => BackdropSpec
}

export const BACKDROP_PRESETS: readonly BackdropPreset[] = [
  {
    id: 'dots', label: 'Dot Grid', hint: 'Soft repeating dots',
    build: (a) => ({
      image:  `radial-gradient(circle, ${withAlpha(a, 0.07)} 1px, transparent 1px)`,
      size:   '30px 30px',
      repeat: 'repeat',
    }),
  },
  {
    id: 'grid', label: 'Line Grid', hint: 'Fine graph-paper lines',
    build: (a) => ({
      image:
        `linear-gradient(${withAlpha(a, 0.05)} 1px, transparent 1px),` +
        `linear-gradient(90deg, ${withAlpha(a, 0.05)} 1px, transparent 1px)`,
      size:   '34px 34px',
      repeat: 'repeat',
    }),
  },
  {
    id: 'diagonal', label: 'Diagonal', hint: 'Angled hairlines',
    build: (a) => ({
      image:  `repeating-linear-gradient(45deg, ${withAlpha(a, 0.05)} 0, ${withAlpha(a, 0.05)} 1px, transparent 1px, transparent 14px)`,
      size:   'auto',
      repeat: 'repeat',
    }),
  },
  {
    id: 'crosshatch', label: 'Crosshatch', hint: 'Woven diagonal weave',
    build: (a) => ({
      image:
        `repeating-linear-gradient(45deg, ${withAlpha(a, 0.04)} 0, ${withAlpha(a, 0.04)} 1px, transparent 1px, transparent 16px),` +
        `repeating-linear-gradient(-45deg, ${withAlpha(a, 0.04)} 0, ${withAlpha(a, 0.04)} 1px, transparent 1px, transparent 16px)`,
      size:   'auto',
      repeat: 'repeat',
    }),
  },
  {
    id: 'glow', label: 'Aurora Glow', hint: 'Diffuse corner glows',
    build: (a) => ({
      image:
        `radial-gradient(ellipse 80% 60% at 12% 0%, ${withAlpha(a, 0.10)}, transparent 70%),` +
        `radial-gradient(ellipse 70% 60% at 100% 100%, ${withAlpha(a, 0.08)}, transparent 70%)`,
      size:   '100% 100%',
      repeat: 'no-repeat',
    }),
  },
  {
    id: 'topglow', label: 'Halo', hint: 'Single soft top halo',
    build: (a) => ({
      image:  `radial-gradient(ellipse 90% 50% at 50% -10%, ${withAlpha(a, 0.12)}, transparent 65%)`,
      size:   '100% 100%',
      repeat: 'no-repeat',
    }),
  },
  {
    id: 'plain', label: 'Plain', hint: 'No texture — pure surface',
    build: () => ({ image: 'none', size: 'auto', repeat: 'no-repeat' }),
  },
]

export const BACKDROP_MAP: Readonly<Record<BackdropId, BackdropPreset>> =
  Object.fromEntries(BACKDROP_PRESETS.map(p => [p.id, p])) as Record<BackdropId, BackdropPreset>

export function resolveBackdrop(id: BackdropId, accent: string, bg: string): BackdropSpec {
  return (BACKDROP_MAP[id] ?? BACKDROP_MAP.dots).build(accent, bg)
}
