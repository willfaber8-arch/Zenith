'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — SyncIndicator
 * Phase 2 · Step 2.2 — Cloud Synchronization Pipeline Hooks
 *
 * Micro-indicator chip mounted inside the Topbar's right cluster.
 * Reflects the live SyncStatus from SyncContext with colour-coded
 * states and a subtle animation during active sync.
 *
 * Behaviour by state:
 *   CLOUD_SYNCHRONIZED — green check; fades to a quiet dot after 3 s
 *   SYNCING            — pulsing purple ring; non-interactive
 *   SAVED_LOCALLY      — muted label; non-interactive
 *   OFFLINE_QUEUED     — amber warning; clickable to retry
 * ════════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from 'react'
import { useSyncStatus }       from '@/lib/SyncContext'
import type { SyncStatus }     from '@/services/syncEngine'
import styles                  from './SyncIndicator.module.css'

/* ── Status display config ──────────────────────────────────── */

interface StatusConfig {
  icon:        string
  label:       string
  modifier:    string   // CSS module class name suffix
  ariaLabel:   string
  clickable:   boolean
  clickTitle?: string
}

const STATUS_CONFIG: Record<SyncStatus, StatusConfig> = {
  CLOUD_SYNCHRONIZED: {
    icon:      '✓',
    label:     'saved',
    modifier:  'synced',
    ariaLabel: 'Cloud synchronized',
    clickable: false,
  },
  SYNCING: {
    icon:      '◌',
    label:     'sync',
    modifier:  'syncing',
    ariaLabel: 'Syncing to cloud…',
    clickable: false,
  },
  SAVED_LOCALLY: {
    icon:      '◉',
    label:     'local',
    modifier:  'local',
    ariaLabel: 'Saved locally — awaiting cloud sync',
    clickable: false,
  },
  OFFLINE_QUEUED: {
    icon:       '⚡',
    label:      'queue',
    modifier:   'queued',
    ariaLabel:  'Offline — changes queued, click to retry',
    clickable:  true,
    clickTitle: 'Retry cloud sync',
  },
}

/* ── Component ──────────────────────────────────────────────── */

export default function SyncIndicator() {
  const { status, triggerSync } = useSyncStatus()
  const config = STATUS_CONFIG[status]

  /*
   * After CLOUD_SYNCHRONIZED has been visible for 3 s with no new
   * mutations, collapse to the quiet dot so it doesn't compete with
   * the weather chip and clock visually.
   * Any status change resets the visibility immediately.
   */
  const [quiet, setQuiet] = useState(false)

  useEffect(() => {
    setQuiet(false)   // any status change → show full chip

    if (status !== 'CLOUD_SYNCHRONIZED') return
    const timer = setTimeout(() => setQuiet(true), 3_000)
    return () => clearTimeout(timer)
  }, [status])

  /* Quiet dot — very subtle when everything is perfectly in sync */
  if (quiet) {
    return (
      <span
        className={styles.quietDot}
        aria-label="Cloud synchronized"
        title="Cloud synchronized"
      />
    )
  }

  const Wrapper = config.clickable ? 'button' : 'span'

  return (
    <Wrapper
      /* button-specific props — only rendered when clickable */
      {...(config.clickable
        ? {
            type:     'button' as const,
            onClick:  triggerSync,
            title:    config.clickTitle,
          }
        : {})}
      className={`${styles.chip} ${styles[config.modifier]}`}
      aria-label={config.ariaLabel}
      aria-live="polite"
    >
      <span className={styles.icon} aria-hidden="true">
        {config.icon}
      </span>
      <span className={styles.label}>
        {config.label}
      </span>
    </Wrapper>
  )
}
