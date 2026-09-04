'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  generateUniversitySchedule,
  windowForUniversity,
  validateMeetings,
  validateWindow,
  DAY_KEYS,
  type CourseInput,
  type GenerateResult,
  type DayKey,
  type DayMeeting,
  type SemesterWindow,
} from '@/utils/scheduleGenerator'
import {
  UNIVERSITY_CALENDARS,
  UNIVERSITY_ID_LIST,
  type UniversityId,
} from '@/utils/universityCalendars'
import { useToast } from '@/lib/ToastContext'
import styles from './UniversityScheduleReplicator.module.css'

/* ── Day descriptors ────────────────────────────────────────────── */

const DAY_LABEL: Record<DayKey, { short: string; full: string }> = {
  mon: { short: 'M',  full: 'Monday'    },
  tue: { short: 'T',  full: 'Tuesday'   },
  wed: { short: 'W',  full: 'Wednesday' },
  thu: { short: 'Th', full: 'Thursday'  },
  fri: { short: 'F',  full: 'Friday'    },
}

const DEFAULT_START = '10:10'
const DEFAULT_END   = '11:00'

/* ── Saved calendar overrides ───────────────────────────────────── */

/*
 * A customised calendar is worth keeping.
 *
 * Someone on exchange re-enters the same foreign term dates and the same
 * local holidays for every single course they take. Storing the edits per
 * campus means that happens once.
 */
const CAL_KEY = 'zenith_sched_calendar_v1'

type SavedCalendars = Partial<Record<UniversityId, SemesterWindow>>

function loadSaved(): SavedCalendars {
  try {
    const raw = localStorage.getItem(CAL_KEY)
    return raw ? (JSON.parse(raw) as SavedCalendars) : {}
  } catch { return {} }
}

function saveOne(id: UniversityId, win: SemesterWindow): void {
  try {
    localStorage.setItem(CAL_KEY, JSON.stringify({ ...loadSaved(), [id]: win }))
  } catch { /* storage full or blocked — the run still works, it just won't persist */ }
}

function forgetOne(id: UniversityId): void {
  try {
    const all = loadSaved()
    delete all[id]
    localStorage.setItem(CAL_KEY, JSON.stringify(all))
  } catch { /* noop */ }
}

/** Format an ISO "YYYY-MM-DD" as a short readable label, e.g. "Aug 25". */
function fmtBreakDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** True when the window still matches the campus's stock calendar. */
function isStock(id: UniversityId, win: SemesterWindow): boolean {
  const stock = windowForUniversity(id)
  return JSON.stringify(stock) === JSON.stringify(win)
}

/* ── Props ──────────────────────────────────────────────────────── */

interface Props {
  /** Called when the user clicks "View Calendar →" after a successful run. */
  onDone?: () => void
}

