'use client'

/**
 * components/CloudSyncDot.tsx — is this device in step with the cloud?
 *
 * A dot and one word, in the top bar on phone and desktop. Hidden when
 * cloud sync is not available (not configured, or an offline-only
 * session), so nothing changes for anyone not using it.
 */

import { useCloudSync } from '@/lib/CloudSyncContext'
import styles from './CloudSyncDot.module.css'

export default function CloudSyncDot({ compact = false }: { compact?: boolean }) {
  const s = useCloudSync()
  if (!s.available) return null

  const [tone, word, detail] =
      s.blocked                 ? ['warn',  'Needs you', 'Sync is paused until you choose — see the message at the top']
    : s.pushing || s.pulling    ? ['busy',  'Syncing',   'Syncing with the cloud']
    : s.status === 'offline'    ? ['muted', 'Offline',   'Offline — changes are kept on this device and sync when you reconnect']
    : s.status === 'error'      ? ['warn',  'Not synced', s.error ?? 'The last sync failed; it will try again']
    : s.updateReady             ? ['info',  'Update',    'Newer changes are waiting in the cloud']
    :                             ['ok',    'Synced',    'In step with the cloud']

  return (
    <span className={`${styles.wrap} ${styles[tone]}`} role="status" aria-label={detail} title={detail}>
      <span className={styles.dot} aria-hidden="true" />
      {!compact && <span className={styles.word}>{word}</span>}
    </span>
  )
}
