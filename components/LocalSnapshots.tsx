'use client'

/**
 * LocalSnapshots — the copy of yesterday, and a way back to it.
 *
 * The export button beside this one already works, but it only helps
 * someone who remembered to press it, and the people who most need a
 * way back are the ones who did not. A snapshot is taken quietly once a
 * day; this is where they surface.
 *
 * It says plainly that this is not a backup. Snapshots live in the same
 * browser storage as the data they copy, so they survive a mistake and
 * not a lost laptop — and a recovery feature that looks like more
 * protection than it gives is worse than none, because it is trusted.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  listSnapshots, takeSnapshot, restoreSnapshot, deleteSnapshot,
  KEEP_SNAPSHOTS, type SnapshotInfo,
} from '@/utils/dbSnapshots'
import ConfirmDelete from '@/components/ui/ConfirmDelete'
import { useToast } from '@/lib/ToastContext'
import styles from './LocalSnapshots.module.css'

function whenLabel(ms: number): string {
  const mins = Math.floor((Date.now() - ms) / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return hrs === 1 ? 'an hour ago' : `${hrs} hours ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

function sizeLabel(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function LocalSnapshots() {
  const { toast } = useToast()
  const [snaps, setSnaps] = useState<SnapshotInfo[] | null>(null)
  const [busy,  setBusy]  = useState(false)
  /* Which one is armed for restore — restoring replaces everything, so
     it asks the same way the backup file restore does. */
  const [armed, setArmed] = useState<string | null>(null)

  const refresh = useCallback(async () => setSnaps(await listSnapshots()), [])

  useEffect(() => { void refresh() }, [refresh])

  const takeNow = async () => {
    setBusy(true)
    try {
      const r = await takeSnapshot({ force: true })
      if (r.taken) toast('Snapshot taken.', 'success')
      else if (r.reason === 'too-large')
        toast('Your data is too large to snapshot safely — use Export instead.', 'error')
      else toast('Could not take a snapshot.', 'error')
      await refresh()
    } finally { setBusy(false) }
  }

  const restore = async (s: SnapshotInfo) => {
    setBusy(true)
    setArmed(null)
    try {
      await restoreSnapshot(s.id)
      toast('Restored. A copy of what was here was kept first.', 'success')
      await refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Restore failed.', 'error')
    } finally { setBusy(false) }
  }

  const drop = async (s: SnapshotInfo) => {
    await deleteSnapshot(s.id)
    await refresh()
  }

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div>
          <p className={styles.title}>Automatic snapshots</p>
          <p className={styles.desc}>
            A copy of everything is kept once a day, and the last {KEEP_SNAPSHOTS} are
            held. These live in this browser, so they cover a mistake — not a lost
            or wiped device. Export a backup for that.
          </p>
        </div>
        <button
          type="button"
          className={styles.takeBtn}
          onClick={() => void takeNow()}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? 'Working…' : 'Snapshot now'}
        </button>
      </div>

      {snaps === null && <p className={styles.empty}>Loading…</p>}

      {snaps?.length === 0 && (
        <p className={styles.empty}>
          None yet — the first is taken shortly after you next open Zenith.
        </p>
      )}

      {snaps && snaps.length > 0 && (
        <ul className={styles.list}>
          {snaps.map(s => (
            <li key={s.id} className={styles.row}>
              <span className={styles.when}>{whenLabel(s.takenAt)}</span>
              <span className={styles.meta}>
                {s.rowCount.toLocaleString()} rows · {sizeLabel(s.bytes)} ·{' '}
                {new Date(s.takenAt).toLocaleString()}
              </span>

              {armed === s.id ? (
                <span className={styles.confirm} role="alert">
                  <span className={styles.confirmText}>
                    Replace everything with this? A copy of what is here now is kept first.
                  </span>
                  <button type="button" className={styles.yes} onClick={() => void restore(s)}>
                    Restore
                  </button>
                  <button type="button" className={styles.no} onClick={() => setArmed(null)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.restoreBtn}
                    onClick={() => setArmed(s.id)}
                    disabled={busy}
                  >
                    Restore
                  </button>
                  <ConfirmDelete
                    label={`the snapshot from ${whenLabel(s.takenAt)}`}
                    onConfirm={() => drop(s)}
                    className={styles.dropBtn}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
