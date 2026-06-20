'use client'

/**
 * lib/notificationCenter.ts — in-app Zenith notification feed.
 *
 * A lightweight, localStorage-backed notification store with a module-level
 * pub/sub bus (same shape as lib/hooks/useWeather) so the Topbar bell, the
 * background scanner, and any feature that pushes a notification all stay in
 * sync — including across browser tabs via the `storage` event.
 *
 * Two surfaces consume this:
 *   • Pushed EVENTS (streak loss, assignment due soon, habit milestone) are
 *     persisted here. They drive the "new" dot on the bell and auto-clear
 *     24 h after the user has seen them (i.e. after they open the bell).
 *   • The DAILY SUMMARY checklist config (which daily intentions to show) is
 *     also persisted here; completion of each item is derived live from IDB
 *     by the hook, not stored.
 *
 * No Dexie / React imports — safe to call from any handler or hook.
 */

import type { ViewId } from '@/lib/nav-config'

/* ── Types ─────────────────────────────────────────────────────── */

export type NotificationType =
  | 'streak-loss'
  | 'assignment-due'
  | 'assignment-overdue'
  | 'event-soon'
  | 'habit-milestone'
  | 'info'

export interface ZenithNotification {
  id:        string          // stable id — drives dedup
  type:      NotificationType
  icon:      string          // emoji glyph
  title:     string
  body?:     string
  view?:     ViewId          // optional deep-link target on click
  createdAt: number
  seenAt?:   number          // set when the bell is opened while visible
}

/* ── Constants ─────────────────────────────────────────────────── */

const STORE_KEY    = 'zenith_notifications_v1'
const CHECKLIST_KEY = 'zenith_daily_checklist_v1'
const MAX_ITEMS    = 60
const SEEN_TTL_MS  = 24 * 60 * 60 * 1000   // auto-clear 24 h after seen

/* ── Daily-summary checklist defaults ──────────────────────────── */

export interface ChecklistItemDef {
  id:     string
  label:  string
  icon:   string
  view:   ViewId
  /** IDB signal used by the hook to auto-detect today's completion. */
  source: 'habit' | 'focus' | 'mood' | 'cardio' | 'vocab' | 'reading'
}

export const DEFAULT_CHECKLIST: readonly ChecklistItemDef[] = [
  { id: 'habit',   label: 'Track a habit',        icon: '◎', view: 'habits',        source: 'habit'   },
  { id: 'focus',   label: 'Complete a focus block', icon: '🧠', view: 'study-shield', source: 'focus' },
  { id: 'mood',    label: 'Log a mood check-in',  icon: '🌤️', view: 'wellness',      source: 'mood'    },
  { id: 'cardio',  label: 'Move your body',       icon: '🏃', view: 'workouts',      source: 'cardio'  },
  { id: 'vocab',   label: 'Review vocabulary',    icon: '📚', view: 'vocab-builder', source: 'vocab'   },
  { id: 'reading', label: 'Read',                 icon: '📖', view: 'book-tracker',  source: 'reading' },
] as const

/* ── Pub/sub bus ───────────────────────────────────────────────── */

type Listener = () => void
const listeners = new Set<Listener>()
let started = false

function emit(): void {
  listeners.forEach(l => { try { l() } catch { /* noop */ } })
}

function ensureStarted(): void {
  if (started || typeof window === 'undefined') return
  started = true
  // Cross-tab sync — another tab wrote the store / checklist.
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY || e.key === CHECKLIST_KEY) emit()
  })
}

export function subscribeNotifications(fn: Listener): () => void {
  ensureStarted()
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/* ── Store read / write ────────────────────────────────────────── */

function readRaw(): ZenithNotification[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as ZenithNotification[]) : []
  } catch { return [] }
}

function writeRaw(list: ZenithNotification[]): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)) } catch { /* noop */ }
}

/** Drop notifications that have been seen for longer than the TTL. */
function prune(list: ZenithNotification[]): ZenithNotification[] {
  const now = Date.now()
  const kept = list.filter(n => !(n.seenAt != null && now - n.seenAt > SEEN_TTL_MS))
  return kept.slice(-MAX_ITEMS)
}

/**
 * Read the live notification list (pruned). Safe to call every render.
 */
export function getNotifications(): ZenithNotification[] {
  const pruned = prune(readRaw())
  // Newest first.
  return [...pruned].sort((a, b) => b.createdAt - a.createdAt)
}

export function unseenCount(): number {
  return getNotifications().filter(n => n.seenAt == null).length
}

/**
 * Push a notification. If one with the same id already exists (and hasn't
 * expired) it is left untouched — this is the dedup guarantee, so scanners
 * can fire freely without spamming.
 */
export function pushNotification(
  n: Omit<ZenithNotification, 'createdAt' | 'seenAt'>,
): void {
  const list = prune(readRaw())
  if (list.some(existing => existing.id === n.id)) return
  list.push({ ...n, createdAt: Date.now() })
  writeRaw(prune(list))
  emit()
}

/** Mark every currently-unseen notification as seen (called on bell open). */
export function markAllSeen(): void {
  const now = Date.now()
  const list = readRaw().map(n => (n.seenAt == null ? { ...n, seenAt: now } : n))
  writeRaw(list)
  emit()
}

export function dismissNotification(id: string): void {
  writeRaw(prune(readRaw().filter(n => n.id !== id)))
  emit()
}

export function clearAllNotifications(): void {
  writeRaw([])
  emit()
}

/* ── Daily checklist config ────────────────────────────────────── */

/** Returns the ordered list of checklist items the user has kept enabled. */
export function getEnabledChecklist(): ChecklistItemDef[] {
  if (typeof window === 'undefined') return [...DEFAULT_CHECKLIST]
  let enabledIds: string[] | null = null
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY)
    if (raw) enabledIds = JSON.parse(raw) as string[]
  } catch { /* noop */ }
  if (!enabledIds) return [...DEFAULT_CHECKLIST]
  const set = new Set(enabledIds)
  return DEFAULT_CHECKLIST.filter(item => set.has(item.id))
}

/** Enable / disable a checklist item and persist. */
export function setChecklistItemEnabled(id: string, enabled: boolean): void {
  if (typeof window === 'undefined') return
  const current = new Set(getEnabledChecklist().map(i => i.id))
  if (enabled) current.add(id)
  else current.delete(id)
  // Persist in canonical order.
  const ordered = DEFAULT_CHECKLIST.filter(i => current.has(i.id)).map(i => i.id)
  try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(ordered)) } catch { /* noop */ }
  emit()
}
