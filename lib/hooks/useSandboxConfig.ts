'use client'
/**
 * useSandboxConfig
 * ────────────────────────────────────────────────────────────────
 * localStorage-backed visibility dictionary for WidgetSandbox.
 * Reads persisted config on first mount (client-only), falls back
 * to SANDBOX_DEFAULTS when no stored value exists.
 *
 * Returns { config, toggleWidget, mounted } — the `mounted` flag
 * lets consumers skip rendering until the real config is read,
 * preventing a flash of incorrect widget visibility on load.
 *
 * Import only from `'use client'` components.
 */

import { useState, useEffect } from 'react'

/* ── Widget visibility dictionary ─────────────────────────────── */

export interface SandboxConfig {
  urgentTasks:     boolean
  pomodoroPreview: boolean
  habitSummary:    boolean
  localWeather:    boolean
}

export const SANDBOX_DEFAULTS: SandboxConfig = {
  urgentTasks:     true,
  pomodoroPreview: false,
  habitSummary:    true,
  localWeather:    true,
}

/** Friendly label map for the Manage Sandbox panel */
export const WIDGET_LABELS: Record<keyof SandboxConfig, string> = {
  urgentTasks:     'Urgent Tasks',
  pomodoroPreview: 'Pomodoro Preview',
  habitSummary:    'Habit Summary',
  localWeather:    'Local Weather',
}

const STORAGE_KEY = 'zenith_sandbox_config'

/* ── Return type ──────────────────────────────────────────────── */

export interface UseSandboxConfigResult {
  config:       SandboxConfig
  toggleWidget: (key: keyof SandboxConfig) => void
  /** false until the first useEffect reads from localStorage */
  mounted:      boolean
}

/* ── Hook ─────────────────────────────────────────────────────── */

export function useSandboxConfig(): UseSandboxConfigResult {
  /* Start with defaults — SSR-safe, no window access */
  const [config,  setConfig]  = useState<SandboxConfig>(SANDBOX_DEFAULTS)
  const [mounted, setMounted] = useState(false)

  /* Hydrate from localStorage on first client render */
  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SandboxConfig>
        /* Merge with defaults so any future new keys get their default */
        setConfig(prev => ({ ...prev, ...parsed }))
      }
    } catch {
      /* Corrupt localStorage entry — silently keep defaults */
    }
  }, [])

  const toggleWidget = (key: keyof SandboxConfig) => {
    setConfig(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* Storage quota exceeded — UI still updates, just not persisted */
      }
      return next
    })
  }

  return { config, toggleWidget, mounted }
}
