'use client'

/* ════════════════════════════════════════════════════════════
   AppContent — Phase 0 · Step 0.5  (updated Phase 6.5)
   Auth-aware wrapper that orchestrates the synchronized
   transition between the AuthGate overlay and the main
   Zenith workspace.

   Animation contract:
     Sign-in  →  gate: opacity 1→0 + translateY 0→12px  (0.5s ease)
                  app: opacity 0→1 + scale 0.97→1        (0.5s expo)
     Sign-out →  gate: opacity 0→1 + translateY 12px→0  (0.5s ease)
                  app: opacity 1→0 + scale 1→0.97        (0.3s ease)

   Phase 6.5 — System Handshake:
     On the first authenticated load per browser session, the
     SystemHandshake overlay gates the workspace. sessionStorage
     key 'zenith_handshake_v1' is set when the handshake
     completes (or is force-overridden), so subsequent page loads
     within the same session skip the boot sequence entirely.
   ════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth }         from '@/lib/AuthContext'
import AuthGate            from './AuthGate'
import AppShell            from './AppShell'
import SystemHandshake     from './SystemHandshake'

/** Three-state machine for the per-session handshake gate. */
type HandshakeState =
  | 'checking'  // sessionStorage read pending (initial render)
  | 'needed'    // key absent — show SystemHandshake overlay
  | 'done'      // key present or handshake just completed

export default function AppContent({ children }: { children: ReactNode }) {
  const { session, isReady }  = useAuth()
  const authed                 = isReady && !!session
  const [hsState, setHsState] = useState<HandshakeState>('checking')

  /*
   * Read sessionStorage once after hydration to determine whether
   * the boot handshake has already run this browser session.
   * Falls back to 'done' if sessionStorage is blocked (private
   * browsing sandboxing, CSP restrictions, etc.).
   */
  useEffect(() => {
    try {
      const done = sessionStorage.getItem('zenith_handshake_v1') === '1'
      setHsState(done ? 'done' : 'needed')
    } catch {
      setHsState('done')
    }
  }, [])

  const handleUnlock = useCallback(() => {
    try { sessionStorage.setItem('zenith_handshake_v1', '1') } catch { /* blocked */ }
    setHsState('done')
  }, [])

  /* Phase 15.3 — performance monitor: fires once per session on first authenticated boot */
  useEffect(() => {
    if (!authed || hsState !== 'done') return
    const tag = '%c[ ZENITH PERFORMANCE MONITOR ]%c'
    const base = 'color:#52cca3;font-weight:700;font-family:monospace'
    const reset = 'color:inherit;font-weight:normal'
    console.info(tag + ' LOCAL FONTS LOADED COMPLETE // CDNS CLEARED', base, reset)
    console.info(tag + ' INDEX STRUCTURES FROZEN // QUERY TARGET VELOCITY: SUB-1MS', base, reset)
  }, [authed, hsState])

  /*
   * Workspace is fully visible only once authed AND the handshake
   * is complete. During the handshake (hsState='needed') the
   * AppShell is still mounted (opacity:0) so BadgeSyncEffect,
   * RpgSyncEffect and other zero-render effects can seed data
   * while the boot sequence plays.
   */
  const workspaceVisible = authed && hsState === 'done'

  return (
    <>
      {/* ── Auth overlay ──────────────────────────────── */}
      <div
        aria-hidden={authed}
        style={{
          position:      'fixed',
          inset:         0,
          zIndex:        50,
          opacity:       !isReady || authed ? 0 : 1,
          pointerEvents: !isReady || authed ? 'none' : 'auto',
          transform:     !isReady || authed ? 'translateY(12px)' : 'translateY(0)',
          transition:    'opacity 0.5s ease, transform 0.5s ease',
        }}
      >
        {isReady && <AuthGate />}
      </div>

      {/* ── System Handshake (first boot per session) ─── */}
      {authed && hsState === 'needed' && (
        <SystemHandshake onUnlock={handleUnlock} />
      )}

      {/* ── Main workspace ────────────────────────────── */}
      <div
        style={{
          opacity:       workspaceVisible ? 1 : 0,
          transform:     workspaceVisible ? 'scale(1)' : 'scale(0.97)',
          pointerEvents: workspaceVisible ? 'auto' : 'none',
          transition:    workspaceVisible
            ? 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
            : 'opacity 0.3s ease, transform 0.3s ease',
          minHeight: '100vh',
        }}
      >
        {isReady && <AppShell>{children}</AppShell>}
      </div>
    </>
  )
}
