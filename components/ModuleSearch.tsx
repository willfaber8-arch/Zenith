'use client'

/**
 * ModuleSearch — Topbar finder, for modules and for what is in them.
 *
 * It used to match module *names* only, so typing "chapter 3" found
 * nothing: no module is called that, and the thing you were looking for
 * was a task, a note or an event. Modules still come first — they are
 * the fast path, and they resolve instantly from a static index — but
 * underneath them are matches from the database itself.
 *
 * The two halves behave differently on purpose. Modules are synchronous
 * and appear as you type; content is a pass over several tables, so it
 * is debounced and arrives a moment later, under a heading that says
 * what it is. A results list that reorders itself under the cursor
 * after you have already started moving down it is worse than one that
 * grows at the bottom.
 *
 * Keyboard: ⌘K / Ctrl+K focuses it from anywhere · ↑/↓ move the selection ·
 * Enter navigates · Escape clears & blurs. Click-outside closes the dropdown.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNav } from '@/lib/NavContext'
import { searchModules, type ModuleEntry } from '@/lib/moduleSearch'
import { searchContent, KIND_LABEL, MIN_QUERY, type ContentResult } from '@/lib/contentSearch'
import styles from './ModuleSearch.module.css'

/** Long enough that typing a word does not run a scan per keystroke,
 *  short enough that results feel like they were already there. */
const DEBOUNCE_MS = 160

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

  const modules = useMemo(() => searchModules(query), [query])
  const [content, setContent] = useState<ContentResult[]>([])

  /*
   * Content results, debounced.
   *
   * `runId` is what keeps a slow query from overwriting a fast one that
   * came after it: two scans in flight can finish in either order, and
   * without the guard the list can settle on results for a prefix of
   * what you actually typed.
   */
  const runRef = useRef(0)
  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_QUERY) { setContent([]); return }
    const id = ++runRef.current
    const t = setTimeout(() => {
      void searchContent(q).then(rows => {
        if (runRef.current === id) setContent(rows)
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  /* One flat list for the keyboard: modules first, then content. Arrow
     keys should not have to know there are two sections. */
  const results = useMemo(
    () => [
      ...modules.map(m => ({ sort: 'module' as const, module: m })),
      ...content.map(c => ({ sort: 'content' as const, content: c })),
    ],
    [modules, content],
  )

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

  const goTo = useCallback((view: ModuleEntry['id'], category: ModuleEntry['category']) => {
    navigate(view, category)
    setQuery('')
    setContent([])
    setOpen(false)
    inputRef.current?.blur()
  }, [navigate])

  type Row = (typeof results)[number]
  const openRow = useCallback((row: Row) => {
    if (row.sort === 'module') goTo(row.module.id, row.module.category)
    else                       goTo(row.content.view, row.content.category)
  }, [goTo])

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
      if (target) openRow(target)
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
          placeholder="Search Zenith…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="module-search-results"
          aria-autocomplete="list"
          aria-label="Search modules and your content"
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
            <p className={styles.empty}>
              {query.trim().length < MIN_QUERY
                ? 'Keep typing…'
                : `Nothing matches “${query.trim()}”.`}
            </p>
          ) : (
            <ul className={styles.list}>
              {results.map((row, i) => {
                /* The heading is rendered by the first row of each
                   section rather than as its own list item, so the
                   arrow keys never land on something you cannot open. */
                const isFirstContent =
                  row.sort === 'content' && (results[i - 1]?.sort !== 'content')

                return (
                  <li key={row.sort === 'module' ? `m:${row.module.id}` : row.content.key}
                      role="option" aria-selected={i === activeIdx}>
                    {isFirstContent && (
                      <p className={styles.sectionHeading} aria-hidden="true">In your Zenith</p>
                    )}
                    <button
                      type="button"
                      className={`${styles.result} ${i === activeIdx ? styles.resultActive : ''}`}
                      onClick={() => openRow(row)}
                      onMouseEnter={() => setActiveIdx(i)}
                    >
                      {row.sort === 'module' ? (
                        <>
                          <span className={styles.resultBody}>
                            <span className={styles.resultLabel}>{row.module.label}</span>
                            <span className={styles.resultHint}>{row.module.hint}</span>
                          </span>
                          {row.module.category && (
                            <span className={styles.resultCat} data-cat={row.module.category}>
                              {CATEGORY_LABEL[row.module.category]}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className={styles.resultBody}>
                            <span className={styles.resultLabel}>{row.content.title}</span>
                            <span className={styles.resultHint}>
                              {row.content.snippet || row.content.meta || KIND_LABEL[row.content.kind]}
                            </span>
                          </span>
                          <span className={styles.resultKind} data-kind={row.content.kind}>
                            {KIND_LABEL[row.content.kind]}
                          </span>
                        </>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
