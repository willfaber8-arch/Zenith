/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — RelationshipNotesWidget
 * Phase 9 · Step 9.3 — Letterbox Live Note Dashboard Widget
 *
 * Reactive live-query card that surfaces the most recent incoming
 * message from the relationship_notes IndexedDB table. The moment
 * the letterbox broker (Phase 9.2) or a direct P2P exchange
 * (Phase 9.1) writes a new row, useLiveQuery streams the change
 * to this widget with 0ms polling overhead.
 *
 * State contract:
 *   • Empty table  → calm placeholder with bracketed terminal copy
 *   • One row      → note displayed with sender + relative time
 *   • New row      → key={note.id} remounts .messageCard, replaying
 *                    the letterReveal entrance animation organically
 *
 * The widget never auto-expires or purges messages. A row persists
 * until a newer one overwrites it (the query always returns the
 * single most recent entry). The original row stays in IDB for the
 * full audit history; only the display changes.
 * ════════════════════════════════════════════════════════════════
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery }                      from 'dexie-react-hooks'
import { db }                                from '@/lib/db'
import type { RelationshipNote }             from '@/types/relationshipNotes'
import styles                                from './RelationshipNotesWidget.module.css'

/* ════════════════════════════════════════════════════════════════
   Relative-time formatter
   Produces human-readable strings like "3 minutes ago", "yesterday"
   without any external date library.
   ════════════════════════════════════════════════════════════════ */

function formatRelativeTime(ts: number): string {
  const delta = Date.now() - ts
  const mins  = Math.floor(delta / 60_000)

  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7)   return `${days} days ago`

  const weeks = Math.floor(days / 7)
  return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
}

/* ════════════════════════════════════════════════════════════════
   Widget
   ════════════════════════════════════════════════════════════════ */

export default function RelationshipNotesWidget() {

  /* ── Live IDB subscription ───────────────────────────────────
     useLiveQuery re-fires any time the relationship_notes table
     is written to — by the letterbox broker, P2P sync, or any
     other producer. The widget never needs a manual refresh.    */
  const note: RelationshipNote | undefined = useLiveQuery(
    () => db.relationship_notes.orderBy('timestamp').reverse().first(),
    [],
  )

  /* ── Relative time ticker ────────────────────────────────────
     Recalculates the "X minutes ago" label every 60 seconds so
     the footer stays truthful without any costly re-render.     */
  const [relativeTime, setRelativeTime] = useState<string>('')

  const refreshRelativeTime = useCallback(() => {
    if (note?.timestamp != null) {
      setRelativeTime(formatRelativeTime(note.timestamp))
    }
  }, [note?.timestamp])

  useEffect(() => {
    refreshRelativeTime()
    const timer = setInterval(refreshRelativeTime, 60_000)
    return () => clearInterval(timer)
  }, [refreshRelativeTime])

  /* ── Loading guard ───────────────────────────────────────────
     useLiveQuery returns undefined on the initial IDB read frame.
     We render nothing (or a skeleton) until the query resolves.  */
  const isLoading = note === undefined && typeof window !== 'undefined'
  // Once the query resolves to null/a-record, isLoading becomes false.
  // undefined = still booting; null/record = resolved.

  const hasNote   = note != null
  const isUnread  = hasNote && !note.isRead

  return (
    <div className={styles.card}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className={styles.header}>
        <span
          className={`${styles.headerIcon} ${isUnread ? styles.unread : ''}`}
          aria-hidden="true"
        >
          ✉
        </span>
        <span className={styles.headerLabel}>Letterbox</span>

        {isUnread && (
          <span
            className={styles.newBadge}
            role="status"
            aria-label="Unread message"
          >
            <span className={styles.newDot} aria-hidden="true" />
            NEW
          </span>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────── */}

      {!hasNote ? (
        /* Empty / loading state */
        <div
          className={styles.emptyState}
          aria-live="polite"
          aria-label="No messages yet"
        >
          <span className={styles.emptyGlyph} aria-hidden="true">◈</span>
          <p className={styles.emptyText}>
            {`[ THE LETTERBOX IS CALM\n// SEND A NOTE TO CONNECT CHANNELS ]`}
          </p>
        </div>
      ) : (
        /* Active message — key remounts on new note.id, replaying letterReveal */
        <div
          className={styles.messageCard}
          key={note.id}
          aria-live="polite"
          aria-atomic="true"
        >
          <div className={styles.messageBody}>
            <p className={styles.messageText}>{note.messageText}</p>
          </div>

          <footer
            className={styles.footer}
            aria-label={`Message from ${note.senderDisplayName}, received ${relativeTime}`}
          >
            <span className={styles.footerFrom}>From:</span>
            <span className={styles.senderName}>{note.senderDisplayName}</span>
            <span className={styles.footerDivider} aria-hidden="true">—</span>
            <span className={styles.timestamp}>{relativeTime || '…'}</span>
          </footer>
        </div>
      )}

    </div>
  )
}
