'use client'

/**
 * components/CloudSyncBanner.tsx — when sync needs the user, it says so here.
 *
 * Shown at the top of every screen, phone and desktop, and only when one
 * of the safeguards in services/cloudSnapshot.ts has stopped sync (or the
 * cloud has newer changes waiting). Every choice it offers keeps the
 * version not chosen as a safety copy on this device, and it never offers
 * the one thing that could expose data: uploading one account's workspace
 * into another's.
 */

import { useEffect, useState } from 'react'
import { useCloudSync } from '@/lib/CloudSyncContext'
import { reloadPage } from '@/lib/reloadPage'
import type { SyncBlock } from '@/services/cloudSnapshot'
import styles from './CloudSyncBanner.module.css'

interface Choice { label: string; run: () => void | Promise<unknown>; primary?: boolean }

export default function CloudSyncBanner() {
  const sync = useCloudSync()
  const [hiddenFor, setHiddenFor] = useState<string | null>(null)

  const key: string | null = sync.blocked ?? (sync.updateReady ? 'update' : null)
  /* A new situation always shows, even if an earlier one was dismissed. */
  useEffect(() => { if (key !== hiddenFor) setHiddenFor(null) }, [key])   // eslint-disable-line react-hooks/exhaustive-deps

  if (!sync.available || !key || hiddenFor === key) return null

  const other = sync.remoteMeta?.deviceLabel ?? 'your other device'
  const busy  = sync.pushing || sync.pulling
  const later: Choice = { label: 'Not now', run: () => setHiddenFor(key) }

  const copy: Record<SyncBlock | 'update', { title: string; body: string; choices: Choice[] } | null> = {
    conflict: {
      title: 'Both devices changed since they last synced',
      body:  `This device and ${other} each have changes the other hasn’t seen, so nothing was saved or loaded. ` +
             'Pick which version to keep — the other is kept as a safety copy on this device (Settings → Local snapshots).',
      choices: [
        { label: 'Keep this device’s', run: sync.keepThisDevice, primary: true },
        { label: `Keep ${other}’s`,    run: sync.keepCloud },
      ],
    },
    'account-mismatch': {
      title: 'This device’s data belongs to a different account',
      body:  'Sync is paused so the two accounts’ data never mix. Loading this account’s data keeps what is here now as a safety copy on this device.',
      choices: [
        { label: 'Load this account’s data', run: sync.useAccountData, primary: true },
        { label: 'Keep sync off', run: later.run },
      ],
    },
    'outdated-app': {
      title: 'This copy of Zenith is out of date',
      body:  'Your data was last saved by a newer version, so this one won’t save over it. Reload to update — nothing here is lost.',
      choices: [{ label: 'Reload', run: () => reloadPage(), primary: true }],
    },
    'mass-deletion': {
      title: 'Most of your data is missing on this device',
      body:  'Compared with your last sync, most of it is gone here — as if browser storage was cleared. It has not been saved to the cloud, so your other devices still have everything.',
      choices: [
        { label: 'Bring it back from the cloud', run: sync.keepCloud, primary: true },
        { label: 'I deleted it on purpose — save', run: sync.confirmShrink },
      ],
    },
    'no-backup': {
      title: 'Couldn’t make a safety copy',
      body:  `Newer changes from ${other} were not loaded, because a safety copy of this device couldn’t be saved first (storage may be full).`,
      choices: [
        { label: 'Load anyway', run: sync.loadAnyway },
        later,
      ],
    },
    busy: null,
    update: {
      title: `Newer changes from ${other}`,
      body:  'They load automatically next time you open Zenith, or now. A safety copy of this device is kept first.',
      choices: [{ label: 'Load now', run: sync.loadNow, primary: true }, later],
    },
  }

  const c = copy[key as SyncBlock | 'update']
  if (!c) return null

  return (
    <div className={`${styles.banner} ${key === 'update' ? styles.info : styles.warn}`} role="alert">
      <div className={styles.text}>
        <p className={styles.title}>{c.title}</p>
        <p className={styles.body}>{c.body}</p>
      </div>
      <div className={styles.actions}>
        {c.choices.map(ch => (
          <button
            key={ch.label}
            type="button"
            className={`${styles.btn} ${ch.primary ? styles.btnPrimary : ''}`}
            onClick={() => void ch.run()}
            disabled={busy}
          >
            {ch.label}
          </button>
        ))}
      </div>
    </div>
  )
}
