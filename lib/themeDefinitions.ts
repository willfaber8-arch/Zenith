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
  /** When true, this theme already provides a light background + dark text.
   *  ThemeApplicator will NOT overlay the generic light-mode base vars on top. */
  readonly isLightTheme?: boolean
}

export const THEME_DEFINITIONS: Readonly<Record<string, ThemeDefinition>> = {

  /* ── Base (default) — no overrides, restores globals.css baseline ── */
  zenith_default: {
    label:  'Sage Studio',
    swatch: '#68d9a0',
    vars:   {},
  },

  /* ── Classic Periwinkle — original Zenith blue-purple look ─────── */
  zenith_periwinkle: {
    label:  'Classic Periwinkle',
    swatch: '#7c95ff',
    vars: {
      '--bg-main':           '#0b0d13',
      '--surface-card':      '#141923',
      '--accent-purple':     '#7c95ff',
      '--accent-purple-dim': 'rgba(124,149,255,0.35)',
      '--border-subtle':     'rgba(124,149,255,0.10)',
      '--bg-hover':          'rgba(124,149,255,0.05)',
      '--bg-active':         'rgba(124,149,255,0.10)',
      '--shadow-card':       '0 2px 24px rgba(124,149,255,0.12), 0 0 0 1px rgba(124,149,255,0.06)',
    },
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

  /* ─────────────────────── EXPANDED THEME LIBRARY ─────────────────── */

  /* ── Deep Ocean — teal/aqua on dark navy ────────────────────────── */
  zenith_ocean: {
    label:  'Deep Ocean',
    swatch: '#1ec8d0',
    vars: {
      '--bg-main':           '#04101a',
      '--surface-card':      '#091824',
      '--accent-purple':     '#1ec8d0',
      '--accent-purple-dim': 'rgba(30,200,208,0.35)',
      '--border-subtle':     'rgba(30,200,208,0.10)',
      '--bg-hover':          'rgba(30,200,208,0.05)',
      '--bg-active':         'rgba(30,200,208,0.11)',
      '--shadow-card':       '0 2px 24px rgba(30,200,208,0.14), 0 0 0 1px rgba(30,200,208,0.06)',
    },
  },

  /* ── Lavender Haze — soft violet on deep purple-grey ───────────── */
  zenith_lavender: {
    label:  'Lavender Haze',
    swatch: '#b088f5',
    vars: {
      '--bg-main':           '#0d0b14',
      '--surface-card':      '#15121f',
      '--accent-purple':     '#b088f5',
      '--accent-purple-dim': 'rgba(176,136,245,0.35)',
      '--border-subtle':     'rgba(176,136,245,0.10)',
      '--bg-hover':          'rgba(176,136,245,0.06)',
      '--bg-active':         'rgba(176,136,245,0.12)',
      '--shadow-card':       '0 2px 24px rgba(176,136,245,0.14), 0 0 0 1px rgba(176,136,245,0.07)',
    },
  },

  /* ── Dusty Rose — rose-mauve on warm dark ───────────────────────── */
  zenith_rose: {
    label:  'Dusty Rose',
    swatch: '#e87aa0',
    vars: {
      '--bg-main':           '#130d10',
      '--surface-card':      '#1e1218',
      '--accent-purple':     '#e87aa0',
      '--accent-purple-dim': 'rgba(232,122,160,0.35)',
      '--border-subtle':     'rgba(232,122,160,0.10)',
      '--bg-hover':          'rgba(232,122,160,0.05)',
      '--bg-active':         'rgba(232,122,160,0.11)',
      '--shadow-card':       '0 2px 24px rgba(232,122,160,0.14), 0 0 0 1px rgba(232,122,160,0.07)',
    },
  },

  /* ── Steel Blue — cool industrial steel ─────────────────────────── */
  zenith_steel: {
    label:  'Steel Blue',
    swatch: '#5b9bd5',
    vars: {
      '--bg-main':           '#090c12',
      '--surface-card':      '#10151e',
      '--accent-purple':     '#5b9bd5',
      '--accent-purple-dim': 'rgba(91,155,213,0.35)',
      '--border-subtle':     'rgba(91,155,213,0.10)',
      '--bg-hover':          'rgba(91,155,213,0.05)',
      '--bg-active':         'rgba(91,155,213,0.11)',
      '--shadow-card':       '0 2px 24px rgba(91,155,213,0.12), 0 0 0 1px rgba(91,155,213,0.06)',
    },
  },

  /* ── Copper Forge — warm bronze on dark mahogany ────────────────── */
  zenith_copper: {
    label:  'Copper Forge',
    swatch: '#d47a3a',
    vars: {
      '--bg-main':           '#110904',
      '--surface-card':      '#1c1008',
      '--accent-purple':     '#d47a3a',
      '--accent-purple-dim': 'rgba(212,122,58,0.35)',
      '--border-subtle':     'rgba(212,122,58,0.10)',
      '--bg-hover':          'rgba(212,122,58,0.05)',
      '--bg-active':         'rgba(212,122,58,0.11)',
      '--shadow-card':       '0 2px 24px rgba(212,122,58,0.14), 0 0 0 1px rgba(212,122,58,0.07)',
    },
  },

  /* ── Arctic — icy blue-white on near-black ──────────────────────── */
  zenith_arctic: {
    label:  'Arctic',
    swatch: '#9fd4f0',
    vars: {
      '--bg-main':           '#050a10',
      '--surface-card':      '#0b1520',
      '--accent-purple':     '#9fd4f0',
      '--accent-purple-dim': 'rgba(159,212,240,0.30)',
      '--border-subtle':     'rgba(159,212,240,0.09)',
      '--bg-hover':          'rgba(159,212,240,0.05)',
      '--bg-active':         'rgba(159,212,240,0.10)',
      '--text-primary':      '#e0f0f8',
      '--shadow-card':       '0 2px 24px rgba(159,212,240,0.12), 0 0 0 1px rgba(159,212,240,0.06)',
    },
  },

  /* ── Emerald City — deep emerald green ──────────────────────────── */
  zenith_emerald: {
    label:  'Emerald City',
    swatch: '#2ecc71',
    vars: {
      '--bg-main':           '#030e07',
      '--surface-card':      '#07180d',
      '--accent-purple':     '#2ecc71',
      '--accent-purple-dim': 'rgba(46,204,113,0.32)',
      '--border-subtle':     'rgba(46,204,113,0.10)',
      '--bg-hover':          'rgba(46,204,113,0.05)',
      '--bg-active':         'rgba(46,204,113,0.10)',
      '--shadow-card':       '0 2px 24px rgba(46,204,113,0.14), 0 0 0 1px rgba(46,204,113,0.06)',
    },
  },

  /* ── Sunset Drive — warm tangerine-orange ───────────────────────── */
  zenith_sunset: {
    label:  'Sunset Drive',
    swatch: '#f5834a',
    vars: {
      '--bg-main':           '#100804',
      '--surface-card':      '#1c1008',
      '--accent-purple':     '#f5834a',
      '--accent-purple-dim': 'rgba(245,131,74,0.35)',
      '--border-subtle':     'rgba(245,131,74,0.10)',
      '--bg-hover':          'rgba(245,131,74,0.05)',
      '--bg-active':         'rgba(245,131,74,0.11)',
      '--shadow-card':       '0 2px 24px rgba(245,131,74,0.14), 0 0 0 1px rgba(245,131,74,0.06)',
    },
  },

  /* ── Gilded — bright antique gold ──────────────────────────────── */
  zenith_gold: {
    label:  'Gilded',
    swatch: '#f0c040',
    vars: {
      '--bg-main':           '#0c0a02',
      '--surface-card':      '#181402',
      '--accent-purple':     '#f0c040',
      '--accent-purple-dim': 'rgba(240,192,64,0.35)',
      '--border-subtle':     'rgba(240,192,64,0.10)',
      '--bg-hover':          'rgba(240,192,64,0.05)',
      '--bg-active':         'rgba(240,192,64,0.11)',
      '--shadow-card':       '0 2px 24px rgba(240,192,64,0.14), 0 0 0 1px rgba(240,192,64,0.06)',
    },
  },

  /* ── Cyan Protocol — electric cyan on deep black ────────────────── */
  zenith_cyan: {
    label:  'Cyan Protocol',
    swatch: '#00bcd4',
    vars: {
      '--bg-main':           '#020c0e',
      '--surface-card':      '#061518',
      '--accent-purple':     '#00bcd4',
      '--accent-purple-dim': 'rgba(0,188,212,0.32)',
      '--border-subtle':     'rgba(0,188,212,0.10)',
      '--bg-hover':          'rgba(0,188,212,0.05)',
      '--bg-active':         'rgba(0,188,212,0.10)',
      '--shadow-card':       '0 2px 24px rgba(0,188,212,0.14), 0 0 0 1px rgba(0,188,212,0.06)',
    },
  },

  /* ── Forest Sage — muted sage green, warmer than default ────────── */
  zenith_sage: {
    label:  'Forest Sage',
    swatch: '#8cc68a',
    vars: {
      '--bg-main':           '#0a0f0a',
      '--surface-card':      '#111a11',
      '--accent-purple':     '#8cc68a',
      '--accent-purple-dim': 'rgba(140,198,138,0.35)',
      '--border-subtle':     'rgba(140,198,138,0.10)',
      '--bg-hover':          'rgba(140,198,138,0.05)',
      '--bg-active':         'rgba(140,198,138,0.11)',
      '--shadow-card':       '0 2px 24px rgba(140,198,138,0.12), 0 0 0 1px rgba(140,198,138,0.06)',
    },
  },

  /* ── Midnight Indigo — deep indigo-purple on near-black ─────────── */
  zenith_indigo: {
    label:  'Midnight Indigo',
    swatch: '#5c4fd4',
    vars: {
      '--bg-main':           '#080610',
      '--surface-card':      '#0f0c1c',
      '--accent-purple':     '#5c4fd4',
      '--accent-purple-dim': 'rgba(92,79,212,0.35)',
      '--border-subtle':     'rgba(92,79,212,0.11)',
      '--bg-hover':          'rgba(92,79,212,0.06)',
      '--bg-active':         'rgba(92,79,212,0.12)',
      '--shadow-card':       '0 2px 24px rgba(92,79,212,0.16), 0 0 0 1px rgba(92,79,212,0.08)',
    },
  },

  /* ── Minty Fresh — bright electric mint ─────────────────────────── */
  zenith_mint: {
    label:  'Minty Fresh',
    swatch: '#50e3c2',
    vars: {
      '--bg-main':           '#030e0c',
      '--surface-card':      '#081815',
      '--accent-purple':     '#50e3c2',
      '--accent-purple-dim': 'rgba(80,227,194,0.32)',
      '--border-subtle':     'rgba(80,227,194,0.10)',
      '--bg-hover':          'rgba(80,227,194,0.05)',
      '--bg-active':         'rgba(80,227,194,0.10)',
      '--shadow-card':       '0 2px 24px rgba(80,227,194,0.14), 0 0 0 1px rgba(80,227,194,0.06)',
    },
  },

  /* ── Dusty Mauve — warm dusty pink-purple ───────────────────────── */
  zenith_mauve: {
    label:  'Dusty Mauve',
    swatch: '#c47ab8',
    vars: {
      '--bg-main':           '#120a12',
      '--surface-card':      '#1d121c',
      '--accent-purple':     '#c47ab8',
      '--accent-purple-dim': 'rgba(196,122,184,0.35)',
      '--border-subtle':     'rgba(196,122,184,0.10)',
      '--bg-hover':          'rgba(196,122,184,0.05)',
      '--bg-active':         'rgba(196,122,184,0.11)',
      '--shadow-card':       '0 2px 24px rgba(196,122,184,0.14), 0 0 0 1px rgba(196,122,184,0.07)',
    },
  },

  /* ── Sakura Season — cherry blossom pink pack ───────────────────── */
  pack_sakura: {
    label:  'Sakura Season',
    swatch: '#f5a0c0',
    vars: {
      '--bg-main':           '#120810',
      '--surface-card':      '#1e0f1a',
      '--accent-purple':     '#f5a0c0',
      '--accent-purple-dim': 'rgba(245,160,192,0.35)',
      '--border-subtle':     'rgba(245,160,192,0.10)',
      '--bg-hover':          'rgba(245,160,192,0.05)',
      '--bg-active':         'rgba(245,160,192,0.11)',
      '--text-primary':      '#f8eaf2',
      '--shadow-card':       '0 2px 24px rgba(245,160,192,0.16), 0 0 0 1px rgba(245,160,192,0.08)',
    },
  },

  /* ── Citrus Rush — vivid yellow-orange energy ───────────────────── */
  pack_citrus: {
    label:  'Citrus Rush',
    swatch: '#f5c842',
    vars: {
      '--bg-main':           '#0e0c02',
      '--surface-card':      '#1a1804',
      '--accent-purple':     '#f5c842',
      '--accent-purple-dim': 'rgba(245,200,66,0.35)',
      '--border-subtle':     'rgba(245,200,66,0.10)',
      '--bg-hover':          'rgba(245,200,66,0.05)',
      '--bg-active':         'rgba(245,200,66,0.10)',
      '--shadow-card':       '0 2px 24px rgba(245,200,66,0.14), 0 0 0 1px rgba(245,200,66,0.06)',
    },
  },

  /* ── Ocean Depths — deep navy with bioluminescent blue ──────────── */
  pack_ocean_deep: {
    label:  'Ocean Depths',
    swatch: '#3a7bd5',
    vars: {
      '--bg-main':           '#020610',
      '--surface-card':      '#04091a',
      '--accent-purple':     '#3a7bd5',
      '--accent-purple-dim': 'rgba(58,123,213,0.35)',
      '--border-subtle':     'rgba(58,123,213,0.10)',
      '--bg-hover':          'rgba(58,123,213,0.05)',
      '--bg-active':         'rgba(58,123,213,0.11)',
      '--text-primary':      '#dce8f8',
      '--shadow-card':       '0 2px 24px rgba(58,123,213,0.16), 0 0 0 1px rgba(58,123,213,0.08)',
    },
  },

  /* ── Ash & Ember — cool ash with hot ember accent ───────────────── */
  pack_ash: {
    label:  'Ash & Ember',
    swatch: '#e04840',
    vars: {
      '--bg-main':           '#0d0c0c',
      '--surface-card':      '#181818',
      '--accent-purple':     '#e04840',
      '--accent-purple-dim': 'rgba(224,72,64,0.35)',
      '--border-subtle':     'rgba(224,72,64,0.10)',
      '--bg-hover':          'rgba(224,72,64,0.05)',
      '--bg-active':         'rgba(224,72,64,0.11)',
      '--text-primary':      '#f0ece8',
      '--text-muted':        '#a8a4a0',
      '--text-dark':         '#6a6664',
      '--shadow-card':       '0 2px 24px rgba(224,72,64,0.14), 0 0 0 1px rgba(224,72,64,0.06)',
    },
  },

  /* ── Light Themes ─────────────────────────────────────────────── */

  light_clean: {
    label:        'Morning Studio',
    swatch:       '#1e9e6c',
    isLightTheme: true,
    vars: {
      '--bg-main':           '#ffffff',
      '--surface-card':      '#ffffff',
      '--accent-purple':     '#1e9e6c',
      '--accent-purple-dim': 'rgba(30, 158, 108, 0.25)',
      '--border-subtle':     'rgba(18, 46, 36, 0.12)',
      '--bg-hover':          'rgba(30, 158, 108, 0.07)',
      '--bg-active':         'rgba(30, 158, 108, 0.13)',
      '--text-primary':      '#14151c',
      '--text-muted':        '#33364a',
      '--text-dark':         '#565b78',
      '--shadow-card':       '0 2px 12px rgba(20, 24, 60, 0.10), 0 0 0 1px rgba(18, 46, 36, 0.12)',
      '--tint-home':         '#ffffff',
      '--tint-essentials':   '#ffffff',
      '--tint-creator':      '#ffffff',
      '--tint-vault':        '#ffffff',
      '--body-bg-image':     'none',
    },
  },

  light_warm: {
    label:        'Parchment Studio',
    swatch:       '#8b6c3c',
    isLightTheme: true,
    vars: {
      '--bg-main':           '#f7f3eb',
      '--surface-card':      '#fefcf6',
      '--accent-purple':     '#8b6c3c',
      '--accent-purple-dim': 'rgba(139, 108, 60, 0.30)',
      '--border-subtle':     'rgba(100, 70, 20, 0.12)',
      '--bg-hover':          'rgba(139, 108, 60, 0.06)',
      '--bg-active':         'rgba(139, 108, 60, 0.11)',
      '--text-primary':      '#2a2118',
      '--text-muted':        '#5a4d3e',
      '--text-dark':         '#7a6e60',
      '--shadow-card':       '0 2px 12px rgba(80, 50, 20, 0.09), 0 0 0 1px rgba(100, 70, 20, 0.09)',
      '--tint-home':         '#f7f3eb',
      '--tint-essentials':   '#f4f0e6',
      '--tint-creator':      '#f2f0e2',
      '--tint-vault':        '#f5f3ec',
      '--body-bg-image':     'none',
    },
  },

  light_rose: {
    label:        'Petal',
    swatch:       '#b04060',
    isLightTheme: true,
    vars: {
      '--bg-main':           '#fdf2f4',
      '--surface-card':      '#fff8f9',
      '--accent-purple':     '#b04060',
      '--accent-purple-dim': 'rgba(176, 64, 96, 0.25)',
      '--border-subtle':     'rgba(120, 40, 60, 0.10)',
      '--bg-hover':          'rgba(176, 64, 96, 0.05)',
      '--bg-active':         'rgba(176, 64, 96, 0.09)',
      '--text-primary':      '#261018',
      '--text-muted':        '#5a3844',
      '--text-dark':         '#7a5860',
      '--shadow-card':       '0 2px 12px rgba(100, 20, 40, 0.08), 0 0 0 1px rgba(120, 40, 60, 0.08)',
      '--tint-home':         '#fdf2f4',
      '--tint-essentials':   '#fbeef1',
      '--tint-creator':      '#fbedf0',
      '--tint-vault':        '#fdf3f5',
      '--body-bg-image':     'none',
    },
  },

  light_ocean: {
    label:        'Coastal',
    swatch:       '#1a6e8a',
    isLightTheme: true,
    vars: {
      '--bg-main':           '#f0f6f8',
      '--surface-card':      '#f8fcfd',
      '--accent-purple':     '#1a6e8a',
      '--accent-purple-dim': 'rgba(26, 110, 138, 0.25)',
      '--border-subtle':     'rgba(10, 60, 80, 0.10)',
      '--bg-hover':          'rgba(26, 110, 138, 0.06)',
      '--bg-active':         'rgba(26, 110, 138, 0.11)',
      '--text-primary':      '#0e2028',
      '--text-muted':        '#3a5058',
      '--text-dark':         '#5a7080',
      '--shadow-card':       '0 2px 12px rgba(10, 60, 80, 0.08), 0 0 0 1px rgba(10, 60, 80, 0.08)',
      '--tint-home':         '#f0f6f8',
      '--tint-essentials':   '#ecf4f7',
      '--tint-creator':      '#ecf5f6',
      '--tint-vault':        '#f0f4f6',
      '--body-bg-image':     'none',
    },
  },

  light_dusk: {
    label:        'Golden Hour',
    swatch:       '#9e6020',
    isLightTheme: true,
    vars: {
      '--bg-main':           '#faf4e8',
      '--surface-card':      '#fdfaf2',
      '--accent-purple':     '#9e6020',
      '--accent-purple-dim': 'rgba(158, 96, 32, 0.28)',
      '--border-subtle':     'rgba(80, 50, 10, 0.12)',
      '--bg-hover':          'rgba(158, 96, 32, 0.06)',
      '--bg-active':         'rgba(158, 96, 32, 0.11)',
      '--text-primary':      '#28200a',
      '--text-muted':        '#5a4c28',
      '--text-dark':         '#7a6840',
      '--shadow-card':       '0 2px 12px rgba(80, 50, 0, 0.09), 0 0 0 1px rgba(80, 50, 10, 0.09)',
      '--tint-home':         '#faf4e8',
      '--tint-essentials':   '#f7f1e3',
      '--tint-creator':      '#f4eedc',
      '--tint-vault':        '#f8f3e8',
      '--body-bg-image':     'none',
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
  '--tint-home',
  '--tint-essentials',
  '--tint-creator',
  '--tint-vault',
  '--body-bg-image',
] as const
