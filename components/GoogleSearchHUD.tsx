'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './GoogleSearchHUD.module.css'

/* Recent searches are kept locally (local-first — nothing leaves the device)
   and power the autofill suggestions under the bar. */
const HISTORY_KEY  = 'zenith_search_history_v1'
const MAX_HISTORY  = 25   // how many past searches we retain
const MAX_SUGGEST  = 6    // how many we show at once

function readHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function writeHistory(list: string[]): void {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)) } catch { /* storage unavailable */ }
}

export default function GoogleSearchHUD() {
  const [query, setQuery]     = useState('')
  const [focused, setFocused] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  /** Highlighted suggestion index; -1 = none (typing in the raw input). */
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef              = useRef<HTMLInputElement>(null)

  /* Auto-focus on mount — one animation frame guarantees the DOM is painted */
  useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [])

  /* Load saved searches after mount (SSR-safe) */
  useEffect(() => { setHistory(readHistory()) }, [])

  /* Suggestions: past searches matching what's typed (or the most recent
     ones when the field is empty). */
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = q
      ? history.filter(h => h.toLowerCase().includes(q) && h.toLowerCase() !== q)
      : history
    return pool.slice(0, MAX_SUGGEST)
  }, [query, history])

  const showSuggestions = focused && suggestions.length > 0

  const runSearch = useCallback((raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return

    // Microsoft Bing (the Edge default search engine).
    const targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(trimmed)}`
    window.open(targetUrl, '_blank', 'noopener,noreferrer')

    // Remember it (most-recent first, de-duplicated, capped).
    setHistory(prev => {
      const next = [trimmed, ...prev.filter(h => h.toLowerCase() !== trimmed.toLowerCase())]
        .slice(0, MAX_HISTORY)
      writeHistory(next)
      return next
    })

    // Clear the field so the next search starts fresh.
    setQuery('')
    setActiveIdx(-1)
  }, [])

  const handleSearchSubmission = useCallback(() => { runSearch(query) }, [runSearch, query])

  const clearHistory = useCallback(() => {
    setHistory([])
    writeHistory([])
    setActiveIdx(-1)
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        // Enter accepts the highlighted suggestion when one is selected.
        runSearch(activeIdx >= 0 && suggestions[activeIdx] ? suggestions[activeIdx] : query)
        return
      }
      if (e.key === 'Escape') {
        if (activeIdx >= 0) { setActiveIdx(-1); return }
        setQuery('')
        return
      }
      if (!showSuggestions) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => (i + 1 >= suggestions.length ? 0 : i + 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => (i - 1 < 0 ? suggestions.length - 1 : i - 1))
      }
      if (e.key === 'Tab' && activeIdx >= 0 && suggestions[activeIdx]) {
        // Tab completes the field with the highlighted suggestion.
        e.preventDefault()
        setQuery(suggestions[activeIdx])
        setActiveIdx(-1)
      }
    },
    [runSearch, query, activeIdx, suggestions, showSuggestions],
  )

  return (
    <div className={`${styles.hud} anim-scale-in`} role="search" aria-label="Web search">

      {/* ── Label ─────────────────────────────────────────────── */}
      <p className={styles.label} aria-hidden="true">
        Search the web
      </p>

      {/* ── Input bar ─────────────────────────────────────────── */}
      <div className={styles.barWrap}>
        <div className={`${styles.bar} ${focused ? styles.barFocused : ''}`}>

          {/* Search glyph */}
          <span className={styles.icon} aria-hidden="true">⌕</span>

          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(-1) }}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            /* Delay so a suggestion mousedown lands before the list unmounts */
            onBlur={() => setTimeout(() => { setFocused(false); setActiveIdx(-1) }, 140)}
            placeholder="Search anything…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Web search query"
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls="zenith-search-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={
              activeIdx >= 0 ? `zenith-search-sug-${activeIdx}` : undefined
            }
          />

          {/* Clear button — visible only when there is text */}
          {query.length > 0 && (
            <button
              className={styles.clearBtn}
              onClick={() => { setQuery(''); setActiveIdx(-1); inputRef.current?.focus() }}
              aria-label="Clear search"
              tabIndex={-1}
            >
              ✕
            </button>
          )}

          {/* Submit affordance */}
          <button
            className={`${styles.submitBtn} tap-44 ${query.trim() ? styles.submitBtnActive : ''}`}
            onClick={handleSearchSubmission}
            aria-label="Run search"
            tabIndex={-1}
            disabled={!query.trim()}
          >
            ↗
          </button>
        </div>

        {/* ── Autofill suggestions (recent searches) ──────────── */}
        {showSuggestions && (
          <ul
            id="zenith-search-suggestions"
            className={styles.suggestions}
            role="listbox"
            aria-label="Recent searches"
          >
            {suggestions.map((s, i) => (
              <li key={s} role="presentation">
                <button
                  id={`zenith-search-sug-${i}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  className={`${styles.suggestion} ${i === activeIdx ? styles.suggestionActive : ''}`}
                  /* mousedown fires before input blur — keeps the click alive */
                  onMouseDown={e => { e.preventDefault(); runSearch(s) }}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <span className={styles.sugIcon} aria-hidden="true">↺</span>
                  <span className={styles.sugText}>{s}</span>
                </button>
              </li>
            ))}
            <li role="presentation">
              <button
                className={styles.clearHistoryBtn}
                onMouseDown={e => { e.preventDefault(); clearHistory() }}
              >
                Clear recent searches
              </button>
            </li>
          </ul>
        )}
      </div>

      {/* ── Hint strip ────────────────────────────────────────── */}
      <p className={styles.hint} aria-hidden="true">
        <span>↵ search</span>
        <span className={styles.hintDot} />
        <span>↑↓ recent</span>
        <span className={styles.hintDot} />
        <span>esc clear</span>
      </p>

    </div>
  )
}
