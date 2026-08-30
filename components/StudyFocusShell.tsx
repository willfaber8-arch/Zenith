/**
 * components/StudyFocusShell.tsx — a distraction-free wrapper.
 *
 * Wraps any study surface. Inactive it renders its children exactly
 * where they were; active it lifts them onto a full-viewport panel with
 * the sidebar, topbar and the rest of the app out of sight.
 *
 * Two layers of "full screen", because they solve different problems:
 * the overlay removes Zenith's own furniture, and the Fullscreen API
 * removes the browser's. The API is best-effort — Safari refuses it
 * outside some gestures and iOS lacks it entirely — so the overlay is
 * what the feature actually rests on, and a refusal is silent rather
 * than an error about something the user did not ask for.
 */

'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import Icon from '@/components/ui/Icon'
import styles from './StudyFocusShell.module.css'

interface Props {
  /** Shown in the focus panel's header so you know what you are in. */
  title:    string
  subtitle?: string
  /**
   * True when this shell is mounted but its pane is hidden. Vocab
   * Builder keeps both outer tabs mounted, so without this the shell
   * behind the one you are looking at also answers F and Escape — and
   * F would ask for fullscreen twice.
   */
  paused?:  boolean
  children: ReactNode
}

export default function StudyFocusShell({ title, subtitle, paused = false, children }: Props) {
  const [active, setActive] = useState(false)
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const enter = useCallback(() => {
    setActive(true)
    /* Best-effort; the overlay stands on its own if this is refused. */
    void document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])

  const exit = useCallback(() => {
    setActive(false)
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
  }, [])

  /*
   * Leaving browser fullscreen by any route — Escape, F11, the OS —
   * has to close the overlay too, or the two disagree and you are left
   * in a panel with no visible way out.
   */
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setActive(false) }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  /* F toggles, Escape leaves — but never while a field has the caret,
     or F would be swallowed mid-answer. */
  useEffect(() => {
    if (paused) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() === 'f') { e.preventDefault(); active ? exit() : enter() }
      if (e.key === 'Escape' && active)  { e.preventDefault(); exit() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paused, active, enter, exit])

  /* Nothing behind the panel should scroll while it is up. */
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [active])

  useEffect(() => {
    if (active) panelRef.current?.focus()
  }, [active])

  const toggle = (
    <button
      type="button"
      className={styles.enterBtn}
      onClick={enter}
      title="Focus mode (F)"
    >
      <Icon name="grid" size={14} />
      Focus
      <kbd className={styles.kbd}>F</kbd>
    </button>
  )

  /*
   * One wrapper, always in the same place in the tree.
   *
   * This used to portal the children to <body> when active, and to
   * change its own tree shape once mounted. Both move the session to a
   * different position in the React tree, and React reads that as a
   * different component: entering focus mode unmounted the session and
   * mounted a fresh one, so it restarted from card one and threw away
   * everything you had answered.
   *
   * The portal was there because a fixed-position panel inside
   * AppShell's transformed wrapper would have been pinned to the
   * scroll content rather than the viewport. That wrapper now releases
   * its transform once the sign-in animation settles, so `position:
   * fixed` resolves against the viewport again and styling this div in
   * place does the same job without ever moving the children.
   */
  return (
    <div className={active ? styles.panel : undefined}
         ref={panelRef}
         role={active ? 'dialog' : undefined}
         aria-modal={active ? true : undefined}
         aria-label={active ? `${title} — focus mode` : undefined}
         tabIndex={active ? -1 : undefined}>

      {active ? (
        <header className={styles.header}>
          <div className={styles.headText}>
            <span className={styles.headTitle}>{title}</span>
            {subtitle && <span className={styles.headSub}>{subtitle}</span>}
          </div>
          <button type="button" className={styles.exitBtn} onClick={exit}>
            Exit <kbd className={styles.kbd}>Esc</kbd>
          </button>
        </header>
      ) : (
        <div className={styles.toggleRow}>{mounted ? toggle : null}</div>
      )}

      <div className={active ? styles.stage : undefined}>
        <div className={active ? styles.stageInner : undefined}>
          {children}
        </div>
      </div>
    </div>
  )
}
