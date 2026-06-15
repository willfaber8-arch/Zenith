'use client'

import { useEffect } from 'react'
import { db }        from '@/lib/db'

/* ── Constants ──────────────────────────────────────────────── */

const POLL_MS       = 5 * 60 * 1000   // check every 5 min
const EVENT_LEAD_MS = 30 * 60 * 1000  // warn 30 min before event start
const TASK_LEAD_MS  = 2 * 60 * 60 * 1000 // warn 2 hours before due
const FIRED_KEY     = 'zenith_notif_fired_v1'

/* ── Dedup helpers ──────────────────────────────────────────── */

function getFiredSet(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch { return new Set() }
}

function markFired(id: string): void {
  const set = getFiredSet()
  set.add(id)
  // Keep last 500 IDs to avoid unbounded growth
  const arr = [...set].slice(-500)
  try { localStorage.setItem(FIRED_KEY, JSON.stringify(arr)) } catch {}
}

/* ── Fire a notification (deduped) ─────────────────────────── */

function fireNotif(title: string, body: string, dedupId: string): void {
  if (Notification.permission !== 'granted') return
  if (getFiredSet().has(dedupId)) return
  markFired(dedupId)
  // eslint-disable-next-line no-new
  new Notification(title, { body, icon: '/favicon.ico' })
}

/* ── Check logic ─────────────────────────────────────────────── */

async function checkUpcoming(): Promise<void> {
  if (!db) return
  const now = Date.now()

  // ── Calendar feed events starting soon ──────────────────────
  const calEvts = await db.calendarEvents
    .where('startMs')
    .between(now + 1, now + EVENT_LEAD_MS, false, true)
    .toArray()

  for (const ev of calEvts) {
    const mins = Math.round((ev.startMs - now) / 60_000)
    fireNotif(
      `⏰ ${ev.title}`,
      `Starting in ${mins} min`,
      `cal-${ev.id}-${Math.floor(ev.startMs / 60_000)}`,
    )
  }

  // ── Personal events starting soon ──────────────────────────
  const persEvts = await db.personalEvents
    .where('startMs')
    .between(now + 1, now + EVENT_LEAD_MS, false, true)
    .toArray()

  for (const ev of persEvts) {
    const mins = Math.round((ev.startMs - now) / 60_000)
    fireNotif(
      `⏰ ${ev.title}`,
      `Starting in ${mins} min`,
      `pers-${ev.id}-${Math.floor(ev.startMs / 60_000)}`,
    )
  }

  // ── Assignments due soon ─────────────────────────────────────
  const assignments = await db.assignments.toArray()
  for (const a of assignments) {
    if (a.status === 'completed') continue
    const dueMs = new Date(a.dueDate ?? '').getTime()
    if (Number.isNaN(dueMs)) continue

    if (dueMs > now && dueMs <= now + TASK_LEAD_MS) {
      const hrs = (dueMs - now) / 3_600_000
      const label = hrs < 1
        ? `${Math.round(hrs * 60)} min`
        : `${Math.round(hrs * 10) / 10} hr`
      fireNotif(
        `📋 Due soon: ${a.title}`,
        `Due in ${label}`,
        `task-${a.id}-${Math.floor(dueMs / 3_600_000)}`,
      )
    } else if (dueMs < now && a.status !== 'overdue') {
      fireNotif(
        `🚨 Overdue: ${a.title}`,
        'This task is now past due',
        `overdue-${a.id}-${a.dueDate ?? ''}`,
      )
    }
  }
}

/* ── Hook ─────────────────────────────────────────────────────── */

export function useNotifications(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    async function init() {
      if (Notification.permission === 'default') {
        await Notification.requestPermission()
      }
      if (Notification.permission === 'granted') {
        await checkUpcoming()
      }
    }

    void init()

    const id = setInterval(() => {
      if (Notification.permission === 'granted') void checkUpcoming()
    }, POLL_MS)

    return () => clearInterval(id)
  }, [])
}
