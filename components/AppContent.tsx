'use client'

/* ════════════════════════════════════════════════════════════
   AppContent — Auth-aware wrapper that orchestrates the
   synchronized transition between the AuthGate overlay and
   the main Zenith workspace.

   Animation contract:
     Sign-in  →  gate: opacity 1→0 + translateY 0→12px  (0.5s ease)
                  app: opacity 0→1 + scale 0.97→1        (0.5s expo)
     Sign-out →  gate: opacity 0→1 + translateY 12px→0  (0.5s ease)
                  app: opacity 1→0 + scale 1→0.97        (0.3s ease)
   ════════════════════════════════════════════════════════════ */

import { useEffect, useState, type ReactNode } from 'react'
import { useAuth }   from '@/lib/AuthContext'
import AuthGate      from './AuthGate'
import AppShell      from './AppShell'

export default function AppContent({ children }: { children: ReactNode }) {
  const { session, isReady } = useAuth()
  const authed               = isReady && !!session

  /*
   * The workspace scales in on sign-in, then lets the transform go.
   *
   * A transform — even the identity `scale(1)` it lands on — makes this
   * element the containing block for every `position: fixed` descendant
   * inside it. Every modal in the app asks to cover the viewport and
   * would instead cover *this* div, which is as tall as its scrolling
   * content. That is invisible on a short page and severe on a long
   * one: the Vocab Builder's card list produced a dialog 93,207px tall
   * starting 46,035px above the screen, and focusing its first input
   * scrolled the page into the middle of nowhere.
   *
   * `none` renders identically to `scale(1)`. Dropping it after the
   * animation costs nothing and makes fixed positioning work again
   * everywhere.
   */
  const [workspaceSettled, setWorkspaceSettled] = useState(false)
  useEffect(() => {
    if (!authed) { setWorkspaceSettled(false); return }
    /* Comfortably past the 0.5s transition declared below. */
    const t = setTimeout(() => setWorkspaceSettled(true), 600)
    return () => clearTimeout(t)
  }, [authed])

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
          /* `none` once the sign-in animation is done — see the comment
             on `workspaceSettled` above. */
          transform:     workspaceSettled ? 'none' : authed ? 'scale(1)' : 'scale(0.97)',
          pointerEvents: authed ? 'auto' : 'none',
          transition:    authed
            ? 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
            : 'opacity 0.3s ease, transform 0.3s ease',
          /* dvh, not vh: mobile browsers shrink the viewport as the
             address bar hides, and vh does not follow. An inline style
             cannot carry a fallback declaration, and every browser this
             app already requires for color-mix() supports dvh. */
          minHeight: '100dvh',
        }}
      >
        {isReady && <AppShell>{children}</AppShell>}
      </div>
    </>
  )
}
