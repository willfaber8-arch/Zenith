/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Cloud Letterbox Broker
 * Phase 9 · Step 9.2 — Async Encrypted Message Relay Service
 *
 * Responsibilities:
 *   1. Keypair bootstrap — generates and persists an RSA-OAEP keypair
 *      into db.userProfile on first call (idempotent on subsequent calls).
 *   2. Mailbox drain — queries Supabase via the claim_letterbox_messages()
 *      RPC, decrypts each row client-side, writes to db.peer_messages,
 *      and relies on the RPC's atomic hard-delete for zero cloud retention.
 *   3. Background polling — sets up a 12-hour setInterval so the drain
 *      runs automatically whenever Zenith is open.
 *   4. Manual trigger — exposes drainCloudMailbox() for the UI "Check
 *      Cloud Mailbox" button.
 *   5. Outbound delivery — encryptLetterboxMessage + Supabase INSERT.
 *
 * SSR safety:
 *   All functions guard for window === undefined and return early.
 *   Import this module only inside useEffect or event handlers.
 * ════════════════════════════════════════════════════════════════
 */

import { getDb, addRelationshipNote } from '@/lib/db'
import { getSupabaseClient }          from '@/lib/supabase'
import {
  generateLetterboxKeypair,
  encryptLetterboxMessage,
  decryptLetterboxMessage,
} from '@/utils/cryptoLetterbox'

/* ── Constants ─────────────────────────────────────────────────── */

/** Drain interval: twice per day when the app is open */
const POLL_INTERVAL_MS = 12 * 60 * 60 * 1_000   // 12 hours

/* ── Module state (one broker per browser session) ─────────────── */

let _pollTimer:       ReturnType<typeof setInterval> | null = null
let _isBrokerActive:  boolean = false

/* ── Type for a cloud_letterbox row returned by the RPC ─────────── */

interface LetterboxCloudRow {
  id:                  string
  sender_display_name: string
  encrypted_payload:   string
  created_at:          string
}

/* ══════════════════════════════════════════════════════════════════
   1.  KEYPAIR BOOTSTRAP
   ══════════════════════════════════════════════════════════════════ */

/**
 * Ensures the local user has an RSA-OAEP letterbox keypair stored in
 * db.userProfile. Generates a fresh keypair on first call; subsequent
 * calls return the persisted pair without any DB write.
 *
 * Returns the keypair as parsed JsonWebKey objects ready for use with
 * the crypto engine.
 */
export async function ensureLetterboxKeypair(): Promise<{
  publicKeyJwk:  JsonWebKey
  privateKeyJwk: JsonWebKey
}> {
  if (typeof window === 'undefined') {
    throw new Error('[LetterboxBroker] ensureLetterboxKeypair() called outside browser context.')
  }

  const db      = getDb()
  const profile = await db.userProfile.get(1)

  if (profile?.letterboxPublicKeyJwk && profile?.letterboxPrivateKeyJwk) {
    return {
      publicKeyJwk:  JSON.parse(profile.letterboxPublicKeyJwk)  as JsonWebKey,
      privateKeyJwk: JSON.parse(profile.letterboxPrivateKeyJwk) as JsonWebKey,
    }
  }

  // Generate a fresh 2048-bit RSA-OAEP keypair
  const keypair = await generateLetterboxKeypair()

  await db.userProfile.update(1, {
    letterboxPublicKeyJwk:  JSON.stringify(keypair.publicKeyJwk),
    letterboxPrivateKeyJwk: JSON.stringify(keypair.privateKeyJwk),
  })

  return keypair
}

/**
 * Returns the local user's public key JWK as a compact JSON string,
 * ready to be broadcast over the WebRTC sync channel so peers can
 * send encrypted letterbox messages.
 *
 * Returns null if no keypair exists yet (call ensureLetterboxKeypair first).
 */
export async function getLocalPublicKeyString(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const db      = getDb()
  const profile = await db.userProfile.get(1)
  return profile?.letterboxPublicKeyJwk ?? null
}

/* ══════════════════════════════════════════════════════════════════
   2.  MAILBOX DRAIN  (retrieve → decrypt → store → cloud-delete)
   ══════════════════════════════════════════════════════════════════ */

export interface DrainResult {
  consumed: number   // messages successfully decrypted + stored locally
  skipped:  number   // rows that failed decryption (wrong key / corrupted)
  errors:   string[] // one error string per skipped row
}

/**
 * Queries Supabase for all letterbox messages addressed to localPeerId,
 * decrypts each one client-side, writes the plaintext to db.peer_messages,
 * and relies on the RPC's atomic hard-delete for zero cloud retention.
 *
 * The cloud row is already deleted by the RPC before this function returns —
 * no additional DELETE call is needed.
 *
 * @param localPeerId  The current user's WebRTC peer ID (PeerJS-assigned)
 * @returns            DrainResult summary
 */
