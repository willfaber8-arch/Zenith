'use client'

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useToast } from '@/lib/ToastContext'
import type { CompletedTrail } from '@/types/trailLog'
import CompleteTrailModal from './CompleteTrailModal'
import styles from './CompletedTrailsLog.module.css'

function fmt(dateISO: string): string {
  const d = new Date(dateISO + 'T12:00:00')
  if (isNaN(d.getTime())) return dateISO
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Stars({ value }: { value: number }) {
  return (
    <span className={styles.metaStars} aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={n <= value ? styles.starFull : styles.starEmpty}>★</span>
      ))}
    </span>
  )
}

export default function CompletedTrailsLog() {
  const { toast } = useToast()
  const rows = useLiveQuery(() => db?.completed_trails.toArray() ?? Promise.resolve([]), []) ?? []

  // Modal state: null = closed, 'new' = add, or an existing row = edit.
  const [modal, setModal] = useState<'new' | CompletedTrail | null>(null)

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.completedDate.localeCompare(a.completedDate)) || (b.createdAt - a.createdAt)),
    [rows],
  )

  const totalPhotos = useMemo(() => rows.reduce((s, r) => s + (r.photos?.length ?? 0), 0), [rows])
  const totalMiles = useMemo(
    () => rows.reduce((s, r) => s + (typeof r.distanceMiles === 'number' ? r.distanceMiles : 0), 0),
    [rows],
  )

  const modalEl = modal !== null && (
    <CompleteTrailModal
      existing={modal === 'new' ? null : modal}
      onClose={() => setModal(null)}
      onToast={toast}
    />
  )

  if (sorted.length === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>
          <span className={styles.emptyGlyph}>🥾</span>
          <p className={styles.emptyTitle}>No completed trails yet</p>
          <p className={styles.emptyHint}>
            Log any hike you&apos;ve finished — distance, difficulty, a rating, notes and photos.
          </p>
          <button className={styles.addBtn} onClick={() => setModal('new')}>+ Add Completed Trail</button>
        </div>
        {modalEl}
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.headerRow}>
        <div className={styles.statsRow}>
          <span className={styles.stat}><strong>{sorted.length}</strong> trail{sorted.length === 1 ? '' : 's'}</span>
          <span className={styles.statSep}>·</span>
          <span className={styles.stat}><strong>{Math.round(totalMiles * 10) / 10}</strong> mi</span>
          <span className={styles.statSep}>·</span>
          <span className={styles.stat}><strong>{totalPhotos}</strong> photo{totalPhotos === 1 ? '' : 's'}</span>
        </div>
        <button className={styles.addBtn} onClick={() => setModal('new')}>+ Add Completed Trail</button>
      </div>

      <div className={styles.list}>
        {sorted.map(r => (
          <article
            key={r.id}
            className={styles.entry}
            onClick={() => setModal(r)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModal(r) } }}
          >
            <div className={styles.entryHead}>
              <div>
                <h3 className={styles.entryName}>{r.trailName}</h3>
                <span className={styles.entryDate}>✓ Completed {fmt(r.completedDate)}</span>
              </div>
            </div>

            {(r.distanceMiles != null || r.difficulty || r.rating) && (
              <div className={styles.metaRow}>
                {r.distanceMiles != null && (
                  <span className={styles.metaChip}>{r.distanceMiles} mi</span>
                )}
                {r.difficulty && (
                  <span className={styles.metaChip}>{r.difficulty}</span>
                )}
                {r.rating ? <Stars value={r.rating} /> : null}
              </div>
            )}

            {r.features && (
              <div className={styles.featTags}>
                {r.features.split(',').map(f => f.trim()).filter(Boolean).map((f, i) => (
                  <span key={i} className={styles.featTag}>{f}</span>
                ))}
              </div>
            )}

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

      {modalEl}
    </div>
  )
}