/* ══════════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function UniversityScheduleReplicator({ onDone }: Props) {
  const { toast } = useToast()

  /* ── Form state ──────────────────────────────────────────────── */
  const [courseName,   setCourseName]   = useState('')
  const [universityId, setUniversityId] = useState<UniversityId>('CORNELL')

  /* Which days the class meets, and the hours for each. Times live per
     day so an uneven timetable is expressible; the "same time" switch is
     only a convenience for the common case where they match. */
  const [days,      setDays]      = useState<Set<DayKey>>(() => new Set())
  const [dayTimes,  setDayTimes]  = useState<Record<DayKey, { start: string; end: string }>>(
    () => Object.fromEntries(
      DAY_KEYS.map(d => [d, { start: DEFAULT_START, end: DEFAULT_END }]),
    ) as Record<DayKey, { start: string; end: string }>,
  )
  const [uniformTimes, setUniformTimes] = useState(true)

  /* The semester window, editable and remembered per campus. */
  const [win, setWin]           = useState<SemesterWindow>(() => windowForUniversity('CORNELL'))
  const [calOpen, setCalOpen]   = useState(false)
  const [hydrated, setHydrated] = useState(false)

  /* Run state */
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [result, setResult] = useState<GenerateResult | null>(null)

  const uniCal  = UNIVERSITY_CALENDARS[universityId]
  const running = status === 'running'

  /* Load any saved calendar for the selected campus. Runs on mount and on
     every campus change, so switching campuses restores that campus's
     edits rather than carrying the previous one's across. */
  useEffect(() => {
    const saved = loadSaved()[universityId]
    setWin(saved ?? windowForUniversity(universityId))
    setHydrated(true)
  }, [universityId])

  const customised = hydrated && !isStock(universityId, win)

  /* ── Meetings assembled from days + times ────────────────────── */

  const meetings = useMemo<DayMeeting[]>(
    () => DAY_KEYS.filter(d => days.has(d)).map(d => ({
      day:       d,
      startTime: uniformTimes ? dayTimes.mon.start : dayTimes[d].start,
      endTime:   uniformTimes ? dayTimes.mon.end   : dayTimes[d].end,
    })),
    [days, dayTimes, uniformTimes],
  )

  /* Say what is wrong before the button is pressed, not after. */
  const problem = useMemo(
    () => (days.size === 0 ? null : validateMeetings(meetings)) ?? validateWindow(win),
    [days, meetings, win],
  )

  const toggleDay = useCallback((key: DayKey) => {
    setDays(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const setDayTime = useCallback((key: DayKey, field: 'start' | 'end', value: string) => {
    setDayTimes(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }, [])

  /* In uniform mode every day reads from Monday's slot, so editing the
     single visible pair has to write there whichever days are selected. */
  const setUniformTime = useCallback((field: 'start' | 'end', value: string) => {
    setDayTimes(prev => ({ ...prev, mon: { ...prev.mon, [field]: value } }))
  }, [])

  /* ── Calendar editing ────────────────────────────────────────── */

  const patchWin = useCallback((patch: Partial<SemesterWindow>) => {
    setWin(prev => {
      const next = { ...prev, ...patch }
      saveOne(universityId, next)
      return next
    })
  }, [universityId])

  const addBreak = useCallback(() => {
    patchWin({ breaks: [...win.breaks, { label: '', from: '', to: '' }] })
  }, [patchWin, win.breaks])

  const editBreak = useCallback((i: number, field: 'label' | 'from' | 'to', value: string) => {
    const next = win.breaks.map((b, j) => (j === i ? { ...b, [field]: value } : b))
    patchWin({ breaks: next })
  }, [patchWin, win.breaks])

  const removeBreak = useCallback((i: number) => {
    patchWin({ breaks: win.breaks.filter((_, j) => j !== i) })
  }, [patchWin, win.breaks])

  const resetCalendar = useCallback(() => {
    forgetOne(universityId)
    setWin(windowForUniversity(universityId))
    toast(`Calendar reset to ${UNIVERSITY_CALENDARS[universityId].label} defaults.`, 'info')
  }, [universityId, toast])

  /* ── Submit ──────────────────────────────────────────────────── */

  const handleSubmit = useCallback(async () => {
    if (!courseName.trim()) { toast('Enter a course name.', 'error'); return }
    if (days.size === 0)    { toast('Select at least one meeting day.', 'error'); return }
    if (problem)            { toast(problem, 'error'); return }

    setStatus('running')
    setResult(null)

    const input: CourseInput = {
      courseName,
      meetings,
      universityId,
      calendar: win,
    }

    try {
      const res = await generateUniversitySchedule(input)
      setResult(res)
      setStatus('done')
      if (res.count === 0) {
        toast('No sessions fell inside the semester — check the dates and breaks.', 'info')
      } else {
        toast(`${res.count} class sessions generated for "${courseName.trim()}".`, 'success')
      }
    } catch (err) {
      setStatus('idle')
      toast(`Generation failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }, [courseName, days, meetings, problem, universityId, win, toast])

  /* Reset the course, but keep the calendar — the next course is in the
     same term, and re-entering the term dates each time is the tedium
     this is meant to remove. */
  const handleReset = useCallback(() => {
    setCourseName('')
    setDays(new Set())
    setUniformTimes(true)
    setDayTimes(Object.fromEntries(
      DAY_KEYS.map(d => [d, { start: DEFAULT_START, end: DEFAULT_END }]),
    ) as Record<DayKey, { start: string; end: string }>)
    setStatus('idle')
    setResult(null)
  }, [])

  const selectedDays = DAY_KEYS.filter(d => days.has(d))

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div className={styles.panel}>

      <div className={styles.panelHeader}>
        <div className={styles.headerMeta}>
          <p className={styles.eyebrow}>Academic Calendar</p>
          <h2 className={styles.title}>Course Schedule</h2>
        </div>
        <p className={styles.subtitle}>
          Generate a full semester of recurring class events. Break weeks are
          skipped, and a class that meets at different hours on different days
          is fine.
        </p>
      </div>

      {/* ── Success panel ───────────────────────────────────────── */}
      {status === 'done' && result && (
        <div className={styles.successPanel}>
          <span
            className={styles.successIcon}
            style={{ background: result.feedColor }}
            aria-hidden="true"
          >
            ✓
          </span>
          <div className={styles.successBody}>
            <p className={styles.successTitle}>
              {result.count === 0 ? 'Nothing to schedule' : 'Schedule replicated'}
            </p>
            <p className={styles.successMeta}>
              <strong>{result.count}</strong> class sessions written across the{' '}
              {win.label} semester&nbsp;
              <span className={styles.dateRange}>
                ({win.semesterStart} → {win.semesterEnd})
              </span>
            </p>
            <p className={styles.successHint}>
              Events appear in the Week and Month views instantly.
              To remove them, delete the&nbsp;
              <em>&ldquo;{courseName.trim()} — {win.label}&rdquo;</em>&nbsp;
              calendar from the New Calendar manager.
            </p>
            <div className={styles.successActions}>
              <button type="button" className={styles.viewBtn} onClick={onDone}>
                View Calendar →
              </button>
              <button type="button" className={styles.scheduleAnotherBtn} onClick={handleReset}>
                Schedule Another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Input form ──────────────────────────────────────────── */}
      {status !== 'done' && (
        <div className={styles.form}>

          {/* Course name */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="sched-course-name">
              Course Name
            </label>
            <input
              id="sched-course-name"
              type="text"
              className={styles.textInput}
              placeholder="e.g. MATH 2210 — Multivariable Calculus"
              value={courseName}
              onChange={e => setCourseName(e.target.value)}
              disabled={running}
              maxLength={80}
              autoComplete="off"
            />
          </div>

          {/* Meeting days */}
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel} id="sched-days-label">Meeting Days</span>
            <div className={styles.dayPicker} role="group" aria-labelledby="sched-days-label">
              {DAY_KEYS.map(key => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.dayBtn} ${days.has(key) ? styles.dayBtnOn : ''}`}
                  onClick={() => toggleDay(key)}
                  aria-pressed={days.has(key)}
                  aria-label={DAY_LABEL[key].full}
                  disabled={running}
                >
                  {DAY_LABEL[key].short}
                </button>
              ))}
            </div>
          </div>

          {/* Times — one pair, or one per day */}
          {selectedDays.length > 0 && (
            <div className={styles.fieldGroup}>
              <div className={styles.timesHeader}>
                <span className={styles.fieldLabel}>Class Time</span>
                {selectedDays.length > 1 && (
                  <label className={styles.uniformToggle}>
                    <input
                      type="checkbox"
                      checked={!uniformTimes}
                      onChange={e => setUniformTimes(!e.target.checked)}
                      disabled={running}
                    />
                    Different times per day
                  </label>
                )}
              </div>

              {uniformTimes || selectedDays.length === 1 ? (
                <div className={styles.timePair}>
                  <input
                    type="time"
                    className={styles.timeInput}
                    value={dayTimes.mon.start}
                    onChange={e => setUniformTime('start', e.target.value)}
                    disabled={running}
                    aria-label="Start time"
                  />
                  <span className={styles.timeSep} aria-hidden="true">→</span>
                  <input
                    type="time"
                    className={styles.timeInput}
                    value={dayTimes.mon.end}
                    onChange={e => setUniformTime('end', e.target.value)}
                    disabled={running}
                    aria-label="End time"
                  />
                </div>
              ) : (
                <div className={styles.perDayList}>
                  {selectedDays.map(d => (
                    <div key={d} className={styles.perDayRow}>
                      <span className={styles.perDayName}>{DAY_LABEL[d].full}</span>
                      <input
                        type="time"
                        className={styles.timeInput}
                        value={dayTimes[d].start}
                        onChange={e => setDayTime(d, 'start', e.target.value)}
                        disabled={running}
                        aria-label={`${DAY_LABEL[d].full} start time`}
                      />
                      <span className={styles.timeSep} aria-hidden="true">→</span>
                      <input
                        type="time"
                        className={styles.timeInput}
                        value={dayTimes[d].end}
                        onChange={e => setDayTime(d, 'end', e.target.value)}
                        disabled={running}
                        aria-label={`${DAY_LABEL[d].full} end time`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Campus */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="sched-university">Campus</label>
            <select
              id="sched-university"
              className={styles.select}
              value={universityId}
              onChange={e => setUniversityId(e.target.value as UniversityId)}
              disabled={running}
            >
              {UNIVERSITY_ID_LIST.map(uid => (
                <option key={uid} value={uid}>{UNIVERSITY_CALENDARS[uid].label}</option>
              ))}
            </select>
          </div>

          {/* Semester window + breaks */}
          <div className={styles.semesterPreview}>
            <div className={styles.semesterRow}>
              <span
                className={styles.semesterBound}
                style={{ borderColor: `${uniCal.color}66`, background: `${uniCal.color}22` }}
              >
                {fmtBreakDate(win.semesterStart)}
              </span>
              <span className={styles.semesterArrow} aria-hidden="true">→</span>
              <span
                className={styles.semesterBound}
                style={{ borderColor: `${uniCal.color}66`, background: `${uniCal.color}22` }}
              >
                {fmtBreakDate(win.semesterEnd)}
              </span>
              <span className={styles.breakCount}>
                {win.breaks.length} break{win.breaks.length !== 1 ? 's' : ''} excluded
              </span>
              {customised && <span className={styles.customBadge}>Edited</span>}
              <button
                type="button"
                className={styles.calEditBtn}
                onClick={() => setCalOpen(o => !o)}
                aria-expanded={calOpen}
                disabled={running}
              >
                {calOpen ? 'Done' : 'Edit dates'}
              </button>
            </div>

            {!calOpen && win.breaks.length > 0 && (
              <div className={styles.breakList}>
                {win.breaks.map((b, i) => (
                  <span key={`${b.label}-${i}`} className={styles.breakChip}>
                    <span className={styles.breakChipName}>{b.label || 'Break'}</span>
                    <span className={styles.breakChipDates}>
                      {fmtBreakDate(b.from)} – {fmtBreakDate(b.to)}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {calOpen && (
              <div className={styles.calEditor}>
                <p className={styles.calHint}>
                  Studying somewhere else this term? Set the dates your classes
                  actually run between, and list the weeks they don&rsquo;t meet.
                  Saved for this campus, so the next course starts from them.
                </p>

                <div className={styles.calDateRow}>
                  <label className={styles.calDateField}>
                    <span className={styles.calFieldLabel}>Term starts</span>
                    <input
                      type="date"
                      className={styles.dateInput}
                      value={win.semesterStart}
                      onChange={e => patchWin({ semesterStart: e.target.value })}
                      disabled={running}
                    />
                  </label>
                  <label className={styles.calDateField}>
                    <span className={styles.calFieldLabel}>Term ends</span>
                    <input
                      type="date"
                      className={styles.dateInput}
                      value={win.semesterEnd}
                      onChange={e => patchWin({ semesterEnd: e.target.value })}
                      disabled={running}
                    />
                  </label>
                </div>

                <div className={styles.breakEditor}>
                  <span className={styles.calFieldLabel}>Breaks &amp; holidays</span>
                  {win.breaks.length === 0 && (
                    <p className={styles.calEmpty}>
                      No breaks — classes run every selected weekday.
                    </p>
                  )}
                  {win.breaks.map((b, i) => (
                    <div key={i} className={styles.breakRow}>
                      <input
                        type="text"
                        className={styles.breakNameInput}
                        placeholder="Name, e.g. Semana Santa"
                        value={b.label}
                        onChange={e => editBreak(i, 'label', e.target.value)}
                        disabled={running}
                        maxLength={40}
                        aria-label={`Break ${i + 1} name`}
                      />
                      <input
                        type="date"
                        className={styles.dateInput}
                        value={b.from}
                        onChange={e => editBreak(i, 'from', e.target.value)}
                        disabled={running}
                        aria-label={`Break ${i + 1} first day`}
                      />
                      <span className={styles.timeSep} aria-hidden="true">→</span>
                      <input
                        type="date"
                        className={styles.dateInput}
                        value={b.to}
                        onChange={e => editBreak(i, 'to', e.target.value)}
                        disabled={running}
                        aria-label={`Break ${i + 1} last day`}
                      />
                      <button
                        type="button"
                        className={styles.breakRemoveBtn}
                        onClick={() => removeBreak(i)}
                        disabled={running}
                        aria-label={`Remove ${b.label || `break ${i + 1}`}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div className={styles.calActions}>
                    <button
                      type="button"
                      className={styles.addBreakBtn}
                      onClick={addBreak}
                      disabled={running}
                    >
                      + Add break
                    </button>
                    {customised && (
                      <button
                        type="button"
                        className={styles.resetCalBtn}
                        onClick={resetCalendar}
                        disabled={running}
                      >
                        Reset to {uniCal.label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {problem && days.size > 0 && (
            <p className={styles.problemMsg} role="alert">{problem}</p>
          )}

          <button
            type="button"
            className={`${styles.submitBtn} ${running ? styles.submitBtnRunning : ''}`}
            onClick={handleSubmit}
            disabled={running || !courseName.trim() || days.size === 0 || problem !== null}
            aria-busy={running}
          >
            {running ? (
              <span className={styles.runningContent}>
                <span className={styles.runningDot} aria-hidden="true" />
                Generating schedule…
              </span>
            ) : (
              'Generate Schedule'
            )}
          </button>

        </div>
      )}
    </div>
  )
}
