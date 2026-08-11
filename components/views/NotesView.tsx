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
 *
 * ── On the formatting toolbar ────────────────────────────────────────
 * The body has always been Markdown, and the placeholder said so — which
 * is documentation standing in for an interface. You had to already know
 * `- [ ] ` to find the checklist, the single most useful thing a note can
 * do here, because a ticked box in a note becomes a to-do downstream.
 * So the marks that matter got buttons and shortcuts.
 *
 * The storage format did not change. It is still Markdown: what the task
 * detector reads, what the Co-Pilot receives, and what survives export.
 */

'use client'

import {
  useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type QuickNote } from '@/lib/db'
import { useToast } from '@/lib/ToastContext'
import {
  pendingTasks, toggleLine, checklistProgress, detectTasks, type DetectedTask,
} from '@/lib/engines/NoteTaskDetector'
import {
  toggleInline, toggleLineMark, insertLink, insertBlock, continueList,
  hasInlineMark, lineHasMark, parseLine, noteStats,
  type EditState,
} from '@/lib/engines/markdownEditing'
import {
  NOTE_COMMANDS, matchChord, chordLabel, isApple, type NoteCommand,
} from '@/lib/noteCommands'
import {
  resolvePolicy, setGlobalPolicy, POLICY_EVENT, type NotePolicy,
} from '@/lib/notePolicy'
import NoteToolbar from '@/components/NoteToolbar'
import ZenHeading from '@/components/ui/ZenHeading'
import styles from './NotesView.module.css'

/** Debounce before a keystroke reaches IndexedDB. */
const AUTOSAVE_MS = 600

/**
 * First non-empty line, used when the user never writes a title.
 *
 * Uses the line parser rather than stripping a character class, which
 * left the checkbox behind and titled a shopping list "[ ] buy milk".
 * Barely noticeable while checklists needed hand-typed Markdown; not
 * once there is a button for them.
 */
