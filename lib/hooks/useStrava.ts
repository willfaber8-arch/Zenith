/**
 * lib/hooks/useStrava.ts — the browser half of the Strava bridge.
 *
 * The server holds the tokens and fetches the activities; this decides
 * which of them are new and writes them to the local log. Deciding what
 * is new needs the database, and the database only exists here.
 *
 * Vitality Points are deliberately *not* awarded from inside this hook.
 * The balance lives in localStorage and the Workouts view holds it in
 * React state; writing it from two places would leave whichever one did
 * not write it showing a stale number. The hook reports what was earned
 * and the view banks it.
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from '@/lib/db'
import { convertActivities, type StravaActivity } from '@/lib/strava'
import { todayISO } from '@/utils/localDate'
import type { CardioSession } from '@/lib/db'

export interface StravaStatus {
  configured:  boolean
  connected:   boolean
  athleteName: string | null
}

export interface ImportSummary {
  imported:       number
  duplicates:     number
  skipped:        number
  vitalityEarned: number
  /**
   * Minutes imported that were logged *today*.
   *
   * Habits advance on today's activity, and a first sync reaching back
   * three months would otherwise credit today's "30 minutes of cardio"
   * with a year of running in one go.
   */
  todayMinutes:   number
  /** False when Strava had more history than one sync could carry. */
  complete:       boolean
}

export type StravaError =
  | 'not_configured' | 'not_connected' | 'rate_limited'
  | 'unreachable'    | 'upstream_failed'

/**
 * How far back before the newest import to re-check.
 *
 * A watermark alone would miss a backdated upload — a watch synced days
 * after a hike, or an activity edited later. Re-asking for the last few
 * days costs one small request and catches those; anything already held
 * is dropped by the id dedupe anyway.
 */
const OVERLAP_DAYS = 3

/** With nothing imported yet, this is the first bite. */
const FIRST_SYNC_DAYS = 90

const UNKNOWN_STATUS: StravaStatus = { configured: false, connected: false, athleteName: null }

export function useStrava() {
  const [status, setStatus]   = useState<StravaStatus | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError]     = useState<StravaError | null>(null)
  const alive = useRef(true)

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/strava/status', { cache: 'no-store' })
      const body = await res.json() as StravaStatus
      if (alive.current) setStatus(body)
    } catch {
      // Offline, or the route is missing. Either way there is nothing to
      // offer, and an error banner about a feature the user has not asked
      // for is noise.
      if (alive.current) setStatus(UNKNOWN_STATUS)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const connect = useCallback(() => {
    // A full navigation, not fetch: this is an OAuth consent screen and
    // the user has to see it.
    window.location.href = '/api/strava/authorize'
  }, [])

  const disconnect = useCallback(async () => {
    await fetch('/api/strava/disconnect', { method: 'POST' })
    await refresh()
  }, [refresh])

  /**
   * Pull what is new and write it to the cardio log.
   *
   * @param days  Look back this far instead of from the last import.
   *              Used by "import full history".
   */
  const importNow = useCallback(async (days?: number): Promise<ImportSummary | null> => {
    setImporting(true)
    setError(null)
    try {
      /* One read answers both questions: which activity ids are already
         held, and how far back the request needs to reach. */
      const existing = await db.cardioSessions
        .where('stravaActivityId').above(0).toArray()

      const existingIds = new Set(
        existing.map(s => s.stravaActivityId).filter((n): n is number => typeof n === 'number'),
      )

      const q = new URLSearchParams()
      if (days) {
        q.set('days', String(days))
      } else if (existing.length > 0) {
        const newest = Math.max(...existing.map(s => s.completedAt))
        q.set('after', String(Math.floor(newest / 1000) - OVERLAP_DAYS * 86_400))
      } else {
        q.set('days', String(FIRST_SYNC_DAYS))
      }

      const res = await fetch(`/api/strava/activities?${q}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: StravaError } | null
        const reason = body?.error ?? 'upstream_failed'
        if (alive.current) {
          setError(reason)
          if (reason === 'not_connected') void refresh()
        }
        return null
      }

      const body = await res.json() as { activities: StravaActivity[]; complete: boolean }
      const { sessions, skipped, duplicates } = convertActivities(body.activities, existingIds)

      if (sessions.length > 0) {
        await db.cardioSessions.bulkAdd(sessions as CardioSession[])
      }

      const today = todayISO()
      return {
        imported:       sessions.length,
        duplicates,
        skipped,
        vitalityEarned: sessions.reduce((n, s) => n + s.vitalityEarned, 0),
        todayMinutes:   sessions.reduce(
          (n, s) => s.logDate === today ? n + s.durationMinutes : n, 0),
        complete:       body.complete,
      }
    } catch {
      if (alive.current) setError('unreachable')
      return null
    } finally {
      if (alive.current) setImporting(false)
    }
  }, [refresh])

  return { status, importing, error, connect, disconnect, importNow, refresh }
}

/**
 * Human wording for what came back from the OAuth redirect.
 *
 * Separated from the component so the strings are in one place, and so
 * an unrecognised reason still says something rather than nothing.
 */
export function describeCallback(param: string, reason: string | null): {
  text: string; tone: 'success' | 'info' | 'error'
} | null {
  if (param === 'connected') return { text: 'Strava connected.', tone: 'success' }
  if (param === 'cancelled') return { text: 'Strava connection cancelled.', tone: 'info' }
  if (param !== 'error') return null

  switch (reason) {
    case 'scope_denied':
      return { text: 'Strava was connected without permission to read activities — reconnect and tick the activity box.', tone: 'error' }
    case 'not_configured':
      return { text: 'This deployment has no Strava app configured.', tone: 'error' }
    case 'state_mismatch':
      return { text: 'That Strava link had expired. Try connecting again.', tone: 'error' }
    default:
      return { text: 'Could not complete the Strava connection.', tone: 'error' }
  }
}
