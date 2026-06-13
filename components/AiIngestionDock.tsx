'use client'

/**
 * Zenith OS — AiIngestionDock
 * Phase 3 · Step 3.5 — Study Package Generator
 *
 * Two input modes:
 *   a) "Paste Notes"  — paste raw lecture notes / textbook text
 *   b) "Describe Topic" — describe what you want to study; AI writes the material
 *
 * Generate options: Summary Notes · Flashcards · Practice Test (independently toggleable)
 */

import {
  useState, useRef, useCallback,
  type DragEvent, type FormEvent, type ChangeEvent,
} from 'react'
import { useToast } from '@/lib/ToastContext'
import type { StudyAiResponse, StudyAiError, GenerateOptions } from '@/types/studyAi'
import styles from './AiIngestionDock.module.css'

/* ── Props ───────────────────────────────────────────────────── */

interface AiIngestionDockProps {
  onResult:   (result: StudyAiResponse, title: string) => void
  isCompact?: boolean
}

/* ── Constants ───────────────────────────────────────────────── */

const MAX_CHARS     = 16_000
const ACCEPTED_EXTS = ['.txt', '.md']

/* ── Component ───────────────────────────────────────────────── */

export default function AiIngestionDock({ onResult, isCompact = false }: AiIngestionDockProps) {
  const [title,      setTitle]      = useState('')
  const [text,       setText]       = useState('')
  const [inputMode,  setInputMode]  = useState<'notes' | 'topic'>('notes')
  const [generate,   setGenerate]   = useState<GenerateOptions>({
    summary:      true,
    flashcards:   true,
    practiceTest: false,
  })
  const [loading,    setLoading]    = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [expanded,   setExpanded]   = useState(true)
  const [notConfigured, setNotConfigured] = useState(false)

  const { toast } = useToast()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const toggleGenerate = (key: keyof GenerateOptions) => {
    setGenerate(prev => ({ ...prev, [key]: !prev[key] }))
  }

  /* ── Drag-and-drop (notes mode only) ──────────────────────── */

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (inputMode !== 'notes') return
    e.preventDefault(); e.stopPropagation()
    setIsDragging(true)
  }, [inputMode])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation()
    setIsDragging(false)
    if (inputMode !== 'notes') return

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
  }, [inputMode, title, toast])

  /* ── Submit ────────────────────────────────────────────────── */

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    const minLen  = inputMode === 'topic' ? 10 : 40

    if (trimmed.length < minLen) {
      toast(`Please provide at least ${minLen} characters.`, 'error')
      return
    }
    if (!generate.summary && !generate.flashcards && !generate.practiceTest) {
      toast('Select at least one item to generate.', 'error')
      return
    }

    setLoading(true)
    setNotConfigured(false)
    toast('Processing with Zenith AI…', 'info')

    try {
      const res = await fetch('/api/study-ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          text:     trimmed,
          title:    title.trim() || 'Study Session',
          mode:     inputMode,
          generate,
        }),
      })

      const data: StudyAiResponse | StudyAiError = await res.json()

      if (res.status === 503) {
        setNotConfigured(true)
        return
      }

      if (!res.ok || 'error' in data) {
        const msg = 'error' in data ? (data as StudyAiError).error : 'An unexpected error occurred.'
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
  }, [text, title, inputMode, generate, toast, onResult])

  /* ── Compact collapsed state ───────────────────────────────── */

  if (isCompact && !expanded) {
    return (
      <button className={styles.compactToggle} onClick={() => setExpanded(true)}>
        + New Study Session
      </button>
    )
  }

  const charCount = text.length
  const overLimit = charCount > MAX_CHARS

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div
      className={`${styles.dock} ${isDragging ? styles.dragging : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className={styles.dropOverlay} aria-hidden>
          <span className={styles.dropIcon}>↓</span>
          <span className={styles.dropLabel}>Drop .txt or .md file</span>
        </div>
      )}

      {/* ── Not-configured banner ──────────────────────────── */}
      {notConfigured && (
        <div className={styles.notConfigured}>
          <span className={styles.notConfiguredIcon}>⚠</span>
          <div>
            <p className={styles.notConfiguredTitle}>AI service not configured</p>
            <p className={styles.notConfiguredBody}>
              Add <code className={styles.code}>LLM_API_KEY=sk-ant-...</code> to your{' '}
              <code className={styles.code}>.env.local</code> file, then restart the dev server.
              Get a key at{' '}
              <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className={styles.configLink}>
                console.anthropic.com
              </a>
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>

        {/* ── Mode toggle ──────────────────────────────────── */}
        <div className={styles.modeToggleRow}>
          <span className={styles.modeLabel}>Input mode</span>
          <div className={styles.modeToggle} role="group" aria-label="Input mode">
            <button
              type="button"
              className={`${styles.modeBtn} ${inputMode === 'notes' ? styles.modeBtnActive : ''}`}
              onClick={() => { setInputMode('notes'); setText('') }}
            >
              Paste Notes
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${inputMode === 'topic' ? styles.modeBtnActive : ''}`}
              onClick={() => { setInputMode('topic'); setText('') }}
            >
              Describe Topic
            </button>
          </div>
        </div>

        {/* ── Title row ────────────────────────────────────── */}
        <div className={styles.titleRow}>
          <input
            type="text"
            placeholder={inputMode === 'topic' ? 'Session title (e.g. Organic Chemistry — Alkenes)' : 'Session title (optional)'}
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

        {/* ── Input area ───────────────────────────────────── */}
        <div className={styles.textareaWrap}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value.slice(0, MAX_CHARS))}
            placeholder={
              inputMode === 'topic'
                ? `Describe what you want to study.\n\nExamples:\n  "Newton's three laws of motion and how they relate to real-world examples"\n  "The causes and consequences of World War I"\n  "JavaScript async/await and the event loop"}`
                : `Paste lecture notes, textbook excerpts, or slide transcriptions here.\n\nDrop a .txt or .md file anywhere on this panel to load it automatically.`
            }
            className={styles.textarea}
            rows={inputMode === 'topic' ? 5 : 9}
            disabled={loading}
            aria-label={inputMode === 'topic' ? 'Topic description' : 'Study content input'}
          />
          {loading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner} aria-label="Processing" />
              <span className={styles.loadingLabel}>Zenith AI is generating your study package…</span>
            </div>
          )}
        </div>

        {/* ── Generate options ─────────────────────────────── */}
        <div className={styles.generateRow}>
          <span className={styles.generateLabel}>Generate</span>
          <div className={styles.generateOptions}>
            {([
              { key: 'summary'      as const, label: 'Study Notes' },
              { key: 'flashcards'   as const, label: 'Flashcards'  },
              { key: 'practiceTest' as const, label: 'Practice Test' },
            ]).map(({ key, label }) => (
              <label key={key} className={`${styles.genOption} ${generate[key] ? styles.genOptionOn : ''}`}>
                <input
                  type="checkbox"
                  className={styles.genCheckbox}
                  checked={generate[key]}
                  onChange={() => toggleGenerate(key)}
                  disabled={loading}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className={styles.footer}>
          {inputMode === 'notes' ? (
            <span className={`${styles.charCount} ${overLimit ? styles.charOver : ''}`}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} chars
            </span>
          ) : (
            <span className={styles.charCount}>
              {charCount > 0 ? `${charCount} chars` : 'Describe any topic'}
            </span>
          )}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || text.trim().length < (inputMode === 'topic' ? 10 : 40)}
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
