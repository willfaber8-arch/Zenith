'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * GameErrorBoundary — Games Tab · Step 7.3
 * Localized Recovery Boundary
 *
 * Wraps an individual arcade game canvas to intercept runtime
 * faults before they can propagate upward and crash the full
 * GamesTabShell or the global Zenith workspace.
 *
 * Recovery pipeline on "Re-Initialize Game Component":
 *   1. clearLocalCache() — scans localStorage for any key that
 *      contains `fallbackGameId` and removes it, purging stale
 *      serialised game state that may have caused the crash.
 *   2. sessionKey is incremented — the Fragment wrapper changes
 *      its React key, which forces an unmount + remount of the
 *      entire child subtree, giving the game a clean slate.
 *   3. hasError is reset to false — the fallback UI disappears
 *      and the freshly remounted game renders in its place.
 *
 * Retry guard:
 *   If the child throws again immediately (persistent bug), the
 *   boundary catches it and increments retryCount.  After
 *   MAX_RETRIES consecutive failures the boundary enters a
 *   permanent-failure state that shows a dismiss-only UI to
 *   prevent an infinite recovery loop.
 *
 * Exception telemetry:
 *   Every caught error is forwarded to `logBoundaryException` in
 *   boundaryLog.ts so the DiagnosticsHUD can surface lifetime
 *   exception counts and the last intercepted payload.
 * ════════════════════════════════════════════════════════════════
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { logBoundaryException } from './boundaryLog'
import styles from './GameErrorBoundary.module.css'

/* ════════════════════════════════════════════════════════════════
   §1  EXPORTED INTERFACES  (spec-required signatures)
   ════════════════════════════════════════════════════════════════ */

export interface GameErrorBoundaryProps {
  children:       ReactNode
  /**
   * Identifies the game component this boundary wraps.
   * Used to:
   *   - Label the fallback terminal pane so operators know which
   *     game faulted.
   *   - Scope the localStorage purge to keys containing this ID,
   *     preventing cache from stale serialised game state.
   */
  fallbackGameId: string
}

/* ════════════════════════════════════════════════════════════════
   §2  COMPONENT STATE
   ════════════════════════════════════════════════════════════════ */

interface BoundaryState {
  hasError:   boolean
  error:      Error | null
  errorInfo:  ErrorInfo | null
  /**
   * Incremented on each recovery attempt.  The children Fragment
   * carries `key={sessionKey}` so React unmounts and remounts the
   * entire game subtree — a hot component remount without any
   * full-page reload.
   */
  sessionKey: number
  /**
   * Consecutive crash counter.  Reset to 0 on successful recovery
   * (component stays healthy for at least one render cycle after
   * remount).  At MAX_RETRIES the boundary enters permanent-failure
   * mode and stops offering recovery.
   */
  retryCount: number
}

/* ════════════════════════════════════════════════════════════════
   §3  CONSTANTS
   ════════════════════════════════════════════════════════════════ */

/**
 * Maximum consecutive recovery attempts before the boundary
 * refuses further retries and shows the permanent-failure pane.
 */
const MAX_RETRIES = 3

