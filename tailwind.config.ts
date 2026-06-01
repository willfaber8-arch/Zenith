/**
 * Zenith OS — Tailwind CSS Configuration
 * Phase 1 · Step 1.1 — Design Token & Visual Foundations Port
 *
 * ─────────────────────────────────────────────────────────────
 * ARCHITECTURE NOTE — Tailwind CSS v4 (CSS-first)
 * ─────────────────────────────────────────────────────────────
 * This project runs Tailwind v4 via @tailwindcss/postcss.
 * In v4, design tokens are registered in CSS with @theme rather
 * than in a JavaScript config object. This file is therefore NOT
 * processed by the PostCSS pipeline; it exists as:
 *
 *   (a) a human-readable contract listing every design token and
 *       the Tailwind utility class it generates, and
 *   (b) a TypeScript-typed reference for IDEs and documentation.
 *
 * THE AUTHORITATIVE TOKEN REGISTRY is app/globals.css → @theme.
 * Changing values here alone has no effect on the build.
 *
 * ─────────────────────────────────────────────────────────────
 * TOKEN → UTILITY CLASS MAP
 * ─────────────────────────────────────────────────────────────
 *
 * COLOR TOKENS                     GENERATED UTILITY CLASSES
 * ──────────────────────────────────────────────────────────
 * --color-bg-main       #0b0d13    bg-bg-main  text-bg-main  border-bg-main
 * --color-surface-card  #141923    bg-surface-card …
 * --color-accent-purple #7c95ff    bg-accent-purple  text-accent-purple …
 * --color-accent-green  #52cca3    bg-accent-green   text-accent-green …
 * --color-text-primary  #e8eaf6    text-text-primary …
 * --color-text-muted    #9ba3c4    text-text-muted …
 * --color-text-dark     #5c6487    text-text-dark …
 *
 * SEMANTIC COLORS
 * --color-hover         rgba(124,149,255,0.05)   bg-hover …
 * --color-active        rgba(124,149,255,0.10)   bg-active …
 * --color-purple-dim    rgba(124,149,255,0.35)   bg-purple-dim …
 * --color-green-dim     rgba(82,204,163,0.35)    bg-green-dim …
 * --color-border-subtle rgba(124,149,255,0.10)   border-border-subtle …
 *
 * CATEGORY TINTS (Step 0.3 background morph system)
 * --color-tint-essentials #0d1020               bg-tint-essentials …
 * --color-tint-creator    #090f0b               bg-tint-creator …
 * --color-tint-vault      #101010               bg-tint-vault …
 *
 * TYPOGRAPHY                       GENERATED UTILITY CLASSES
 * ──────────────────────────────────────────────────────────
 * --font-sans     Plus Jakarta Sans              font-sans
 * --font-display  Space Grotesk / Cabinet Grotesk font-display
 * --font-mono     Cascadia Code                  font-mono
 *
 * BORDER RADIUS                    GENERATED UTILITY CLASSES
 * ──────────────────────────────────────────────────────────
 * --radius-sm  4px                              rounded-sm
 * --radius-md  8px                              rounded-md
 * --radius-lg  14px                             rounded-lg
 * --radius-xl  22px                             rounded-xl
 *
 * ANIMATIONS                       GENERATED UTILITY CLASSES
 * ──────────────────────────────────────────────────────────
 * --animate-fade-in                             animate-fade-in
 * --animate-scale-in                            animate-scale-in
 * --animate-slide-in                            animate-slide-in
 * --animate-slide-left                          animate-slide-left
 * --animate-card-enter                          animate-card-enter
 * --animate-toast-in                            animate-toast-in
 * --animate-toast-out                           animate-toast-out
 * --animate-spin                                animate-spin
 *
 * ─────────────────────────────────────────────────────────────
 * FONT INSTALLATION
 * ─────────────────────────────────────────────────────────────
 * Plus Jakarta Sans  → next/font/google (auto-loaded)
 *
 * Cabinet Grotesk / Clash Display → NOT on Google Fonts.
 *   Option A (recommended): Download from Fontshare
 *     https://www.fontshare.com/fonts/cabinet-grotesk
 *     Place .woff2 files in /public/fonts/cabinet-grotesk/
 *     Update layout.tsx to use next/font/local
 *
 *   Option B (current): Space Grotesk from Google Fonts
 *     Used as a geometric-humanist stand-in with equivalent
 *     weight range and visual rhythm. Swap variable name
 *     --font-cabinet when real files are available.
 *
 * ─────────────────────────────────────────────────────────────
 */

import type { Config } from 'tailwindcss'

const config = {
  /*
   * In v4 with @tailwindcss/postcss, content paths are auto-detected
   * from the project root. Add explicit @source directives in
   * globals.css if you need to scan non-standard locations.
   */
  content: [],
} satisfies Config

export default config
