'use client'

/**
 * ThemeApplicator — zero-render client component.
 *
 * Reads the player's active cosmetic theme from the Games IDB singleton
 * and applies CSS custom-property overrides to document.documentElement.
 * This makes every themed CSS var across the entire app respond instantly
 * to theme changes without a page reload.
 *
 * Mount location: inside CopilotProvider in layout.tsx (always present when
 * authenticated or not — seeds the Games DB if the user has never opened the
 * Arcade Hub).
 */

import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { gamesDb, seedGamesDatabase } from '@/lib/gamesDb'
import { THEME_DEFINITIONS, ALL_THEMEABLE_VARS } from '@/lib/themeDefinitions'

export default function ThemeApplicator() {
  /* Seed the Games DB if it hasn't been seeded yet (idempotent). */
  useEffect(() => {
    seedGamesDatabase().catch(() => {})
  }, [])

  /* Reactively watch the active theme from the user_profile_config table. */
  const profile = useLiveQuery(
    () => gamesDb?.user_profile_config.get('active_user'),
    [],
  )

  useEffect(() => {
    const themeId = profile?.activeTheme ?? 'zenith_default'
    const def = THEME_DEFINITIONS[themeId]

    // Step 1: Clear all previously applied overrides so no stale vars bleed through
    ALL_THEMEABLE_VARS.forEach(v =>
      document.documentElement.style.removeProperty(v),
    )

    // Step 2: Apply the new theme's CSS custom-property overrides
    if (def) {
      Object.entries(def.vars).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value)
      })
    }
  }, [profile?.activeTheme])

  return null
}
