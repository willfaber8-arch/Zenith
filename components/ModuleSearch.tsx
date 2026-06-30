'use client'

/**
 * ModuleSearch — Topbar module finder.
 *
 * A compact search field in the Topbar that lets users jump to any of Zenith's
 * modules by name OR by what they mean ("budget" → Subscriptions, "trail"
 * → Trail Hunter). Results come from `searchModules()` over a keyword index.
 *
 * Keyboard: ⌘K / Ctrl+K focuses it from anywhere · ↑/↓ move the selection ·
 * Enter navigates · Escape clears & blurs. Click-outside closes the dropdown.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNav } from '@/lib/NavContext'
import { searchModules, type ModuleEntry } from '@/lib/moduleSearch'
import styles from './ModuleSearch.module.css'

const CATEGORY_LABEL: Record<string, string> = {
  essentials: 'Essentials',
  creator:    "Creator's",
  vault:      'Vault',
}

export default function ModuleSearch() {
  const { navigate } = useNav()
  const [query,     setQuery]     = useState('')
  const [open,      setOpen]      = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  const rootRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => searchModules(query), [query])

  /* Reset highlight whenever the result set changes. */
  useEffect(() => { setActiveIdx(0) }, [query])

  /* ⌘K / Ctrl+K focuses the finder from anywhere in the app. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* Click-outside closes the dropdown. */
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const goTo = useCallback((m: ModuleEntry) => {
    navigate(m.id, m.category)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }, [navigate])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = results[activeIdx] ?? results[0]
      if (target) goTo(target)
    }
  }

  const showDropdown = open && query.trim().length > 0

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={`${styles.field} ${open ? styles.fieldOpen : ''}`}>
        <span className={styles.searchIcon} aria-hidden="true">⌕</span>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          placeholder="Find a module…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="module-search-results"
          aria-autocomplete="list"
          aria-label="Find a Zenith module"
        />
        {query
          ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )
          : null}
      </div>

      {showDropdown && (
        <div className={styles.panel} id="module-search-results" role="listbox">
          {results.length === 0 ? (
            <p className={styles.empty}>No modules match &ldquo;{query.trim()}&rdquo;.</p>
          ) : (
            <ul className={styles.list}>
              {results.map((m, i) => (
                <li key={m.id} role="option" aria-selected={i === activeIdx}>
                  <button
                    type="button"
                    className={`${styles.result} ${i === activeIdx ? styles.resultActive : ''}`}
                    onClick={() => goTo(m)}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <span className={styles.resultBody}>
                      <span className={styles.resultLabel}>{m.label}</span>
                      <span className={styles.resultHint}>{m.hint}</span>
                    </span>
                    {m.category && (
                      <span className={styles.resultCat} data-cat={m.category}>
                        {CATEGORY_LABEL[m.category]}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
