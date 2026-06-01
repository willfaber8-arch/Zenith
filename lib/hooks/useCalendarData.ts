'use client'
/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — useCalendarData
 * Phase 2 · Step 2.5 — iCal / Canvas Feed Aggregate Engine
 *
 * Exposes:
 *   feeds         — live array of CalendarFeed rows (IndexedDB)
 *   events        — live array of CalendarEvent rows (IndexedDB)
 *   isFetching    — true while a network fetch is in flight
 *   addFeed()     — validate URL → fetch via proxy → parse → store
 *   deleteFeed()  — remove feed row + all its events
 *   refreshFeed() — delete old events → re-fetch → re-parse → re-store
 *
 * All mutations go through IndexedDB; useLiveQuery subscribers
 * update the UI automatically — no manual state lifting needed.
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useCallback } from 'react'
import { useLiveQuery }          from 'dexie-react-hooks'
import { db, type CalendarFeed, type CalendarEvent } from '@/lib/db'
import { useToast }              from '@/lib/ToastContext'
import { parseIcal }             from '@/utils/calendarParser'

/* ── Feed accent colour palette (cycles on add) ─────────────── */

export const FEED_COLORS = [
  '#7c95ff',   // periwinkle  (default)
  '#52cca3',   // sage
  '#ff8fa3',   // rose
  '#ffb347',   // amber
  '#a78bfa',   // violet
  '#38bdf8',   // sky
] as const

function pickColor(existingCount: number): string {
  return FEED_COLORS[existingCount % FEED_COLORS.length]
}

/* ── Proxy fetch helper ─────────────────────────────────────── */

async function fetchIcalViaProxy(url: string): Promise<string> {
  const proxyUrl = `/api/cal-proxy?url=${encodeURIComponent(url)}`
  const res      = await fetch(proxyUrl)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return res.text()
}

/* ── Public hook ─────────────────────────────────────────────── */

export interface UseCalendarDataReturn {
  feeds:        CalendarFeed[]
  events:       CalendarEvent[]
  isFetching:   boolean
  addFeed:      (url: string, label: string) => Promise<void>
  deleteFeed:   (feedId: number)             => Promise<void>
  refreshFeed:  (feed: CalendarFeed)         => Promise<void>
}

export function useCalendarData(): UseCalendarDataReturn {
  const { toast }                       = useToast()
  const [isFetching, setIsFetching]     = useState(false)

  /* ── Live queries ─────────────────────────────────────────── */

  const feeds = useLiveQuery(
    async (): Promise<CalendarFeed[]> => {
      if (!db) return []
      const all = await db.calendarFeeds.toArray()
      return all.sort((a, b) => a.createdAt - b.createdAt)
    },
    [],
    [] as CalendarFeed[],
  )

  const events = useLiveQuery(
    async (): Promise<CalendarEvent[]> => {
      if (!db) return []
      return db.calendarEvents.orderBy('startMs').toArray()
    },
    [],
    [] as CalendarEvent[],
  )

  /* ── Core fetch-parse-store pipeline ─────────────────────── */

  async function fetchAndStore(feedId: number, url: string): Promise<number> {
    const icalText = await fetchIcalViaProxy(url)
    const parsed   = parseIcal(icalText)

    if (parsed.length === 0) {
      throw new Error('No events found in feed — check the URL.')
    }

    /* Dedup by uid within this feed — skip already-stored events */
    const existingUids = new Set(
      (await db.calendarEvents.where('feedId').equals(feedId).toArray())
        .map(e => e.uid),
    )

    const toInsert: Omit<CalendarEvent, 'id'>[] = parsed
      .filter(e => !existingUids.has(e.uid))
      .map(e => ({
        feedId,
        uid:         e.uid,
        title:       e.title,
        startMs:     e.startMs,
        endMs:       e.endMs,
        allDay:      e.allDay  ? 1 : 0,
        is1159:      e.is1159  ? 1 : 0,
        category:    e.category,
        location:    e.location,
        description: e.description,
      }))

    if (toInsert.length > 0) {
      await db.calendarEvents.bulkAdd(toInsert as CalendarEvent[])
    }

    return toInsert.length
  }

  /* ── addFeed ─────────────────────────────────────────────── */

  const addFeed = useCallback(async (url: string, label: string) => {
    if (!db) return

    /* Basic URL validation */
    const clean = url.trim()
    if (!clean) { toast('Please enter a calendar URL.', 'error'); return }

    const normalised = clean.replace(/^webcal:\/\//i, 'https://')
    try { new URL(normalised) } catch {
      toast('Invalid URL — check your feed link.', 'error')
      return
    }

    /* Duplicate guard */
    const dup = await db.calendarFeeds.where('url').equals(clean).first()
    if (dup) { toast(`"${dup.label}" is already added.`, 'info'); return }

    const now     = Date.now()
    const color   = pickColor(feeds.length)
    const feedLabel = label.trim() || 'My Calendar'

    setIsFetching(true)
    try {
      const feedId = await db.calendarFeeds.add({
        label:         feedLabel,
        url:           clean,
        color,
        isActive:      1,
        lastFetchedAt: now,
        createdAt:     now,
      } as CalendarFeed)

      const count = await fetchAndStore(feedId as number, clean)

      await db.calendarFeeds.update(feedId as number, { lastFetchedAt: Date.now() })

      toast(`"${feedLabel}" added — ${count} events imported.`, 'success')
    } catch (err) {
      /* Clean up orphan feed row on failure */
      const orphan = await db.calendarFeeds.where('url').equals(clean).first()
      if (orphan) await db.calendarFeeds.delete(orphan.id)
      toast(`Feed error: ${String(err)}`, 'error')
    } finally {
      setIsFetching(false)
    }
  }, [feeds.length, toast])

  /* ── deleteFeed ──────────────────────────────────────────── */

  const deleteFeed = useCallback(async (feedId: number) => {
    if (!db) return
    await db.calendarEvents.where('feedId').equals(feedId).delete()
    await db.calendarFeeds.delete(feedId)
    toast('Feed removed.', 'info')
  }, [toast])

  /* ── refreshFeed ─────────────────────────────────────────── */

  const refreshFeed = useCallback(async (feed: CalendarFeed) => {
    if (!db) return
    setIsFetching(true)
    try {
      /* Delete all existing events for this feed, then re-fetch */
      await db.calendarEvents.where('feedId').equals(feed.id).delete()
      const count = await fetchAndStore(feed.id, feed.url)
      await db.calendarFeeds.update(feed.id, { lastFetchedAt: Date.now() })
      toast(`"${feed.label}" refreshed — ${count} events loaded.`, 'success')
    } catch (err) {
      toast(`Refresh failed: ${String(err)}`, 'error')
    } finally {
      setIsFetching(false)
    }
  }, [toast])

  return { feeds, events, isFetching, addFeed, deleteFeed, refreshFeed }
}