function deriveTitle(body: string): string {
  const first = body
    .split('\n')
    .map(l => parseLine(l).content.trim())
    .find(Boolean)
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

/**
 * Apply an edit to the textarea while keeping the browser's undo stack.
 *
 * Assigning to `value` (or letting React re-render it) clears native
 * undo, so ⌘Z after pressing Bold would blow away the paragraph instead
 * of the asterisks. `insertText` goes through the browser's own editing
 * pipeline and stays undoable, so the transform is reduced to the
 * smallest span that actually changed and inserted that way.
 *
 * Returns false when the command is unavailable, so the caller can fall
 * back to a plain state update rather than silently doing nothing.
 */
function applyWithUndo(
  ta: HTMLTextAreaElement, prev: string, next: EditState,
): boolean {
  let s = 0
  const a = prev, b = next.text
  const max = Math.min(a.length, b.length)
  while (s < max && a[s] === b[s]) s++
  let e = 0
  while (e < max - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++

  const from = s
  const to   = a.length - e
  const insert = b.slice(s, b.length - e)

  ta.setSelectionRange(from, to)
  let ok = false
  try {
    ok = document.execCommand('insertText', false, insert)
  } catch { ok = false }
  if (ok) ta.setSelectionRange(next.selStart, next.selEnd)
  return ok
}

type SaveState = 'idle' | 'dirty' | 'saved'

/* ══════════════════════════════════════════════════════════════════ */

export default function NotesView() {
  const { toast } = useToast()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query,      setQuery]      = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [draft,      setDraft]      = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [policyTick, setPolicyTick] = useState(0)
  const [sel,        setSel]        = useState({ start: 0, end: 0 })
  const [saveState,  setSaveState]  = useState<SaveState>('idle')
  const [showKeys,   setShowKeys]   = useState(false)
  const [apple,      setApple]      = useState(false)

  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editingRef  = useRef<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  /** Selection to restore after React commits a value it owns. */
  const pendingSel  = useRef<{ start: number; end: number } | null>(null)

  useEffect(() => { setApple(isApple()) }, [])

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
      setTitleDraft(selected.titleManual ? selected.title : '')
      setSaveState('idle')
    }
    if (!selected) editingRef.current = null
  }, [selected])

  /* Restore a selection the engine asked for, after React writes value. */
  useLayoutEffect(() => {
    const want = pendingSel.current
    if (!want || !textareaRef.current) return
    pendingSel.current = null
    textareaRef.current.setSelectionRange(want.start, want.end)
    setSel(want)
  }, [draft])

  /* ── Persistence ─────────────────────────────────────────────── */

  const markSaved = useCallback(() => {
    setSaveState('saved')
    if (savedTimer.current) clearTimeout(savedTimer.current)
    // Long enough to notice, short enough not to become furniture.
    savedTimer.current = setTimeout(() => setSaveState('idle'), 2200)
  }, [])

  const persist = useCallback(async (id: number, body: string) => {
    if (!db) return
    const row = await db.quickNotes.get(id)
    await db.quickNotes.update(id, {
      body,
      // A hand-written title is the user's; only derive when there isn't one.
      ...(row?.titleManual ? {} : { title: deriveTitle(body) }),
      updatedAt: Date.now(),
    })
    markSaved()
  }, [markSaved])

  const onDraftChange = (body: string) => {
    setDraft(body)
    if (selectedId == null) return
    setSaveState('dirty')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void persist(selectedId, body) }, AUTOSAVE_MS)
  }

  /* Flush any pending save on unmount — losing the last few keystrokes
     because the user navigated away would be the worst possible bug in a
     capture tool. */
  const draftRef = useRef(draft)
  draftRef.current = draft
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const id = editingRef.current
    if (id != null) void persist(id, draftRef.current)
  }, [persist])

  /* ── Title ───────────────────────────────────────────────────── */

  const onTitleChange = (value: string) => {
    setTitleDraft(value)
    if (selectedId == null) return
    setSaveState('dirty')
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(async () => {
      if (!db) return
      const trimmed = value.trim()
      await db.quickNotes.update(selectedId, trimmed
        // Emptying the field hands naming back to the first line, rather
        // than leaving the note permanently called "".
        ? { title: trimmed, titleManual: true, updatedAt: Date.now() }
        : { title: deriveTitle(draftRef.current), titleManual: false, updatedAt: Date.now() })
      markSaved()
    }, AUTOSAVE_MS)
  }

  /* ── Editing commands ────────────────────────────────────────── */

  /** Current textarea state — read from the DOM, which is authoritative. */
  const readState = useCallback((): EditState | null => {
    const ta = textareaRef.current
    if (!ta) return null
    return { text: ta.value, selStart: ta.selectionStart, selEnd: ta.selectionEnd }
  }, [])

  const commit = useCallback((prev: string, next: EditState) => {
    const ta = textareaRef.current
    if (!ta) return
    if (applyWithUndo(ta, prev, next)) {
      // insertText fires `input`, so onChange has already run; just keep
      // our own copy of the selection in step.
      setSel({ start: next.selStart, end: next.selEnd })
      return
    }
    pendingSel.current = { start: next.selStart, end: next.selEnd }
    onDraftChange(next.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const runCommand = useCallback((cmd: NoteCommand) => {
    const st = readState()
    if (!st) return
    let next: EditState
    switch (cmd.kind) {
      case 'inline':  next = toggleInline(st, cmd.mark);   break
      case 'line':    next = toggleLineMark(st, cmd.mark); break
      case 'link':    next = insertLink(st);               break
      case 'divider': next = insertBlock(st, '---');       break
    }
    if (next.text === st.text && next.selStart === st.selStart) return
    commit(st.text, next)
    textareaRef.current?.focus()
  }, [readState, commit])

  /** Which marks are live at the cursor — drives aria-pressed. */
  const activeMarks = useMemo(() => {
    const out = new Set<string>()
    const st: EditState = { text: draft, selStart: sel.start, selEnd: sel.end }
    const lineStart = draft.lastIndexOf('\n', sel.start - 1) + 1
    const lineEndIdx = draft.indexOf('\n', sel.start)
    const line = draft.slice(lineStart, lineEndIdx === -1 ? draft.length : lineEndIdx)

    for (const spec of NOTE_COMMANDS) {
      if (spec.command.kind === 'inline') {
        if (hasInlineMark(st, spec.command.mark)) out.add(spec.id)
      } else if (spec.command.kind === 'line') {
        if (lineHasMark(line, spec.command.mark)) out.add(spec.id)
      }
    }
    return out
  }, [draft, sel])

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const spec = matchChord(e)
    if (spec) {
      e.preventDefault()
      runCommand(spec.command)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const st = readState()
      if (!st) return
      const next = continueList(st)
      if (next) {
        e.preventDefault()
        commit(st.text, next)
      }
    }
  }

  /* ── Note actions ────────────────────────────────────────────── */

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

  const destroy = async (n: QuickNote) => {
    if (!db || n.id == null) return
    await db.quickNotes.delete(n.id)
    if (selectedId === n.id) setSelectedId(null)
    toast('Note deleted.', 'info')
  }

  const duplicate = async (n: QuickNote) => {
    if (!db) return
    const now = Date.now()
    const id = await db.quickNotes.add({
      ...n, id: undefined,
      title: `${n.title} (copy)`, titleManual: true,
      // A copy has not filed its own to-dos, and inheriting the record of
      // them would silently suppress every task in the duplicate.
      createdTasks: [],
      pinned: false, archived: 0,
      createdAt: now, updatedAt: now,
    } as unknown as QuickNote)
    setSelectedId(id as number)
    toast('Note duplicated.', 'success')
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
        category:     'notes',
        sourceNoteId: selected.id,
        notes:        `From note: ${selected.title}`,
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

  const stats = useMemo(() => noteStats(draft), [draft])

  /*
   * Mirror rows and the mirror's count come from the same call.
   *
   * They used to come from two: the rows from the line parser and the
   * count from the detector, which disagree about a box holding nothing
   * but punctuation. That is a "0/0" header sitting above a visible row.
   */
  const checkItems = useMemo(
    () => detectTasks(draft).filter(t => t.via === 'checkbox'),
    [draft],
  )
  const progress = useMemo(
    () => ({ done: checkItems.filter(t => t.done).length, total: checkItems.length }),
    [checkItems],
  )

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
              type="search"
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
              const isActive = selectedId === n.id
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`${styles.row} ${isActive ? styles.rowActive : ''}`}
                    onClick={() => setSelectedId(n.id ?? null)}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <span className={styles.rowTitle}>
                      {n.pinned && (
                        <>
                          <span className={styles.pin} aria-hidden="true">▪</span>
                          <span className="sr-only">Pinned.</span>
                        </>
                      )}
                      <span className={styles.rowTitleText}>{n.title}</span>
                      {n.privateFromAi && (
                        <>
                          <span className={styles.lock} aria-hidden="true">⊘</span>
                          <span className="sr-only">Hidden from the AI Co-Pilot.</span>
                        </>
                      )}
                    </span>
                    <span className={styles.rowMeta}>
                      <span>Edited {relativeTime(n.updatedAt)}</span>
                      {prog.total > 0 && (
                        <span className={styles.progress}>
                          <span aria-hidden="true">{prog.done}/{prog.total}</span>
                          <span className="sr-only">
                            {prog.done} of {prog.total} checklist items done.
                          </span>
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
                {/*
                  The title is an input, not a label. It used to be derived
                  from the first line with no way to override it, so a note
                  opening "Ok so" was called "Ok so" forever.
                */}
                <input
                  className={styles.titleInput}
                  value={titleDraft}
                  onChange={e => onTitleChange(e.target.value)}
                  placeholder={selected.title || 'Untitled note'}
                  aria-label="Note title"
                  spellCheck={false}
                />
                <div className={styles.editorActions}>
                  <button
                    type="button" className={styles.iconBtn}
                    onClick={() => togglePinned(selected)}
                    aria-pressed={!!selected.pinned}
                    title={selected.pinned ? 'Unpin' : 'Pin to top'}
                  >
                    <span aria-hidden="true">▪</span>
                    <span className="sr-only">{selected.pinned ? 'Unpin note' : 'Pin note to top'}</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${selected.privateFromAi ? styles.iconBtnOn : ''}`}
                    onClick={() => setPrivate(selected, !selected.privateFromAi)}
                    aria-pressed={!!selected.privateFromAi}
                    title={selected.privateFromAi
                      ? 'Hidden from the AI Co-Pilot — click to allow'
                      : 'The Co-Pilot can read this note — click to hide it'}
                  >
                    <span aria-hidden="true">⊘</span>
                    <span className="sr-only">Hide this note from the AI Co-Pilot</span>
                  </button>
                  <button
                    type="button" className={styles.iconBtn}
                    onClick={() => duplicate(selected)}
                    title="Duplicate note"
                  >
                    <span aria-hidden="true">⧉</span>
                    <span className="sr-only">Duplicate note</span>
                  </button>
                  <button
                    type="button" className={styles.iconBtn}
                    onClick={() => setArchived(selected, selected.archived !== 1)}
                    title={selected.archived === 1 ? 'Restore' : 'Archive'}
                  >
                    <span aria-hidden="true">{selected.archived === 1 ? '↩' : '⌦'}</span>
                    <span className="sr-only">
                      {selected.archived === 1 ? 'Restore note' : 'Archive note'}
                    </span>
                  </button>
                  {/* Delete is offered only from the archive: archiving first
                      makes losing a note take two deliberate steps. */}
                  {selected.archived === 1 && (
                    <button
                      type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      onClick={() => destroy(selected)}
                      title="Delete permanently"
                    >
                      <span aria-hidden="true">✕</span>
                      <span className="sr-only">Delete note permanently</span>
                    </button>
                  )}
                </div>
              </div>

              <NoteToolbar onCommand={runCommand} active={activeMarks} />

              <textarea
                ref={textareaRef}
                className={`${styles.textarea} scrollbar-zen`}
                value={draft}
                onChange={e => onDraftChange(e.target.value)}
                onKeyDown={onEditorKeyDown}
                onSelect={e => {
                  const t = e.currentTarget
                  setSel({ start: t.selectionStart, end: t.selectionEnd })
                }}
                placeholder="Start typing…"
                aria-label="Note body"
                aria-describedby="note-editor-help"
                spellCheck
              />

              <p id="note-editor-help" className="sr-only">
                Markdown. Press Enter on a list item to start the next one, or
                on an empty one to leave the list. Formatting controls are in
                the toolbar above.
              </p>

              {/* Tappable checklist mirror — the thing that makes a note
                  usable as a to-do list without being a task system. */}
              {progress.total > 0 && (
                <div className={styles.checklist}>
                  <p className={styles.checklistHead} id="note-checklist-head">
                    Checklist
                    <span className={styles.checklistCount}>
                      {progress.done}/{progress.total}
                    </span>
                  </p>
                  <div role="group" aria-labelledby="note-checklist-head">
                    {checkItems.map(item => (
                      <label key={item.line} className={styles.check}>
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => toggleChecklistLine(item.line)}
                        />
                        <span className={item.done ? styles.checkDone : ''}>
                          {item.text}
                        </span>
                      </label>
                    ))}
                  </div>
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

              {/* ── Status bar ────────────────────────────────── */}
              <div className={styles.statusBar}>
                <span className={styles.stat}>
                  {stats.words} {stats.words === 1 ? 'word' : 'words'}
                </span>
                <span className={styles.statDot} aria-hidden="true">·</span>
                <span className={styles.stat}>{stats.chars} characters</span>

                {/* Announced, not just shown: someone who cannot see the
                    label still needs to know the note is safe to leave. */}
                <span className={styles.saveState} role="status" aria-live="polite">
                  {saveState === 'dirty' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
                </span>

                <button
                  type="button"
                  className={styles.keysBtn}
                  onClick={() => setShowKeys(v => !v)}
                  aria-expanded={showKeys}
                  aria-controls="note-shortcuts"
                >
                  Shortcuts
                </button>
              </div>

              {showKeys && (
                <div className={styles.keys} id="note-shortcuts">
                  <ul className={styles.keyList}>
                    {NOTE_COMMANDS.filter(c => c.chord).map(c => (
                      <li key={c.id} className={styles.keyRow}>
                        <span>{c.label}</span>
                        <kbd className={styles.kbd}>{chordLabel(c.chord, apple)}</kbd>
                      </li>
                    ))}
                    <li className={styles.keyRow}>
                      <span>Continue or leave a list</span>
                      <kbd className={styles.kbd}>Enter</kbd>
                    </li>
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
