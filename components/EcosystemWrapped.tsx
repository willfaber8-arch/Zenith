'use client'

/**
 * EcosystemWrapped — Phase 15.2 · Annual Ecosystem Review
 *
 * Cinematic 4-slide interactive dashboard that synthesises the user's
 * full local database history into a paginated analytical narrative.
 *
 * Slide architecture:
 *   0 — Operational Overview   (total completed tasks, academic/life split)
 *   1 — Memory Vault           (vocab cards retained, books, pages)
 *   2 — Habit Matrix           (peak streak, focus hours)
 *   3 — System Persona         (data-driven archetype assignment)
 *
 * Performance: aggregation runs in async chunked batches (yield$ pattern)
 * so thousands of IDB rows never lock the main thread during compilation.
 *
 * Navigation: arrow buttons, dot indicator, ArrowLeft/ArrowRight keys.
 * Dismiss: × button or Escape key.
 */

import { useEffect, useCallback, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  generateEcosystemMetrics,
  type EcosystemMetrics,
} from '@/utils/analyticsAggregator'
import styles from './EcosystemWrapped.module.css'

/* ── Constants ────────────────────────────────────────────────── */

const SLIDE_COUNT = 4

/* Pip display cap for the streak visualiser (Slide 3) */
const MAX_PIPS = 30

/* ══════════════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════════════ */

/* ── Slide 0 — Operational Overview ──────────────────────────── */

