'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — StudyModeContext
 * Phase 3 · Step 3.1 — Custom Study Mode Layout State
 *
 * Atomic boolean controller for the distraction-free focus cockpit.
 *
 * Public API (via useStudyMode()):
 *   isStudyModeActive   — true while the focus cockpit is shown
 *   sessionCount        — completed focus intervals this workspace session
 *   enterStudyWorkspace() — activates the cockpit + resets session data
 *   exitStudyWorkspace()  — restores the normal workspace shell
 *   incrementSession()    — called by the Pomodoro arena on each completed interval
 *
 * Keyboard contract:
 *   Escape → exitStudyWorkspace()  (only when study mode is active)
 *   The listener is attached to window so it fires regardless of
 *   which element holds focus inside the cockpit.
 * ════════════════════════════════════════════════════════════════
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

/* ── Public types ───────────────────────────────────────────── */

interface StudyModeState {
  isStudyModeActive:   boolean
  /** Completed Pomodoro focus intervals in this workspace session */
  sessionCount:        number
  enterStudyWorkspace: () => void
  exitStudyWorkspace:  () => void
  /** Called by StudyPomodoroArena when a focus interval completes */
  incrementSession:    () => void
}

/* ── Context + safe default ─────────────────────────────────── */

const StudyModeContext = createContext<StudyModeState>({
  isStudyModeActive:   false,
  sessionCount:        0,
  enterStudyWorkspace: () => {},
  exitStudyWorkspace:  () => {},
  incrementSession:    () => {},
})

/* ── Provider ────────────────────────────────────────────────── */

export function StudyModeProvider({ children }: { children: ReactNode }) {
  const [isStudyModeActive, setIsStudyModeActive] = useState(false)
  const [sessionCount,      setSessionCount]      = useState(0)

  const enterStudyWorkspace = useCallback(() => {
    setIsStudyModeActive(true)
    /* Don't reset sessionCount — preserve cross-entry continuity */
  }, [])

  const exitStudyWorkspace = useCallback(() => {
    setIsStudyModeActive(false)
  }, [])

  const incrementSession = useCallback(() => {
    setSessionCount(n => n + 1)
  }, [])

  /* ── Global Escape key handler ──────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      /*
       * Only intercept Escape when the cockpit is active.
       * Check !e.repeat to avoid repeated fire on held-key.
       */
      if (e.key === 'Escape' && !e.repeat && isStudyModeActive) {
        exitStudyWorkspace()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isStudyModeActive, exitStudyWorkspace])

  /* ── Prevent body scroll while cockpit is open ──────────────── */
  useEffect(() => {
    document.body.style.overflow = isStudyModeActive ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isStudyModeActive])

  return (
    <StudyModeContext.Provider
      value={{
        isStudyModeActive,
        sessionCount,
        enterStudyWorkspace,
        exitStudyWorkspace,
        incrementSession,
      }}
    >
      {children}
    </StudyModeContext.Provider>
  )
}

/* ── Consumer hook ──────────────────────────────────────────── */

export const useStudyMode = () => useContext(StudyModeContext)
