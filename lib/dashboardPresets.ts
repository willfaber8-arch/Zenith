/**
 * lib/dashboardPresets.ts — Dashboard preset CRUD (localStorage).
 *
 * A preset is a named snapshot of the user's widget visibility config.
 * The AI can create presets via save_dashboard_preset, apply them via
 * load_dashboard_preset, and the SettingsView lets the user manage them.
 */

'use client'

import type { SandboxConfig } from '@/lib/hooks/useSandboxConfig'
import { SANDBOX_DEFAULTS, SANDBOX_STORAGE_KEY } from '@/lib/hooks/useSandboxConfig'

export const PRESETS_STORAGE_KEY = 'zenith_dashboard_presets_v1'

export interface DashboardPreset {
  id:        string
  name:      string
  /** Stores the full widget map so applying a preset is a clean replace. */
  widgets:   Partial<SandboxConfig>
  createdAt: number
}

export function getPresets(): DashboardPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as DashboardPreset[]
  } catch { return [] }
}

export function savePreset(name: string, widgets?: Partial<SandboxConfig>): DashboardPreset {
  // If no explicit widgets provided, snapshot the current config from localStorage.
  let snapshot: Partial<SandboxConfig> = widgets ?? {}
  if (!widgets) {
    try {
      const raw = localStorage.getItem(SANDBOX_STORAGE_KEY)
      if (raw) snapshot = JSON.parse(raw) as Partial<SandboxConfig>
    } catch { /* keep empty snapshot */ }
  }

  const preset: DashboardPreset = {
    id:        crypto.randomUUID(),
    name:      name.trim(),
    widgets:   snapshot,
    createdAt: Date.now(),
  }

  const existing = getPresets().filter(p => p.name.toLowerCase() !== preset.name.toLowerCase())
  existing.push(preset)
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(existing))
  return preset
}

export function deletePreset(id: string): void {
  const filtered = getPresets().filter(p => p.id !== id)
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(filtered))
}

/** Apply a preset: merges its widgets over defaults and writes to sandbox config. */
export function applyPreset(preset: DashboardPreset): void {
  const config = { ...SANDBOX_DEFAULTS, ...preset.widgets }
  localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(config))
  window.dispatchEvent(new CustomEvent('zenith:sandbox-config-change'))
}

/** Find a preset by exact name (case-insensitive). */
export function findPresetByName(name: string): DashboardPreset | undefined {
  const lower = name.toLowerCase().trim()
  return getPresets().find(p => p.name.toLowerCase() === lower)
}
