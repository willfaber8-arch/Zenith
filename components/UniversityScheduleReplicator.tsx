'use client'

import { useState, useCallback } from 'react'
import {
  generateUniversitySchedule,
  type CourseInput,
  type GenerateResult,
  type SelectedDays,
} from '@/utils/scheduleGenerator'
import {
  UNIVERSITY_CALENDARS,
  UNIVERSITY_ID_LIST,
  type UniversityId,
} from '@/utils/universityCalendars'
import { useToast } from '@/lib/ToastContext'
import styles from './UniversityScheduleReplicator.module.css'

/* ── Day toggle button descriptor ──────────────────────────────── */

const DAY_DESCRIPTORS: { key: keyof SelectedDays; label: string; full: string }[] = [
  { key: 'mon', label: 'M',  full: 'Monday'    },
  { key: 'tue', label: 'T',  full: 'Tuesday'   },
  { key: 'wed', label: 'W',  full: 'Wednesday' },
  { key: 'thu', label: 'Th', full: 'Thursday'  },
  { key: 'fri', label: 'F',  full: 'Friday'    },
]

const DEFAULT_DAYS: SelectedDays = {
  mon: false, tue: false, wed: false, thu: false, fri: false,
}

/** Format an ISO "YYYY-MM-DD" date as a short readable label, e.g. "Aug 25". */
function fmtBreakDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

  /* Form state */
  const [courseName,   setCourseName]   = useState('')
  const [selectedDays, setSelectedDays] = useState<SelectedDays>({ ...DEFAULT_DAYS })
  const [startTime,    setStartTime]    = useState('10:10')
  const [endTime,      setEndTime]      = useState('11:00')
  const [universityId, setUniversityId] = useState<UniversityId>('CORNELL')

  /* Run state */
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [result, setResult] = useState<GenerateResult | null>(null)

  const uniCal  = UNIVERSITY_CALENDARS[universityId]
  const running = status === 'running'

  /* Toggle a single day on/off */
  const toggleDay = useCallback((key: keyof SelectedDays) => {
    setSelectedDays(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  /* ── Submit ──────────────────────────────────────────────────── */

  const handleSubmit = useCallback(async () => {
    if (!courseName.trim()) {
      toast('Enter a course name.', 'error')
      return
    }
    if (!Object.values(selectedDays).some(Boolean)) {
      toast('Select at least one meeting day.', 'error')
      return
    }
    if (!startTime || !endTime) {
      toast('Set start and end times.', 'error')
      return
    }

    setStatus('running')
    setResult(null)

    const input: CourseInput = {
      courseName,
      selectedDays,
      startTime,
      endTime,
      universityId,
    }

    try {
      const res = await generateUniversitySchedule(input)
      setResult(res)
      setStatus('done')
      toast(
        `${res.count} class sessions generated for "${courseName.trim()}".`,
        'success',
      )
    } catch (err) {
      setStatus('idle')
      toast(`Generation failed: ${String(err)}`, 'error')
    }
  }, [courseName, selectedDays, startTime, endTime, universityId, toast])

  /* ── Reset to schedule another course ───────────────────────── */

  const handleReset = useCallback(() => {
    setCourseName('')
    setSelectedDays({ ...DEFAULT_DAYS })
    setStartTime('10:10')
    setEndTime('11:00')
    setUniversityId('CORNELL')
    setStatus('idle')
    setResult(null)
  }, [])

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div className={styles.panel}>

      {/* ── Panel header ────────────────────────────────────────── */}
      <div className={styles.panelHeader}>
        <div className={styles.headerMeta}>
          <p className={styles.eyebrow}>Academic Calendar · Auto-Scheduler</p>
          <h2 className={styles.title}>Course Schedule Replicator</h2>
        </div>
        <p className={styles.subtitle}>
          Enter your class details and generate a full semester of recurring
          events — campus holidays and break weeks are excluded automatically.
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
            <p className={styles.successTitle}>Schedule replicated</p>
            <p className={styles.successMeta}>
              <strong>{result.count}</strong> class sessions written across the{' '}
              {uniCal.label} semester&nbsp;
              <span className={styles.dateRange}>
                ({uniCal.semesterStart} → {uniCal.semesterEnd})
              </span>
            </p>
            <p className={styles.successHint}>
              Events appear in the Week and Month views instantly.
              To remove them, delete the feed&nbsp;
              <em>&ldquo;{courseName.trim()} — {uniCal.label}&rdquo;</em>&nbsp;
              from the iCal Feeds tab.
            </p>
            <div className={styles.successActions}>
              <button
                type="button"
                className={styles.viewBtn}
                onClick={onDone}
              >
                View Calendar →
              </button>
              <button
                type="button"
                className={styles.scheduleAnotherBtn}
                onClick={handleReset}
              >
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

          {/* Meeting days + time range */}
          <div className={styles.scheduleRow}>

            {/* Day picker */}
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel} id="sched-days-label">
                Meeting Days
              </span>
              <div
                className={styles.dayPicker}
                role="group"
                aria-labelledby="sched-days-label"
              >
                {DAY_DESCRIPTORS.map(({ key, label, full }) => (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.dayBtn} ${selectedDays[key] ? styles.dayBtnOn : ''}`}
                    onClick={() => toggleDay(key)}
                    aria-pressed={selectedDays[key]}
                    aria-label={full}
                    disabled={running}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time range */}
            <div className={styles.timePair}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="sched-start">
                  Start
                </label>
                <input
                  id="sched-start"
                  type="time"
                  className={styles.timeInput}
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  disabled={running}
                />
              </div>
              <span className={styles.timeSep} aria-hidden="true">→</span>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="sched-end">
                  End
                </label>
                <input
                  id="sched-end"
                  type="time"
                  className={styles.timeInput}
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  disabled={running}
                />
              </div>
            </div>
          </div>

          {/* University select */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="sched-university">
              Campus
            </label>
            <select
              id="sched-university"
              className={styles.select}
              value={universityId}
              onChange={e => setUniversityId(e.target.value as UniversityId)}
              disabled={running}
            >
              {UNIVERSITY_ID_LIST.map(uid => (
                <option key={uid} value={uid}>
                  {UNIVERSITY_CALENDARS[uid].label}
                </option>
              ))}
            </select>
          </div>

          {/* Semester window preview */}
          <div className={styles.semesterPreview}>
            <div className={styles.semesterRow}>
              <span
                className={styles.semesterBound}
                style={{ borderColor: `${uniCal.color}66`, background: `${uniCal.color}22` }}
              >
                {fmtBreakDate(uniCal.semesterStart)}
              </span>
              <span className={styles.semesterArrow} aria-hidden="true">→</span>
              <span
                className={styles.semesterBound}
                style={{ borderColor: `${uniCal.color}66`, background: `${uniCal.color}22` }}
              >
                {fmtBreakDate(uniCal.semesterEnd)}
              </span>
              <span className={styles.breakCount}>
                {uniCal.breaks.length} break{uniCal.breaks.length !== 1 ? 's' : ''} excluded
              </span>
            </div>
            {uniCal.breaks.length > 0 && (
              <div className={styles.breakList}>
                {uniCal.breaks.map(b => (
                  <span key={b.label} className={styles.breakChip}>
                    <span className={styles.breakChipName}>{b.label}</span>
                    <span className={styles.breakChipDates}>
                      {fmtBreakDate(b.from)} – {fmtBreakDate(b.to)}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="button"
            className={`${styles.submitBtn} ${running ? styles.submitBtnRunning : ''}`}
            onClick={handleSubmit}
            disabled={running || !courseName.trim()}
            aria-busy={running}
          >
            {running ? (
              <span className={styles.runningContent}>
                <span className={styles.runningDot} aria-hidden="true" />
                [ CALIBRATING CAMPUS TIMELINES... ]
              </span>
            ) : (
              '[ Replicate Academic Schedule ]'
            )}
          </button>

        </div>
      )}
    </div>
  )
}
