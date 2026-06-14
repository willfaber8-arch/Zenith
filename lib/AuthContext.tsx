'use client'

/* ════════════════════════════════════════════════════════════
   AuthContext
   Dual-mode authentication:
     • Supabase Auth (email + password) when NEXT_PUBLIC_SUPABASE_URL
       and NEXT_PUBLIC_SUPABASE_ANON_KEY are configured. The sync
       engine reads the Supabase session to push data to the cloud.
     • Local-only mock (localStorage) when Supabase is not configured —
       no data leaves the device.
   ════════════════════════════════════════════════════════════ */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'

/* ── Types ─────────────────────────────────────────────────── */

export interface UserSession {
  userHandle:   string
  sessionToken: string
  timestamp:    number
  email?:       string
}

interface AuthState {
  session:  UserSession | null
  isReady:  boolean
  /** Sign in with email + password (Supabase) or just a name (local). */
  signIn:   (emailOrName: string, password?: string) => Promise<{ error: string | null }>
  /** Create a new Supabase account. No-op in local-only mode. */
  signUp:   (email: string, password: string, displayName: string) => Promise<{ error: string | null }>
  signOut:  () => void
}

const LOCAL_STORAGE_KEY = 'zenith_session_active'

const AuthContext = createContext<AuthState>({
  session:  null,
  isReady:  false,
  signIn:   async () => ({ error: null }),
  signUp:   async () => ({ error: null }),
  signOut:  () => {},
})

/* ── Helper: Supabase Session → UserSession ─────────────────── */

function sbSessionToUserSession(sbSession: Session): UserSession {
  const displayName =
    (sbSession.user.user_metadata?.display_name as string | undefined) ||
    sbSession.user.email?.split('@')[0] ||
    'Zenith User'
  return {
    userHandle:   displayName,
    sessionToken: sbSession.access_token,
    timestamp:    Date.now(),
    email:        sbSession.user.email,
  }
}

/* ── Provider ───────────────────────────────────────────────── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      /* ── Local-only mode: rehydrate from localStorage ── */
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as UserSession
          if (parsed?.userHandle && parsed?.sessionToken) setSession(parsed)
        }
      } catch {
        localStorage.removeItem(LOCAL_STORAGE_KEY)
      }
      setIsReady(true)
      return
    }

    /* ── Supabase mode: load existing session then subscribe ── */
    const supabase = getSupabaseClient()!

    supabase.auth.getSession().then(({ data: { session: sbSession } }) => {
      if (sbSession) setSession(sbSessionToUserSession(sbSession))
      setIsReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, sbSession) => {
        setSession(sbSession ? sbSessionToUserSession(sbSession) : null)
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  /* ── signIn ─────────────────────────────────────────────── */

  const signIn = useCallback(
    async (emailOrName: string, password?: string): Promise<{ error: string | null }> => {
      if (!isSupabaseConfigured || !password) {
        // Local-only: create a pseudo-session
        const sess: UserSession = {
          userHandle:   emailOrName.trim() || 'Zenith User',
          sessionToken: `mock_jwt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          timestamp:    Date.now(),
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sess))
        setSession(sess)
        return { error: null }
      }

      const supabase = getSupabaseClient()!
      const { error } = await supabase.auth.signInWithPassword({
        email:    emailOrName,
        password,
      })
      // onAuthStateChange handles setSession on success
      return { error: error?.message ?? null }
    },
    [],
  )

  /* ── signUp ─────────────────────────────────────────────── */

  const signUp = useCallback(
    async (email: string, password: string, displayName: string): Promise<{ error: string | null }> => {
      if (!isSupabaseConfigured) return { error: 'Supabase not configured.' }

      const supabase = getSupabaseClient()!
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() || email.split('@')[0] },
        },
      })
      return { error: error?.message ?? null }
    },
    [],
  )

  /* ── signOut ────────────────────────────────────────────── */

  const signOut = useCallback(() => {
    if (!isSupabaseConfigured) {
      localStorage.removeItem(LOCAL_STORAGE_KEY)
      setSession(null)
      return
    }
    // Fire-and-forget; onAuthStateChange clears session state
    getSupabaseClient()?.auth.signOut().catch(() => {})
  }, [])

  return (
    <AuthContext.Provider value={{ session, isReady, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
