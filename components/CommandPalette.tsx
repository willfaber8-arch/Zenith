'use client'

/**
 * CommandPalette — ⌘K over everything Zenith can do or hold.
 *
 * Zenith had four keyboard shortcuts. Everything else was reachable
 * only by knowing which screen it lived on and navigating there, which
 * is fine while exploring and slow once you already know what you want.
 *
 * Three kinds of result, in the order they are useful:
 *
 *   Actions   — the few things done constantly, ranked from a short list
 *   Modules   — the thirty-odd places, from the existing keyword index
 *   Your data — tasks, notes, events; the cross-table search from
 *               lib/contentSearch
 *
 * Rendered through a portal to `document.body`. An overlay inside the
 * app tree inherits whatever stacking context its ancestors create, and
 * a transform on one wrapper is enough to trap it — which is exactly
 * how the topbar's own dropdown ended up painting underneath the page.
 */

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useNav } from '@/lib/NavContext'
import { useCopilot } from '@/lib/CopilotContext'
import { buildCommands, rankCommands, type Command } from '@/lib/commands'
import { searchModules, type ModuleEntry } from '@/lib/moduleSearch'
import { searchContent, KIND_LABEL, MIN_QUERY, type ContentResult } from '@/lib/contentSearch'
import styles from './CommandPalette.module.css'

const DEBOUNCE_MS = 160

/** One flat list for the keyboard — arrow keys should not have to know
 *  there are sections. */
type Row =
  | { kind: 'command'; heading?: string; command: Command }
  | { kind: 'module';  heading?: string; module:  ModuleEntry }
  | { kind: 'content'; heading?: string; content: ContentResult }

export default function CommandPalette() {
  const { navigate } = useNav()
  const { open: openCopilot } = useCopilot()

  const [mounted, setMounted] = useState(false)
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [active,  setActive]  = useState(0)
  const [content, setContent] = useState<ContentResult[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLUListElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const commands = useMemo(
    () => buildCommands({ navigate, openCopilot }),
    [navigate, openCopilot],
  )

  /* ── Opening and closing ─────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* Reset each time it opens: a palette that remembers last time's
     query makes you clear it before you can use it. */
  useEffect(() => {
    if (!open) return
    setQuery('')
    setContent([])
    setActive(0)
    /* rAF so the input exists to be focused. */
    const h = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(h)
  }, [open])

  /* The page behind must not scroll under the overlay. */
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  /* ── Results ─────────────────────────────────────────────────── */

  const modules = useMemo(() => (query.trim() ? searchModules(query) : []), [query])
  const ranked  = useMemo(() => rankCommands(commands, query), [commands, query])

  /* Content is a pass over several tables, so it is debounced. `runRef`
     stops a slow query overwriting a faster one that came after it. */
  const runRef = useRef(0)
  useEffect(() => {
    const q = query.trim()
    if (!open || q.length < MIN_QUERY) { setContent([]); return }
    const id = ++runRef.current
    const t = setTimeout(() => {
      void searchContent(q).then(rows => { if (runRef.current === id) setContent(rows) })
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query, open])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    ranked.forEach((c, i) => out.push({ kind: 'command', heading: i === 0 ? 'Do' : undefined, command: c }))
    modules.forEach((m, i) => out.push({ kind: 'module', heading: i === 0 ? 'Go to' : undefined, module: m }))
    content.forEach((c, i) => out.push({ kind: 'content', heading: i === 0 ? 'In your Zenith' : undefined, content: c }))
    return out
  }, [ranked, modules, content])

  useEffect(() => { setActive(0) }, [query])

  /* Keep the highlighted row on screen when arrowing past the fold. */
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const runRow = useCallback((row: Row) => {
    setOpen(false)
    if (row.kind === 'command')      void row.command.run()
    else if (row.kind === 'module')  navigate(row.module.id, row.module.category)
    else                             navigate(row.content.view, row.content.category)
  }, [navigate])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (rows.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % rows.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + rows.length) % rows.length) }
    else if (e.key === 'Enter') { e.preventDefault(); runRow(rows[active] ?? rows[0]) }
  }

  if (!mounted || !open) return null

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}
      role="presentation"
    >
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="What do you want to do?"
          aria-label="Search commands, modules and your data"
          role="combobox"
          aria-expanded
          aria-controls="command-palette-results"
          aria-autocomplete="list"
        />

        <ul className={styles.list} id="command-palette-results" role="listbox" ref={listRef}>
          {rows.length === 0 && (
            <li className={styles.empty}>Nothing matches &ldquo;{query.trim()}&rdquo;.</li>
          )}
          {rows.map((row, i) => (
            <li key={
              row.kind === 'command' ? `c:${row.command.id}`
              : row.kind === 'module' ? `m:${row.module.id}`
              : `d:${row.content.key}`
            }>
              {row.heading && <p className={styles.heading} aria-hidden="true">{row.heading}</p>}
              <button
                type="button"
                data-idx={i}
                role="option"
                aria-selected={i === active}
                className={`${styles.row} ${i === active ? styles.rowActive : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => runRow(row)}
              >
                <span className={styles.body}>
                  <span className={styles.label}>
                    {row.kind === 'command' ? row.command.label
                     : row.kind === 'module' ? row.module.label
                     : row.content.title}
                  </span>
                  <span className={styles.hint}>
                    {row.kind === 'command' ? row.command.hint
                     : row.kind === 'module' ? row.module.hint
                     : (row.content.snippet || row.content.meta)}
                  </span>
                </span>
                {row.kind === 'content' && (
                  <span className={styles.tag}>{KIND_LABEL[row.content.kind]}</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <p className={styles.footer}>
          <kbd>↑</kbd><kbd>↓</kbd> move · <kbd>↵</kbd> open · <kbd>esc</kbd> close
        </p>
      </div>
    </div>,
    document.body,
  )
}
