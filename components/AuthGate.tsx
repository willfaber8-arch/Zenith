'use client'

/* ════════════════════════════════════════════════════════════
   AuthGate — Phase 0 · Step 0.5
   Full-viewport login overlay. Inherits the ambient cosmos
   backdrop — overlay itself is transparent, only the card
   has a surface background.
   ════════════════════════════════════════════════════════════ */

import { useState, type FormEvent } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useToast } from '@/lib/ToastContext'
import styles from './AuthGate.module.css'

/* ── Google G SVG — official multi-colour mark ──────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

/* ── Spinner ─────────────────────────────────────────────── */
function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />
}

/* ── AuthGate ────────────────────────────────────────────── */
export default function AuthGate() {
  const { signIn }  = useAuth()
  const { toast }   = useToast()

  const [handle,    setHandle]    = useState('')
  const [inputErr,  setInputErr]  = useState('')
  const [gLoading,  setGLoading]  = useState(false)
  const [gStep,     setGStep]     = useState(false)   // Google "choose account" step
  const [gName,     setGName]     = useState('')
  const [gErr,      setGErr]      = useState('')

  /* ── Mock Google OAuth ───────────────────────────────────
   * This is a local-first app with no real OAuth backend, so clicking
   * the Google button reveals an inline "choose account" step. The
   * session is created with the actual person's name — never a
   * hardcoded value — so the dashboard greets the real signed-in user. */
  const handleGoogleClick = () => {
    if (gLoading) return
    setGStep(true)
  }

  const handleGoogleContinue = async (e?: FormEvent) => {
    e?.preventDefault()
    const name = gName.trim()
    if (!name) { setGErr('Enter the name on your account.'); return }
    setGLoading(true)
    // Simulate network round-trip
    await new Promise<void>(r => setTimeout(r, 700))
    signIn(name)
    toast(`Signed in via Google — welcome, ${name}.`, 'success')
    setGLoading(false)
  }

  /* ── Local workspace handle ──────────────────────────── */
  const handleLocal = (e?: FormEvent) => {
    e?.preventDefault()
    const trimmed = handle.trim()
    if (!trimmed) { setInputErr('Please enter a workspace handle.'); return }
    signIn(trimmed)
    toast(`Workspace initialized — welcome, ${trimmed}.`, 'success')
  }

  return (
    <div className={styles.overlay} aria-label="Authentication required">
      <div className={styles.card} role="main">

        {/* ── App badge ─────────────────────────────────── */}
        <div className={styles.badge}>
          <div className={styles.logoMark} aria-hidden="true">Z</div>
          <div className={styles.logoTextGroup}>
            <span className={styles.logoTitle}>Zenith OS</span>
            <span className={styles.logoTag}>Personal Command Centre</span>
          </div>
        </div>

        <p className={styles.tagline}>
          Your minimalist academic dashboard — sign in to begin.
        </p>

        <div className={styles.divider} />

        {/* ── Google sign-in ────────────────────────────── */}
        {!gStep ? (
          <button
            type="button"
            className={styles.googleBtn}
            onClick={handleGoogleClick}
          >
            <GoogleIcon />
            <span>Sign in with Google</span>
          </button>
        ) : (
          <form className={styles.localForm} onSubmit={handleGoogleContinue} noValidate>
            <label className={styles.inputLabel} htmlFor="google-name">
              Choose your account
            </label>
            <input
              id="google-name"
              className={`${styles.input} ${gErr ? styles.inputInvalid : ''}`}
              type="text"
              placeholder="Name on your Google account"
              value={gName}
              onChange={e => { setGName(e.target.value); setGErr('') }}
              autoFocus
              autoComplete="name"
              spellCheck={false}
              maxLength={40}
            />
            {gErr && <p className={styles.inputErr} role="alert">{gErr}</p>}
            <button
              type="submit"
              className={styles.googleBtn}
              disabled={gLoading}
              aria-busy={gLoading}
            >
              {gLoading ? <Spinner /> : <GoogleIcon />}
              <span>{gLoading ? 'Connecting to Google…' : 'Continue with Google'}</span>
            </button>
          </form>
        )}

        {/* ── Divider row ───────────────────────────────── */}
        <div className={styles.orRow} aria-hidden="true">
          <span className={styles.orLine} />
          <span className={styles.orLabel}>or</span>
          <span className={styles.orLine} />
        </div>

        {/* ── Local handle form ─────────────────────────── */}
        <form className={styles.localForm} onSubmit={handleLocal} noValidate>
          <label className={styles.inputLabel} htmlFor="workspace-handle">
            Workspace Handle
          </label>
          <input
            id="workspace-handle"
            className={`${styles.input} ${inputErr ? styles.inputInvalid : ''}`}
            type="text"
            placeholder="e.g. alex, river, 0x1f…"
            value={handle}
            onChange={e => { setHandle(e.target.value); setInputErr('') }}
            autoComplete="off"
            spellCheck={false}
            maxLength={32}
          />
          {inputErr && (
            <p className={styles.inputErr} role="alert">{inputErr}</p>
          )}
          <button type="submit" className={styles.submitBtn}>
            Initialize Workspace
          </button>
        </form>

        {/* ── Footer note ───────────────────────────────── */}
        <p className={styles.footerNote}>
          Session stored locally · No data leaves your device
        </p>

      </div>
    </div>
  )
}
