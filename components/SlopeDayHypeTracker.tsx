'use client'

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import { useLiveQuery }       from 'dexie-react-hooks'
import { db }                 from '@/lib/db'
import { useMentalHealthLog } from '@/lib/hooks/useMentalHealthLog'
import {
  MOOD_VECTORS,
  MOOD_MAP,
  relativeDateLabel,
  todayISO,
  type MoodKey,
  type MoodVector,
} from '@/utils/mentalHealthLog'
import type { MentalHealthLog } from '@/lib/db'
import styles from './SlopeDayHypeTracker.module.css'

/* ── Helpers ─────────────────────────────────────────────────── */

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildMonthCells(year: number, month: number): Array<string | null> {
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<string | null> = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(isoDate(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function moodCellColor(log: MentalHealthLog): string {
  // wellbeing 0..1: high-energy + low-stress = 1 (green); opposite = 0 (red)
  const w   = (log.energyLevel - log.stressLevel + 9) / 18
  const hue = Math.round(w * 120)
  return `hsla(${hue}, 65%, 50%, 0.85)`
}

/* ── Sub-components ──────────────────────────────────────────── */

function StatBar({
  name, value, variant,
}: { name: string; value: number; variant: 'stress' | 'energy' }) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statName}>{name}</span>
      <div className={styles.statTrack}>
        <div
          className={`${styles.statFill} ${variant === 'stress' ? styles.statFillStress : styles.statFillEnergy}`}
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
      <span className={styles.statValue}>{value}</span>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────── */

export default function WellnessTracker() {
  const mh = useMentalHealthLog()

  // All logs for the calendar (no date restriction)
  const allLogs = useLiveQuery(
    () => db?.mentalHealthLogs?.orderBy('logDate').toArray().catch(() => []) ?? Promise.resolve([]),
    [],
  ) ?? []

  const logMap = useMemo(() => {
    const m = new Map<string, MentalHealthLog>()
    for (const l of allLogs) m.set(l.logDate, l)
    return m
  }, [allLogs])

  /* ── Mood logging state ───────────────────────────────────── */
  const [selectedMood, setSelectedMood] = useState<MoodVector | null>(null)
  const [notes,        setNotes]        = useState('')
  const [justLogged,   setJustLogged]   = useState(false)

  useEffect(() => {
    if (mh.todayLog?.moodVector) {
      const m = MOOD_MAP[mh.todayLog.moodVector as MoodKey]
      if (m) { setSelectedMood(m); setNotes(mh.todayLog.qualitativeNotes) }
    }
  }, [mh.todayLog])

  const handleLog = useCallback(async () => {
    if (!selectedMood || mh.submitting) return
    await mh.logMood(selectedMood, notes)
    setJustLogged(true)
    setTimeout(() => setJustLogged(false), 2200)
  }, [selectedMood, notes, mh])

  /* ── Calendar state ───────────────────────────────────────── */
  const today = new Date()
  const [calYear,     setCalYear]     = useState(today.getFullYear())
  const [calMonth,    setCalMonth]    = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const monthCells = useMemo(() => buildMonthCells(calYear, calMonth), [calYear, calMonth])
  const selectedLog = selectedDay ? (logMap.get(selectedDay) ?? null) : null
  const todayStr    = todayISO()
  const monthLabel  = new Date(calYear, calMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const dateDisplay = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const prevMonth = useCallback(() => {
    setSelectedDay(null)
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }, [calMonth])

  const nextMonth = useCallback(() => {
    setSelectedDay(null)
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }, [calMonth])

  /* ── 3-day trend data ─────────────────────────────────────── */
  const last3Days = [0, 1, 2].map(dAgo => {
    const d = new Date(); d.setDate(d.getDate() - dAgo)
    const dateStr = d.toISOString().slice(0, 10)
    return { dateStr, label: relativeDateLabel(dateStr), log: mh.logs.find(l => l.logDate === dateStr) ?? null }
  })

  return (
    <div className={styles.tracker}>
      <div className={styles.grid}>

        {/* ════════════════════════════════════════════════════
            LEFT PANE — MOOD LOGGING
            ════════════════════════════════════════════════════ */}
        <div className={`${styles.card} anim-scale-in`}>

          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Daily Wellness · Log</p>
              <h2 className={styles.cardTitle}>Emotional State</h2>
            </div>
            <span className={styles.cardDate}>{dateDisplay}</span>
          </div>

          {justLogged && (
            <div className={`${styles.todayChip} anim-scale-in`}>
              <span className={styles.todayChipDot} aria-hidden="true" />
              Logged for today
            </div>
          )}

          <div className={styles.moodGrid} role="group" aria-label="Select your emotional state">
            {MOOD_VECTORS.map(m => {
              const isBurnout = m.stressLevel >= 8 && m.energyLevel <= 3
              return (
                <button
                  key={m.key}
                  type="button"
                  className={[
                    styles.moodBtn,
                    selectedMood?.key === m.key ? styles.moodBtnSelected : '',
                    isBurnout ? styles.moodBtnBurnout : '',
                  ].join(' ')}
                  onClick={() => setSelectedMood(m)}
                  aria-pressed={selectedMood?.key === m.key}
                  aria-label={`${m.label}: stress ${m.stressLevel}, energy ${m.energyLevel}`}
                  style={{ '--mood-hue': String(m.hue) } as CSSProperties}
                >
                  <span className={styles.moodEmoji} aria-hidden="true">{m.emoji}</span>
                  <span className={styles.moodLabel}>{m.label}</span>
                </button>
              )
            })}
          </div>

          <div className={styles.notesWrap}>
            <label htmlFor="mh-notes" className={styles.notesLabel}>
              Quick Note (optional)
            </label>
            <textarea
              id="mh-notes"
              className={styles.notesInput}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What's driving today's energy level?"
              maxLength={280}
              rows={2}
            />
          </div>

          <button
            type="button"
            className={styles.logBtn}
            onClick={handleLog}
            disabled={!selectedMood || mh.submitting}
          >
            {mh.submitting ? 'Logging…' : justLogged ? '✓ Logged' : 'Log Entry'}
          </button>

          <div className={styles.divider} aria-hidden="true" />

          <div className={styles.trendSection}>
            <p className={styles.trendHeading}>3-Day Trend</p>
            {last3Days.map(({ dateStr, label, log }) => (
              <div
                key={dateStr}
                className={`${styles.dayEntry} ${log ? '' : styles.dayEntryMissing}`}
              >
                <div className={styles.dayRow}>
                  <span className={styles.dayLabel}>{label}</span>
                  {log
                    ? (
                      <span className={styles.dayMood}>
                        <span className={styles.dayMoodEmoji}>
                          {MOOD_MAP[log.moodVector as MoodKey]?.emoji ?? '❓'}
                        </span>
                        <span className={styles.dayMoodLabel}>
                          {MOOD_MAP[log.moodVector as MoodKey]?.label ?? log.moodVector}
                        </span>
                      </span>
                    )
                    : <span className={styles.dayNoLog}>No entry</span>
                  }
                </div>
                {log && (
                  <>
                    <div className={styles.statBars}>
                      <StatBar name="Stress" value={log.stressLevel} variant="stress" />
                      <StatBar name="Energy" value={log.energyLevel} variant="energy" />
                    </div>
                    {log.qualitativeNotes && (
                      <p className={styles.dayNotes}>&ldquo;{log.qualitativeNotes}&rdquo;</p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

        </div>

        {/* ════════════════════════════════════════════════════
            RIGHT PANE — MOOD HISTORY CALENDAR
            ════════════════════════════════════════════════════ */}
        <div className={`${styles.card} anim-scale-in delay-1`}>

          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Mood History · Calendar</p>
              <h2 className={styles.cardTitle}>Emotional Map</h2>
            </div>
          </div>

          {/* Month navigator */}
          <div className={styles.calNav}>
            <button
              type="button"
              className={styles.calNavBtn}
              onClick={prevMonth}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className={styles.calMonthLabel}>{monthLabel}</span>
            <button
              type="button"
              className={styles.calNavBtn}
              onClick={nextMonth}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className={styles.calDowRow}>
            {DOW.map(d => (
              <span key={d} className={styles.calDowLabel}>{d}</span>
            ))}
          </div>

          {/* Day grid */}
          <div className={styles.calGrid} role="grid" aria-label={`Mood calendar for ${monthLabel}`}>
            {monthCells.map((dateStr, i) => {
              if (!dateStr) return <div key={`e-${i}`} className={styles.calCellEmpty} />
              const log      = logMap.get(dateStr)
              const isToday  = dateStr === todayStr
              const isSel    = dateStr === selectedDay
              const dayNum   = parseInt(dateStr.slice(8), 10)
              return (
                <button
                  key={dateStr}
                  type="button"
                  className={[
                    styles.calCell,
                    log      ? styles.calCellLogged  : styles.calCellNoLog,
                    isToday  ? styles.calCellToday   : '',
                    isSel    ? styles.calCellSelected : '',
                  ].join(' ')}
                  style={log ? { background: moodCellColor(log) } : undefined}
                  onClick={() => setSelectedDay(isSel ? null : dateStr)}
                  aria-label={`${dateStr}${log ? `: ${MOOD_MAP[log.moodVector as MoodKey]?.label ?? log.moodVector}` : ': no entry'}`}
                  aria-pressed={isSel}
                >
                  <span className={styles.calCellNum}>{dayNum}</span>
                  {log && (
                    <span className={styles.calCellEmoji} aria-hidden="true">
                      {MOOD_MAP[log.moodVector as MoodKey]?.emoji ?? ''}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className={styles.calLegend}>
            <div className={styles.calLegendItem}>
              <span className={styles.calLegendDot} style={{ background: 'hsla(120,65%,50%,0.85)' }} />
              <span className={styles.calLegendLabel}>Thriving</span>
            </div>
            <div className={styles.calLegendItem}>
              <span className={styles.calLegendDot} style={{ background: 'hsla(60,65%,50%,0.85)' }} />
              <span className={styles.calLegendLabel}>Neutral</span>
            </div>
            <div className={styles.calLegendItem}>
              <span className={styles.calLegendDot} style={{ background: 'hsla(0,65%,50%,0.85)' }} />
              <span className={styles.calLegendLabel}>Drained</span>
            </div>
            <div className={`${styles.calLegendItem} ${styles.calLegendNoLog}`}>
              <span className={styles.calLegendDot} style={{ background: 'rgba(255,255,255,0.07)' }} />
              <span className={styles.calLegendLabel}>No entry</span>
            </div>
          </div>

          <div className={styles.divider} aria-hidden="true" />

          {/* Selected day detail */}
          {selectedDay ? (
            <div className={`${styles.calDetail} anim-scale-in`} key={selectedDay}>
              <div className={styles.calDetailHeader}>
                <span className={styles.calDetailDate}>
                  {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                  })}
                </span>
                {selectedLog && (
                  <span className={styles.calDetailMoodBadge}>
                    {MOOD_MAP[selectedLog.moodVector as MoodKey]?.emoji}{' '}
                    {MOOD_MAP[selectedLog.moodVector as MoodKey]?.label ?? selectedLog.moodVector}
                  </span>
                )}
              </div>
              {selectedLog ? (
                <>
                  <div className={styles.statBars}>
                    <StatBar name="Stress" value={selectedLog.stressLevel} variant="stress" />
                    <StatBar name="Energy" value={selectedLog.energyLevel} variant="energy" />
                  </div>
                  {selectedLog.qualitativeNotes ? (
                    <p className={styles.calDetailNotes}>
                      &ldquo;{selectedLog.qualitativeNotes}&rdquo;
                    </p>
                  ) : (
                    <p className={styles.calDetailEmpty}>No notes for this day.</p>
                  )}
                </>
              ) : (
                <p className={styles.calDetailEmpty}>No entry logged for this day.</p>
              )}
            </div>
          ) : (
            <p className={styles.calPrompt}>
              Select a day to view your logged emotional state.
            </p>
          )}

        </div>
      </div>
    </div>
  )
}
