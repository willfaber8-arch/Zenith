'use client'

/**
 * Zenith OS — AiIngestionDock
 * Phase 3 · Step 3.5 — Text Ingestion & Study Package Generator
 *
 * Accepts raw study content via:
 *   a) Direct text paste / typing in the textarea
 *   b) Drag-and-drop of .txt plain-text files
 *
 * On submit → POST /api/study-ai → calls onResult() with the
 * structured response.  The host view (StudyShieldView) handles
 * persisting to IDB and mounting the result panels.
 */

import {
  useState, useRef, useCallback,
  type DragEvent, type FormEvent, type ChangeEvent,
} from 'react'
import { useToast } from '@/lib/ToastContext'
import type { StudyAiResponse, StudyAiError } from '@/types/studyAi'
import styles from './AiIngestionDock.module.css'

/* ── Props ───────────────────────────────────────────────────── */

interface AiIngestionDockProps {
  onResult:    (result: StudyAiResponse, title: string) => void
  isCompact?:  boolean   // collapses dock once results are visible
}

/* ── Constants ───────────────────────────────────────────────── */

const MAX_CHARS      = 16_000
const ACCEPTED_EXTS  = ['.txt', '.md']

/* ── Component ───────────────────────────────────────────────── */

export default function AiIngestionDock({ onResult, isCompact = false }: AiIngestionDockProps) {
  const [title,      setTitle]      = useState('')
  const [text,       setText]       = useState('')
  const [loading,    setLoading]    = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [expanded,   setExpanded]   = useState(true)

  const { toast } = useToast()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /* ── Drag-and-drop ─────────────────────────────────────────── */

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    // Only clear when leaving the dock container itself
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    const ext = '.' + file.name.split('.').pop()!.toLowerCase()
    if (!ACCEPTED_EXTS.includes(ext)) {
      toast(`Only ${ACCEPTED_EXTS.join(' / ')} files are supported.`, 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      setText(content.slice(0, MAX_CHARS))
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
      textareaRef.current?.focus()
    }
    reader.readAsText(file)
  }, [title, toast])

  /* ── Submit ────────────────────────────────────────────────── */

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (trimmed.length < 40) {
      toast('Please provide at least 40 characters of study content.', 'error')
      return
    }

    setLoading(true)
    toast('Processing materials with Zenith AI…', 'info')

    try {
      const res = await fetch('/api/study-ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          text:  trimmed,
          title: title.trim() || 'Study Session',
        }),
      })

      const data: StudyAiResponse | StudyAiError = await res.json()

      if (!res.ok || 'error' in data) {
        const msg = 'error' in data ? data.error : 'An unexpected error occurred.'
        toast(msg, 'error')
        return
      }

      toast('Study package generated.', 'success')
      onResult(data as StudyAiResponse, title.trim() || 'Study Session')
    } catch {
      toast('Network error — check your connection and try again.', 'error')
    } finally {
      setLoading(false)
    }
  }, [text, title, toast, onResult])

  /* ── Compact toggle (once results exist) ───────────────────── */

  if (isCompact && !expanded) {
    return (
      <button className={styles.compactToggle} onClick={() => setExpanded(true)}>
        + New Study Session
      </button>
    )
  }

  /* ── Render ────────────────────────────────────────────────── */

  const charCount = text.length
  const overLimit = charCount > MAX_CHARS

  return (
    <div
      className={`${styles.dock} ${isDragging ? styles.dragging : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {isDragging && (
        <div className={styles.dropOverlay} aria-hidden>
          <span className={styles.dropIcon}>↓</span>
          <span className={styles.dropLabel}>Drop .txt or .md file</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>

        {/* Title row */}
        <div className={styles.titleRow}>
          <input
            type="text"
            placeholder="Session title (optional)"
            value={title}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            className={styles.titleInput}
            maxLength={80}
            disabled={loading}
          />
          {isCompact && (
            <button
              type="button"
              className={styles.collapseBtn}
              onClick={() => setExpanded(false)}
              aria-label="Collapse input dock"
            >
              ↑ Collapse
            </button>
          )}
        </div>

        {/* Text area */}
        <div className={styles.textareaWrap}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value.slice(0, MAX_CHARS))}
            placeholder={`Paste lecture notes, textbook excerpts, or slide transcriptions here.\n\nDrop a .txt or .md file anywhere on this panel to load it automatically.`}
            className={styles.textarea}
            rows={9}
            disabled={loading}
            aria-label="Study content input"
          />
          {loading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner} aria-label="Processing" />
              <span className={styles.loadingLabel}>Zenith AI is reading your materials…</span>
            </div>
          )}
        </div>

        {/* Footer row */}
        <div className={styles.footer}>
          <span className={`${styles.charCount} ${overLimit ? styles.charOver : ''}`}>
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} chars
          </span>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || text.trim().length < 40}
            aria-label="Generate study package"
          >
            {loading ? (
              <>
                <span className={styles.btnSpinner} />
                Generating…
              </>
            ) : (
              'Generate Study Package →'
            )}
          </button>
        </div>

      </form>
    </div>
  )
}
