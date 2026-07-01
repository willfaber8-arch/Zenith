'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { db } from '@/lib/db'
import type { CompletedTrail } from '@/types/trailLog'
import { fileToDownscaledDataUrl } from '@/utils/imageDownscale'
import styles from './CompleteTrailModal.module.css'

type ToastFn = (msg: string, type?: 'info' | 'success' | 'error') => void

interface Props {
  /** Existing row when editing; null/undefined when adding a new freeform entry. */
  existing?: CompletedTrail | null
  onClose:   () => void
  onToast:   ToastFn
}

const DIFFICULTIES = ['', 'Easy', 'Moderate', 'Hard'] as const

function todayISO() { return new Date().toISOString().slice(0, 10) }

export default function CompleteTrailModal({ existing, onClose, onToast }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const isEdit = !!existing

  const [name,       setName]       = useState(existing?.trailName ?? '')
  const [distance,   setDistance]   = useState(existing?.distanceMiles != null ? String(existing.distanceMiles) : '')
  const [difficulty, setDifficulty] = useState<string>(existing?.difficulty ?? '')
  const [featuresIn, setFeaturesIn] = useState(existing?.features ?? '')
  const [rating,     setRating]     = useState<number>(existing?.rating ?? 0)
  const [date,       setDate]       = useState(existing?.completedDate ?? todayISO())
  const [notes,      setNotes]      = useState(existing?.notes ?? '')
  const [photos,     setPhotos]     = useState<string[]>(existing?.photos ?? [])
  const [busy,       setBusy]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      const next: string[] = []
      for (const f of Array.from(files)) {
        next.push(await fileToDownscaledDataUrl(f))
      }
      setPhotos(p => [...p, ...next])
    } catch {
      onToast('Could not read one of those images.', 'error')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    if (!db) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      onToast('Please enter a trail name.', 'error')
      return
    }
    const distNum = distance.trim() ? Number(distance) : NaN

    const row: CompletedTrail = {
      ...(existing ?? {}),
      trailId:       existing?.trailId ?? crypto.randomUUID(),
      trailName:     trimmedName,
      completedDate: date,
      distanceMiles: Number.isFinite(distNum) ? distNum : undefined,
      difficulty:    difficulty || undefined,
      features:      featuresIn.trim() || undefined,
      rating:        rating > 0 ? rating : undefined,
      notes:         notes.trim() || undefined,
      photos,
      createdAt:     existing?.createdAt ?? Date.now(),
    }
    // put() upserts: replaces by id when editing, auto-assigns when new.
    await db.completed_trails.put(row)
    onToast(isEdit ? 'Trail log updated.' : `Logged "${trimmedName}".`, 'success')
    onClose()
  }

  async function removeCompletion() {
    if (!db || existing?.id == null) return
    await db.completed_trails.delete(existing.id)
    onToast('Removed from completed trails.', 'info')
    onClose()
  }

  if (!mounted) return null

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Edit ${existing?.trailName}` : 'Log a completed trail'}
      >
        <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>

        <p className={styles.eyebrow}>{isEdit ? 'Edit Entry' : 'New Entry'}</p>
        <h2 className={styles.title}>{isEdit ? 'Edit Completed Trail' : 'Log a Completed Trail'}</h2>

        <label className={styles.label}>Trail name <span className={styles.req}>*</span></label>
        <input
          type="text"
          className={styles.input}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Buttermilk Falls Gorge Trail"
          maxLength={200}
        />

        <div className={styles.grid2}>
          <div>
            <label className={styles.label}>Distance (mi)</label>
            <input
              type="number"
              className={styles.input}
              value={distance}
              onChange={e => setDistance(e.target.value)}
              placeholder="e.g. 4.5"
              min={0}
              step="0.1"
            />
          </div>
          <div>
            <label className={styles.label}>Difficulty</label>
            <select
              className={styles.input}
              value={difficulty}
              onChange={e => setDifficulty(e.target.value)}
            >
              {DIFFICULTIES.map(d => (
                <option key={d || 'none'} value={d}>{d || '—'}</option>
              ))}
            </select>
          </div>
        </div>

        <label className={styles.label}>Features</label>
        <input
          type="text"
          className={styles.input}
          value={featuresIn}
          onChange={e => setFeaturesIn(e.target.value)}
          placeholder="comma-separated — e.g. waterfall, scenic views, loop"
          maxLength={300}
        />

        <label className={styles.label}>Rating</label>
        <div className={styles.starRow}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              className={`${styles.star} ${rating >= n ? styles.starOn : ''}`}
              onClick={() => setRating(rating === n ? 0 : n)}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              aria-pressed={rating >= n}
            >★</button>
          ))}
          {rating > 0 && <span className={styles.starClear} onClick={() => setRating(0)}>clear</span>}
        </div>

        <label className={styles.label}>Date completed</label>
        <input type="date" className={styles.input} value={date} onChange={e => setDate(e.target.value)} />

        <label className={styles.label}>Notes</label>
        <textarea
          className={styles.textarea}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="How was it? Conditions, highlights, who you went with…"
          rows={4}
          maxLength={2000}
        />

        <label className={styles.label}>Photos</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => void addPhotos(e.target.files)}
        />
        <button type="button" className={styles.photoBtn} onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? 'Adding…' : '📷 Add Photos'}
        </button>
        {photos.length > 0 && (
          <div className={styles.photoGrid}>
            {photos.map((src, i) => (
              <div key={i} className={styles.photoThumb}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${name || 'Trail'} photo ${i + 1}`} />
                <button
                  type="button"
                  className={styles.photoRemove}
                  onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                  aria-label="Remove photo"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        <div className={styles.actions}>
          {isEdit && (
            <button className={styles.removeBtn} onClick={removeCompletion}>Remove from Completed</button>
          )}
          <div className={styles.actionsRight}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.saveBtn} onClick={save} disabled={busy}>
              {isEdit ? 'Save Log' : 'Add Entry'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
