'use client'

/**
 * CloudSnapshotManager — Settings panel for the whole-database Cloud Snapshot.
 *
 * Mirrors BackupRestoreManager's visual grammar (two-cell action grid, single
 * status strip, monospace labels, aria-busy / aria-live) but in the periwinkle
 * accent rather than parchment, so the local archive and the cloud copy read as
 * two related-but-distinct systems.
 *
 * States surfaced:
 *   • unavailable  — cloud not configured, or offline-only session (with reason)
 *   • idle/synced  — last sync time + which device wrote the cloud copy
 *   • syncing      — pulsing dot, buttons disabled
 *   • error        — actionable message from the service layer
 *   • conflict     — cloud is newer AND this profile has unsaved changes;
 *                    two explicit resolution buttons, no silent overwrite
 */

import { useCallback, useEffect, useState } from 'react'
import { useToast }          from '@/lib/ToastContext'
import { useCloudSync }      from '@/lib/CloudSyncContext'
import { relativeTime }      from '@/utils/relativeTime'
import styles from './CloudSnapshotManager.module.css'

const PULL_CONFIRM =
  'Load from cloud?\n\n' +
  'This replaces what is stored in this browser profile — habits, notes, ' +
  'calendar, tasks and settings — with the copy saved in your account.\n\n' +
  'A safety copy of what is here now is kept first (Settings → Local ' +
  'snapshots), and the page reloads when it finishes.'

/* ══════════════════════════════════════════════════════════════════
   CloudSnapshotManager
   ══════════════════════════════════════════════════════════════════ */

export default function CloudSnapshotManager() {
  const { toast } = useToast()
  const {
    available, reason, status, lastSyncedAt, remoteMeta,
    pushing, pulling, blocked, error,
    saveNow, loadNow, refreshRemote,
  } = useCloudSync()
  /* The conflict itself is resolved from the banner at the top of every
     screen (CloudSyncBanner); this panel reports it and offers the same
     two choices for anyone who came here to look. */
  const conflict = blocked === 'conflict'

  /* Re-render the relative timestamps once a minute without extra fetches. */
  const [, setTimeTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTimeTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const busy = pushing || pulling

  /* ── Push ───────────────────────────────────────────────────────── */

  const handlePush = useCallback(async () => {
    if (busy || !available) return
    const ok = await saveNow()
    if (ok) {
      toast('Workspace saved to your account.', 'success')
      void refreshRemote()
    } else {
      /* A safeguard stopping it is reported by the banner, not as a failure. */
      toast('Not saved — see the message at the top of the screen.', 'info')
    }
  }, [busy, available, saveNow, refreshRemote, toast])

  /* ── Pull ───────────────────────────────────────────────────────── */

  const handlePull = useCallback(async () => {
    if (busy || !available) return
    if (!window.confirm(PULL_CONFIRM)) return

    /* Reloads by itself on success, after keeping a safety copy. */
    const ok = await loadNow()
    if (!ok) toast('Not loaded — see the message at the top of the screen.', 'info')
  }, [busy, available, loadNow, toast])

  /* ── Status strip ───────────────────────────────────────────────── */

  const renderStatus = () => {
    if (busy) {
      return (
        <>
          <span className={`${styles.dot} ${styles.dotWorking}`} />
          <span className={styles.statusWorking}>
            {pushing ? 'Saving to cloud…' : 'Loading from cloud…'}
          </span>
        </>
      )
    }
    if (!available) {
      return (
        <>
          <span className={`${styles.dot} ${styles.dotIdle}`} />
          <span className={styles.statusIdle}>
            {reason ?? 'Cloud sync unavailable.'}
          </span>
        </>
      )
    }
    if (status === 'error' && error) {
      return (
        <>
          <span className={`${styles.dot} ${styles.dotError}`} />
          <span className={styles.statusError}>{error}</span>
        </>
      )
    }
    if (conflict) {
      return (
        <>
          <span className={`${styles.dot} ${styles.dotConflict}`} />
          <span className={styles.statusConflict}>
            Cloud copy is newer than this profile
          </span>
        </>
      )
    }
    return (
      <>
        <span className={`${styles.dot} ${styles.dotSuccess}`} />
        <span className={styles.statusSuccess}>
          Last synced {relativeTime(lastSyncedAt)}
          {remoteMeta?.deviceLabel ? ` · cloud copy from ${remoteMeta.deviceLabel}` : ''}
        </span>
      </>
    )
  }

  return (
    <div className={styles.panel}>

      {/* ── Conflict callout ─────────────────────────────────────────
          Explains; does not decide. The choices live in one place — the
          banner at the top of the screen, which is on this screen too —
          where each says what it replaces, shows what both versions hold,
          and asks once more before replacing anything. */}
      {conflict && available && (
        <div className={styles.conflictBox} role="alert">
          <p className={styles.conflictTitle}>Which version should win?</p>
          <p className={styles.conflictBody}>
            The cloud copy was saved{' '}
            {relativeTime(remoteMeta?.updatedAt ?? null)}
            {remoteMeta?.deviceLabel ? ` from ${remoteMeta.deviceLabel}` : ''},
            but this browser profile has changes that were never saved.
            Nothing is saved or loaded until you choose, in the message at the
            top of the screen — it shows what each version holds, and the one
            you don&apos;t pick is kept as a safety copy on this device.
          </p>
        </div>
      )}

      {/* ── Action row ───────────────────────────────────────────── */}
      <div className={styles.actions}>

        <div className={styles.cell}>
          <p className={styles.cellLabel}>Save</p>
          <p className={styles.cellDesc}>
            Upload this profile&apos;s entire workspace to your account. Happens
            automatically after you make changes — this button forces it now.
          </p>
          <button
            className={styles.pushBtn}
            onClick={() => void handlePush()}
            disabled={busy || !available}
            aria-busy={pushing}
          >
            {pushing ? 'Saving…' : '⬆ Save to cloud now'}
          </button>
        </div>

        <div className={styles.cell}>
          <p className={styles.cellLabel}>Load</p>
          <p className={styles.cellDesc}>
            Replace this browser profile with the copy saved in your account.
            A safety copy of what is here now is kept first.
          </p>
          <button
            className={styles.pullBtn}
            onClick={() => void handlePull()}
            disabled={busy || !available}
            aria-busy={pulling}
          >
            {pulling ? 'Loading…' : '⬇ Load from cloud'}
          </button>
        </div>

      </div>

      {/* ── Status strip ─────────────────────────────────────────── */}
      <div
        className={styles.status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {renderStatus()}
      </div>

    </div>
  )
}
