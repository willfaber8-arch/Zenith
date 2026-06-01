'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — MajorSelector
 * Phase 2 · Step 2.4 — Major-Specific Link Matrix & Resource Hub
 *
 * Onboarding combobox shown when no majorIdentifier is stored in
 * userProfile. Filters MAJOR_REGISTRY as the user types, supports
 * keyboard navigation, and calls onSelect when a major is committed.
 *
 * Mirrors UniSelector's combobox/listbox ARIA pattern exactly.
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
import { MAJOR_REGISTRY, type MajorEntry } from '@/config/majors'
import styles from './MajorSelector.module.css'

const MAX_RESULTS = 8

interface MajorSelectorProps {
  onSelect: (entry: MajorEntry) => void
}

export default function MajorSelector({ onSelect }: MajorSelectorProps) {
  const [query,   setQuery]   = useState('')
  const [isOpen,  setIsOpen]  = useState(false)
  const [hlIndex, setHlIndex] = useState(-1)

  const inputRef  = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const results: MajorEntry[] = query.length > 0
    ? MAJOR_REGISTRY.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.shortName.toLowerCase().includes(query.toLowerCase()),
      ).slice(0, MAX_RESULTS)
    : MAJOR_REGISTRY.slice(0, MAX_RESULTS)

  const hasResults = results.length > 0

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => { setHlIndex(-1) }, [query])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setIsOpen(true)
  }

  const handleFocus = () => setIsOpen(true)

  const handleBlur = () => {
    setTimeout(() => setIsOpen(false), 160)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && e.key !== 'Escape') { setIsOpen(true); return }

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
          commit(results[0])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHlIndex(-1)
        break
    }
  }

  const commit = (entry: MajorEntry) => {
    setIsOpen(false)
    setQuery(entry.name)
    onSelect(entry)
  }

  const handleOptionMouseDown = (e: React.MouseEvent, entry: MajorEntry) => {
    e.preventDefault()
    commit(entry)
  }

  const activeDescendantId = hlIndex >= 0
    ? `${listboxId}-option-${hlIndex}`
    : undefined

  return (
    <div className={`${styles.wrap} anim-scale-in`}>

      <div className={styles.heading}>
        <ZenHeading
          eyebrow="Scholastic · Major Hub"
          title={`Declare your\nMajor Track.`}
          subtitle="Select your declared major to load a tailored matrix of specialised academic resources, tools, and technical references."
          size="lg"
        />
      </div>

      <div className={styles.fieldGroup}>

        <label className={styles.fieldLabel} htmlFor="major-search">
          Your Major
        </label>

        <div className={styles.combobox}>

          <div className={styles.inputRow}>
            <span className={styles.searchIcon} aria-hidden="true">⌕</span>

            <input
              id="major-search"
              ref={inputRef}
              type="text"
              role="combobox"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={styles.input}
              placeholder="e.g. Engineering, Computer Science, Pre-Med…"
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

          {isOpen && hasResults && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Major suggestions"
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

              {MAJOR_REGISTRY.length > MAX_RESULTS && query.length === 0 && (
                <li className={styles.hint} aria-hidden="true">
                  {MAJOR_REGISTRY.length - MAX_RESULTS} more — keep typing to narrow
                </li>
              )}
            </ul>
          )}

          {isOpen && !hasResults && query.length > 0 && (
            <div className={styles.emptyState} role="status" aria-live="polite">
              No matching major found. More fields will be added in a future phase.
            </div>
          )}

        </div>

        <p className={styles.fieldHint}>
          Only majors with a{' '}
          <span className={`${styles.badge} ${styles.badgeLive} ${styles.badgeInline}`}>
            Full Data
          </span>{' '}
          badge load a resource hub immediately.
        </p>

      </div>

    </div>
  )
}
