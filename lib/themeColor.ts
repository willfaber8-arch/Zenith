/**
 * lib/themeColor.ts — pure colour maths for the Theme Forge.
 *
 * No React / DOM imports. Everything here exists to guarantee the two
 * non-negotiables of a user-built theme: colours that do not clash and
 * text that is always comfortably readable against its background.
 */

export interface RGB { r: number; g: number; b: number }

/* ── Parse / format ───────────────────────────────────────────── */

/** Accepts "#abc", "#aabbcc", "aabbcc". Returns null on garbage. */
export function hexToRgb(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Normalise any loose input to a canonical "#rrggbb", or null. */
export function normalizeHex(hex: string): string | null {
  const rgb = hexToRgb(hex)
  return rgb ? rgbToHex(rgb) : null
}

/* ── Perceptual maths ─────────────────────────────────────────── */

/** WCAG relative luminance (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const ch = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * ch(rgb.r) + 0.7152 * ch(rgb.g) + 0.0722 * ch(rgb.b)
}

/** WCAG contrast ratio between two hex colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/** True when the colour is light enough to need dark text on top. */
export function isLight(hex: string): boolean {
  return luminance(hex) > 0.45
}

/* ── Blending ─────────────────────────────────────────────────── */

/** Linear mix of two hex colours. t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ra = hexToRgb(a), rb = hexToRgb(b)
  if (!ra || !rb) return a
  const k = Math.max(0, Math.min(1, t))
  return rgbToHex({
    r: ra.r + (rb.r - ra.r) * k,
    g: ra.g + (rb.g - ra.g) * k,
    b: ra.b + (rb.b - ra.b) * k,
  })
}

export function lighten(hex: string, t: number): string { return mix(hex, '#ffffff', t) }
export function darken(hex: string, t: number): string { return mix(hex, '#000000', t) }

/** "rgba(r,g,b,a)" string from a hex colour. */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return `rgba(0,0,0,${alpha})`
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`
}

/* ── Readability guarantees ───────────────────────────────────── */

/**
 * Pick the body text colour that reads best on `bg`. We start from a near-
 * white or near-black candidate and, if it somehow falls short of the AA
 * 4.5:1 threshold, fall back to pure white/black.
 */
export function readableText(bg: string): string {
  const light = '#e9ecf5'
  const dark  = '#141620'
  const pick  = isLight(bg) ? dark : light
  if (contrastRatio(pick, bg) >= 4.5) return pick
  return contrastRatio('#ffffff', bg) >= contrastRatio('#000000', bg) ? '#ffffff' : '#000000'
}

/**
 * Nudge an accent so it keeps at least `minRatio` contrast against `bg`.
 * Lightens the accent on dark backgrounds / darkens it on light ones until
 * the ratio is met (bounded iterations). Prevents an accent the same tone
 * as the surface from disappearing.
 */
export function ensureAccentContrast(accent: string, bg: string, minRatio = 2.4): string {
  let out = accent
  const towardText = isLight(bg) ? '#000000' : '#ffffff'
  for (let i = 0; i < 12 && contrastRatio(out, bg) < minRatio; i++) {
    out = mix(out, towardText, 0.08)
  }
  return out
}
