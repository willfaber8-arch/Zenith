'use client'

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import styles from './CompletedTrailsLog.module.css'

function fmt(dateISO: string): string {
  const d = new Date(dateISO + 'T12:00:00')
  if (isNaN(d.getTime())) return dateISO
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CompletedTrailsLog() {
  const rows = useLiveQuery(() => db?.completed_trails.toArray() ?? Promise.resolve([]), []) ?? []
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.completedDate.localeCompare(a.completedDate)) || (b.createdAt - a.createdAt)),
    [rows],
  )

  const totalPhotos = useMemo(() => rows.reduce((s, r) => s + (r.photos?.length ?? 0), 0), [rows])

  if (sorted.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyGlyph}>🥾</span>
        <p className={styles.emptyTitle}>No completed trails yet</p>
        <p className={styles.emptyHint}>
          Open a trail in <strong>Trail Scout</strong>, then hit <strong>✓ Mark Complete</strong> to log it
          here with notes and photos.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.statsRow}>
        <span className={styles.stat}><strong>{sorted.length}</strong> trail{sorted.length === 1 ? '' : 's'}</span>
        <span className={styles.statSep}>·</span>
        <span className={styles.stat}><strong>{totalPhotos}</strong> photo{totalPhotos === 1 ? '' : 's'}</span>
      </div>

      <div className={styles.list}>
        {sorted.map(r => (
          <article key={r.id} className={styles.entry}>
            <div className={styles.entryHead}>
              <div>
                <h3 className={styles.entryName}>{r.trailName}</h3>
                <span className={styles.entryDate}>✓ Completed {fmt(r.completedDate)}</span>
              </div>
            </div>
            {r.notes && <p className={styles.entryNotes}>{r.notes}</p>}
            {r.photos?.length > 0 && (
              <div className={styles.gallery}>
                {r.photos.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt={`${r.trailName} ${i + 1}`} className={styles.photo} />
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
