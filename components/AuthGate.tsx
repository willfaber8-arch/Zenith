'use client'

/* ════════════════════════════════════════════════════════════
   AuthGate
   Full-viewport login overlay with two modes:
     • Supabase Auth  — email + password when env vars are set.
     • Local-only     — workspace handle when Supabase is absent.
   ════════════════════════════════════════════════════════════ */

import { useState, type FormEvent } from 'react'
import { useAuth }               from '@/lib/AuthContext'
import { useToast }              from '@/lib/ToastContext'
import { isSupabaseConfigured }  from '@/lib/supabase'
import styles                    from './AuthGate.module.css'

/* ── Spinner ─────────────────────────────────────────────── */
function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />
}

/* ── Envelope icon for check-email state ────────────────── */
function EnvelopeIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 7l10 7 10-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════
   SUPABASE AUTH FORM
   Shows when NEXT_PUBLIC_SUPABASE_URL + ANON_KEY are set.
   ══════════════════════════════════════════════════════════ */

type SbMode = 'signin' | 'signup'

interface SupabaseAuthFormProps {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>
}

function SupabaseAuthForm({ signIn, signUp }: SupabaseAuthFormProps) {
  const { toast } = useToast()

  const [mode,        setMode]        = useState<SbMode>('signin')
  const [displayName, setDisplayName] = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [checkEmail,  setCheckEmail]  = useState(false)  // post-sign-up awaiting confirmation

  const clearError = () => { if (error) setError('') }

  const switchMode = (next: SbMode) => {
    setMode(next)
    setError('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const trimEmail = email.trim()
    const trimPass  = password

    if (!trimEmail) { setError('Email is required.'); return }
    if (!trimPass)  { setError('Password is required.'); return }

    if (mode === 'signup') {
      if (trimPass.length < 6) { setError('Password must be at least 6 characters.'); return }
      setLoading(true)
      const { error: err } = await signUp(trimEmail, trimPass, displayName)
      setLoading(false)
      if (err) { setError(err); return }
      setCheckEmail(true)
      return
    }

    // Sign in
    setLoading(true)
    const { error: err } = await signIn(trimEmail, trimPass)
    setLoading(false)
    if (err) {
      setError(err.includes('Invalid login') ? 'Invalid email or password.' : err)
      return
    }
    toast(`Welcome back — workspace ready.`, 'success')
  }

  if (checkEmail) {
    return (
      <div className={styles.overlay} aria-label="Check your email">
        <div className={styles.card}>
          <div className={styles.badge}>
            <div className={styles.logoMark} aria-hidden="true">Z</div>
            <div className={styles.logoTextGroup}>
              <span className={styles.logoTitle}>Zenith OS</span>
              <span className={styles.logoTag}>Personal Command Centre</span>
            </div>
          </div>

          <div className={styles.checkEmailState}>
            <div className={styles.checkEmailIcon}>
              <EnvelopeIcon />
            </div>
            <p className={styles.checkEmailTitle}>Check your inbox</p>
            <p className={styles.checkEmailDesc}>
              We sent a confirmation link to <strong>{email}</strong>. Click it
              to activate your account, then come back to sign in.
            </p>
          </div>

          <button
            type="button"
            className={styles.tabLink}
            onClick={() => { setCheckEmail(false); setMode('signin') }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay} aria-label="Authentication required">
      <div className={styles.card} role="main">

        {/* ── App badge ──────────────────────────────────── */}
        <div className={styles.badge}>
          <div className={styles.logoMark} aria-hidden="true">Z</div>
          <div className={styles.logoTextGroup}>
            <span className={styles.logoTitle}>Zenith OS</span>
            <span className={styles.logoTag}>Personal Command Centre</span>
          </div>
        </div>

        {/* ── Mode tabs ──────────────────────────────────── */}
        <div className={styles.tabBar} role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'signin'}
            className={`${styles.tab} ${mode === 'signin' ? styles.tabActive : ''}`}
            onClick={() => switchMode('signin')}
            type="button"
          >
            Sign In
          </button>
          <button
            role="tab"
            aria-selected={mode === 'signup'}
            className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
            onClick={() => switchMode('signup')}
            type="button"
          >
            Create Account
          </button>
        </div>

        {/* ── Form ───────────────────────────────────────── */}
        <form className={styles.localForm} onSubmit={handleSubmit} noValidate>

          {/* Display name — sign-up only */}
          {mode === 'signup' && (
            <div className={styles.fieldGroup}>
              <label className={styles.inputLabel} htmlFor="display-name">
                Display Name
              </label>
              <input
                id="display-name"
                className={styles.input}
                type="text"
                placeholder="What should we call you?"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); clearError() }}
                autoComplete="name"
                maxLength={40}
              />
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.inputLabel} htmlFor="auth-email">
              Email Address
            </label>
            <input
              id="auth-email"
              className={`${styles.input} ${error ? styles.inputInvalid : ''}`}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); clearError() }}
              autoComplete={mode === 'signup' ? 'email' : 'username'}
              autoFocus
              spellCheck={false}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.inputLabel} htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              className={`${styles.input} ${error ? styles.inputInvalid : ''}`}
              type="password"
              placeholder={mode === 'signup' ? 'Minimum 6 characters' : '••••••••'}
              value={password}
              onChange={e => { setPassword(e.target.value); clearError() }}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <p className={styles.inputErr} role="alert">{error}</p>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
            aria-busy={loading}
          >
            {loading
              ? <><Spinner /> {mode === 'signup' ? 'Creating account…' : 'Signing in…'}</>
              : mode === 'signup' ? 'Create Account' : 'Sign In'
            }
          </button>
        </form>

        <p className={styles.footerNote}>
          {mode === 'signin'
            ? <>No account? <button type="button" className={styles.tabLink} onClick={() => switchMode('signup')}>Create one</button></>
            : <>Already have an account? <button type="button" className={styles.tabLink} onClick={() => switchMode('signin')}>Sign in</button></>
          }
        </p>

      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   LOCAL-ONLY AUTH FORM
   Shows when Supabase is not configured.
   Kept intact so the app is usable without a Supabase project.
   ══════════════════════════════════════════════════════════ */

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

