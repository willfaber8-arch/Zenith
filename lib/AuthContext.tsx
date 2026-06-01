'use client'

/* ════════════════════════════════════════════════════════════
   AuthContext — Phase 0 · Step 0.5
   Session persistence via localStorage.
   Key: zenith_session_active  (stringified UserSession object)
   ════════════════════════════════════════════════════════════ */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface UserSession {
  userHandle:   string
  sessionToken: string   // mock JWT — replace with real token in production
  timestamp:    number
}

interface AuthState {
  session:  UserSession | null
  /** true after the initial localStorage check has completed */
  isReady:  boolean
  signIn:   (name: string) => void
  signOut:  () => void
}

const STORAGE_KEY = 'zenith_session_active'

const AuthContext = createContext<AuthState>({
  session:  null,
  isReady:  false,
  signIn:   () => {},
  signOut:  () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,  setSession]  = useState<UserSession | null>(null)
  const [isReady,  setIsReady]  = useState(false)

  /* Rehydrate on mount — runs only in the browser */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as UserSession
        if (parsed?.userHandle && parsed?.sessionToken) {
          setSession(parsed)
        }
      }
    } catch {
      // Corrupted entry — ignore and stay logged out
      localStorage.removeItem(STORAGE_KEY)
    }
    setIsReady(true)
  }, [])

  const signIn = (name: string) => {
    const sess: UserSession = {
      userHandle:   name.trim() || 'Zenith User',
      /* Pseudo-unique token — not cryptographically secure */
      sessionToken: `mock_jwt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp:    Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sess))
    setSession(sess)
  }

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, isReady, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
