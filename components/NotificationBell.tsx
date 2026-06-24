'use client'

/**
 * NotificationBell — Topbar in-app notification centre.
 *
 * Panel is rendered as a React portal on document.body so it escapes the
 * Topbar's backdrop-filter stacking context. Closing uses a document-level
 * `click` listener (not mousedown) so button actions always fire before the
 * outside-click check runs.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNav } from '@/lib/NavContext'
import { NAV_CONFIG, type ViewId, type CategoryId } from '@/lib/nav-config'
import { useNotificationCenter } from '@/lib/hooks/useNotificationCenter'
import { DEFAULT_CHECKLIST } from '@/lib/notificationCenter'
import styles from './NotificationBell.module.css'

/* Flat ViewId → CategoryId map built once from the nav taxonomy. */
const VIEW_CATEGORY: Record<string, CategoryId> = (() => {
  const map: Record<string, CategoryId> = {}
  for (const cat of NAV_CONFIG) {
    for (const link of cat.links ?? []) map[link.id] = link.category
    for (const sub of cat.subcategories ?? []) {
      for (const link of sub.links) map[link.id] = link.category
    }
  }
  return map
})()

function timeAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60)    return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)    return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)    return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationBell() {
  const { navigate } = useNav()
  const {
    notifications, unseen, dueToday, checklist, checklistDone,
    markAllSeen, dismiss, clearAll, toggleChecklistItem,
  } = useNotificationCenter()

  const [open, setOpen]          = useState(false)
  const [customizing, setCustom] = useState(false)
  const [mounted, setMounted]    = useState(false)
  /* Notifications mid-swipe-out — kept in the DOM until the animation ends,
     then removed from the store. Lets users rapid-fire ✕ individual rows
     while the rest of the panel stays put. */
  const [exiting, setExiting]    = useState<Set<string>>(new Set())

  const rootRef      = useRef<HTMLDivElement>(null)
  const panelRef     = useRef<HTMLDivElement>(null)
  const panelPosRef  = useRef({ top: 0, right: 0 })

  /* SSR guard — portal requires document. */
  useEffect(() => { setMounted(true) }, [])

  /* Toggle: compute panel position synchronously before state update so
     the portal renders at the correct coordinates on its first frame. */
  const handleToggle = useCallback(() => {
    if (rootRef.current) {
      const r = rootRef.current.getBoundingClientRect()
      panelPosRef.current = { top: r.bottom + 10, right: window.innerWidth - r.right }
    }
    setOpen(prev => {
      if (!prev) markAllSeen()
      return !prev
    })
  }, [markAllSeen])

  /* Close on outside click.
     Using 'click' (not 'mousedown') guarantees that any button inside the
     panel fires its React onClick BEFORE this listener runs. */
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t))  return  // inside bell button
      if (panelRef.current?.contains(t)) return  // inside portal panel
      setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  /* Escape closes. */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const go = useCallback((view?: ViewId) => {
    if (!view) return
    navigate(view, view === 'home' ? null : (VIEW_CATEGORY[view] ?? 'essentials'))
    setOpen(false)
  }, [navigate])

  /* Swipe a single notification off-screen, then drop it from the store.
     Panel stays open the whole time. */
  const handleDismiss = useCallback((id: string) => {
    setExiting(prev => {
      if (prev.has(id)) return prev          // already animating — ignore repeat
      const next = new Set(prev)
      next.add(id)
      return next
    })
    window.setTimeout(() => {
      dismiss(id)
      setExiting(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 240)
  }, [dismiss])

  const enabledIds = new Set(checklist.map(c => c.id))

  /* Panel rendered as a portal at document.body so it sits in the root
     stacking context, independent of the Topbar's backdrop-filter context. */
  const panel = open && mounted ? createPortal(
    <div
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-label="Notifications"
      style={{
        position: 'fixed',
        top:      panelPosRef.current.top,
        right:    panelPosRef.current.right,
        zIndex:   320,
      }}
    >
      {/* ── Today summary ─────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Today</span>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => setCustom(v => !v)}
          >
            {customizing ? 'Done' : 'Customize'}
          </button>
        </div>

        {dueToday.length > 0 ? (
          <ul className={styles.dueList}>
            {dueToday.map(d => (
              <li key={d.id} className={styles.dueItem}>
                <span className={styles.dueDot} data-kind={d.kind} aria-hidden="true" />
                <span className={styles.dueTitle}>{d.title}</span>
                <span className={styles.dueWhen}>{d.when}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyLine}>Nothing due today. Clear runway. ✦</p>
        )}

        <div className={styles.checklistHead}>
          <span className={styles.checklistLabel}>Daily checklist</span>
          {!customizing && checklist.length > 0 && (
            <span className={styles.checklistCount}>{checklistDone}/{checklist.length}</span>
          )}
        </div>

        {customizing ? (
          <ul className={styles.customList}>
            {DEFAULT_CHECKLIST.map(item => {
              const on = enabledIds.has(item.id)
              return (
                <li key={item.id} className={styles.customItem}>
                  <span className={styles.checkIcon} aria-hidden="true">{item.icon}</span>
                  <span className={styles.customLabel}>{item.label}</span>
                  <button
                    type="button"
                    className={`${styles.toggle} ${on ? styles.toggleOn : ''}`}
                    role="switch"
                    aria-checked={on}
                    aria-label={`${on ? 'Remove' : 'Add'} ${item.label}`}
                    onClick={() => toggleChecklistItem(item.id, !on)}
                  >
                    <span className={styles.toggleThumb} />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : checklist.length > 0 ? (
          <ul className={styles.checkList}>
            {checklist.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`${styles.checkRow} ${item.done ? styles.checkRowDone : ''}`}
                  onClick={() => go(item.view)}
                >
                  <span className={styles.checkBox} aria-hidden="true">
                    {item.done ? '✓' : item.icon}
                  </span>
                  <span className={styles.checkText}>{item.label}</span>
                  <span className={styles.checkGo} aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyLine}>No checklist items. Add some via Customize.</p>
        )}
      </div>

      {/* ── Feed ──────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Notifications</span>
          {notifications.length > 0 && (
            <button type="button" className={styles.linkBtn} onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className={styles.emptyLine}>You&apos;re all caught up.</p>
        ) : (
          <ul className={styles.feedList}>
            {notifications.map(n => (
              <li
                key={n.id}
                className={`${styles.feedItem} ${exiting.has(n.id) ? styles.feedItemExiting : ''}`}
                data-type={n.type}
              >
                <button
                  type="button"
                  className={styles.feedMain}
                  onClick={() => go(n.view)}
                >
                  <span className={styles.feedIcon} aria-hidden="true">{n.icon}</span>
                  <span className={styles.feedBody}>
                    <span className={styles.feedTitle}>{n.title}</span>
                    {n.body && <span className={styles.feedText}>{n.body}</span>}
                    <span className={styles.feedTime}>{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.feedDismiss}
                  onClick={() => handleDismiss(n.id)}
                  aria-label="Dismiss notification"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.bellBtn} ${open ? styles.bellBtnActive : ''}`}
        onClick={handleToggle}
        aria-label={unseen > 0 ? `Notifications, ${unseen} new` : 'Notifications'}
        aria-expanded={open}
        title="Notifications"
      >
        <svg
          className={styles.bellIcon}
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 1.5a3 3 0 0 0-3 3v3L2.5 9.5h9L10 7.5v-3a3 3 0 0 0-3-3z" />
          <path d="M5.75 11.5a1.25 1.25 0 0 0 2.5 0" />
        </svg>
        {unseen > 0 && <span className={styles.dot} aria-hidden="true" />}
      </button>
      {panel}
    </div>
  )
}
