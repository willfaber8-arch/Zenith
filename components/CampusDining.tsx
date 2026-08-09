/**
 * components/CampusDining.tsx — dining hours for the active university.
 *
 * User-maintained rather than scraped. See docs/specs/campus-companion.md
 * for why; the short version is that a broken scraper shows stale hours,
 * and stale hours send you to a closed dining hall.
 */

'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DiningHall } from '@/lib/db'
import { useToast } from '@/lib/ToastContext'
import { seedHallsFor, hasSeedFor } from '@/data/diningSeed'
import {
  evaluateStatus, describeStatus, sortRank, fmtTime,
  type DiningStatus, type Weekday,
} from '@/lib/engines/DiningHours'
import styles from './CampusDining.module.css'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** Tick so open/closed stays honest without a reload. */
const TICK_MS = 60_000

export default function CampusDining({ universityId }: { universityId: string }) {
  const { toast } = useToast()
  const [now, setNow]       = useState<Date | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  /* Rendered null until mounted so server and client agree — an
     open/closed chip computed during SSR would hydrate mismatched. */
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(t)
  }, [])

  const halls = useLiveQuery(
    async () => {
      if (!db) return []
      return db.campus_dining_halls.where('universityId').equals(universityId).toArray()
    },
    [universityId],
  )

  const loaded = halls !== undefined
  const list   = useMemo(() => halls ?? [], [halls])

  const ranked = useMemo(() => {
    if (!now) return list.map(h => ({ hall: h, status: null as DiningStatus | null }))
    return list
      .map(h => ({ hall: h, status: evaluateStatus(h.hours, now) }))
      .sort((a, b) => {
        const r = sortRank(a.status!) - sortRank(b.status!)
        return r !== 0 ? r : a.hall.name.localeCompare(b.hall.name)
      })
  }, [list, now])

  const seed = useCallback(async () => {
    if (!db) return
    const rows = seedHallsFor(universityId)
    if (rows.length === 0) return
    // Stable seed ids, so pressing this twice cannot duplicate a hall.
    await db.campus_dining_halls.bulkPut(rows)
    toast(`Added ${rows.length} dining halls. Edit any hours that are wrong.`, 'success')
  }, [universityId, toast])

  const updateHours = useCallback(async (
    hall: DiningHall, day: Weekday, open: string, close: string,
  ) => {
    if (!db) return
    const rest = hall.hours.filter(h => h.day !== day)
    const next = open && close ? [...rest, { day, open, close }] : rest
    await db.campus_dining_halls.update(hall.id, { hours: next, updatedAt: Date.now() })
  }, [])

  const remove = useCallback(async (hall: DiningHall) => {
    if (!db) return
    await db.campus_dining_halls.delete(hall.id)
    toast(`Removed ${hall.name}.`, 'info')
  }, [toast])

  /* ── Render ──────────────────────────────────────────────────── */

  if (loaded && list.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyGlyph} aria-hidden="true">◉</span>
        <p className={styles.emptyLabel}>No dining halls yet</p>
        <p className={styles.emptyHint}>
          {hasSeedFor(universityId)
            ? 'Start from a set of known halls for your campus, then correct anything that has changed. Hours live on this device — nothing is scraped, so nothing goes stale without you noticing.'
            : 'Your campus has no starter data yet. Add halls manually and their hours will stay accurate on this device.'}
        </p>
        {hasSeedFor(universityId) && (
          <button type="button" className={styles.primaryBtn} onClick={seed}>
            Add starter halls
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <p className={styles.headNote}>
          Hours are stored on this device and never fetched — edit any that drift.
        </p>
        {hasSeedFor(universityId) && (
          <button type="button" className={styles.ghostBtn} onClick={seed}>
            Restore starter halls
          </button>
        )}
      </div>

      <ul className={styles.list}>
        {ranked.map(({ hall, status }) => {
          const open = editing === hall.id
          return (
            <li key={hall.id} className={styles.hall} data-state={status?.state ?? 'unknown'}>
              <div className={styles.hallTop}>
                <div className={styles.hallId}>
                  <span className={styles.hallName}>{hall.name}</span>
                  {hall.location && <span className={styles.hallLoc}>{hall.location}</span>}
                </div>
                <span className={styles.status}>
                  {status ? describeStatus(status) : '—'}
                </span>
              </div>

              <div className={styles.week}>
                {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map(d => {
                  const w = hall.hours.find(h => h.day === d)
                  return (
                    <span
                      key={d}
                      className={`${styles.day} ${w ? styles.dayOpen : ''}`}
                      title={w ? `${fmtTime(w.open)} – ${fmtTime(w.close)}` : 'Closed'}
                    >
                      {DAY_LABELS[d]}
                    </span>
                  )
                })}
              </div>

              <div className={styles.hallFoot}>
                <span className={styles.updated}>
                  updated {new Date(hall.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <div className={styles.hallActions}>
                  <button
                    type="button" className={styles.linkBtn}
                    onClick={() => setEditing(open ? null : hall.id)}
                    aria-expanded={open}
                  >
                    {open ? 'Done' : 'Edit hours'}
                  </button>
                  <button type="button" className={styles.linkQuiet} onClick={() => remove(hall)}>
                    Remove
                  </button>
                </div>
              </div>

              {open && (
                <div className={styles.editor}>
                  {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map(d => {
                    const w = hall.hours.find(h => h.day === d)
                    return (
                      <div key={d} className={styles.editRow}>
                        <span className={styles.editDay}>{DAY_LABELS[d]}</span>
                        <input
                          type="time" value={w?.open ?? ''}
                          onChange={e => updateHours(hall, d, e.target.value, w?.close ?? '17:00')}
                          aria-label={`${DAY_LABELS[d]} opening time`}
                        />
                        <span className={styles.editDash}>–</span>
                        <input
                          type="time" value={w?.close ?? ''}
                          onChange={e => updateHours(hall, d, w?.open ?? '09:00', e.target.value)}
                          aria-label={`${DAY_LABELS[d]} closing time`}
                        />
                        {w && (
                          <button
                            type="button" className={styles.clearDay}
                            onClick={() => updateHours(hall, d, '', '')}
                            aria-label={`Mark ${DAY_LABELS[d]} closed`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )
                  })}
                  <p className={styles.editHint}>
                    A closing time earlier than the opening time means overnight
                    service — 21:00 to 01:00 stays open past midnight.
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
