'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — useMicrosoftCalendar
 *
 * Thin React binding over lib/microsoftCalendar.ts. Tracks the signed-in
 * Microsoft account across mount and exposes connect / disconnect / push
 * actions. Every path is browser-guarded and degrades gracefully when
 * NEXT_PUBLIC_MS_CLIENT_ID is absent (`configured === false`).
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react'
import {
  isMicrosoftConfigured,
  signInMicrosoft,
  signOutMicrosoft,
  getMicrosoftAccount,
  pushEventToMicrosoft,
  type ExternalCalendarEvent,
} from '@/lib/microsoftCalendar'

export type MicrosoftStatus =
  | 'idle'        // configured but no session
  | 'connecting'  // sign-in popup in flight
  | 'connected'   // signed in
  | 'pushing'     // Graph write in flight
  | 'error'       // last action failed

export interface UseMicrosoftCalendar {
  configured: boolean
  account:    { username: string } | null
  connecting: boolean
  status:     MicrosoftStatus
  connect:    () => Promise<void>
  disconnect: () => Promise<void>
  pushEvent:  (event: ExternalCalendarEvent) => Promise<void>
}

export function useMicrosoftCalendar(): UseMicrosoftCalendar {
  const [account, setAccount] = useState<{ username: string } | null>(null)
  const [status,  setStatus]  = useState<MicrosoftStatus>('idle')

  /* Restore any existing session on mount. */
  useEffect(() => {
    if (!isMicrosoftConfigured || typeof window === 'undefined') return
    let cancelled = false
    void getMicrosoftAccount().then(acct => {
      if (cancelled) return
      setAccount(acct)
      setStatus(acct ? 'connected' : 'idle')
    })
    return () => { cancelled = true }
  }, [])

  const connect = useCallback(async () => {
    if (!isMicrosoftConfigured) return
    setStatus('connecting')
    try {
      const acct = await signInMicrosoft()
      setAccount(acct)
      setStatus('connected')
    } catch (err) {
      setStatus('error')
      throw err
    }
  }, [])

  const disconnect = useCallback(async () => {
    if (!isMicrosoftConfigured) return
    try {
      await signOutMicrosoft()
    } finally {
      setAccount(null)
      setStatus('idle')
    }
  }, [])

  const pushEvent = useCallback(async (event: ExternalCalendarEvent) => {
    if (!isMicrosoftConfigured) {
      throw new Error(
        'Direct Microsoft sync is not configured. Use "Add to Outlook Calendar" instead.',
      )
    }
    setStatus('pushing')
    try {
      await pushEventToMicrosoft(event)
      // Re-read the account — a first push may have created the session.
      const acct = await getMicrosoftAccount()
      setAccount(acct)
      setStatus(acct ? 'connected' : 'idle')
    } catch (err) {
      setStatus('error')
      throw err
    }
  }, [])

  return {
    configured: isMicrosoftConfigured,
    account,
    connecting: status === 'connecting',
    status,
    connect,
    disconnect,
    pushEvent,
  }
}
