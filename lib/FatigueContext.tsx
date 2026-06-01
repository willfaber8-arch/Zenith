'use client'

/**
 * FatigueContext — Phase 5 · Step 5.6
 * ─────────────────────────────────────────────────────────────────
 * React context that broadcasts the live fatigue state produced by
 * useFatigueMonitor and exposes recovery lifecycle controls.
 *
 * Recovery state is deliberately minimal — the context owns just the
 * boolean flag.  RecoveryCockpit owns its own countdown and reward
 * logic, calling endRecovery() when complete.
 *
 * FatigueCtx is exported as a raw context so CosmosCanvas can read
 * it via useContext() without triggering the throw-on-missing guard
 * in useFatigue() (the canvas may render before the provider mounts
 * in edge cases).
 */

import {
  createContext, useContext, useState, useCallback,
  type ReactNode,
} from 'react'
import {
  useFatigueMonitor,
  type FatigueMetrics,
} from '@/lib/hooks/useFatigueMonitor'

/* ── Types ───────────────────────────────────────────────────── */

interface RecoveryControls {
  isRecovering:  boolean
  startRecovery: () => void
  endRecovery:   () => void
}

export type FatigueContextValue = FatigueMetrics & RecoveryControls

/* ── Context ─────────────────────────────────────────────────── */

export const FatigueCtx = createContext<FatigueContextValue | null>(null)

/* ── Safe fallback (used when context is unavailable) ────────── */

const FALLBACK: FatigueContextValue = {
  isFatigued:            false,
  continuousWorkMinutes: 0,
  currentHealth:         100,
  fatigueReason:         null,
  isRecovering:          false,
  startRecovery:         () => {},
  endRecovery:           () => {},
}

/* ── Provider ────────────────────────────────────────────────── */

export function FatigueProvider({ children }: { children: ReactNode }) {
  const metrics                        = useFatigueMonitor()
  const [isRecovering, setIsRecovering] = useState(false)

  const startRecovery = useCallback(() => setIsRecovering(true),  [])
  const endRecovery   = useCallback(() => setIsRecovering(false), [])

  return (
    <FatigueCtx.Provider value={{ ...metrics, isRecovering, startRecovery, endRecovery }}>
      {children}
    </FatigueCtx.Provider>
  )
}

/* ── Hook ────────────────────────────────────────────────────── */

/**
 * Returns the current fatigue + recovery state.
 * Falls back to safe defaults when called outside FatigueProvider
 * (e.g., SSR or before provider mounts).
 */
export function useFatigue(): FatigueContextValue {
  return useContext(FatigueCtx) ?? FALLBACK
}
