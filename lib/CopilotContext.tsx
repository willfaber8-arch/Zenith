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
  open:   () => void
  close:  () => void
  toggle: () => void
}

/* ── Defaults (used when consumed outside provider) ──────────── */

const CopilotCtx = createContext<CopilotContextValue>({
  isOpen: false,
  open:   () => {},
  close:  () => {},
  toggle: () => {},
})

/* ── Provider ─────────────────────────────────────────────────── */

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const open   = useCallback(() => setIsOpen(true),    [])
  const close  = useCallback(() => setIsOpen(false),   [])
  const toggle = useCallback(() => setIsOpen(o => !o), [])

  return (
    <CopilotCtx.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </CopilotCtx.Provider>
  )
}

/* ── Hook ─────────────────────────────────────────────────────── */

export function useCopilot(): CopilotContextValue {
  return useContext(CopilotCtx)
}
