/**
 * components/MobileTabBar.tsx — the phone's primary navigation.
 *
 * Zenith has 24 destinations. Putting all of them behind a hamburger
 * would be the desktop design with an extra tap, so this is a different
 * composition of the same modules rather than a smaller copy of the
 * sidebar: five destinations that pass the test in docs/specs/mobile.md
 * — used away from a desk, in under a minute, one-handed.
 *
 *     Today      Log       +      Habits    Notes
 *
 * Everything else stays reachable through the drawer, which becomes an
 * honest overflow list rather than the main way around. Thumbs reach the
 * bottom of a phone; the drawer's toggle sits in the hardest corner of a
 * large one to get to.
 *
 * The centre "+" is a capture action, not a sixth destination. Opening
 * Zenith to write something down should not begin with navigation.
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import Icon, { type IconName } from '@/components/ui/Icon'
import { useNav } from '@/lib/NavContext'
import type { ViewId, CategoryId } from '@/lib/nav-config'
import styles from './MobileTabBar.module.css'

interface Dest {
  view:     ViewId
  category: CategoryId | null
  label:    string
  icon:     IconName
}

/* Two either side of the capture button. */
const LEFT: Dest[] = [
  { view: 'outlook',  category: 'essentials', label: 'Today',  icon: 'sun' },
  { view: 'workouts', category: 'essentials', label: 'Log',    icon: 'barbell' },
]
const RIGHT: Dest[] = [
  { view: 'habits', category: 'essentials', label: 'Habits', icon: 'check' },
  { view: 'notes',  category: 'vault',      label: 'Notes',  icon: 'note' },
]

/**
 * What the "+" offers.
 *
 * Each one lands where the thing can actually be done, and carries a
 * `kind` so the destination can open on the right tab instead of making
 * you find it. A view that does not listen still gets you to the right
 * screen — the event is an improvement, never a dependency.
 */
export type CaptureKind = 'note' | 'cardio' | 'set' | 'habit'

export const CAPTURE_EVENT = 'zenith:capture'

const CAPTURES: { kind: CaptureKind; label: string; hint: string; icon: IconName;
                  view: ViewId; category: CategoryId | null }[] = [
  { kind: 'note',   label: 'Note',         hint: 'Write it down before you lose it',
    icon: 'note',     view: 'notes',    category: 'vault' },
  { kind: 'set',    label: 'Log a set',    hint: 'Today’s strength session',
    icon: 'barbell',  view: 'workouts', category: 'essentials' },
  { kind: 'cardio', label: 'Log cardio',   hint: 'A run, ride or swim',
    icon: 'run',      view: 'workouts', category: 'essentials' },
  { kind: 'habit',  label: 'Tick a habit', hint: 'Mark today’s progress',
    icon: 'check',    view: 'habits',   category: 'essentials' },
]

export default function MobileTabBar() {
  const { activeView, navigate } = useNav()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  /* Escape closes the sheet, like every other overlay in the app. */
  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheetOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  /* Move focus into the sheet so a keyboard or screen reader follows it. */
  useEffect(() => {
    if (sheetOpen) sheetRef.current?.querySelector('button')?.focus()
  }, [sheetOpen])

  const capture = useCallback((c: typeof CAPTURES[number]) => {
    setSheetOpen(false)
    navigate(c.view, c.category)
    /* After the navigation, so the destination is mounted and listening. */
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent<{ kind: CaptureKind }>(
        CAPTURE_EVENT, { detail: { kind: c.kind } }))
    })
  }, [navigate])

  if (!mounted) return null

  const tab = (d: Dest) => {
    const on = activeView === d.view
    return (
      <button
        key={d.view}
        type="button"
        className={`${styles.tab} ${on ? styles.tabOn : ''}`}
        onClick={() => navigate(d.view, d.category)}
        aria-current={on ? 'page' : undefined}
      >
        <Icon name={d.icon} size={21} />
        <span className={styles.tabLabel}>{d.label}</span>
      </button>
    )
  }

  return (
    <>
      {sheetOpen && createPortal(
        <div className={styles.sheetBackdrop} onClick={() => setSheetOpen(false)}>
          <div
            ref={sheetRef}
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label="Capture something"
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.sheetGrip} aria-hidden="true" />
            <p className={styles.sheetTitle}>Capture</p>
            {CAPTURES.map(c => (
              <button
                key={c.kind}
                type="button"
                className={styles.sheetRow}
                onClick={() => capture(c)}
              >
                <span className={styles.sheetIcon}><Icon name={c.icon} size={19} /></span>
                <span className={styles.sheetText}>
                  <span className={styles.sheetLabel}>{c.label}</span>
                  <span className={styles.sheetHint}>{c.hint}</span>
                </span>
                <Icon name="chevronRight" size={15} />
              </button>
            ))}
            <button
              type="button"
              className={styles.sheetCancel}
              onClick={() => setSheetOpen(false)}
            >Cancel</button>
          </div>
        </div>,
        document.body,
      )}

      {/*
        * Portalled to <body>, like the sheet above it.
        *
        * AppShell sits inside a wrapper that carries an inline transform
        * for the sign-in transition. Any transform — including the
        * identity matrix it settles on once the animation finishes —
        * makes that element the containing block for `position: fixed`
        * descendants. Left in place the bar pinned itself to the bottom
        * of the *scroll content* instead of the viewport: 3348px down a
        * 780px screen, present and clickable in the DOM but never
        * visible. Rendering into <body> is the only reliable escape.
        *
        * Not labelled "Primary": the sidebar already is, and two
        * navigation landmarks with the same name are indistinguishable
        * when a screen reader lists them.
        */}
      {createPortal(
        <nav className={styles.bar} aria-label="Bottom navigation">
          {LEFT.map(tab)}

          <button
            type="button"
            className={styles.capture}
            onClick={() => setSheetOpen(v => !v)}
            aria-label="Capture something"
            aria-expanded={sheetOpen}
          >
            <Icon name="plus" size={23} />
          </button>

          {RIGHT.map(tab)}
        </nav>,
        document.body,
      )}
    </>
  )
}
