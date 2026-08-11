/**
 * components/NoteToolbar.tsx — formatting controls for the note editor.
 *
 * Implements the ARIA toolbar pattern: the whole strip is a single tab
 * stop and the arrow keys move between buttons. Twelve individually
 * tabbable controls sitting between the note list and the writing area
 * would mean twelve presses of Tab to get to the thing you came to do,
 * every time, for anyone navigating by keyboard.
 *
 * Buttons use onMouseDown with preventDefault rather than onClick so the
 * textarea never loses focus and the selection survives the press —
 * without that, clicking Bold with text selected deselects it first and
 * the mark lands on an empty cursor.
 */

'use client'

import { useRef, useState, useMemo, useEffect } from 'react'
import {
  NOTE_COMMANDS, chordLabel, isApple,
  type CommandSpec, type NoteCommand,
} from '@/lib/noteCommands'
import styles from './NoteToolbar.module.css'

interface Props {
  onCommand: (cmd: NoteCommand) => void
  /** Ids of commands whose mark is present at the cursor. */
  active:    ReadonlySet<string>
  disabled?: boolean
}

/* ── Icons ────────────────────────────────────────────────────────────
   Inline SVG rather than glyphs: the Unicode options for "checklist"
   and "numbered list" are inconsistent across platforms and some render
   as emoji, which cannot be recoloured to match the button state. */

function Icon({ name }: { name: NonNullable<CommandSpec['icon']> }) {
  const common = {
    width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.5,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true, focusable: false,
  }
  switch (name) {
    case 'bullet':
      return (
        <svg {...common}>
          <circle cx="2.5" cy="4" r="1" fill="currentColor" stroke="none" />
          <circle cx="2.5" cy="8" r="1" fill="currentColor" stroke="none" />
          <circle cx="2.5" cy="12" r="1" fill="currentColor" stroke="none" />
          <path d="M6 4h8M6 8h8M6 12h8" />
        </svg>
      )
    case 'number':
      return (
        <svg {...common}>
          <text x="0" y="5.6" fontSize="5" fill="currentColor" stroke="none"
                fontFamily="var(--font-mono)">1</text>
          <text x="0" y="10" fontSize="5" fill="currentColor" stroke="none"
                fontFamily="var(--font-mono)">2</text>
          <text x="0" y="14.4" fontSize="5" fill="currentColor" stroke="none"
                fontFamily="var(--font-mono)">3</text>
          <path d="M6 4h8M6 8h8M6 12h8" />
        </svg>
      )
    case 'checklist':
      return (
        <svg {...common}>
          <rect x="0.9" y="2.4" width="3.2" height="3.2" rx="0.8" />
          <rect x="0.9" y="9.4" width="3.2" height="3.2" rx="0.8" />
          <path d="M1.7 4l0.8 0.8L3.5 3.2" />
          <path d="M6.4 4h8M6.4 11h8" />
        </svg>
      )
    case 'quote':
      return (
        <svg {...common}>
          <path d="M2 3v10" strokeWidth="2" />
          <path d="M5.5 5h8.5M5.5 8h8.5M5.5 11h5.5" />
        </svg>
      )
    case 'link':
      return (
        <svg {...common}>
          <path d="M6.6 9.4a2.6 2.6 0 0 0 3.9.3l2-2a2.6 2.6 0 0 0-3.7-3.7l-1.1 1.1" />
          <path d="M9.4 6.6a2.6 2.6 0 0 0-3.9-.3l-2 2a2.6 2.6 0 0 0 3.7 3.7l1.1-1.1" />
        </svg>
      )
    case 'rule':
      return (
        <svg {...common}>
          <path d="M1 8h14" />
          <path d="M3.5 4h9M3.5 12h9" opacity="0.35" />
        </svg>
      )
  }
}

/* ══════════════════════════════════════════════════════════════════ */

export default function NoteToolbar({ onCommand, active, disabled }: Props) {
  const [focusIdx, setFocusIdx] = useState(0)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [apple, setApple] = useState(false)

  // Platform detection is a client-only read; doing it during render
  // would make the first paint disagree with the server's.
  useEffect(() => { setApple(isApple()) }, [])

  const groups = useMemo(() => {
    const out: CommandSpec[][] = []
    for (const spec of NOTE_COMMANDS) {
      (out[spec.group] ??= []).push(spec)
    }
    return out
  }, [])

  /* Roving tabindex: one stop for the strip, arrows within it. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = NOTE_COMMANDS.length
    let next = -1
    if (e.key === 'ArrowRight') next = (focusIdx + 1) % n
    else if (e.key === 'ArrowLeft') next = (focusIdx - 1 + n) % n
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End')  next = n - 1
    if (next < 0) return
    e.preventDefault()
    setFocusIdx(next)
    btnRefs.current[next]?.focus()
  }

  let flatIdx = -1

  return (
    <div
      className={styles.bar}
      role="toolbar"
      aria-label="Formatting"
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
    >
      {groups.map((group, gi) => (
        <div className={styles.group} key={gi}>
          {gi > 0 && <span className={styles.sep} aria-hidden="true" />}
          {group.map(spec => {
            flatIdx += 1
            const i  = flatIdx
            const on = active.has(spec.id)
            const kb = chordLabel(spec.chord, apple)
            return (
              <button
                key={spec.id}
                ref={el => { btnRefs.current[i] = el }}
                type="button"
                className={[
                  styles.btn,
                  spec.primary ? styles.btnPrimary : '',
                  on ? styles.btnOn : '',
                  spec.glyph ? styles[`glyph_${spec.id}`] ?? '' : '',
                ].filter(Boolean).join(' ')}
                tabIndex={i === focusIdx ? 0 : -1}
                disabled={disabled}
                /* aria-pressed only where the mark is genuinely stateful.
                   Link and Divider insert something and are done; claiming
                   a pressed state for them would be a lie to a screen
                   reader every time one is used. */
                aria-pressed={spec.command.kind === 'link' || spec.command.kind === 'divider'
                  ? undefined : on}
                aria-keyshortcuts={kb || undefined}
                /*
                 * An explicit label rather than relying on the contents.
                 * The checklist button shows a word AND used to carry a
                 * visually-hidden name, so it announced "Checklist
                 * Checklist" — and hiding that word on narrow screens
                 * would have left the button with no name at all, since
                 * display:none removes it from the accessibility tree.
                 * Naming the button directly is immune to both.
                 */
                aria-label={spec.label}
                title={kb ? `${spec.label} (${kb})` : spec.label}
                onFocus={() => setFocusIdx(i)}
                onMouseDown={e => { e.preventDefault(); onCommand(spec.command) }}
                /* Keyboard activation does not fire mousedown, so Enter and
                   Space need their own path. Click alone is not enough
                   because preventing mousedown suppresses it for the mouse. */
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onCommand(spec.command)
                  }
                }}
              >
                {spec.icon
                  ? <Icon name={spec.icon} />
                  : <span aria-hidden="true">{spec.glyph}</span>}
                {spec.primary && (
                  <span className={styles.btnWord} aria-hidden="true">{spec.label}</span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
