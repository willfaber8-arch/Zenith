/**
 * components/CampusEventFeeds.tsx — one-click campus calendar subscription.
 *
 * No aggregator. Zenith already has a complete iCal pipeline — the CORS
 * proxy, a parser with real timezone handling, and live storage — so a
 * campus feed becomes an ordinary CalendarFeed and its events land in the
 * Universal Calendar the user already reads, with the week/month/agenda
 * views they already have.
 *
 * Building a separate events surface would have meant a second refresh
 * mechanism, a second place to look, and no reuse of any of that.
 */

'use client'

import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useToast } from '@/lib/ToastContext'
import { useCalendarData } from '@/lib/hooks/useCalendarData'
import type { CampusEventFeed } from '@/config/universities'
import styles from './CampusEventFeeds.module.css'

export default function CampusEventFeeds({ feeds }: { feeds: CampusEventFeed[] }) {
  const { toast } = useToast()
  const { addFeed } = useCalendarData()
  const [busy, setBusy] = useState<string | null>(null)

  /* Subscription state comes from the calendar's own feed table — the
     single source of truth — rather than a local flag that could drift
     from what the calendar actually holds. */
  const existing = useLiveQuery(
    async () => (db ? db.calendarFeeds.toArray() : []),
    [],
  )
  const subscribedUrls = new Set((existing ?? []).map(f => f.url))

  const subscribe = useCallback(async (feed: CampusEventFeed) => {
    setBusy(feed.id)
    try {
      await addFeed(feed.url, feed.label)
      toast(`Subscribed to ${feed.label}. Events are in your calendar.`, 'success')
    } catch (e) {
      // Campus calendars go down, move, or block proxies. Say which.
      const msg = e instanceof Error ? e.message : 'Could not reach that calendar.'
      toast(msg.length < 120 ? msg : 'Could not reach that calendar.', 'error')
    } finally {
      setBusy(null)
    }
  }, [addFeed, toast])

  if (feeds.length === 0) {
    return (
      <p className={styles.none}>
        No event calendars listed for your campus yet. You can still add any
        public .ics URL from Calendar → iCal Feeds.
      </p>
    )
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>
        These subscribe as ordinary calendar feeds — events appear alongside
        everything else, and unsubscribing happens in Calendar → iCal Feeds.
      </p>

      <ul className={styles.list}>
        {feeds.map(f => {
          const on = subscribedUrls.has(f.url)
          return (
            <li key={f.id} className={styles.feed}>
              <span className={styles.swatch} style={{ background: f.color }} aria-hidden="true" />
              <div className={styles.body}>
                <p className={styles.label}>{f.label}</p>
                {f.description && <p className={styles.desc}>{f.description}</p>}
              </div>
              <button
                type="button"
                className={`${styles.btn} ${on ? styles.btnOn : ''}`}
                onClick={() => !on && subscribe(f)}
                disabled={on || busy === f.id}
              >
                {on ? '✓ Subscribed' : busy === f.id ? 'Adding…' : '+ Subscribe'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