function SlideOperational({ m, dir }: { m: EcosystemMetrics; dir: string }) {
  return (
    <div className={`${styles.slide} ${dir}`}>
      <p className={styles.slideEyebrow}>[ SYSTEM EXECUTION // ANNUAL REVIEW ]</p>
      <h2 className={styles.slideTitle}>
        Total Completed<br />Tasks
      </h2>

      <span className={styles.heroMetric}>{m.totalCompletedTasks.toLocaleString()}</span>
      <p className={styles.heroLabel}>[ TASKS ARCHIVED ACROSS ALL ACTIVE CHANNELS ]</p>

      {/* Academic / Life split */}
      <div className={styles.statRow}>
        <div className={styles.statChip}>
          <span className={styles.chipValue}>{m.completedAcademic}</span>
          <span className={styles.chipLabel}>Scholastic</span>
        </div>
        <div className={styles.statChip}>
          <span className={styles.chipValue}>{m.completedLife}</span>
          <span className={styles.chipLabel}>Life Ops</span>
        </div>
      </div>

      {/* Academic share bar */}
      <div className={styles.barWrap}>
        <div
          className={styles.barFill}
          style={{ width: `${m.academicPct}%` }}
          role="meter"
          aria-valuenow={m.academicPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${m.academicPct}% scholastic tasks`}
        />
      </div>
      <p className={styles.barMeta}>{m.academicPct}% scholastic workload</p>

      {m.mostProductiveDayCount > 0 && (
        <div className={styles.callout}>
          <p className={styles.calloutLabel}>Peak Execution Day</p>
          <p className={styles.calloutValue}>
            {m.mostProductiveDay} — {m.mostProductiveDayCount} tasks
          </p>
        </div>
      )}
    </div>
  )
}

/* ── Slide 1 — Memory Vault ───────────────────────────────────── */

function SlideMemory({ m, dir }: { m: EcosystemMetrics; dir: string }) {
  const retentionPct = m.vocabCardsTotal > 0
    ? Math.round((m.vocabCardsRetained / m.vocabCardsTotal) * 100)
    : 0

  return (
    <div className={`${styles.slide} ${dir}`}>
      <p className={styles.slideEyebrow}>[ COGNITIVE ARCHIVE // MEMORY VAULT ]</p>
      <h2 className={styles.slideTitle}>Long-Term<br />Memory Locks</h2>

      <div className={styles.vaultGrid}>
        <div className={styles.vaultRow}>
          <span className={styles.vaultNum}>{m.vocabCardsRetained.toLocaleString()}</span>
          <span className={styles.vaultMeta}>
            Vocab cards consolidated into long-term retention
            {m.vocabCardsTotal > 0 && ` · ${retentionPct}% of deck`}
          </span>
        </div>

        <div className={styles.vaultDivider} />

        <div className={styles.vaultRow}>
          <span className={styles.vaultNum}>{m.booksCompleted}</span>
          <span className={styles.vaultMeta}>
            Books completed via Literary Ledger
            {m.totalPagesRead > 0 && ` · ${m.totalPagesRead.toLocaleString()} pages parsed`}
          </span>
        </div>

        {m.booksCompleted > 0 && (
          <>
            <div className={styles.vaultDivider} />
            <div className={styles.vaultRow}>
              <span className={styles.vaultNum}>{m.totalPagesRead.toLocaleString()}</span>
              <span className={styles.vaultMeta}>Total pages absorbed across all completed texts</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Slide 2 — Habit Matrix ───────────────────────────────────── */

function SlideHabits({ m, dir }: { m: EcosystemMetrics; dir: string }) {
  const pipCount = Math.min(m.peakHabitStreak, MAX_PIPS)

  return (
    <div className={`${styles.slide} ${dir}`}>
      <p className={styles.slideEyebrow}>[ DISCIPLINE MATRIX // CONSISTENCY RECORD ]</p>
      <h2 className={styles.slideTitle}>Peak Daily<br />Habit Streak</h2>

      <span className={styles.heroMetric}>{m.peakHabitStreak}</span>
      <p className={styles.heroLabel}>[ CONSECUTIVE DAYS AT FULL HABIT COMPLETION ]</p>

      {pipCount > 0 && (
        <div className={styles.pipRow} role="img" aria-label={`${pipCount} streak pips`}>
          {Array.from({ length: MAX_PIPS }).map((_, i) => (
            <span
              key={i}
              className={`${styles.pip} ${i < pipCount ? styles.pipFilled : ''}`}
              style={i < pipCount ? { animationDelay: `${i * 18}ms` } : undefined}
            />
          ))}
          {m.peakHabitStreak > MAX_PIPS && (
            <span className={styles.chipLabel}>+{m.peakHabitStreak - MAX_PIPS}</span>
          )}
        </div>
      )}

      <div className={styles.statRow}>
        <div className={styles.statChip}>
          <span className={styles.chipValue}>{m.totalHabitCompletions.toLocaleString()}</span>
          <span className={styles.chipLabel}>Total Completions</span>
        </div>
        <div className={styles.statChip}>
          <span className={styles.chipValue}>{m.focusHoursLogged}</span>
          <span className={styles.chipLabel}>Pomodoro Hours</span>
        </div>
      </div>
    </div>
  )
}

/* ── Slide 3 — System Persona ─────────────────────────────────── */

function SlidePersona({ m, dir }: { m: EcosystemMetrics; dir: string }) {
  const ts = new Date(m.generatedAt)
  const dateStr = `${ts.getFullYear()}.${String(ts.getMonth() + 1).padStart(2, '0')}.${String(ts.getDate()).padStart(2, '0')}`

  return (
    <div className={`${styles.slide} ${dir}`}>
      <p className={styles.slideEyebrow}>[ SYSTEM PERSONA // ARCHETYPE ASSIGNMENT ]</p>

      <div className={styles.personaGlyph} aria-hidden="true">
        {m.personaGlyph}
      </div>

      <p className={styles.personaBracket}>[ PRIMARY DESIGNATION ]</p>
      <h2 className={styles.personaTitle}>{m.personaTitle}</h2>
      <p className={styles.personaTagline}>{m.personaTagline}</p>

      <div className={styles.callout}>
        <p className={styles.calloutLabel}>Archetype computed from</p>
        <p className={styles.calloutValue}>
          {m.totalCompletedTasks} tasks · {m.vocabCardsRetained} retained words ·{' '}
          {m.peakHabitStreak}d streak · {m.booksCompleted} books
        </p>
      </div>

      <p className={styles.generatedAt}>
        Ecosystem compiled {dateStr} · All data local · Zero network transmission
      </p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   EcosystemWrapped
   ══════════════════════════════════════════════════════════════════ */

interface EcosystemWrappedProps {
  onClose: () => void
}

export default function EcosystemWrapped({ onClose }: EcosystemWrappedProps) {
  const [mounted,    setMounted   ] = useState(false)
  const [metrics,    setMetrics   ] = useState<EcosystemMetrics | null>(null)
  const [loadError,  setLoadError ] = useState<string>('')
  const [slideIndex, setSlideIndex] = useState(0)
  const [direction,  setDirection ] = useState<'forward' | 'backward'>('forward')
  const [slideKey,   setSlideKey  ] = useState(0)

  /* Portal requires a browser DOM — guard against SSR */
  useEffect(() => { setMounted(true) }, [])

  /* ── Aggregation on mount ─────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const m = await generateEcosystemMetrics()
        if (!cancelled) setMetrics(m)
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message ?? 'Aggregation failed.')
      }
    })()
    return () => { cancelled = true }
  }, [])

  /* ── Slide navigation ─────────────────────────────────────────── */

  const goToSlide = useCallback((next: number) => {
    if (!metrics) return
    setDirection(next > slideIndex ? 'forward' : 'backward')
    setSlideIndex(next)
    setSlideKey(k => k + 1)
  }, [metrics, slideIndex])

  const goNext = useCallback(() => {
    if (slideIndex < SLIDE_COUNT - 1) goToSlide(slideIndex + 1)
  }, [slideIndex, goToSlide])

  const goPrev = useCallback(() => {
    if (slideIndex > 0) goToSlide(slideIndex - 1)
  }, [slideIndex, goToSlide])

  /* ── Keyboard ─────────────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      { onClose(); return }
      if (e.key === 'ArrowRight')  { goNext() }
      if (e.key === 'ArrowLeft')   { goPrev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goNext, goPrev])

  /* ── Dismiss on backdrop click ────────────────────────────────── */

  const overlayRef = useRef<HTMLDivElement>(null)
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }, [onClose])

  /* ── Direction CSS class ──────────────────────────────────────── */

  const dirClass = direction === 'forward' ? styles.slideForward : styles.slideBackward

  /* ── Slide renderer ───────────────────────────────────────────── */

  const renderSlide = () => {
    if (!metrics) return null
    const props = { m: metrics, dir: dirClass }
    switch (slideIndex) {
      case 0: return <SlideOperational key={slideKey} {...props} />
      case 1: return <SlideMemory      key={slideKey} {...props} />
      case 2: return <SlideHabits      key={slideKey} {...props} />
      case 3: return <SlidePersona     key={slideKey} {...props} />
      default: return null
    }
  }

  if (!mounted) return null

  return createPortal(
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Ecosystem Wrapped — annual data review"
    >
      <div className={styles.shell}>

        {/* Close button */}
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close Ecosystem Wrapped"
        >
          ✕
        </button>

        {/* Slide viewport */}
        <div className={styles.slideViewport}>
          {loadError ? (
            <p className={styles.errorMsg}>
              [ COMPILATION FAULT ]<br />{loadError}
            </p>
          ) : !metrics ? (
            <div className={styles.loading}>
              <span className={styles.loadingGlyph} aria-hidden="true">◈</span>
              <span className={styles.loadingLabel}>
                [ COMPILING ECOSYSTEM DATA... ]
              </span>
            </div>
          ) : (
            renderSlide()
          )}
        </div>

        {/* Bottom chrome — nav + dots */}
        {metrics && (
          <div className={styles.chrome}>
            <button
              className={styles.navBtn}
              onClick={goPrev}
              disabled={slideIndex === 0}
              aria-label="Previous slide"
            >
              ←
            </button>

            <div className={styles.dots} role="tablist" aria-label="Slide navigation">
              {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
                <button
                  key={i}
                  className={`${styles.dot} ${i === slideIndex ? styles.dotActive : ''}`}
                  onClick={() => goToSlide(i)}
                  role="tab"
                  aria-selected={i === slideIndex}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>

            <span className={styles.slideCounter} aria-live="polite">
              {String(slideIndex + 1).padStart(2, '0')} / {String(SLIDE_COUNT).padStart(2, '0')}
            </span>

            <button
              className={styles.navBtn}
              onClick={goNext}
              disabled={slideIndex === SLIDE_COUNT - 1}
              aria-label="Next slide"
            >
              →
            </button>
          </div>
        )}

      </div>
    </div>,
    document.body,
  )
}
