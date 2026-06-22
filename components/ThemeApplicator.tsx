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

/* Light-mode inline overrides — mirrors html[data-color-scheme='light'] in globals.css.
   Applied as inline styles so they beat any dark cosmetic theme's bg/text vars. */
const LIGHT_BASE_VARS: Readonly<Record<string, string>> = {
  '--bg-main':           '#f2f4fc',
  '--surface-card':      '#ffffff',
  '--text-primary':      '#181a2e',
  '--text-muted':        '#464870',
  '--text-dark':         '#8890b4',
  '--accent-purple':     '#1e9e6c',
  '--accent-purple-dim': 'rgba(30, 158, 108, 0.20)',
  '--border-subtle':     'rgba(18, 46, 36, 0.12)',
  '--bg-hover':          'rgba(30, 158, 108, 0.07)',
  '--bg-active':         'rgba(30, 158, 108, 0.13)',
  '--shadow-card':       '0 2px 12px rgba(20, 24, 60, 0.10), 0 0 0 1px rgba(18, 46, 36, 0.12)',
}

export default function ThemeApplicator() {
  const [isLight, setIsLight] = useState(false)

  useEffect(() => {
    seedGamesDatabase().catch(() => {})
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
    const themeId = profile?.activeTheme ?? 'zenith_default'
    const def = THEME_DEFINITIONS[themeId] ?? UNIVERSITY_THEME_DEFINITIONS[themeId]

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

    /* Step 3: If light mode is active and the theme is not itself a light theme,
       overlay the light-mode base vars so dark bg/text values are overridden */
    if (isLight && !def?.isLightTheme) {
      Object.entries(LIGHT_BASE_VARS).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value)
      })
    }
  }, [profile?.activeTheme, isLight])

  return null
}
