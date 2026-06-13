/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — useLetterbox
 * Phase 9 · Step 9.2 — React Interface for the Letterbox Broker
 *
 * Provides all the reactive state and stable action callbacks needed
 * to render a letterbox inbox and compose encrypted outbound messages.
 *
 * Usage (e.g. in FriendsNetworkView / SocialLeaderboard):
 *
 *   const {
 *     messages,       // PeerMessage[] — live-queried from IDB, newest first
 *     unreadCount,    // number — badge count for UI
 *     isDraining,     // boolean — spinner state during "Check Cloud Mailbox"
 *     lastDrainAt,    // number | null — Unix ms of last successful drain
 *     drainError,     // string | null — surface to toast on failure
 *     drain,          // () => void — "Check Cloud Mailbox" button handler
 *     send,           // (opts) => Promise<void> — compose + deliver
 *     markRead,       // (id: number) => Promise<void>
 *     deleteMessage,  // (id: number) => Promise<void>
 *     publicKeyString,// string | null — local public key to share with peers
 *   } = useLetterbox(localPeerId)
 *
 * ════════════════════════════════════════════════════════════════
 */

'use client'

import { useState, useEffect, useCallback, useRef }  from 'react'
import { useLiveQuery }                               from 'dexie-react-hooks'
import { db }                                         from '@/lib/db'
import type { PeerMessage }                           from '@/lib/db'
import {
  ensureLetterboxKeypair,
  getLocalPublicKeyString,
  drainCloudMailbox,
  sendLetterboxMessage,
  markMessageRead,
  deleteLocalMessage,
  type SendLetterboxOptions,
  type DrainResult,
}                                                     from '@/services/letterboxBroker'

export type { PeerMessage }

export interface UseLetterboxReturn {
  /** All locally-stored messages, newest first */
  messages:        PeerMessage[]
  /** Count of isRead=0 messages — suitable for a nav badge */
  unreadCount:     number
  /** True while a Supabase drain RPC is in-flight */
  isDraining:      boolean
  /** Unix ms of the most recent successful drain (null before first drain) */
  lastDrainAt:     number | null
  /** Error string from the most recent drain attempt, or null */
  drainError:      string | null
  /** Trigger a manual drain — wire to the "[ Check Cloud Mailbox ]" button */
  drain:           () => void
  /** Compose and deliver an encrypted outbound letterbox message */
  send:            (opts: SendLetterboxOptions) => Promise<void>
  /** Mark a message as read in local IDB */
  markRead:        (id: number) => Promise<void>
  /** Permanently delete a message from local IDB */
  deleteMessage:   (id: number) => Promise<void>
  /** Local user's RSA public key as a JSON string — share with peers over WebRTC */
  publicKeyString: string | null
  /** True while keypair is being generated for the first time */
  isKeypairReady:  boolean
}

/**
 * @param localPeerId  The current session's WebRTC peer ID. Pass null when
 *                     the peer connection has not yet initialised — the hook
 *                     degrades gracefully (drain is a no-op).
 */
export function useLetterbox(localPeerId: string | null): UseLetterboxReturn {

  /* ── Live IDB queries ──────────────────────────────────────────── */

  const messages: PeerMessage[] = useLiveQuery(
    () => db.peer_messages.orderBy('receivedAt').reverse().toArray(),
    [],
  ) ?? []

  const unreadCount: number = useLiveQuery(
    () => db.peer_messages.where('isRead').equals(0).count(),
    [],
  ) ?? 0

  /* ── Local state ───────────────────────────────────────────────── */

  const [isDraining,      setIsDraining]      = useState(false)
  const [lastDrainAt,     setLastDrainAt]      = useState<number | null>(null)
  const [drainError,      setDrainError]       = useState<string | null>(null)
  const [publicKeyString, setPublicKeyString]  = useState<string | null>(null)
  const [isKeypairReady,  setIsKeypairReady]   = useState(false)

  // Prevent state updates after unmount
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  /* ── Keypair bootstrap ─────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        await ensureLetterboxKeypair()
        const pubKey = await getLocalPublicKeyString()
        if (!cancelled && isMountedRef.current) {
          setPublicKeyString(pubKey)
          setIsKeypairReady(true)
        }
      } catch {
        // Non-fatal — Web Crypto unavailable or IDB error
        if (!cancelled && isMountedRef.current) {
          setIsKeypairReady(false)
        }
      }
    }
    void bootstrap()
    return () => { cancelled = true }
  }, [])

  /* ── Manual drain ──────────────────────────────────────────────── */

  const drain = useCallback(() => {
    if (!localPeerId || isDraining) return

    setIsDraining(true)
    setDrainError(null)

    drainCloudMailbox(localPeerId)
      .then((result: DrainResult) => {
        if (!isMountedRef.current) return
        setLastDrainAt(Date.now())
        if (result.errors.length > 0 && result.consumed === 0) {
          setDrainError(result.errors[0])
        }
      })
      .catch((err: unknown) => {
        if (!isMountedRef.current) return
        const msg = err instanceof Error ? err.message : 'Drain failed'
        setDrainError(msg)
      })
      .finally(() => {
        if (isMountedRef.current) setIsDraining(false)
      })
  }, [localPeerId, isDraining])

  /* ── Stable action callbacks ───────────────────────────────────── */

  const send = useCallback(async (opts: SendLetterboxOptions): Promise<void> => {
    await sendLetterboxMessage(opts)
  }, [])

  const markRead = useCallback(async (id: number): Promise<void> => {
    await markMessageRead(id)
  }, [])

  const deleteMessage = useCallback(async (id: number): Promise<void> => {
    await deleteLocalMessage(id)
  }, [])

  return {
    messages,
    unreadCount,
    isDraining,
    lastDrainAt,
    drainError,
    drain,
    send,
    markRead,
    deleteMessage,
    publicKeyString,
    isKeypairReady,
  }
}
