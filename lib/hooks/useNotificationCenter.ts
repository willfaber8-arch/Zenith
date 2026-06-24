'use client'

/**
 * lib/hooks/useNotificationCenter.ts — React interface to the in-app
 * notification feed + the live daily-summary.
 *
 * Responsibilities:
 *   • Subscribe to the localStorage-backed notification store and expose
 *     the live list + unseen count + mutators (markAllSeen / dismiss / clear).
 *   • Derive the DAILY SUMMARY live from IDB: what is due today + which of
 *     the user's daily-intention checklist items are already done today.
 *   • Run a lightweight background SCANNER that pushes deduped events
 *     (assignment due soon / overdue, plus a once-per-day summary ping) so
 *     the bell's "new" dot stays meaningful without the user opening a tab.
 */

import { useCallback, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import {
  subscribeNotifications,
  getNotifications,
  unseenCount as readUnseen,
  markAllSeen,
  dismissNotification,
  clearAllNotifications,
  pushNotification,
  getEnabledChecklist,
  setChecklistItemEnabled,
  type ZenithNotification,
  type ChecklistItemDef,
} from '@/lib/notificationCenter'

/* ── Local date helpers ────────────────────────────────────────── */

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
function todayBounds(): [number, number] {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end   = new Date(); end.setHours(23, 59, 59, 999)
  return [start.getTime(), end.getTime()]
}

/* ── Public shapes ─────────────────────────────────────────────── */

export interface DueTodayItem {
  id:    string
  title: string
  when:  string   // "All day" | "2:30 PM" | "due"
  kind:  'assignment' | 'event'
}

export interface ChecklistLiveItem extends ChecklistItemDef {
  done: boolean
}

export interface NotificationCenterApi {
  notifications: ZenithNotification[]
  unseen:        number
  dueToday:      DueTodayItem[]
  checklist:     ChecklistLiveItem[]
  checklistDone: number
  markAllSeen:   () => void
  dismiss:       (id: string) => void
  clearAll:      () => void
  toggleChecklistItem: (id: string, enabled: boolean) => void
}

/* ── Hook ──────────────────────────────────────────────────────── */

export function useNotificationCenter(): NotificationCenterApi {
  /* Store subscription → re-render on any change (this tab or another). */
  const [, force] = useState(0)
  useEffect(() => subscribeNotifications(() => force(v => v + 1)), [])

  const notifications = getNotifications()
  const unseen        = readUnseen()
  const checklistDefs = getEnabledChecklist()

  const [start, end] = todayBounds()
  const iso = todayISO()

  /* ── Live IDB reads for the daily summary ──────────────────── */

  const assignments = useLiveQuery(
    () => db?.assignments.toArray() ?? Promise.resolve([]),
    [], [],
  )
  const personalEvents = useLiveQuery(
    () => db?.personalEvents.where('startMs').between(start, end, true, true).toArray()
       ?? Promise.resolve([]),
    [start, end], [],
  )
  const calendarEvents = useLiveQuery(
    () => db?.calendarEvents.where('startMs').between(start, end, true, true).toArray()
       ?? Promise.resolve([]),
    [start, end], [],
  )
  const todayCompletions = useLiveQuery(
    () => db?.habitCompletions.where('date').equals(iso).toArray() ?? Promise.resolve([]),
    [iso], [],
  )
  const habits = useLiveQuery(
    () => db?.habits.toArray() ?? Promise.resolve([]),
    [], [],
  )
  const focusToday = useLiveQuery(
    () => db?.pomodoroSessions.where('completedAt').between(start, end, true, true).toArray()
       ?? Promise.resolve([]),
    [start, end], [],
  )
  const moodToday = useLiveQuery(
    () => db?.mentalHealthLogs.where('logDate').equals(iso).toArray() ?? Promise.resolve([]),
    [iso], [],
  )
  const cardioToday = useLiveQuery(
    () => db?.cardioSessions.where('logDate').equals(iso).toArray() ?? Promise.resolve([]),
    [iso], [],
  )

  /* ── Due today (assignments + events) ──────────────────────── */

  const dueToday: DueTodayItem[] = []
  for (const a of assignments ?? []) {
    if (a.status === 'completed') continue
    if (a.dueDate === iso) {
      dueToday.push({ id: `a-${a.id}`, title: a.title, when: 'due today', kind: 'assignment' })
    }
  }
  const fmtTime = (ms: number, allDay: number) =>
    allDay ? 'All day'
           : new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  for (const e of personalEvents ?? []) {
    dueToday.push({ id: `pe-${e.id}`, title: e.title, when: fmtTime(e.startMs, e.allDay), kind: 'event' })
  }
  for (const e of calendarEvents ?? []) {
    dueToday.push({ id: `ce-${e.id}`, title: e.title, when: fmtTime(e.startMs, e.allDay), kind: 'event' })
  }

  /* ── Checklist completion detection ─────────────────────────── */

  const completedHabitIds = new Set(
    (todayCompletions ?? []).filter(c => c.count > 0).map(c => c.habitId),
  )
  const sourceLinkedDone = (source: string): boolean => {
    const linked = (habits ?? []).filter(h => h.autoSource === source && h.id != null)
    return linked.some(h => completedHabitIds.has(h.id))
  }

  const detect = (source: ChecklistItemDef['source']): boolean => {
    switch (source) {
      case 'habit':   return completedHabitIds.size > 0
      case 'focus':   return (focusToday ?? []).some(s => s.sessionType === 'work')
      case 'mood':    return (moodToday ?? []).length > 0
      case 'cardio':  return (cardioToday ?? []).length > 0
      case 'vocab':   return sourceLinkedDone('vocab')
      case 'reading': return sourceLinkedDone('reading')
      default:        return false
    }
  }

  const checklist: ChecklistLiveItem[] = checklistDefs.map(def => ({ ...def, done: detect(def.source) }))
  const checklistDone = checklist.filter(c => c.done).length

  /* ── Background scanner: push deduped event notifications ────── */

  useEffect(() => {
    if (!assignments) return
    const now = Date.now()
    const LEAD = 24 * 60 * 60 * 1000   // due within 24 h

    for (const a of assignments) {
      if (a.status === 'completed') continue
      const dueMs = new Date(a.dueDate ?? '').getTime()
      if (Number.isNaN(dueMs)) continue

      if (dueMs > now && dueMs <= now + LEAD) {
        const hrs = (dueMs - now) / 3_600_000
        const label = hrs < 1 ? `${Math.round(hrs * 60)} min` : `${Math.round(hrs)} hr`
        pushNotification({
          id: `assignment-due-${a.id}-${a.dueDate}`,
          type: 'assignment-due', icon: '📋', view: 'calendar',
          title: `Due soon: ${a.title}`, body: `Due in ${label}`,
        })
      } else if (dueMs < now && a.status !== 'overdue') {
        pushNotification({
          id: `assignment-overdue-${a.id}-${a.dueDate}`,
          type: 'assignment-overdue', icon: '🚨', view: 'calendar',
          title: `Overdue: ${a.title}`, body: 'This task is past due',
        })
      }
    }
  }, [assignments])

  /* Once-per-day summary ping (deduped by date). */
  useEffect(() => {
    if (!assignments) return
    const dueCount = dueToday.length
    const parts: string[] = []
    if (dueCount > 0) parts.push(`${dueCount} due today`)
    parts.push(`${checklist.length} daily goal${checklist.length === 1 ? '' : 's'}`)
    pushNotification({
      id: `daily-summary-${iso}`,
      type: 'info', icon: '☀', view: 'outlook',
      title: 'Your day at a glance',
      body: parts.join(' · '),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, assignments != null])

  /* ── Mutators ──────────────────────────────────────────────── */

  const toggleChecklistItem = useCallback((id: string, enabled: boolean) => {
    setChecklistItemEnabled(id, enabled)
  }, [])

  return {
    notifications,
    unseen,
    dueToday,
    checklist,
    checklistDone,
    markAllSeen,
    dismiss: dismissNotification,
    clearAll: clearAllNotifications,
    toggleChecklistItem,
  }
}