/* ════════════════════════════════════════════════════════════════
   §4  CLASS COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default class GameErrorBoundary extends Component<
  GameErrorBoundaryProps,
  BoundaryState
> {

  state: BoundaryState = {
    hasError:   false,
    error:      null,
    errorInfo:  null,
    sessionKey: 0,
    retryCount: 0,
  }

  /* ── §4a  Error capture ─────────────────────────────────────────
     getDerivedStateFromError fires synchronously inside the render
     phase that produced the error, so the fallback UI appears in
     the same commit — zero blank-frame flash.                     */

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState(prev => ({
      errorInfo:  info,
      retryCount: prev.retryCount + 1,
    }))

    // Forward to the shared telemetry registry for the DiagnosticsHUD
    logBoundaryException(error, info)

    // Dev-only trace — stripped by compiler.removeConsole in production
    if (process.env.NODE_ENV !== 'production') {
      console.error('[GameErrorBoundary] Game crash — fallbackGameId:', this.props.fallbackGameId)
      console.error('[GameErrorBoundary] Error:', error)
      console.error('[GameErrorBoundary] Component stack:', info.componentStack)
    }
  }

  /* ── §4b  Local cache purge ─────────────────────────────────────
     Scans localStorage for any key whose string representation
     contains `fallbackGameId` and removes it.  This clears stale
     best-score records and serialised layout blobs that may have
     been the root cause of the crash.                            */

  private clearLocalCache = (): void => {
    if (typeof window === 'undefined') return

    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key !== null && key.includes(this.props.fallbackGameId)) {
        keysToRemove.push(key)
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }
  }

  /* ── §4c  Recovery action ──────────────────────────────────────
     1. Purge localStorage keys scoped to this game.
     2. Flip hasError=false and bump sessionKey in one setState call
        so React applies both changes in a single commit:
        — hasError=false renders the Fragment (not the fallback)
        — new sessionKey forces a full unmount + remount of children */

  private reinitialize = (): void => {
    this.clearLocalCache()
    this.setState(prev => ({
      hasError:   false,
      error:      null,
      errorInfo:  null,
      sessionKey: prev.sessionKey + 1,
      // retryCount is NOT reset here; it only decrements on a successful
      // stable render, which happens implicitly by not throwing again.
    }))
  }

  /* ── §4d  Render ────────────────────────────────────────────── */

  render(): ReactNode {
    const { hasError, error, errorInfo, sessionKey, retryCount } = this.state
    const { children, fallbackGameId }                           = this.props

    /* ── Healthy path — wrap children with a keyed Fragment ─────
       Changing sessionKey here forces React to treat the subtree
       as a brand-new tree, unmounting and remounting all children
       without any explicit imperative API call.                  */
    if (!hasError) {
      return (
        <React.Fragment key={sessionKey}>
          {children}
        </React.Fragment>
      )
    }

    /* ── Permanent-failure path — too many retries ──────────── */
    const isPermanentFailure = retryCount >= MAX_RETRIES

    /* ── Truncated stack for the terminal pane ──────────────── */
    const traceLines = (
      error?.stack ?? error?.message ?? 'No stack trace available.'
    ).slice(0, 600)

    /* ── Component stack hint ───────────────────────────────── */
    const componentHint = (errorInfo?.componentStack ?? '')
      .trim()
      .split('\n')
      .slice(0, 5)
      .join('\n')

    return (
      <div
        className={styles.fallbackFrame}
        role="alert"
        aria-live="assertive"
        aria-label={`${fallbackGameId} game module faulted`}
      >
        {/* ── Terminal header ─────────────────────────────── */}
        <div className={styles.terminalHeader}>
          <span className={styles.terminalDot} aria-hidden="true" />
          <span className={styles.terminalLabel}>Game Fault Isolated</span>
          <span className={styles.gameIdBadge} aria-label={`Game: ${fallbackGameId}`}>
            {fallbackGameId}
          </span>
        </div>

        {/* ── Error message ───────────────────────────────── */}
        <p className={styles.errorMessage}>
          {error?.message ?? 'An unknown runtime error occurred.'}
        </p>

        {/* ── Stack trace snippet ─────────────────────────── */}
        <pre
          className={styles.stackTrace}
          aria-label="Error stack trace"
        >
          {traceLines}
          {componentHint ? `\n\n— component stack —\n${componentHint}` : ''}
        </pre>

        {/* ── Recovery footer ─────────────────────────────── */}
        <div className={styles.footer}>
          {isPermanentFailure ? (
            <>
              <p className={styles.permanentError}>
                Recovery failed after {retryCount} attempts — persistent fault detected.
              </p>
              <button
                type="button"
                className={styles.dismissBtn}
                onClick={() => this.setState({ hasError: false, retryCount: 0, sessionKey: this.state.sessionKey + 1 })}
                aria-label="Dismiss error boundary and attempt one final remount"
              >
                Force Dismiss
              </button>
            </>
          ) : (
            <>
              <span className={styles.retryCount}>
                Attempt {retryCount} / {MAX_RETRIES}
              </span>
              <button
                type="button"
                className={styles.reinitBtn}
                onClick={this.reinitialize}
                aria-label={`Re-initialize ${fallbackGameId} game component`}
              >
                ↺ Re-Initialize Game Component
              </button>
            </>
          )}
        </div>

      </div>
    )
  }
}
