'use client'

import { useState, useEffect } from 'react'
import { WIDGET_OWNER } from '@/lib/modules'

/* ── Widget visibility dictionary ─────────────────────────────── */

export interface SandboxConfig {
  habitSummary:      boolean
  pomodoroPreview:   boolean
  calendarToday:     boolean
  localWeather:      boolean
  studyStreak:       boolean
  uniHub:            boolean
  cardioSummary:     boolean
  letterbox:         boolean
  distanceTracker:   boolean
  notesRecent:       boolean
  savedReading:      boolean
  diningNow:         boolean
  problemSets:       boolean
  // Utility widgets
  timerWidget:       boolean
  stopwatch:         boolean
  counter:           boolean
  // Sports
  sportsTeams:       boolean
  // Library
  readingTracker:    boolean
  // Vault
  customLinks:       boolean
  // Scholastic
  vocabTracker:      boolean
  gpaWidget:         boolean
  // Life
  wellnessCheck:     boolean
  mealToday:         boolean
  newsHeadline:      boolean
  // Arcade
  arcadeEconomy:     boolean
}

export const SANDBOX_DEFAULTS: SandboxConfig = {
  habitSummary:    true,
  pomodoroPreview: false,
  calendarToday:   true,
  localWeather:    true,
  studyStreak:     true,
  uniHub:          false,
  cardioSummary:   true,
  letterbox:       true,
  distanceTracker: true,
  notesRecent:     true,
  savedReading:    true,
  diningNow:       false,
  problemSets:     true,
  timerWidget:     true,
  stopwatch:       false,
  counter:         false,
  sportsTeams:     false,
  readingTracker:  true,
  customLinks:     true,
  vocabTracker:    false,
  gpaWidget:       false,
  wellnessCheck:   false,
  mealToday:       false,
  newsHeadline:    false,
  arcadeEconomy:   false,
}

export const WIDGET_LABELS: Record<keyof SandboxConfig, string> = {
  habitSummary:    'Habit Summary',
  pomodoroPreview: 'Pomodoro Timer',
  calendarToday:   'Today\'s Schedule',
  localWeather:    'Local Weather',
  studyStreak:     'Study Streak',
  uniHub:          'University Hub',
  cardioSummary:   'Cardio Activity',
  letterbox:       'Letterbox',
  distanceTracker: 'Distance Tracker',
  notesRecent:     'Recent Note',
  savedReading:    'Saved Reading',
  diningNow:       'Dining Now',
  problemSets:     'Work Due',
  timerWidget:     'Timer',
  stopwatch:       'Stopwatch',
  counter:         'Counter',
  sportsTeams:     'My Teams',
  readingTracker:  'Library',
  customLinks:     'Quick Links',
  vocabTracker:    'Polyglot Vault',
  gpaWidget:       'GPA',
  wellnessCheck:   'Wellness Check',
  mealToday:       'Today\'s Meals',
  newsHeadline:    'World News',
  arcadeEconomy:   'Arcade Economy',
}

/**
 * widget key → the module it belongs to (drives click-through from the
 * dashboard). Derived from the module registry rather than hand-written:
 * this used to be a parallel map with no link to the nav, so a widget
 * could point at a module that no longer existed — or at one that was
 * never in the sidebar at all, which is how four modules ended up
 * reachable only by clicking their own widget.
 *
 * Kept as a `keyof SandboxConfig` record so every widget is still
 * accounted for; WIDGET_OWNER supplies the value, and anything a module
 * has not claimed falls back to 'home'.
 */
export const WIDGET_VIEWS: Record<keyof SandboxConfig, string> =
  Object.fromEntries(
    (Object.keys(SANDBOX_DEFAULTS) as (keyof SandboxConfig)[])
      .map(k => [k, WIDGET_OWNER[k] ?? 'home']),
  ) as Record<keyof SandboxConfig, string>

/* Widget size hints — 'wide' spans full width on desktop */
export const WIDGET_SIZE: Record<keyof SandboxConfig, 'normal' | 'wide'> = {
  habitSummary:    'normal',
  pomodoroPreview: 'normal',
  calendarToday:   'normal',
  localWeather:    'wide',
  studyStreak:     'normal',
  uniHub:          'normal',
  cardioSummary:   'normal',
  letterbox:       'normal',
  distanceTracker: 'normal',
  notesRecent:     'normal',
  savedReading:    'normal',
  diningNow:       'normal',
  problemSets:     'normal',
  timerWidget:     'normal',
  stopwatch:       'normal',
  counter:         'normal',
  sportsTeams:     'normal',
  readingTracker:  'normal',
  customLinks:     'normal',
  vocabTracker:    'normal',
  gpaWidget:       'normal',
  wellnessCheck:   'normal',
  mealToday:       'normal',
  newsHeadline:    'normal',
  arcadeEconomy:   'normal',
}

export const SANDBOX_STORAGE_KEY = 'zenith_sandbox_config_v4'
const STORAGE_KEY = SANDBOX_STORAGE_KEY

export interface UseSandboxConfigResult {
  config:       SandboxConfig
  toggleWidget: (key: keyof SandboxConfig) => void
  mounted:      boolean
}

export function useSandboxConfig(): UseSandboxConfigResult {
  const [config,  setConfig]  = useState<SandboxConfig>(SANDBOX_DEFAULTS)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const reload = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<SandboxConfig>
          setConfig({ ...SANDBOX_DEFAULTS, ...parsed })
        } else {
          setConfig(SANDBOX_DEFAULTS)
        }
      } catch {
        /* Corrupt localStorage — keep defaults */
      }
    }

    reload()

    // Live-update when the AI Co-Pilot (same tab → CustomEvent) or another tab
    // (→ storage event) changes the widget config.
    const onCustom  = () => reload()
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) reload() }
    window.addEventListener('zenith:sandbox-config-change', onCustom)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('zenith:sandbox-config-change', onCustom)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const toggleWidget = (key: keyof SandboxConfig) => {
    setConfig(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }

  return { config, toggleWidget, mounted }
}
