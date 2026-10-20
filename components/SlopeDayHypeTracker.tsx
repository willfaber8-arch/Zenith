'use client'

import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react'
import { useLiveQuery }       from 'dexie-react-hooks'
import { db }                 from '@/lib/db'
import { useMentalHealthLog } from '@/lib/hooks/useMentalHealthLog'
import {
  MOOD_VECTORS,
  MOOD_MAP,
  relativeDateLabel,
  type MoodKey,
  type MoodVector,
} from '@/utils/mentalHealthLog'
import type { MentalHealthLog } from '@/lib/db'
import styles from './SlopeDayHypeTracker.module.css'
import Icon from '@/components/ui/Icon'
import EmotionCheckin from '@/components/EmotionCheckin'
import { scoreCheckin, overallLabel } from '@/utils/emotionCheckin'
import { todayISO, toLocalDateStr, addDaysISO } from '@/utils/localDate'

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
  const [mode,    setMode]    = useState<'mood' | 'checkin'>('mood')
  const dayLog   = logMap.get(logDate) ?? null
  const isPast   = logDate < todayStr

  /* ── Mood logging state ───────────────────────────────────── */
  const [selectedMood, setSelectedMood] = useState<MoodVector | null>(null)
  const [notes,        setNotes]        = useState('')
  const [justLogged,   setJustLogged]   = useState(false)

  // Load the chosen day's entry into the form — once per day, and once more
  // when that day's row first appears. Re-running on every live-query result
  // would wipe a journal entry mid-sentence whenever anything else is saved.
  const prefilled = useRef<string>('')
  useEffect(() => {
    const key = `${logDate}:${dayLog?.id ?? 'none'}`
    if (prefilled.current === key) return
    prefilled.current = key
    const m = dayLog ? MOOD_MAP[dayLog.moodVector as MoodKey] ?? null : null
    setSelectedMood(m)
    setNotes(dayLog?.qualitativeNotes ?? '')
    setJustLogged(false)
  }, [logDate, dayLog])

  const handleLog = useCallback(async () => {
    if (!selectedMood || mh.submitting) return
    await mh.logMood(selectedMood, notes, logDate)
    setJustLogged(true)
    setTimeout(() => setJustLogged(false), 2200)
  }, [selectedMood, notes, logDate, mh])

  // The week ending on the logged day — what the check-in averages against.
  const weekLogs = useMemo(() => {
    const from = addDaysISO(logDate, -6)
    return allLogs.filter(l => l.logDate >= from && l.logDate <= logDate)
  }, [allLogs, logDate])

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
  const selectedCheckin = selectedLog?.emotions ? scoreCheckin(selectedLog.emotions) : null

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
    const dateStr = toLocalDateStr(d)
    return { dateStr, label: relativeDateLabel(dateStr), log: mh.logs.find(l => l.logDate === dateStr) ?? null }
  })

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

          {/* Quick mood, or the longer feelings check-in */}
          <div className={styles.modeTabs} role="tablist" aria-label="Log type">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'mood'}
              className={`${styles.modeTab} ${mode === 'mood' ? styles.modeTabOn : ''}`}
              onClick={() => setMode('mood')}
            >
              Quick mood
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'checkin'}
              className={`${styles.modeTab} ${mode === 'checkin' ? styles.modeTabOn : ''}`}
              onClick={() => setMode('checkin')}
            >
              Feelings check-in
              {dayLog?.emotions && <span className={styles.modeTabDot} aria-label="saved" />}
            </button>
          </div>

          {mode === 'checkin' ? (
            <EmotionCheckin
              date={logDate}
              saved={dayLog?.emotions}
              savedAt={dayLog?.checkinAt}
              recent={weekLogs}
              submitting={mh.submitting}
              onSave={answers => mh.saveCheckin(answers, logDate)}
            />
          ) : (<>

          {justLogged && (
            <div className={`${styles.todayChip} anim-scale-in`}>
              <span className={styles.todayChipDot} aria-hidden="true" />
              Logged for {dayPhrase(logDate)}
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
                  <span className={styles.moodEmoji} aria-hidden="true"><Icon name={m.icon} size={28} /></span>
                  <span className={styles.moodLabel}>{m.label}</span>
                </button>
              )
            })}
          </div>

          <div className={styles.notesWrap}>
            <label htmlFor="mh-notes" className={styles.notesLabel}>
              Journal (optional)
            </label>
            <textarea
              id="mh-notes"
              className={styles.notesInput}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Write down whatever's on your mind — clear your head, reflect on the day, or just let it out."
              maxLength={2000}
              rows={5}
            />
            <span className={styles.notesCount}>{notes.length}/2000</span>
          </div>

          <button
            type="button"
            className={styles.logBtn}
            onClick={handleLog}
            disabled={!selectedMood || mh.submitting}
          >
            {mh.submitting ? 'Logging…' : justLogged ? '✓ Logged' : dayLog ? 'Update Entry' : 'Log Entry'}
          </button>

          </>)}

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
                          <Icon name={MOOD_MAP[log.moodVector as MoodKey]?.icon ?? 'moodNeutral'} size={18} />
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
                  {selectedCheckin?.overall != null && (
                    <p className={styles.calDetailCheckin}>
                      Check-in: <strong>{selectedCheckin.overall}/100</strong> · {overallLabel(selectedCheckin.overall)}
                      {selectedCheckin.focusAreas.length > 0 && (
                        <> · lowest: {selectedCheckin.focusAreas.map(a => a.label).join(', ')}</>
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