interface LocalAuthFormProps {
  signIn: (name: string) => Promise<{ error: string | null }>
}

function LocalAuthForm({ signIn }: LocalAuthFormProps) {
  const { toast } = useToast()

  const [handle,   setHandle]   = useState('')
  const [inputErr, setInputErr] = useState('')
  const [gStep,    setGStep]    = useState(false)
  const [gName,    setGName]    = useState('')
  const [gErr,     setGErr]     = useState('')
  const [gLoading, setGLoading] = useState(false)

  const handleGoogleContinue = async (e?: FormEvent) => {
    e?.preventDefault()
    const name = gName.trim()
    if (!name) { setGErr('Enter the name on your account.'); return }
    setGLoading(true)
    await new Promise<void>(r => setTimeout(r, 700))
    await signIn(name)
    toast(`Signed in — welcome, ${name}.`, 'success')
    setGLoading(false)
  }

  const handleLocal = async (e?: FormEvent) => {
    e?.preventDefault()
    const trimmed = handle.trim()
    if (!trimmed) { setInputErr('Please enter a workspace handle.'); return }
    await signIn(trimmed)
    toast(`Workspace initialized — welcome, ${trimmed}.`, 'success')
  }

  return (
    <div className={styles.overlay} aria-label="Authentication required">
      <div className={styles.card} role="main">

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

        {!gStep ? (
          <button type="button" className={styles.googleBtn} onClick={() => setGStep(true)}>
            <GoogleIcon />
            <span>Sign in with Google</span>
          </button>
        ) : (
          <form className={styles.localForm} onSubmit={handleGoogleContinue} noValidate>
            <label className={styles.inputLabel} htmlFor="google-name">Choose your account</label>
            <input
              id="google-name"
              className={`${styles.input} ${gErr ? styles.inputInvalid : ''}`}
              type="text"
              placeholder="Name on your Google account"
              value={gName}
              onChange={e => { setGName(e.target.value); setGErr('') }}
              autoFocus
              autoComplete="name"
              maxLength={40}
            />
            {gErr && <p className={styles.inputErr} role="alert">{gErr}</p>}
            <button type="submit" className={styles.googleBtn} disabled={gLoading} aria-busy={gLoading}>
              {gLoading ? <Spinner /> : <GoogleIcon />}
              <span>{gLoading ? 'Connecting…' : 'Continue with Google'}</span>
            </button>
          </form>
        )}

        <div className={styles.orRow} aria-hidden="true">
          <span className={styles.orLine} />
          <span className={styles.orLabel}>or</span>
          <span className={styles.orLine} />
        </div>

        <form className={styles.localForm} onSubmit={handleLocal} noValidate>
          <label className={styles.inputLabel} htmlFor="workspace-handle">Workspace Handle</label>
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
          {inputErr && <p className={styles.inputErr} role="alert">{inputErr}</p>}
          <button type="submit" className={styles.submitBtn}>Initialize Workspace</button>
        </form>

        <p className={styles.footerNote}>Session stored locally · No data leaves your device</p>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   ROOT — picks which form to render
   ══════════════════════════════════════════════════════════ */

export default function AuthGate() {
  const { signIn, signUp } = useAuth()

  if (isSupabaseConfigured) {
    return (
      <SupabaseAuthForm
        signIn={(email, password) => signIn(email, password)}
        signUp={signUp}
      />
    )
  }

  return <LocalAuthForm signIn={(name) => signIn(name)} />
}
