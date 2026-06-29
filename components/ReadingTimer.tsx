'use client'

/**
 * ReadingTimer — full-screen, calm count-up stopwatch for a reading session.
 *
 * Opens when the user hits "Read" on a book; starts immediately. Epoch-based
 * timing (accumulated elapsed + a running anchor) stays accurate across pauses
 * and background tabs. "Finish" reports whole minutes back to the caller to log
 * against the book; "Close" discards without logging.
 *
 * Visual language mirrors the Study Protocol cockpit: a dark full-bleed scene
 * with a breathing ring and large mono clock.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './ReadingTimer.module.css'

interface Props {
  bookTitle:  string
  bookAuthor?: string
  onFinish:   (minutes: number) => void
  onClose:    () => void
}

function fmt(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export default function ReadingTimer({ bookTitle, bookAuthor, onFinish, onClose }: Props) {
  const [elapsed, setElapsed] = useState(0)   // seconds
  const [running, setRunning] = useState(true)

  const accumRef  = useRef(0)          // seconds banked before the current run
  const anchorRef = useRef(Date.now()) // epoch ms when the current run started

  /* Tick loop — recomputes from epoch so it never drifts. */
  useEffect(() => {
    if (!running) return
    anchorRef.current = Date.now()
    const id = setInterval(() => {
      const live = accumRef.current + (Date.now() - anchorRef.current) / 1000
      setElapsed(Math.floor(live))
    }, 250)
    return () => {
      // bank the run's time when pausing/unmounting
      accumRef.current += (Date.now() - anchorRef.current) / 1000
      clearInterval(id)
    }
  }, [running])

  const finish = useCallback(() => {
    const live = running
      ? accumRef.current + (Date.now() - anchorRef.current) / 1000
      : accumRef.current
    onFinish(Math.round(live / 60))
  }, [running, onFinish])

  /* Escape closes (discards). */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Reading timer">
      <button className={styles.closeBtn} onClick={onClose} aria-label="Close without logging">✕</button>

      <div className={styles.scene}>
        <p className={styles.eyebrow}>Reading</p>
        <p className={styles.bookTitle}>{bookTitle}</p>
        {bookAuthor && <p className={styles.bookAuthor}>by {bookAuthor}</p>}

        <div className={`${styles.ring} ${running ? styles.ringRunning : ''}`}>
          <span className={styles.clock}>{fmt(elapsed)}</span>
        </div>

        <div className={styles.controls}>
          <button className={styles.ctrlBtn} onClick={() => setRunning(r => !r)}>
            {running ? '❚❚ Pause' : '▶ Resume'}
          </button>
          <button className={`${styles.ctrlBtn} ${styles.finishBtn}`} onClick={finish}>
            ✓ Finish session
          </button>
        </div>

        <p className={styles.hint}>
          {elapsed < 60
            ? 'Settle in — your reading time will be logged to this book.'
            : `${Math.round(elapsed / 60)} min so far · logs to this book on finish`}
        </p>
      </div>
    </div>
  )
}
