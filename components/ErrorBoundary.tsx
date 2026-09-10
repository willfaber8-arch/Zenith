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
 *   2nd crash  → offers a backup download, then an armed "Delete my local
 *                data" that says what it deletes and asks before doing it
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
  /** The destructive button asks before it acts; this is the armed state. */
  armed:     boolean
  /** 'idle' | 'working' | 'done' | 'failed' for the backup download */
  backup:    'idle' | 'working' | 'done' | 'failed'
}

/* ── Class component ───────────────────────────────────────────── */

export default class ErrorBoundary extends Component<Props, State> {

  state: State = {
    hasError:  false,
    error:     null,
    errorInfo: null,
    attempts:  0,
    armed:     false,
    backup:    'idle',
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

  /*
   * Offered before the destructive button, because the thing most likely
   * to be worth saving is the thing this screen is about to delete. The
   * export runs against a database that has just crashed the app, so it
   * is allowed to fail — and says so rather than pretending it worked.
   */
  private downloadBackup = async () => {
    this.setState({ backup: 'working' })
    try {
      const { exportLocalDatabaseToJson } = await import('@/utils/dbExporter')
      await exportLocalDatabaseToJson()
      this.setState({ backup: 'done' })
    } catch {
      this.setState({ backup: 'failed' })
    }
  }

  private flushAndRestart = () => {
    /* Deletes every note, task, habit and calendar entry held locally.
       Only reachable from the armed state, after the second crash, with
       a backup offered first — see the button below.                    */
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

    const { attempts, error, armed, backup } = this.state
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
            {escalated
              ? 'Your locally stored data has not been touched.'
              : 'Your locally stored data is intact.'}
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
                Recovery failed after {attempts} attempts. A crash this
                persistent is usually a single unreadable row, and deleting
                the local database clears it — along with every note, task,
                habit and calendar entry stored on this device. There is no
                undo, so take a copy first.
              </p>

              <button
                type="button"
                className={styles.primaryBtn}
                onClick={this.downloadBackup}
                disabled={backup === 'working'}
              >
                {backup === 'working' ? 'Saving a copy…'
                  : backup === 'done'   ? 'Saved — download it again'
                  : backup === 'failed' ? 'Could not save a copy — try again'
                  : 'Download a backup first'}
              </button>

              {backup === 'failed' && (
                <p className={styles.escalationNotice}>
                  The export failed, which can happen when the database is
                  the thing that is broken. Deleting it now would lose that
                  data for good.
                </p>
              )}

              {/*
                Two presses, deliberately. The first only changes the label,
                so the press that actually deletes is one the reader has
                seen the consequence of.
              */}
              {!armed ? (
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={() => this.setState({ armed: true })}
                >
                  Delete my local data
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    onClick={this.flushAndRestart}
                  >
                    Delete everything permanently
                  </button>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => this.setState({ armed: false })}
                  >
                    Keep my data
                  </button>
                </>
              )}
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
