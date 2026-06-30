'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { db } from '@/lib/db'
import type { CompletedTrail } from '@/types/trailLog'
import { fileToDownscaledDataUrl } from '@/utils/imageDownscale'
import styles from './CompleteTrailModal.module.css'

type ToastFn = (msg: string, type?: 'info' | 'success' | 'error') => void

interface Props {
  trailId:   string
  trailName: string
  existing:  CompletedTrail | null
  onClose:   () => void
  onToast:   ToastFn
}

function todayISO() { return new Date().toISOString().slice(0, 10) }

export default function CompleteTrailModal({ trailId, trailName, existing, onClose, onToast }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [date,   setDate]   = useState(existing?.completedDate ?? todayISO())
  const [notes,  setNotes]  = useState(existing?.notes ?? '')
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? [])
  const [busy,   setBusy]   = useState(false)
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
    const row: CompletedTrail = {
      ...(existing ?? {}),
      trailId,
      trailName,
      completedDate: date,
      notes: notes.trim() || undefined,
      photos,
      createdAt: existing?.createdAt ?? Date.now(),
    }
    // put() upserts: replaces by id when editing, auto-assigns when new.
    await db.completed_trails.put(row)
    onToast(existing ? 'Trail log updated.' : `Marked "${trailName}" complete.`, 'success')
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
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Log ${trailName}`}>
        <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>

        <p className={styles.eyebrow}>Trail Completed</p>
        <h2 className={styles.title}>{trailName}</h2>

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
                <img src={src} alt={`${trailName} photo ${i + 1}`} />
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
          {existing && (
            <button className={styles.removeBtn} onClick={removeCompletion}>Remove from Completed</button>
          )}
          <div className={styles.actionsRight}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.saveBtn} onClick={save} disabled={busy}>
              {existing ? 'Save Log' : 'Mark Complete'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
