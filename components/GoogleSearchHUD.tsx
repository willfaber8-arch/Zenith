'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './GoogleSearchHUD.module.css'

export default function GoogleSearchHUD() {
  const [query, setQuery]     = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef              = useRef<HTMLInputElement>(null)

  /* Auto-focus on mount — one animation frame guarantees the DOM is painted */
  useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleSearchSubmission = useCallback(() => {
    const trimmed = query.trim()
    if (!trimmed) return
    const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
  }, [query])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSearchSubmission()
      }
      if (e.key === 'Escape') {
        setQuery('')
      }
    },
    [handleSearchSubmission],
  )

  return (
    <div className={`${styles.hud} anim-scale-in`} role="search" aria-label="Web search">

      {/* ── Label ─────────────────────────────────────────────── */}
      <p className={styles.label} aria-hidden="true">
        Search the web
      </p>

      {/* ── Input bar ─────────────────────────────────────────── */}
      <div className={`${styles.bar} ${focused ? styles.barFocused : ''}`}>

        {/* Search glyph */}
        <span className={styles.icon} aria-hidden="true">⌕</span>

        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search anything…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Web search query"
        />

        {/* Clear button — visible only when there is text */}
        {query.length > 0 && (
          <button
            className={styles.clearBtn}
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            aria-label="Clear search"
            tabIndex={-1}
          >
            ✕
          </button>
        )}

        {/* Submit affordance */}
        <button
          className={`${styles.submitBtn} ${query.trim() ? styles.submitBtnActive : ''}`}
          onClick={handleSearchSubmission}
          aria-label="Run search"
          tabIndex={-1}
          disabled={!query.trim()}
        >
          ↗
        </button>
      </div>

      {/* ── Hint strip ────────────────────────────────────────── */}
      <p className={styles.hint} aria-hidden="true">
        <span>↵ search</span>
        <span className={styles.hintDot} />
        <span>esc clear</span>
      </p>

    </div>
  )
}