export async function drainCloudMailbox(localPeerId: string): Promise<DrainResult> {
  const result: DrainResult = { consumed: 0, skipped: 0, errors: [] }

  if (typeof window === 'undefined') return result

  const supabase = getSupabaseClient()
  if (!supabase) return result   // Supabase not configured — degrade gracefully

  const db      = getDb()
  const profile = await db.userProfile.get(1)

  if (!profile?.letterboxPrivateKeyJwk) {
    result.errors.push('No private key found — run ensureLetterboxKeypair() first.')
    return result
  }

  const privateKeyJwk: JsonWebKey = JSON.parse(profile.letterboxPrivateKeyJwk)

  // ── Call the atomic claim-and-consume RPC ──────────────────────────────
  // The RPC locks rows for this peer, returns them, then hard-deletes them
  // inside a single Postgres transaction. No row survives after this call.
  const { data: rows, error } = await supabase.rpc('claim_letterbox_messages', {
    p_peer_id: localPeerId,
  }) as { data: LetterboxCloudRow[] | null; error: { message: string } | null }

  if (error) {
    result.errors.push(`RPC error: ${error.message}`)
    return result
  }

  if (!rows || rows.length === 0) return result

  // ── Decrypt each claimed row and write to local IDB ───────────────────
  for (const row of rows) {
    try {
      const decryptedContent = await decryptLetterboxMessage(
        row.encrypted_payload,
        privateKeyJwk,
      )

      const receivedAt = Date.now()

      // Write full audit record to peer_messages (retains encrypted payload)
      await db.peer_messages.add({
        senderDisplayName: row.sender_display_name || 'Unknown',
        decryptedContent,
        encryptedPayload:  row.encrypted_payload,
        receivedAt,
        isRead:            0,
      })

      // Write display-ready record to relationship_notes so the dashboard
      // widget picks up the change instantly via its useLiveQuery subscription
      await addRelationshipNote({
        senderDisplayName: row.sender_display_name || 'Unknown',
        messageText:       decryptedContent,
        timestamp:         receivedAt,
        isRead:            false,
        source:            'letterbox',
      })

      result.consumed++
    } catch (err) {
      // Decryption failure: the row was encrypted for a different key, or the
      // ciphertext was tampered. The cloud copy is already deleted by the RPC —
      // we log and move on. No plaintext is written for a failed decrypt.
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`Decrypt failed for row ${row.id}: ${msg}`)
      result.skipped++
    }
  }

  return result
}

/* ══════════════════════════════════════════════════════════════════
   3.  BACKGROUND POLLING LIFECYCLE
   ══════════════════════════════════════════════════════════════════ */

/**
 * Starts the background 12-hour polling loop.
 *
 * Performs an initial drain immediately on call, then schedules recurring
 * drains every POLL_INTERVAL_MS (12 hours). Safe to call multiple times —
 * subsequent calls are no-ops while the broker is already active.
 *
 * @param localPeerId  The current session's WebRTC peer ID
 * @returns            Cleanup function — call on component unmount or signOut
 */
export function initLetterboxBroker(localPeerId: string): () => void {
  if (_isBrokerActive || typeof window === 'undefined') return () => {}

  _isBrokerActive = true

  // Drain immediately on activation (catches messages left while offline)
  void drainCloudMailbox(localPeerId)

  _pollTimer = setInterval(() => {
    void drainCloudMailbox(localPeerId)
  }, POLL_INTERVAL_MS)

  return () => {
    if (_pollTimer !== null) {
      clearInterval(_pollTimer)
      _pollTimer = null
    }
    _isBrokerActive = false
  }
}

/**
 * Tears down the background polling loop without an explicit cleanup
 * function reference. Useful for signOut flows where the cleanup ref
 * may not be accessible.
 */
export function terminateLetterboxBroker(): void {
  if (_pollTimer !== null) {
    clearInterval(_pollTimer)
    _pollTimer = null
  }
  _isBrokerActive = false
}

/* ══════════════════════════════════════════════════════════════════
   4.  OUTBOUND DELIVERY
   ══════════════════════════════════════════════════════════════════ */

export interface SendLetterboxOptions {
  /** Target recipient's WebRTC peer ID (PeerJS) */
  recipientPeerId:    string
  /** Recipient's RSA-OAEP public key (obtain via WebRTC sync or stored on PeerFriend) */
  recipientPublicKey: JsonWebKey
  /** Plaintext message body */
  messageText:        string
  /** Sender's display name shown in the recipient's inbox */
  senderDisplayName:  string
}

/**
 * Encrypts a message for the recipient's public key and inserts it into
 * the cloud_letterbox table. The recipient's next mailbox drain will
 * claim, decrypt, and locally store the message, then atomically delete
 * the cloud row.
 *
 * Throws if Supabase is unavailable or the INSERT fails.
 */
export async function sendLetterboxMessage(opts: SendLetterboxOptions): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('[LetterboxBroker] sendLetterboxMessage() cannot run on the server.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('[LetterboxBroker] Supabase is not configured — cannot deliver message.')
  }

  const encryptedPayload = await encryptLetterboxMessage(
    opts.messageText,
    opts.recipientPublicKey,
  )

  const { error } = await supabase.from('cloud_letterbox').insert({
    recipient_peer_id:   opts.recipientPeerId,
    sender_display_name: opts.senderDisplayName,
    encrypted_payload:   encryptedPayload,
  })

  if (error) {
    throw new Error(`[LetterboxBroker] Delivery failed: ${error.message}`)
  }
}

/* ══════════════════════════════════════════════════════════════════
   5.  LOCAL MESSAGE MANAGEMENT HELPERS
   ══════════════════════════════════════════════════════════════════ */

/**
 * Marks a locally-stored peer message as read.
 * Does not touch Supabase — the cloud row was already deleted on drain.
 */
export async function markMessageRead(messageId: number): Promise<void> {
  if (typeof window === 'undefined') return
  await getDb().peer_messages.update(messageId, { isRead: 1 })
}

/**
 * Permanently deletes a message from the local IDB store.
 * The cloud copy no longer exists (zero-retention guarantee).
 */
export async function deleteLocalMessage(messageId: number): Promise<void> {
  if (typeof window === 'undefined') return
  await getDb().peer_messages.delete(messageId)
}

/**
 * Returns the count of unread local messages without a full table scan.
 * Uses the isRead index for efficiency.
 */
export async function getUnreadCount(): Promise<number> {
  if (typeof window === 'undefined') return 0
  return getDb().peer_messages.where('isRead').equals(0).count()
}
