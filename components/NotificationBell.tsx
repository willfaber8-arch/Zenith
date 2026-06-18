'use client'

/**
 * NotificationBell — Topbar in-app notification centre.
 *
 * A bell icon (with a "new" dot when unseen events exist) that opens a
 * dropdown panel containing:
 *   • TODAY — a live daily summary: what's due today + a customizable
 *     checklist of daily intentions across Zenith (auto-detected as done).
 *   • FEED — pushed events (streak loss, assignment due / overdue, daily
 *     summary ping). Clicking one deep-links to the relevant view; each can
 *     be dismissed. Opening the bell marks everything seen (24 h auto-clear).
 */

import { useEffect, useRef, useState, useCallback } from 'react'
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

  const [open, setOpen]           = useState(false)
  const [customizing, setCustom]  = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  /* Opening the bell marks everything seen (starts the 24 h auto-clear). */
  const handleToggle = useCallback(() => {
    setOpen(prev => {
      if (!prev) markAllSeen()
      return !prev
    })
  }, [markAllSeen])

  /* Click-outside + Escape close. */
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = useCallback((view?: ViewId) => {
    if (!view) return
    navigate(view, view === 'home' ? null : (VIEW_CATEGORY[view] ?? 'essentials'))
    setOpen(false)
  }, [navigate])

  const enabledIds = new Set(checklist.map(c => c.id))

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
        <span className={styles.bellIcon} aria-hidden="true">🔔</span>
        {unseen > 0 && <span className={styles.dot} aria-hidden="true" />}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Notifications">

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

            {/* Due today */}
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

            {/* Daily checklist */}
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
                  <li key={n.id} className={styles.feedItem} data-type={n.type}>
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
                      onClick={() => dismiss(n.id)}
                      aria-label="Dismiss notification"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
