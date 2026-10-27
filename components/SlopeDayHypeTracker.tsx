'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { useLiveQuery }       from 'dexie-react-hooks'
import { db }                 from '@/lib/db'
import { useMentalHealthLog } from '@/lib/hooks/useMentalHealthLog'
import {
  MOOD_MAP,
  relativeDateLabel,
  type MoodKey,
} from '@/utils/mentalHealthLog'
import type { MentalHealthLog } from '@/lib/db'
import styles from './SlopeDayHypeTracker.module.css'
import Icon from '@/components/ui/Icon'
import EmotionCheckin from '@/components/EmotionCheckin'
import { answersFromLog, categoryScores, hasFullCheckin, overallLabel, overallScore } from '@/utils/emotionCheckin'
import { todayISO, addDaysISO } from '@/utils/localDate'

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

/** "today", "yesterday", or "Monday, Oct 12" — for sentences about a day */
function dayPhrase(date: string): string {
  const rel = relativeDateLabel(date)
  if (rel === 'Today' || rel === 'Yesterday') return rel.toLowerCase()
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
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

  /* ── Which day is being logged ────────────────────────────── */
  // An explicit date rather than "today": a day that rolls over at midnight
  // while you are still in it stays reachable, and so does any earlier day.
  const todayStr = todayISO()
  const [logDate, setLogDate] = useState(todayStr)
  const dayLog   = logMap.get(logDate) ?? null
  const isPast   = logDate < todayStr

  const logPaneRef = useRef<HTMLDivElement>(null)
  const editDay = useCallback((date: string) => {
    if (date > todayISO()) return
    setLogDate(date)
    logPaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  /* ── Calendar state ───────────────────────────────────────── */
  const today = new Date()
  const [calYear,     setCalYear]     = useState(today.getFullYear())
  const [calMonth,    setCalMonth]    = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const monthCells = useMemo(() => buildMonthCells(calYear, calMonth), [calYear, calMonth])
  const selectedLog = selectedDay ? (logMap.get(selectedDay) ?? null) : null
  const monthLabel  = new Date(calYear, calMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const dateDisplay = new Date(logDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const selectedAnswers = selectedLog ? answersFromLog(selectedLog) : null
  const selectedOverall = selectedAnswers ? overallScore(selectedAnswers) : null
  const selectedCats    = selectedAnswers && selectedLog && hasFullCheckin(selectedLog) ? categoryScores(selectedAnswers) : []

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

  return (
    <div className={styles.tracker}>
      <div className={styles.grid}>

        {/* ════════════════════════════════════════════════════
            LEFT PANE — MOOD LOGGING
            ════════════════════════════════════════════════════ */}
        <div ref={logPaneRef} className={`${styles.card} anim-scale-in`}>

          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Daily Wellness · Log</p>
              <h2 className={styles.cardTitle}>Emotional State</h2>
            </div>
            <span className={styles.cardDate}>{dateDisplay}</span>
          </div>

          {/* Which day — today, yesterday, or any earlier date */}
          <div className={styles.dayPicker} role="group" aria-label="Day to log">
            <button
              type="button"
              className={`${styles.dayPickBtn} ${logDate === todayStr ? styles.dayPickBtnOn : ''}`}
              onClick={() => setLogDate(todayStr)}
              aria-pressed={logDate === todayStr}
            >
              Today
            </button>
            <button
              type="button"
              className={`${styles.dayPickBtn} ${logDate === addDaysISO(todayStr, -1) ? styles.dayPickBtnOn : ''}`}
              onClick={() => setLogDate(addDaysISO(todayStr, -1))}
              aria-pressed={logDate === addDaysISO(todayStr, -1)}
            >
              Yesterday
            </button>
            <input
              type="date"
              className={styles.dayPickInput}
              value={logDate}
              max={todayStr}
              onChange={e => { if (e.target.value && e.target.value <= todayStr) setLogDate(e.target.value) }}
              aria-label="Pick a day"
            />
          </div>

          {isPast && (
            <div className={styles.pastChip}>
              <Icon name="edit" size={13} />
              {dayLog ? 'Editing' : 'Adding an entry for'} {dayPhrase(logDate)}
            </div>
          )}

          <EmotionCheckin
            date={logDate}
            log={dayLog}
            history={allLogs}
            submitting={mh.submitting}
            onSave={(answers, notes) => mh.saveCheckin(answers, notes, logDate)}
          />

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
                      <Icon name={MOOD_MAP[log.moodVector as MoodKey]?.icon ?? 'moodNeutral'} size={15} />
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
              <span className={styles.calLegendLabel}>Great</span>
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
                    <Icon name={MOOD_MAP[selectedLog.moodVector as MoodKey]?.icon ?? 'moodNeutral'} size={15} />
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
                  {selectedOverall != null && (
                    <p className={styles.calDetailCheckin}>
                      Wellbeing: <strong>{selectedOverall}/100</strong> · {overallLabel(selectedOverall)}
                      {selectedCats.length > 0 && (
                        <> · {selectedCats.filter(c => c.key !== 'stress' && c.key !== 'energy').map(c => `${c.label} ${c.score}`).join(' · ')}</>
                      )}
                    </p>
                  )}
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
              {selectedDay <= todayStr && (
                <button
                  type="button"
                  className={styles.calEditBtn}
                  onClick={() => editDay(selectedDay)}
                >
                  <Icon name="edit" size={13} />
                  {selectedLog ? 'Edit this day' : 'Add an entry for this day'}
                </button>
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
