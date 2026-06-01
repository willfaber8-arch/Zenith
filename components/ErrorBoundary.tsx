'use client'

/**
 * Zenith OS — ErrorBoundary
 * Phase 6 · Step 6.1 — Global Compact Error Isolation Layer
 *
 * Catches uncaught React subtree crashes and renders a recovery card
 * that matches the Zenith dark-surface palette instead of a blank page.
 *
 * Recovery ladder:
 *   1st crash  → "Reinitialize OS Engine" — resets error state, re-renders children
 *   2nd crash  → "Flush State & Restart" — wipes ZenithOS IndexedDB, navigates to /
 *
 * Mount this around any subtree that touches IDB, WebRTC, or the AI gateway.
 * The root usage wraps AppContent in layout.tsx so no crash can escape to the browser.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

/* ── Props & State ─────────────────────────────────────────────── */

interface Props {
  children:     ReactNode
  /** Shown in the recovery card subtitle — e.g. "Multiplayer Lobby" */
  moduleLabel?: string
}

interface State {
  hasError:  boolean
  error:     Error | null
  errorInfo: ErrorInfo | null
  /** Counts re-render attempts — used to escalate to the hard-reset path */
  attempts:  number
}

/* ── Class component ───────────────────────────────────────────── */

export default class ErrorBoundary extends Component<Props, State> {

  state: State = {
    hasError:  false,
    error:     null,
    errorInfo: null,
    attempts:  0,
  }

  /* Synchronously derive error state so the recovery UI renders in the
     same commit that caused the crash — no intermediate blank frame.   */
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ errorInfo: info })
    /* Dev-only trace — stripped by compiler.removeConsole in production */
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary] Subtree crash:', error)
      console.error('[ErrorBoundary] Component stack:', info.componentStack)
    }
  }

  /* ── Recovery actions ────────────────────────────────────────── */

  private reinitialize = () => {
    /* Bump attempt counter so the state diff is guaranteed non-null.
       React class setState merges, so both fields update atomically.   */
    this.setState(prev => ({
      hasError:  false,
      error:     null,
      errorInfo: null,
      attempts:  prev.attempts + 1,
    }))
  }

  private flushAndRestart = () => {
    /* Wipe the local database so a corrupted row can't re-crash the app.
       Navigating via replace() removes the broken state from history.   */
    if (typeof window !== 'undefined') {
      try {
        window.indexedDB.deleteDatabase('ZenithOS')
      } catch {
        /* Ignore — the navigation below will still clear session state */
      }
      window.location.replace('/')
    }
  }

  /* ── Render ──────────────────────────────────────────────────── */

  render() {
    if (!this.state.hasError) return this.props.children

    const { attempts, error } = this.state
    const escalated           = attempts >= 2

    return (
      <div className={styles.overlay} role="alert" aria-live="assertive">
        <div className={styles.card}>

          {/* Ambient pulse dot — mirrors StudyLayoutContainer title dot */}
          <span className={styles.pulseDot} aria-hidden="true" />

          {/* Header */}
          <p className={styles.eyebrow}>System Fault Isolated</p>
          <h1 className={styles.title}>Module Crash Detected</h1>
          <p className={styles.body}>
            {this.props.moduleLabel
              ? `The "${this.props.moduleLabel}" module encountered an unexpected error.`
              : 'A downstream component encountered an unexpected error.'}{' '}
            Your locally stored data is intact.
          </p>

          {/* Recovery actions */}
          {!escalated ? (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={this.reinitialize}
            >
              Reinitialize OS Engine
            </button>
          ) : (
            <>
              <p className={styles.escalationNotice}>
                Recovery failed after {attempts} attempts — a full state flush is required.
              </p>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={this.flushAndRestart}
              >
                Flush State &amp; Restart
              </button>
            </>
          )}

          {/* Dev-only stack trace panel */}
          {process.env.NODE_ENV !== 'production' && error && (
            <details className={styles.devDetails}>
              <summary>Developer trace</summary>
              <pre className={styles.devPre}>{error.message}</pre>
              {this.state.errorInfo?.componentStack && (
                <pre className={styles.devPre}>
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </details>
          )}

        </div>
      </div>
    )
  }
}
