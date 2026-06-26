'use client'

/**
 * ThemeApplicator — zero-render client component.
 *
 * Reads the player's active cosmetic theme from the Games IDB singleton
 * and applies CSS custom-property overrides to document.documentElement.
 * Also monitors data-color-scheme attribute changes so light-mode vars
 * are applied as inline styles (overriding any dark theme's bg/text).
 */

import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { gamesDb, seedGamesDatabase } from '@/lib/gamesDb'
import { THEME_DEFINITIONS, ALL_THEMEABLE_VARS } from '@/lib/themeDefinitions'
import { UNIVERSITY_THEME_DEFINITIONS } from '@/lib/universityThemes'
import {
  CUSTOM_THEME_ID, CUSTOM_THEME_EVENT,
  loadCustomTheme, buildCustomThemeDefinition,
} from '@/lib/customTheme'
import { subscribePreview, getPreviewId } from '@/lib/themePreview'
import { resolveShopBackground, isShopBackgroundId } from '@/lib/shopBackgrounds'

/* Light-mode inline overrides — mirrors html[data-color-scheme='light'] in globals.css.
   Applied as inline styles so they beat any dark cosmetic theme's bg/text vars. */
const LIGHT_BASE_VARS: Readonly<Record<string, string>> = {
  '--bg-main':           '#ffffff',
  '--surface-card':      '#ffffff',
  '--text-primary':      '#14151c',
  '--text-muted':        '#33364a',
  '--text-dark':         '#565b78',
  '--accent-purple':     '#1e9e6c',
  '--accent-purple-dim': 'rgba(30, 158, 108, 0.20)',
  '--border-subtle':     'rgba(18, 46, 36, 0.12)',
  '--bg-hover':          'rgba(30, 158, 108, 0.07)',
  '--bg-active':         'rgba(30, 158, 108, 0.13)',
  '--shadow-card':       '0 2px 12px rgba(20, 24, 60, 0.10), 0 0 0 1px rgba(18, 46, 36, 0.12)',
  '--tint-home':         '#ffffff',
  '--tint-essentials':   '#ffffff',
  '--tint-creator':      '#ffffff',
  '--tint-vault':        '#ffffff',
}

export default function ThemeApplicator() {
  const [isLight, setIsLight] = useState(false)
  const [previewId, setPreview] = useState<string | null>(getPreviewId())
  /* Bumped whenever the stored custom theme changes so live colour-wheel
     edits re-apply instantly while the Forge theme is active or previewed. */
  const [customVersion, setCustomVersion] = useState(0)

  useEffect(() => {
    seedGamesDatabase().catch(() => {})
  }, [])

  /* Subscribe to the app-wide preview channel */
  useEffect(() => subscribePreview(setPreview), [])

  /* Re-apply when the custom theme config is edited */
  useEffect(() => {
    const onChange = () => setCustomVersion(v => v + 1)
    window.addEventListener(CUSTOM_THEME_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(CUSTOM_THEME_EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  /* Watch data-color-scheme attribute so theme re-applies on scheme toggle */
  useEffect(() => {
    const check = () =>
      setIsLight(document.documentElement.getAttribute('data-color-scheme') === 'light')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-scheme'] })
    return () => obs.disconnect()
  }, [])

  const profile = useLiveQuery(
    () => gamesDb?.user_profile_config.get('active_user'),
    [],
  )

  useEffect(() => {
    /* Preview (if any) wins over the persisted active theme. */
    const themeId = previewId ?? profile?.activeTheme ?? 'zenith_default'
    const def =
      themeId === CUSTOM_THEME_ID
        ? buildCustomThemeDefinition(loadCustomTheme())
        : THEME_DEFINITIONS[themeId] ?? UNIVERSITY_THEME_DEFINITIONS[themeId]

    /* Step 1: Clear all previously applied overrides so no stale vars bleed through */
    ALL_THEMEABLE_VARS.forEach(v =>
      document.documentElement.style.removeProperty(v),
    )

    /* Step 2: Apply the new theme's CSS custom-property overrides */
    if (def) {
      Object.entries(def.vars).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value)
      })
    }

    /* Step 3: Apply active background pattern (not for Theme Forge — it has its own backdrop picker).
       Reads the equipped background from the player profile and converts it to CSS var overrides. */
    if (themeId !== CUSTOM_THEME_ID) {
      const bgId = profile?.activeBackground
      if (bgId && isShopBackgroundId(bgId)) {
        const accentHex = def?.swatch ?? '#7c95ff'
        const bgHex     = (def?.vars as Record<string, string>)?.['--bg-main'] ?? '#0b0d13'
        const spec      = resolveShopBackground(bgId, accentHex, bgHex)
        if (spec) {
          document.documentElement.style.setProperty('--body-bg-image',  spec.image)
          document.documentElement.style.setProperty('--body-bg-size',   spec.size)
          document.documentElement.style.setProperty('--body-bg-repeat', spec.repeat)
        }
      } else {
        // No shop background equipped — remove overrides so globals.css baseline shows
        document.documentElement.style.removeProperty('--body-bg-image')
        document.documentElement.style.removeProperty('--body-bg-size')
        document.documentElement.style.removeProperty('--body-bg-repeat')
      }
    }

    /* Step 4: If light mode is active and the theme is not itself a light theme,
       overlay the light-mode base vars so dark bg/text values are overridden */
    if (isLight && !def?.isLightTheme) {
      Object.entries(LIGHT_BASE_VARS).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value)
      })
    }

    /* Step 5: Set data-light-mode attribute so CSS rules can target both the
       color-scheme toggle AND cosmetic light themes with a single selector */
    const isLightMode = isLight || !!def?.isLightTheme
    if (isLightMode) {
      document.documentElement.setAttribute('data-light-mode', 'true')
    } else {
      document.documentElement.removeAttribute('data-light-mode')
    }
  }, [profile?.activeTheme, profile?.activeBackground, isLight, previewId, customVersion])

  return null
}
