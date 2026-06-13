/**
 * Cosmetic theme and pack CSS override definitions.
 *
 * Each entry maps a cosmetic ID (from SHOP_CATALOG in GamesTabShell) to a set
 * of CSS custom-property overrides applied at runtime on document.documentElement
 * by ThemeApplicator.tsx.
 *
 * Design rules:
 *  • Only override :root CSS vars (--accent-purple, --bg-main, etc.)
 *  • Never override @theme tokens — those are Tailwind build-time only
 *  • zenith_default has no overrides — removing all previously-set props
 *    restores the baseline defined in globals.css
 */

export interface ThemeDefinition {
  /** CSS custom-property overrides, applied via style.setProperty on <html>. */
  readonly vars: Readonly<Record<string, string>>
  /** Human-readable label used in Settings preview chip. */
  readonly label: string
  /** Accent swatch hex for the Settings theme-picker dot. */
  readonly swatch: string
}

export const THEME_DEFINITIONS: Readonly<Record<string, ThemeDefinition>> = {

  /* ── Base (default) — no overrides, restores globals.css baseline ── */
  zenith_default: {
    label:  'Zenith Classic',
    swatch: '#7c95ff',
    vars:   {},
  },

  /* ── Crimson Core — rose-red primary accent ─────────────────────── */
  zenith_crimson: {
    label:  'Crimson Core',
    swatch: '#e05c7b',
    vars: {
      '--accent-purple':     '#e05c7b',
      '--accent-purple-dim': 'rgba(224,92,123,0.35)',
      '--border-subtle':     'rgba(224,92,123,0.10)',
      '--bg-hover':          'rgba(224,92,123,0.05)',
      '--bg-active':         'rgba(224,92,123,0.10)',
      '--shadow-card':       '0 2px 24px rgba(224,92,123,0.12), 0 0 0 1px rgba(224,92,123,0.06)',
    },
  },

  /* ── Solar Dusk — warm amber/orange accent ──────────────────────── */
  zenith_amber: {
    label:  'Solar Dusk',
    swatch: '#e8943a',
    vars: {
      '--accent-purple':     '#e8943a',
      '--accent-purple-dim': 'rgba(232,148,58,0.35)',
      '--border-subtle':     'rgba(232,148,58,0.10)',
      '--bg-hover':          'rgba(232,148,58,0.05)',
      '--bg-active':         'rgba(232,148,58,0.10)',
      '--shadow-card':       '0 2px 24px rgba(232,148,58,0.12), 0 0 0 1px rgba(232,148,58,0.06)',
    },
  },

  /* ── Void Protocol — near-black monochrome ──────────────────────── */
  zenith_void: {
    label:  'Void Protocol',
    swatch: '#b0b8d4',
    vars: {
      '--bg-main':           '#060606',
      '--surface-card':      '#0f0f0f',
      '--accent-purple':     '#b0b8d4',
      '--accent-purple-dim': 'rgba(176,184,212,0.30)',
      '--border-subtle':     'rgba(176,184,212,0.08)',
      '--bg-hover':          'rgba(176,184,212,0.05)',
      '--bg-active':         'rgba(176,184,212,0.10)',
      '--text-primary':      '#d0d4e0',
      '--text-muted':        '#707480',
      '--text-dark':         '#383c48',
      '--shadow-card':       '0 2px 24px rgba(0,0,0,0.50), 0 0 0 1px rgba(176,184,212,0.05)',
    },
  },

  /* ── Neon Cascade — electric cyan on deep navy ──────────────────── */
  zenith_neon: {
    label:  'Neon Cascade',
    swatch: '#00d4f5',
    vars: {
      '--bg-main':           '#050c12',
      '--surface-card':      '#0a1828',
      '--accent-purple':     '#00d4f5',
      '--accent-purple-dim': 'rgba(0,212,245,0.30)',
      '--border-subtle':     'rgba(0,212,245,0.09)',
      '--bg-hover':          'rgba(0,212,245,0.05)',
      '--bg-active':         'rgba(0,212,245,0.10)',
      '--shadow-card':       '0 2px 24px rgba(0,212,245,0.10), 0 0 0 1px rgba(0,212,245,0.05)',
    },
  },

  /* ── Deep Cosmos — intensified galactic purple ──────────────────── */
  zenith_cosmos: {
    label:  'Deep Cosmos',
    swatch: '#a885ff',
    vars: {
      '--bg-main':           '#06040e',
      '--surface-card':      '#0e0b1c',
      '--accent-purple':     '#a885ff',
      '--accent-purple-dim': 'rgba(168,133,255,0.35)',
      '--border-subtle':     'rgba(168,133,255,0.12)',
      '--bg-hover':          'rgba(168,133,255,0.06)',
      '--bg-active':         'rgba(168,133,255,0.12)',
      '--shadow-card':       '0 2px 24px rgba(168,133,255,0.14), 0 0 0 1px rgba(168,133,255,0.07)',
    },
  },

  /* ── Scholar's Focus Pack — cool academic blue ──────────────────── */
  pack_study: {
    label:  "Scholar's Focus",
    swatch: '#4a9eff',
    vars: {
      '--bg-main':           '#080c14',
      '--surface-card':      '#0f1828',
      '--accent-purple':     '#4a9eff',
      '--accent-purple-dim': 'rgba(74,158,255,0.35)',
      '--border-subtle':     'rgba(74,158,255,0.10)',
      '--bg-hover':          'rgba(74,158,255,0.05)',
      '--bg-active':         'rgba(74,158,255,0.10)',
      '--shadow-card':       '0 2px 24px rgba(74,158,255,0.12), 0 0 0 1px rgba(74,158,255,0.06)',
    },
  },

  /* ── Midnight Terminal — hacker-green terminal aesthetic ────────── */
  pack_midnight: {
    label:  'Midnight Terminal',
    swatch: '#00ff41',
    vars: {
      '--bg-main':           '#010a02',
      '--surface-card':      '#051508',
      '--accent-purple':     '#00e535',
      '--accent-purple-dim': 'rgba(0,229,53,0.25)',
      '--border-subtle':     'rgba(0,229,53,0.10)',
      '--bg-hover':          'rgba(0,229,53,0.04)',
      '--bg-active':         'rgba(0,229,53,0.09)',
      '--text-primary':      '#b0ffbc',
      '--text-muted':        '#449a50',
      '--text-dark':         '#225528',
      '--shadow-card':       '0 2px 24px rgba(0,229,53,0.10), 0 0 0 1px rgba(0,229,53,0.06)',
    },
  },

  /* ── Botanical Interface — earthy forest green ──────────────────── */
  pack_flora: {
    label:  'Botanical',
    swatch: '#5cba8a',
    vars: {
      '--bg-main':           '#050c08',
      '--surface-card':      '#0a1810',
      '--accent-purple':     '#5cba8a',
      '--accent-purple-dim': 'rgba(92,186,138,0.35)',
      '--border-subtle':     'rgba(92,186,138,0.10)',
      '--bg-hover':          'rgba(92,186,138,0.05)',
      '--bg-active':         'rgba(92,186,138,0.10)',
      '--shadow-card':       '0 2px 24px rgba(92,186,138,0.12), 0 0 0 1px rgba(92,186,138,0.06)',
    },
  },

  /* ── Arcade Elite Badge — prestige gold ─────────────────────────── */
  pack_elite: {
    label:  'Arcade Elite',
    swatch: '#d4af37',
    vars: {
      '--bg-main':           '#0a0804',
      '--surface-card':      '#14110a',
      '--accent-purple':     '#d4af37',
      '--accent-purple-dim': 'rgba(212,175,55,0.35)',
      '--border-subtle':     'rgba(212,175,55,0.10)',
      '--bg-hover':          'rgba(212,175,55,0.05)',
      '--bg-active':         'rgba(212,175,55,0.10)',
      '--shadow-card':       '0 2px 24px rgba(212,175,55,0.12), 0 0 0 1px rgba(212,175,55,0.06)',
    },
  },
}

/**
 * Ordered list of all CSS custom-property names that any theme can override.
 * Used by ThemeApplicator to cleanly remove previous theme vars before
 * applying a new set — prevents bleed between theme switches.
 */
export const ALL_THEMEABLE_VARS: readonly string[] = [
  '--bg-main',
  '--surface-card',
  '--accent-purple',
  '--accent-purple-dim',
  '--border-subtle',
  '--bg-hover',
  '--bg-active',
  '--text-primary',
  '--text-muted',
  '--text-dark',
  '--shadow-card',
] as const
