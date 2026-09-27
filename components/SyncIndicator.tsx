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
 *
 * Shown only when there is something to say. This uploader mirrors
 * individual rows (urgent tasks, habits, workouts, the profile) into
 * per-item cloud tables that nothing in the app reads back; keeping
 * devices in step is the whole-workspace sync and its own dot
 * (CloudSyncDot). A permanent "saved"/"local" chip beside that dot was
 * a second sync icon that could disagree with the first, and the one
 * people actually asked about was "queue" — so the chip now appears
 * only while changes are genuinely waiting: the uploader stalled
 * (offline, or the cloud refused) with rows still pending, and it stays
 * up through the retry until they are sent or retired. The ordinary
 * upload after every edit never shows it, so the top bar does not jump
 * each time a habit is ticked. See `useSyncChipVisible`.
 * ════════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from 'react'
import { useLiveQuery }        from 'dexie-react-hooks'
import { db }                  from '@/lib/db'
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
    icon:       '◇',
    label:      'queue',
    modifier:   'queued',
    ariaLabel:  'Offline — changes queued, click to retry',
    clickable:  true,
    clickTitle: 'Retry cloud sync',
  },
}

/* ── Visibility ─────────────────────────────────────────────── */

/**
 * True while the uploader is holding changes it could not send.
 *
 * Both queues count — the engine's `pendingSyncQueue` and the broker's
 * `outboxMutations` — because either can be the one stuck. A stall
 * (OFFLINE_QUEUED) with rows pending shows the chip; it then stays
 * through the SYNCING of a retry, so a retry does not blink it off and
 * on, and goes once nothing is pending or everything is in the cloud.
 * An `offline` event with nothing waiting is not news and stays hidden.
 *
 * Exported so the Topbar can drop the chip's whole slot, divider and
 * all, rather than leave an orphan divider behind an empty chip.
 */
export function useSyncChipVisible(): boolean {
  const { status } = useSyncStatus()
  const pending = useLiveQuery(
    async () => (db ? (await db.pendingSyncQueue.count()) + (await db.outboxMutations.count()) : 0),
    [],
  ) ?? 0

  const [stalled, setStalled] = useState(false)
  useEffect(() => {
    if (status === 'OFFLINE_QUEUED' && pending > 0) setStalled(true)
    else if (pending === 0 || status === 'CLOUD_SYNCHRONIZED' || status === 'SAVED_LOCALLY') setStalled(false)
  }, [status, pending])

  return stalled && (status === 'OFFLINE_QUEUED' || status === 'SYNCING')
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
