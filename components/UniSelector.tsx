'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — UniSelector
 * Phase 2 · Step 2.3 — Polymorphic University Search & Content Node
 *
 * Onboarding autocomplete picker shown when no universityName is
 * stored in userProfile. Filters UNIVERSITY_REGISTRY as the user
 * types, supports full keyboard navigation, and calls onSelect
 * when a university is committed (click or Enter key).
 *
 * Accessibility:
 *   • combobox / listbox roles
 *   • aria-expanded on input
 *   • aria-activedescendant tracks highlighted option
 *   • Each option has a stable id for aria linking
 * ════════════════════════════════════════════════════════════════
 */

import {
  useState,
  useEffect,
  useRef,
  useId,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import ZenHeading from '@/components/ui/ZenHeading'
import {
  UNIVERSITY_REGISTRY,
  type UniversityEntry,
} from '@/config/universities'
import styles from './UniSelector.module.css'

const MAX_RESULTS = 8   // cap the dropdown to this many suggestions

interface UniSelectorProps {
  onSelect: (entry: UniversityEntry) => void
}

export default function UniSelector({ onSelect }: UniSelectorProps) {
  const [query,    setQuery]    = useState('')
  const [isOpen,   setIsOpen]   = useState(false)
  const [hlIndex,  setHlIndex]  = useState(-1)   // highlighted row index

  const inputRef  = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  /* ── Filtered results ─────────────────────────────────────── */
  const results: UniversityEntry[] = query.length > 0
    ? UNIVERSITY_REGISTRY.filter(u =>
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.shortName.toLowerCase().includes(query.toLowerCase()),
      ).slice(0, MAX_RESULTS)
    : UNIVERSITY_REGISTRY.slice(0, MAX_RESULTS)   // show top-N on empty query

  const hasResults = results.length > 0

  /* ── Auto-focus on mount ──────────────────────────────────── */
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  /* ── Reset highlight when results change ─────────────────── */
  useEffect(() => {
    setHlIndex(-1)
  }, [query])

  /* ── Input handlers ───────────────────────────────────────── */

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setIsOpen(true)
  }

  const handleFocus = () => setIsOpen(true)

  const handleBlur = () => {
    // Delay hiding so option mousedown fires before the dropdown disappears
    setTimeout(() => setIsOpen(false), 160)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && e.key !== 'Escape') {
      setIsOpen(true)
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHlIndex(i => (i < results.length - 1 ? i + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHlIndex(i => (i > 0 ? i - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (hlIndex >= 0 && results[hlIndex]) {
          commit(results[hlIndex])
        } else if (results.length === 1) {
          // Only one match — commit on Enter even without explicit highlight
          commit(results[0])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHlIndex(-1)
        break
    }
  }

  /* ── Option selection ─────────────────────────────────────── */

  const commit = (entry: UniversityEntry) => {
    setIsOpen(false)
    setQuery(entry.name)
    onSelect(entry)
  }

  const handleOptionMouseDown = (e: React.MouseEvent, entry: UniversityEntry) => {
    // Prevent the input's onBlur from firing before this click lands
    e.preventDefault()
    commit(entry)
  }

  /* ── Active descendant id ─────────────────────────────────── */
  const activeDescendantId = hlIndex >= 0
    ? `${listboxId}-option-${hlIndex}`
    : undefined

  return (
    <div className={`${styles.wrap} anim-scale-in`}>

      {/* ── Page heading ────────────────────────────────────── */}
      <div className={styles.heading}>
        <ZenHeading
          eyebrow="Scholastic · University Hub"
          title={`Configure your\nInstitution.`}
          subtitle="Search for your school to load its personalised resource links, portals, and campus tools."
          size="lg"
        />
      </div>

      {/* ── Search field ────────────────────────────────────── */}
      <div className={styles.fieldGroup}>

        <label className={styles.fieldLabel} htmlFor="uni-search">
          Your University
        </label>

        {/* Combobox wrapper — positions the dropdown */}
        <div className={styles.combobox}>

          <div className={styles.inputRow}>
            <span className={styles.searchIcon} aria-hidden="true">⌕</span>

            <input
              id="uni-search"
              ref={inputRef}
              type="text"
              role="combobox"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={styles.input}
              placeholder="e.g. Cornell University, MIT, Stanford…"
              value={query}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              aria-expanded={isOpen && hasResults}
              aria-controls={listboxId}
              aria-activedescendant={activeDescendantId}
              aria-autocomplete="list"
            />

            {/* Clear button — only when there is text */}
            {query.length > 0 && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => { setQuery(''); setHlIndex(-1); inputRef.current?.focus() }}
                aria-label="Clear search"
                tabIndex={-1}
              >
                ✕
              </button>
            )}
          </div>

          {/* ── Dropdown ──────────────────────────────────── */}
          {isOpen && hasResults && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="University suggestions"
              className={styles.dropdown}
            >
              {results.map((entry, idx) => (
                <li
                  key={entry.id}
                  id={`${listboxId}-option-${idx}`}
                  role="option"
                  aria-selected={idx === hlIndex}
                  className={`${styles.option} ${idx === hlIndex ? styles.optionHighlighted : ''}`}
                  onMouseDown={e => handleOptionMouseDown(e, entry)}
                  onMouseEnter={() => setHlIndex(idx)}
                >
                  <span className={styles.optionName}>{entry.name}</span>

                  {entry.hasData ? (
                    <span className={`${styles.badge} ${styles.badgeLive}`}>
                      Full Data
                    </span>
                  ) : (
                    <span className={`${styles.badge} ${styles.badgeSoon}`}>
                      Coming Soon
                    </span>
                  )}
                </li>
              ))}

              {/* Hint at bottom when showing fewer than total */}
              {UNIVERSITY_REGISTRY.length > MAX_RESULTS && query.length === 0 && (
                <li className={styles.hint} aria-hidden="true">
                  {UNIVERSITY_REGISTRY.length - MAX_RESULTS} more — keep typing to narrow
                </li>
              )}
            </ul>
          )}

          {/* Empty state */}
          {isOpen && !hasResults && query.length > 0 && (
            <div className={styles.emptyState} role="status" aria-live="polite">
              No matching institution found. Your university will be added in a future phase.
            </div>
          )}

        </div>

        <p className={styles.fieldHint}>
          Only institutions with a <span className={`${styles.badge} ${styles.badgeLive} ${styles.badgeInline}`}>Full Data</span> badge load a resource hub immediately.
        </p>

      </div>

    </div>
  )
}
