/**
 * components/views/NotesView.tsx — the Notes module.
 *
 * Capture without classification. Open, type, close. Everything else in
 * Zenith asks you to decide what a thing is before you write it — a habit
 * needs a goal, an assignment needs a due date. Notes asks for nothing,
 * and that is the whole feature.
 *
 * Built on the existing `quickNotes` table (IDB v1), which was already
 * the right shape and was only being used as a scratchpad inside Study
 * Shield. Anything captured there shows up here.
 */

'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type QuickNote } from '@/lib/db'
import { useToast } from '@/lib/ToastContext'
import {
  pendingTasks, toggleLine, checklistProgress, type DetectedTask,
} from '@/lib/engines/NoteTaskDetector'
import {
  resolvePolicy, setGlobalPolicy, POLICY_EVENT, type NotePolicy,
} from '@/lib/notePolicy'
import ZenHeading from '@/components/ui/ZenHeading'
import styles from './NotesView.module.css'

/** Debounce before a keystroke reaches IndexedDB. */
const AUTOSAVE_MS = 600

/** First non-empty line, used when the user never writes a title. */
function deriveTitle(body: string): string {
  const first = body.split('\n').map(l => l.replace(/^[#\s>*-]+/, '').trim()).find(Boolean)
  return (first ?? '').slice(0, 80) || 'Untitled note'
}

function relativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000)
  if (mins < 1)    return 'just now'
  if (mins < 60)   return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)    return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)    return `${days}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/* ══════════════════════════════════════════════════════════════════ */

export default function NotesView() {
  const { toast } = useToast()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query,      setQuery]      = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [draft,      setDraft]      = useState('')
  const [policyTick, setPolicyTick] = useState(0)

  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editingRef  = useRef<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /* Re-resolve consent when the global setting changes elsewhere. */
  useEffect(() => {
    const bump = () => setPolicyTick(t => t + 1)
    window.addEventListener(POLICY_EVENT, bump)
    return () => window.removeEventListener(POLICY_EVENT, bump)
  }, [])

  const notes = useLiveQuery(
    async () => (db ? db.quickNotes.orderBy('updatedAt').reverse().toArray() : []),
    [],
  )
  const loaded = notes !== undefined
  const all: QuickNote[] = useMemo(() => notes ?? [], [notes])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all
      .filter(n => (showArchived ? n.archived === 1 : n.archived !== 1))
      .filter(n => !q
        || n.title.toLowerCase().includes(q)
        || n.body.toLowerCase().includes(q)
        || (n.tags ?? []).some(t => t.toLowerCase().includes(q)))
      .sort((a, b) => {
        // Pinned first, then most recently touched.
        const p = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
        return p !== 0 ? p : b.updatedAt - a.updatedAt
      })
  }, [all, query, showArchived])

  const selected = useMemo(
    () => all.find(n => n.id === selectedId) ?? null,
    [all, selectedId],
  )

  /* Load the selected note into the editor. Guarded on id so a live
     re-render from our own autosave doesn't clobber in-flight typing. */
  useEffect(() => {
    if (selected && editingRef.current !== selected.id) {
      editingRef.current = selected.id
      setDraft(selected.body)
    }
    if (!selected) editingRef.current = null
  }, [selected])

  /* ── Persistence ─────────────────────────────────────────────── */

  const persist = useCallback(async (id: number, body: string) => {
    if (!db) return
    await db.quickNotes.update(id, {
      body,
      title:     deriveTitle(body),
      updatedAt: Date.now(),
    })
  }, [])

  const onDraftChange = (body: string) => {
    setDraft(body)
    if (selectedId == null) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void persist(selectedId, body) }, AUTOSAVE_MS)
  }

  /* Flush any pending save on unmount — losing the last few keystrokes
     because the user navigated away would be the worst possible bug in a
     capture tool. */
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const id = editingRef.current
    if (id != null) void persist(id, draftRef.current)
  }, [persist])
  const draftRef = useRef(draft)
  draftRef.current = draft

  const createNote = async () => {
    if (!db) return
    const now = Date.now()
    const id = await db.quickNotes.add({
      title: 'Untitled note', body: '', category: 'idea',
      createdAt: now, updatedAt: now,
    } as QuickNote)
    setSelectedId(id as number)
    setShowArchived(false)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const toggleChecklistLine = async (line: number) => {
    if (selectedId == null) return
    const next = toggleLine(draft, line)
    setDraft(next)
    await persist(selectedId, next)
  }

  const setArchived = async (n: QuickNote, archived: boolean) => {
    if (!db || n.id == null) return
    await db.quickNotes.update(n.id, { archived: archived ? 1 : 0, updatedAt: Date.now() })
    if (archived && selectedId === n.id) setSelectedId(null)
    toast(archived ? 'Note archived.' : 'Note restored.', 'info')
  }

  const togglePinned = async (n: QuickNote) => {
    if (!db || n.id == null) return
    await db.quickNotes.update(n.id, { pinned: !n.pinned })
  }

  const setPrivate = async (n: QuickNote, priv: boolean) => {
    if (!db || n.id == null) return
    await db.quickNotes.update(n.id, { privateFromAi: priv })
    toast(priv
      ? 'This note is now hidden from the AI Co-Pilot.'
      : 'The Co-Pilot can read this note again.', 'info')
  }

  /* ── To-do detection ─────────────────────────────────────────── */

  const detected: DetectedTask[] = useMemo(
    () => (selected ? pendingTasks(draft, selected.createdTasks ?? []) : []),
    [draft, selected],
  )

  const outcome = useMemo(
    () => resolvePolicy(selected?.noteTaskPolicy),
    // policyTick re-resolves when the global setting changes elsewhere.
    [selected?.noteTaskPolicy, policyTick],
  )

  const fileTasks = useCallback(async (tasks: DetectedTask[]) => {
    if (!db || !selected?.id || tasks.length === 0) return 0
    const now = Date.now()
    const today = new Date()
    const due = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    for (const t of tasks) {
      await db.assignments.add({
        title:     t.text,
        dueDate:   due,
        courseId:  '',
        status:    'pending',
        priority:  'medium',
        category:  'notes',
        notes:     `From note: ${selected.title}`,
        createdAt: now,
        updatedAt: now,
      } as never)
    }

    await db.quickNotes.update(selected.id, {
      createdTasks: [...(selected.createdTasks ?? []), ...tasks.map(t => t.text)],
    })
    return tasks.length
  }, [selected])

  /* Silent creation when the user has opted into that globally or for
     this note. Runs after the debounce so it fires on settled text, not
     mid-word. */
  useEffect(() => {
    if (outcome !== 'auto' || detected.length === 0) return
    const t = setTimeout(async () => {
      const n = await fileTasks(detected)
      if (n > 0) toast(`Added ${n} to-do${n === 1 ? '' : 's'} from this note.`, 'success')
    }, AUTOSAVE_MS + 200)
    return () => clearTimeout(t)
  }, [outcome, detected, fileTasks, toast])

  const respond = async (
    action: 'approve' | 'deny' | 'approve-never-ask' | 'always',
  ) => {
    if (!db || !selected?.id) return

    if (action === 'deny') {
      await db.quickNotes.update(selected.id, { noteTaskPolicy: 'never' as NotePolicy })
      return
    }

    const n = await fileTasks(detected)

    if (action === 'approve-never-ask') {
      await db.quickNotes.update(selected.id, { noteTaskPolicy: 'auto' as NotePolicy })
    } else if (action === 'always') {
      setGlobalPolicy('always')
    }

    if (n > 0) toast(`Added ${n} to-do${n === 1 ? '' : 's'} to your tasks.`, 'success')
  }

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div className={styles.root}>
      <ZenHeading
        eyebrow="Personalized Vault · Notes"
        title="Notes."
        subtitle="Somewhere to put a thought before you know what it is."
        size="lg"
      />

      <div className={styles.layout}>

        {/* ── List ────────────────────────────────────────────── */}
        <aside className={styles.list} aria-label="Notes">
          <div className={styles.listBar}>
            <input
              className={styles.search}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search notes…"
              aria-label="Search notes"
            />
            <button type="button" className={styles.newBtn} onClick={createNote}>
              + New
            </button>
          </div>

          <button
            type="button"
            className={styles.archiveToggle}
            onClick={() => setShowArchived(a => !a)}
            aria-pressed={showArchived}
          >
            {showArchived ? '← Back to notes' : 'View archive'}
          </button>

          {!loaded && <p className={styles.empty}>Loading…</p>}

          {loaded && visible.length === 0 && (
            <p className={styles.empty}>
              {query
                ? 'Nothing matches that search.'
                : showArchived
                  ? 'Nothing archived.'
                  : 'No notes yet. Press + New and start typing.'}
            </p>
          )}

          <ul className={styles.rows}>
            {visible.map(n => {
              const prog = checklistProgress(n.body)
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`${styles.row} ${selectedId === n.id ? styles.rowActive : ''}`}
                    onClick={() => setSelectedId(n.id ?? null)}
                  >
                    <span className={styles.rowTitle}>
                      {n.pinned && <span className={styles.pin} aria-label="Pinned">▪</span>}
                      {n.title}
                      {n.privateFromAi && (
                        <span className={styles.lock} title="Hidden from the AI Co-Pilot">⊘</span>
                      )}
                    </span>
                    <span className={styles.rowMeta}>
                      {relativeTime(n.updatedAt)}
                      {prog.total > 0 && (
                        <span className={styles.progress}>
                          {prog.done}/{prog.total}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* ── Editor ──────────────────────────────────────────── */}
        <section className={styles.editor} aria-label="Note editor">
          {!selected ? (
            <div className={styles.blank}>
              <span className={styles.blankGlyph} aria-hidden="true">▤</span>
              <p>Select a note, or start a new one.</p>
            </div>
          ) : (
            <>
              <div className={styles.editorBar}>
                <span className={styles.editorTitle}>{selected.title}</span>
                <div className={styles.editorActions}>
                  <button
                    type="button" className={styles.iconBtn}
                    onClick={() => togglePinned(selected)}
                    aria-pressed={!!selected.pinned}
                    title={selected.pinned ? 'Unpin' : 'Pin to top'}
                  >▪</button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${selected.privateFromAi ? styles.iconBtnOn : ''}`}
                    onClick={() => setPrivate(selected, !selected.privateFromAi)}
                    aria-pressed={!!selected.privateFromAi}
                    title={selected.privateFromAi
                      ? 'Hidden from the AI Co-Pilot — click to allow'
                      : 'The Co-Pilot can read this note — click to hide it'}
                  >⊘</button>
                  <button
                    type="button" className={styles.iconBtn}
                    onClick={() => setArchived(selected, selected.archived !== 1)}
                    title={selected.archived === 1 ? 'Restore' : 'Archive'}
                  >{selected.archived === 1 ? '↩' : '⌦'}</button>
                </div>
              </div>

              <textarea
                ref={textareaRef}
                className={`${styles.textarea} scrollbar-zen`}
                value={draft}
                onChange={e => onDraftChange(e.target.value)}
                placeholder={'Start typing…\n\nUse - [ ] for a checklist.'}
                aria-label="Note body"
                spellCheck
              />

              {/* Tappable checklist mirror — the thing that makes a note
                  usable as a to-do list without being a task system. */}
              {checklistProgress(draft).total > 0 && (
                <div className={styles.checklist}>
                  {draft.split('\n').map((line, i) => {
                    const m = /^\s*(?:[-*+]|\d+[.)])\s*\[([ xX])\]\s*(.+?)\s*$/.exec(line)
                    if (!m) return null
                    const done = m[1].toLowerCase() === 'x'
                    return (
                      <label key={i} className={styles.check}>
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => toggleChecklistLine(i)}
                        />
                        <span className={done ? styles.checkDone : ''}>{m[2]}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {/* Consent strip. Inline, never a modal — a modal on save
                  would punish exactly the frictionlessness this exists for. */}
              {outcome === 'prompt' && detected.length > 0 && (
                <div className={styles.consent} role="group" aria-label="Add to-dos to tasks">
                  <p className={styles.consentText}>
                    Found <strong>{detected.length}</strong> to-do
                    {detected.length === 1 ? '' : 's'} here. Add
                    {detected.length === 1 ? ' it' : ' them'} to your tasks?
                  </p>
                  <div className={styles.consentBtns}>
                    <button type="button" className={styles.approve}
                            onClick={() => respond('approve')}>Add</button>
                    <button type="button" className={styles.ghost}
                            onClick={() => respond('approve-never-ask')}>Add &amp; stop asking here</button>
                    <button type="button" className={styles.ghost}
                            onClick={() => respond('always')}>Always add</button>
                    <button type="button" className={styles.deny}
                            onClick={() => respond('deny')}>No</button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
