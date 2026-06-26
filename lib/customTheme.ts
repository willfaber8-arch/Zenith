/**
 * lib/customTheme.ts — the user-built "Theme Forge" theme.
 *
 * A single editable theme persisted in localStorage (not IDB) so it can be
 * tweaked instantly from a colour wheel without a DB round-trip. When the
 * active theme is CUSTOM_THEME_ID, ThemeApplicator compiles the stored
 * config into the same CSS-var shape as any built-in ThemeDefinition.
 *
 * Readability + non-clash are enforced at compile time:
 *  • body text colour is auto-chosen for AA contrast against the background
 *  • every secondary tone is derived from the three chosen colours
 *  • the backdrop pattern is a faint tint of the accent (never a 3rd hue)
 */

import type { ThemeDefinition } from '@/lib/themeDefinitions'
import {
  normalizeHex, readableText, mix, withAlpha, isLight,
  ensureAccentContrast, contrastRatio,
} from '@/lib/themeColor'
import { resolveBackdrop, type BackdropId } from '@/lib/backdrops'

export const CUSTOM_THEME_ID = 'theme_forge'
export const CUSTOM_THEME_STORAGE_KEY = 'zenith_custom_theme_v1'
/** Fired (on window) whenever the stored custom theme changes. */
export const CUSTOM_THEME_EVENT = 'zenith:custom-theme-changed'

export interface CustomThemeConfig {
  accent:   string      // primary accent hex
  bgMain:   string      // app background hex
  surface:  string      // card / panel surface hex
  backdrop: BackdropId  // ambient body texture
}

export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  accent:   '#7c95ff',
  bgMain:   '#0b0d13',
  surface:  '#141923',
  backdrop: 'dots',
}

/* ── Persistence ──────────────────────────────────────────────── */

export function loadCustomTheme(): CustomThemeConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_CUSTOM_THEME }
  try {
    const raw = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CUSTOM_THEME }
    const parsed = JSON.parse(raw) as Partial<CustomThemeConfig>
    return {
      accent:   normalizeHex(parsed.accent  ?? '') ?? DEFAULT_CUSTOM_THEME.accent,
      bgMain:   normalizeHex(parsed.bgMain  ?? '') ?? DEFAULT_CUSTOM_THEME.bgMain,
      surface:  normalizeHex(parsed.surface ?? '') ?? DEFAULT_CUSTOM_THEME.surface,
      backdrop: (parsed.backdrop ?? DEFAULT_CUSTOM_THEME.backdrop) as BackdropId,
    }
  } catch {
    return { ...DEFAULT_CUSTOM_THEME }
  }
}

export function saveCustomTheme(config: CustomThemeConfig): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(config))
  window.dispatchEvent(new CustomEvent(CUSTOM_THEME_EVENT))
}

/* ── Compile → CSS vars ───────────────────────────────────────── */

/**
 * Turn a config into the full CSS-var override map. Surface is nudged so it
 * stays distinct from the background (cards must be visible), the accent is
 * nudged to keep contrast, and text tones are derived for guaranteed
 * readability. tint-* are pinned to the background so category morphs don't
 * introduce a clashing wash.
 */
export function buildCustomThemeDefinition(config: CustomThemeConfig): ThemeDefinition {
  const bg     = normalizeHex(config.bgMain)  ?? DEFAULT_CUSTOM_THEME.bgMain
  const light  = isLight(bg)
  const accent = ensureAccentContrast(normalizeHex(config.accent) ?? DEFAULT_CUSTOM_THEME.accent, bg)

  // Keep the surface visibly separated from the background.
  let surface = normalizeHex(config.surface) ?? DEFAULT_CUSTOM_THEME.surface
  if (contrastRatio(surface, bg) < 1.06) {
    surface = light ? darkenToward(surface, bg, 0.06) : mix(surface, '#ffffff', 0.06)
  }

  const text  = readableText(bg)
  const muted = mix(text, bg, 0.42)
  const dark  = mix(text, bg, 0.66)

  const bd = resolveBackdrop(config.backdrop, accent, bg)

  return {
    label:        'Theme Forge',
    swatch:       accent,
    isLightTheme: light,
    vars: {
      '--bg-main':           bg,
      '--surface-card':      surface,
      '--accent-purple':     accent,
      '--accent-purple-dim': withAlpha(accent, 0.35),
      '--border-subtle':     withAlpha(accent, light ? 0.16 : 0.12),
      '--bg-hover':          withAlpha(accent, 0.06),
      '--bg-active':         withAlpha(accent, 0.12),
      '--text-primary':      text,
      '--text-muted':        muted,
      '--text-dark':         dark,
      '--shadow-card':       light
        ? `0 2px 14px ${withAlpha('#000000', 0.10)}, 0 0 0 1px ${withAlpha(accent, 0.10)}`
        : `0 2px 24px ${withAlpha(accent, 0.14)}, 0 0 0 1px ${withAlpha(accent, 0.07)}`,
      '--tint-home':         bg,
      '--tint-essentials':   bg,
      '--tint-creator':      bg,
      '--tint-vault':        bg,
      '--body-bg-image':     bd.image,
      '--body-bg-size':      bd.size,
      '--body-bg-repeat':    bd.repeat,
    },
  }
}

/* tiny local helper: pull `c` slightly toward black relative to a reference */
function darkenToward(c: string, _ref: string, t: number): string {
  return mix(c, '#000000', t)
}
