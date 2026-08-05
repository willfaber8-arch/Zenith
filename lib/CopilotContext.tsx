/**
 * lib/CopilotContext.tsx — AI Co-Pilot Sidebar State
 * Phase 7 · Step 7.1 — Academic Co-Pilot
 *
 * Lightweight context that governs whether the AiCopilotSidebar panel is
 * open or closed.  Kept deliberately thin so any component in the tree can
 * trigger or dismiss the panel without prop-drilling.
 */

'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

/* ── Shape ────────────────────────────────────────────────────── */

interface CopilotContextValue {
  isOpen: boolean
  /** True while the panel is running the guided personalisation interview. */
  setupMode: boolean
  open:   () => void
  /** Open the panel directly into setup mode (from the tour, or the panel's
   *  own empty state). Safe to call when the panel is already open. */
  openSetup: () => void
  /** Leave setup mode without closing the panel. */
  endSetup: () => void
  close:  () => void
  toggle: () => void
}

/* ── Defaults (used when consumed outside provider) ──────────── */

const CopilotCtx = createContext<CopilotContextValue>({
  isOpen:    false,
  setupMode: false,
  open:      () => {},
  openSetup: () => {},
  endSetup:  () => {},
  close:     () => {},
  toggle:    () => {},
})

/* ── Provider ─────────────────────────────────────────────────── */

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [isOpen,    setIsOpen]    = useState(false)
  const [setupMode, setSetupMode] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])

  const openSetup = useCallback(() => {
    setSetupMode(true)
    setIsOpen(true)
  }, [])

  const endSetup = useCallback(() => setSetupMode(false), [])

  /* Closing the panel ends setup: re-opening later should land in the normal
     assistant, not silently resume a half-finished interview whose questions
     the user has long since forgotten. */
  const close = useCallback(() => {
    setIsOpen(false)
    setSetupMode(false)
  }, [])

  const toggle = useCallback(() => setIsOpen(o => {
    if (o) setSetupMode(false)
    return !o
  }), [])

  return (
    <CopilotCtx.Provider
      value={{ isOpen, setupMode, open, openSetup, endSetup, close, toggle }}
    >
      {children}
    </CopilotCtx.Provider>
  )
}

/* ── Hook ─────────────────────────────────────────────────────── */

export function useCopilot(): CopilotContextValue {
  return useContext(CopilotCtx)
}
