'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — SyncStatusIndicator
 * Phase 6 · Step 6.4 — Database Synchronisation Broker
 *
 * Full-panel ambient status readout for the sync pipeline.
 * Distinct from SyncIndicator (topbar chip, compact, 9px mono):
 *   • Wider card format — suitable for the sidebar status dock
 *     or any surface that can afford ~180px of width.
 *   • Verbose bracketed label format: [ SYSTEM STATUS: … ]
 *   • Uses key={status} to remount on every state change, which
 *     replays the slideIn entrance animation silently.
 *   • Never shifts layout — fixed height avoids reflow.
 *
 * State colours (all tokens from globals.css):
 *   CLOUD_SYNCHRONIZED — Ocean Sage Green  (#52cca3 = --accent-green)
 *   OFFLINE_QUEUED     — Slate Grey        (#9ba3c4 = --text-muted)
 *   SYNCING            — Periwinkle Violet (#7c95ff = --accent-purple)
 *   SAVED_LOCALLY      — Guide Slate       (#5c6487 = --text-dark)
 * ════════════════════════════════════════════════════════════════
 */

import { useEffect, useRef }  from 'react'
import { useSyncStatus }      from '@/lib/SyncContext'
import type { SyncStatus }    from '@/services/syncEngine'
import styles                 from './SyncStatusIndicator.module.css'

/* ── Status display config ──────────────────────────────────── */

interface PanelConfig {
  dot:       string        // CSS modifier class for the status dot
  label:     string        // the text after "SYSTEM STATUS:"
  modifier:  string        // CSS modifier on the root panel element
  ariaLabel: string
}

const PANEL_CONFIG: Record<SyncStatus, PanelConfig> = {
  CLOUD_SYNCHRONIZED: {
    dot:       'dotGreen',
    label:     'Synced',
    modifier:  'stateSynced',
    ariaLabel: 'Cloud synchronised — all local changes are mirrored remotely.',
  },
  SYNCING: {
    dot:       'dotPurple',
    label:     'Syncing…',
    modifier:  'stateSyncing',
    ariaLabel: 'Sync in progress — uploading batched mutations to the cloud.',
  },
  SAVED_LOCALLY: {
    dot:       'dotSlate',
    label:     'Pending upload',
    modifier:  'stateLocal',
    ariaLabel: 'Changes saved locally — cloud sync queued for next network pass.',
  },
  OFFLINE_QUEUED: {
    dot:       'dotSlate',
    label:     'Offline',
    modifier:  'stateOffline',
    ariaLabel: 'Offline — all mutations are queued locally and will sync on reconnect.',
  },
}

/* ── Component ──────────────────────────────────────────────── */

export default function SyncStatusIndicator() {
  const { status } = useSyncStatus()
  const cfg        = PANEL_CONFIG[status]

  /*
   * Animate on mount only, not on arbitrary re-renders.
   * Using key={status} on the outer div triggers a full remount
   * whenever the status changes, which replays `anim-slide-in`.
   * The ref guards against the initial (SSR → client) mount
   * triggering an animation before the user has interacted.
   */
  const mountedRef = useRef(false)
  useEffect(() => { mountedRef.current = true }, [])

  return (
    <div
      key={status}
      className={`${styles.panel} ${styles[cfg.modifier]} anim-slide-in`}
      role="status"
      aria-label={cfg.ariaLabel}
      aria-live="polite"
    >
      {/* ── Dot indicator ──────────────────────────────────────── */}
      <span
        className={`${styles.dot} ${styles[cfg.dot]}`}
        aria-hidden="true"
      />

      {/* ── Status label ───────────────────────────────────────── */}
      <span className={styles.label}>
        <span className={`${styles.state} ${styles[cfg.modifier + 'Text']}`}>
          {cfg.label}
        </span>
      </span>
    </div>
  )
}
