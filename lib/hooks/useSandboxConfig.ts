'use client'

import { useState, useEffect } from 'react'

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
  // Utility widgets
  timerWidget:       boolean
  stopwatch:         boolean
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
  timerWidget:     true,
  stopwatch:       false,
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
  timerWidget:     'Timer',
  stopwatch:       'Stopwatch',
  readingTracker:  'Reading Tracker',
  customLinks:     'Quick Links',
  vocabTracker:    'Polyglot Vault',
  gpaWidget:       'GPA',
  wellnessCheck:   'Wellness Check',
  mealToday:       'Today\'s Meals',
  newsHeadline:    'World News',
  arcadeEconomy:   'Arcade Economy',
}

export const WIDGET_VIEWS: Record<keyof SandboxConfig, string> = {
  habitSummary:    'habits',
  pomodoroPreview: 'study-shield',
  calendarToday:   'calendar',
  localWeather:    'calendar',
  studyStreak:     'study-shield',
  uniHub:          'uni-hub',
  cardioSummary:   'workouts',
  letterbox:       'friends-network',
  distanceTracker: 'friends-network',
  timerWidget:     'home',
  stopwatch:       'home',
  readingTracker:  'book-tracker',
  customLinks:     'custom-links',
  vocabTracker:    'vocab-builder',
  gpaWidget:       'uni-hub',
  wellnessCheck:   'wellness',
  mealToday:       'meal-planning',
  newsHeadline:    'world-events',
  arcadeEconomy:   'games',
}

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
  timerWidget:     'normal',
  stopwatch:       'normal',
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
