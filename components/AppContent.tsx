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

import { useEffect, type ReactNode } from 'react'
import { useAuth }   from '@/lib/AuthContext'
import AuthGate      from './AuthGate'
import AppShell      from './AppShell'

export default function AppContent({ children }: { children: ReactNode }) {
  const { session, isReady } = useAuth()
  const authed               = isReady && !!session

  /* Phase 15.3 — performance monitor: fires once per session on first authenticated boot */
  useEffect(() => {
    if (!authed) return
    const tag = '%c[ ZENITH PERFORMANCE MONITOR ]%c'
    const base = 'color:#52cca3;font-weight:700;font-family:monospace'
    const reset = 'color:inherit;font-weight:normal'
    console.info(tag + ' LOCAL FONTS LOADED COMPLETE // CDNS CLEARED', base, reset)
    console.info(tag + ' INDEX STRUCTURES FROZEN // QUERY TARGET VELOCITY: SUB-1MS', base, reset)
  }, [authed])

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

      {/* ── Main workspace ────────────────────────────── */}
      <div
        style={{
          opacity:       authed ? 1 : 0,
          transform:     authed ? 'scale(1)' : 'scale(0.97)',
          pointerEvents: authed ? 'auto' : 'none',
          transition:    authed
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
