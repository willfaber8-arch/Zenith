'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — useGameNotifications
 *
 * Browser-notification reminders for followed teams' upcoming games.
 *
 * - Permission is only requested from a user gesture (call `enable()` from
 *   a button handler) — never auto-prompted.
 * - `scan(fixturesByTeam)` looks for any game starting within the next ~24h
 *   that hasn't already been notified (guarded by a localStorage Set,
 *   zenith_sports_notified_v1) and fires a Notification for each.
 * - Fully SSR-safe: every path guards on `typeof window` / `'Notification'
 *   in window`.
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react'
import type { TeamFixture } from '@/types/sports'
import type { FixturesByTeam } from '@/utils/sportsCalendarSync'

const NOTIFIED_KEY = 'zenith_sports_notified_v1'
const HORIZON_MS   = 24 * 3_600_000   // notify for games within the next 24h

export type NotifyPermission = 'default' | 'granted' | 'denied' | 'unsupported'

function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

function readNotified(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function writeNotified(set: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set]))
  } catch {
    /* non-fatal */
  }
}

function fixtureStartMs(f: TeamFixture): number {
  const [y, m, d] = f.date.split('-').map(Number)
  if (!y || !m || !d) return NaN
  if (f.time) {
    const [hh, mm] = f.time.split(':').map(Number)
    return new Date(y, m - 1, d, hh || 0, mm || 0).getTime()
  }
  return new Date(y, m - 1, d).getTime()
}

function fixtureTitle(f: TeamFixture): string {
  return f.isHome ? `${f.homeTeam} vs ${f.awayTeam}` : `${f.awayTeam} @ ${f.homeTeam}`
}

export interface UseGameNotificationsReturn {
  permission: NotifyPermission
  isSupported: boolean
  /** Request permission (call from a user gesture). Returns the new state. */
  enable:     () => Promise<NotifyPermission>
  /** Scan fixtures and fire reminders for games in the next ~24h. */
  scan:       (fixturesByTeam: FixturesByTeam) => number
}

export function useGameNotifications(): UseGameNotificationsReturn {
  const [permission, setPermission] = useState<NotifyPermission>('default')

  useEffect(() => {
    if (!supported()) { setPermission('unsupported'); return }
    setPermission(Notification.permission as NotifyPermission)
  }, [])

  const enable = useCallback(async (): Promise<NotifyPermission> => {
    if (!supported()) { setPermission('unsupported'); return 'unsupported' }
    try {
      const result = await Notification.requestPermission()
      setPermission(result as NotifyPermission)
      return result as NotifyPermission
    } catch {
      return Notification.permission as NotifyPermission
    }
  }, [])

  const scan = useCallback((fixturesByTeam: FixturesByTeam): number => {
    if (!supported() || Notification.permission !== 'granted') return 0

    const notified = readNotified()
    const now      = Date.now()
    let fired      = 0

    for (const fixtures of Object.values(fixturesByTeam)) {
      for (const f of fixtures) {
        if (!f.eventId || notified.has(f.eventId)) continue
        const startMs = fixtureStartMs(f)
        if (!Number.isFinite(startMs)) continue
        const delta = startMs - now
        if (delta <= 0 || delta > HORIZON_MS) continue

        try {
          new Notification('Game tomorrow', {
            body: fixtureTitle(f) + (f.league ? ` · ${f.league}` : ''),
            tag:  `zenith-sports-${f.eventId}`,
          })
          notified.add(f.eventId)
          fired++
        } catch {
          /* Notification construction can throw on some platforms — ignore */
        }
      }
    }

    if (fired > 0) writeNotified(notified)
    return fired
  }, [])

  return { permission, isSupported: supported(), enable, scan }
}
