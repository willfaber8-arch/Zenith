'use client'

/**
 * Zenith OS — Cognitive Load Map
 * Phase 3 · Step 3.4 — Course Load Matrix & Weekly Strain Forecast
 *
 * Architecture:
 *   • Course Intensity Matrix — editable grid of course cards; each stores
 *     mathIntensity / codingIntensity / memorizationIntensity (1–10) in IDB.
 *     Slider changes are held in a React override Map for instant UI feedback
 *     and flushed to IDB on pointerUp (150 ms debounce).
 *   • Weekly Cognitive Forecast — 7-day vertical bar chart; loads computed by
 *     buildWeeklyStrainMatrix() which matches calendar events to profiles via
 *     title substring search. HIGH / MODERATE strain days surface warning banners.
 */

import {
  useState, useMemo, useCallback, useRef,
  type FormEvent, type CSSProperties,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db }  from '@/lib/db'
import type { CourseIntensityProfile, DailyStrainVector } from '@/types/academics'
import { computeCognitiveLoad, buildWeeklyStrainMatrix } from '@/utils/stressMatrix'
import styles from './CognitiveLoadMap.module.css'

/* ── Semantic colour constants ───────────────────────────────── */

const MATH_COLOR = 'var(--accent-purple)'
const CODE_COLOR = 'var(--accent-green)'
const MEM_COLOR  = '#a78bfa'  // soft violet — semantic for recall/retention

/* ════════════════════════════════════════════════════════════════
   SUB-COMPONENT — IntensitySlider
   ════════════════════════════════════════════════════════════════ */

function IntensitySlider({
  value, color, label, onChange, onRelease,
}: {
  value:     number
  color:     string
  label:     string
  onChange:  (v: number) => void
  onRelease: (v: number) => void
}) {
  // --fill-pct maps value 1–10 → 0–100% for the gradient track
  const fillPct = `${((value - 1) / 9) * 100}%`

  return (
    <div className={styles.sliderRow}>
      <span className={styles.sliderLabel}>{label}</span>
      <div className={styles.sliderWrap}>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          className={styles.intensitySlider}
          style={{ '--fill-pct': fillPct, '--slider-color': color } as CSSProperties}
          aria-label={`${label} intensity: ${value} out of 10`}
          onChange={e  => onChange(Number(e.target.value))}
          onPointerUp={e => onRelease(Number((e.target as HTMLInputElement).value))}
        />
      </div>
      <span className={styles.sliderValue} style={{ color }}>{value}</span>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   SUB-COMPONENT — CourseCard
   ════════════════════════════════════════════════════════════════ */

function CourseCard({
  profile, localValues, onSliderChange, onSliderRelease, onDelete,
}: {
  profile:         CourseIntensityProfile
  localValues:     { math: number; coding: number; mem: number }
  onSliderChange:  (id: number, field: 'math' | 'coding' | 'mem', v: number) => void
  onSliderRelease: (id: number, field: 'math' | 'coding' | 'mem', v: number) => void
  onDelete:        (id: number) => void
}) {
  const cls = computeCognitiveLoad({
    ...profile,
    mathIntensity:         localValues.math,
    codingIntensity:       localValues.coding,
    memorizationIntensity: localValues.mem,
  })

  return (
    <div className={styles.courseCard}>
      <div className={styles.cardTop}>
        <div className={styles.cardMeta}>
          <span className={styles.cardCode}>{profile.courseCode}</span>
          <span className={styles.cardName}>{profile.courseName}</span>
        </div>
        <div className={styles.cardActions}>
          <div
            className={styles.clsBadge}
            data-tier={cls.tier}
            title={`Composite Load Score: ${cls.composite}/100`}
          >
            <span className={styles.clsNumber}>{cls.composite}</span>
            <span className={styles.clsLabel}>CLS</span>
          </div>
          <button
            className={styles.deleteBtn}
            onClick={() => onDelete(profile.id!)}
            aria-label={`Remove ${profile.courseCode}`}
          >
            ×
          </button>
        </div>
      </div>

      <div className={styles.sliders}>
        <IntensitySlider
          value={localValues.math}   color={MATH_COLOR} label="Math"
          onChange={v  => onSliderChange(profile.id!, 'math', v)}
          onRelease={v => onSliderRelease(profile.id!, 'math', v)}
        />
        <IntensitySlider
          value={localValues.coding} color={CODE_COLOR} label="Code"
          onChange={v  => onSliderChange(profile.id!, 'coding', v)}
          onRelease={v => onSliderRelease(profile.id!, 'coding', v)}
        />
        <IntensitySlider
          value={localValues.mem}    color={MEM_COLOR}  label="Memo"
          onChange={v  => onSliderChange(profile.id!, 'mem', v)}
          onRelease={v => onSliderRelease(profile.id!, 'mem', v)}
        />
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   SUB-COMPONENT — AddCoursePanel
   ════════════════════════════════════════════════════════════════ */

function AddCoursePanel({
  onAdd, onCancel,
}: {
  onAdd:    (code: string, name: string, math: number, coding: number, mem: number) => void
  onCancel: () => void
}) {
  const [code,   setCode]   = useState('')
  const [name,   setName]   = useState('')
  const [math,   setMath]   = useState(5)
  const [coding, setCoding] = useState(5)
  const [mem,    setMem]    = useState(5)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimCode = code.trim()
    const trimName = name.trim()
    if (!trimCode || !trimName) return
    onAdd(trimCode.toUpperCase(), trimName, math, coding, mem)
  }

  return (
    <form onSubmit={handleSubmit} className={styles.addPanel}>
      <div className={styles.addFields}>
        <input
          type="text"
          placeholder="Code — e.g. CS 3110"
          value={code}
          onChange={e => setCode(e.target.value)}
          className={styles.addInput}
          maxLength={16}
          required
          autoFocus
        />
        <input
          type="text"
          placeholder="Course Name"
          value={name}
          onChange={e => setName(e.target.value)}
          className={styles.addInput}
          maxLength={64}
          required
        />
      </div>
      <div className={styles.addSliders}>
        <IntensitySlider value={math}   color={MATH_COLOR} label="Math"
          onChange={setMath}   onRelease={setMath}   />
        <IntensitySlider value={coding} color={CODE_COLOR} label="Code"
          onChange={setCoding} onRelease={setCoding} />
        <IntensitySlider value={mem}    color={MEM_COLOR}  label="Memo"
          onChange={setMem}    onRelease={setMem}    />
      </div>
      <div className={styles.addActions}>
        <button type="button" onClick={onCancel} className={styles.cancelBtn}>
          Cancel
        </button>
        <button
          type="submit"
          className={styles.saveBtn}
          disabled={!code.trim() || !name.trim()}
        >
          Add Course
        </button>
      </div>
    </form>
  )
}

/* ════════════════════════════════════════════════════════════════
   SUB-COMPONENT — DayStrainColumn
   ════════════════════════════════════════════════════════════════ */

const BAR_MAX_PX = 64   // maximum bar height in pixels

function DayStrainColumn({
  day, isToday,
}: {
  day:     DailyStrainVector
  isToday: boolean
}) {
  const hasLoad  = day.compositeLoad > 0
  const strainLevel =
    day.warning?.status === 'HIGH_STRAIN'     ? 'high'     :
    day.warning?.status === 'MODERATE_STRAIN' ? 'moderate' : 'none'

  // Format date as "6/3"
  const dateLabel = new Date(`${day.dateISO}T12:00:00`).toLocaleDateString('en-US', {
    month: 'numeric', day: 'numeric',
  })

  return (
    <div className={`${styles.dayCol} ${isToday ? styles.today : ''}`}>
      <span className={styles.dayLabel}>{day.dayLabel}</span>
      <span className={styles.dayDate}>{dateLabel}</span>

      {day.eventCount > 0 && (
        <span className={styles.eventChip} title={`${day.eventCount} event${day.eventCount > 1 ? 's' : ''}`}>
          {day.eventCount}
        </span>
      )}

      {/* Bar chart — three vertical bars (math / coding / mem) */}
      <div className={styles.barChart} style={{ height: BAR_MAX_PX }}>
        {hasLoad ? (
          <>
            <div
              className={`${styles.bar} ${styles.barMath}`}
              style={{ height: `${day.mathLoad}%` }}
              title={`Math: ${day.mathLoad}`}
            />
            <div
              className={`${styles.bar} ${styles.barCode}`}
              style={{ height: `${day.codingLoad}%` }}
              title={`Coding: ${day.codingLoad}`}
            />
            <div
              className={`${styles.bar} ${styles.barMem}`}
              style={{ height: `${day.memLoad}%` }}
              title={`Memorization: ${day.memLoad}`}
            />
          </>
        ) : (
          <div className={styles.barEmpty} />
        )}
      </div>

      <span
        className={styles.compositeLoad}
        data-strain={strainLevel}
      >
        {hasLoad ? `${day.compositeLoad}` : '—'}
      </span>

      {day.warning && (
        <span
          className={styles.warningDot}
          data-status={day.warning.status}
          title={day.warning.message}
        />
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   SUB-COMPONENT — StrainWarningBanner
   ════════════════════════════════════════════════════════════════ */

function StrainWarningBanner({ day }: { day: DailyStrainVector }) {
  if (!day.warning) return null
  const isHigh = day.warning.status === 'HIGH_STRAIN'

  return (
    <div className={`${styles.warningBanner} ${isHigh ? styles.warnHigh : styles.warnModerate} anim-slide-in`}>
      <span className={styles.warnIcon}>{isHigh ? '⚠' : 'ℹ'}</span>
      <div className={styles.warnContent}>
        <span className={styles.warnStatus}>
          {isHigh ? 'HIGH STRAIN' : 'MODERATE STRAIN'}
        </span>
        <p className={styles.warnMessage}>{day.warning.message}</p>
      </div>
      <span className={styles.warnDay}>{day.dayLabel}</span>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   SUB-COMPONENT — ForecastLegend
   ════════════════════════════════════════════════════════════════ */

function ForecastLegend() {
  return (
    <div className={styles.legend}>
      {([
        { color: MATH_COLOR, label: 'Math'   },
        { color: CODE_COLOR, label: 'Coding' },
        { color: MEM_COLOR,  label: 'Memory' },
      ] as const).map(({ color, label }) => (
        <div key={label} className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: color }} />
          {label}
        </div>
      ))}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT — CognitiveLoadMap
   ════════════════════════════════════════════════════════════════ */

export default function CognitiveLoadMap() {
  const [showAdd,   setShowAdd]   = useState(false)
  const [overrides, setOverrides] = useState<Map<number, { math: number; coding: number; mem: number }>>(
    () => new Map()
  )

  // Ref always holds the latest overrides so debounce timeout closures read fresh values
  const overridesRef = useRef(overrides)
  overridesRef.current = overrides
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Live queries ──────────────────────────────────────────── */

  const profiles = useLiveQuery(
    () => db.courseIntensityProfiles.toArray(),
    [],
  )

  const todayStart = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [])

  const upcomingEvents = useLiveQuery(
    () => db.calendarEvents
      .where('startMs')
      .between(todayStart, todayStart + 8 * 86_400_000, true, false)
      .toArray(),
    [todayStart],
  )

  /* ── Derived: 7-day strain matrix ──────────────────────────── */

  const strainMatrix = useMemo((): DailyStrainVector[] => {
    if (!profiles || !upcomingEvents) return []
    // Merge IDB profiles with any in-flight slider overrides
    const resolved = profiles.map(p => {
      const ov = overrides.get(p.id!)
      return ov ? { ...p, mathIntensity: ov.math, codingIntensity: ov.coding, memorizationIntensity: ov.mem } : p
    })
    return buildWeeklyStrainMatrix(upcomingEvents, resolved, todayStart)
  }, [profiles, upcomingEvents, overrides, todayStart])

  const warnings = useMemo(() => strainMatrix.filter(d => d.warning), [strainMatrix])

  /* ── Handlers ──────────────────────────────────────────────── */

  const handleSliderChange = useCallback((
    id: number, field: 'math' | 'coding' | 'mem', v: number,
  ) => {
    setOverrides(prev => {
      const next    = new Map(prev)
      const profile = profiles?.find(p => p.id === id)
      const curr    = next.get(id) ?? {
        math:   profile?.mathIntensity         ?? 5,
        coding: profile?.codingIntensity       ?? 5,
        mem:    profile?.memorizationIntensity ?? 5,
      }
      next.set(id, { ...curr, [field]: v })
      return next
    })
  }, [profiles])

  const handleSliderRelease = useCallback((
    id: number, _field: 'math' | 'coding' | 'mem', _v: number,
  ) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const ov = overridesRef.current.get(id)
      if (!ov) return
      await db.courseIntensityProfiles.update(id, {
        mathIntensity:         ov.math,
        codingIntensity:       ov.coding,
        memorizationIntensity: ov.mem,
        updatedAt:             Date.now(),
      })
      // Clear override — live query will return the authoritative value
      setOverrides(prev => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }, 150)
  }, []) // stable — reads latest via overridesRef

  const handleAdd = useCallback(async (
    courseCode: string, courseName: string,
    math: number, coding: number, mem: number,
  ) => {
    const now = Date.now()
    await db.courseIntensityProfiles.add({
      courseCode, courseName,
      mathIntensity: math, codingIntensity: coding, memorizationIntensity: mem,
      createdAt: now, updatedAt: now,
    })
    setShowAdd(false)
  }, [])

  const handleDelete = useCallback(async (id: number) => {
    await db.courseIntensityProfiles.delete(id)
    setOverrides(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const getLocalValues = useCallback((p: CourseIntensityProfile) => {
    const ov = overrides.get(p.id!)
    return {
      math:   ov?.math   ?? p.mathIntensity,
      coding: ov?.coding ?? p.codingIntensity,
      mem:    ov?.mem    ?? p.memorizationIntensity,
    }
  }, [overrides])

  /* ── Render ────────────────────────────────────────────────── */

  const todayISO = new Date(todayStart).toISOString().slice(0, 10)

  if (!profiles) {
    return <div className={styles.loading}>Initializing database…</div>
  }

  return (
    <div className={styles.wrap}>

      {/* ══════════════════════════════════════════════════════════
          PANEL 1 — Course Intensity Matrix
          ══════════════════════════════════════════════════════════ */}
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Course Intensity Matrix</h2>
            <p className={styles.panelHint}>
              Rate each course across three cognitive dimensions to calibrate the forecast.
              Course codes are matched against your calendar event titles automatically.
            </p>
          </div>
          {!showAdd && (
            <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
              + Add Course
            </button>
          )}
        </div>

        {showAdd && (
          <AddCoursePanel onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
        )}

        {profiles.length === 0 && !showAdd ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No courses configured</p>
            <p className={styles.emptyHint}>
              Add your current courses with intensity ratings to generate a cognitive
              load forecast. Include the course code exactly as it appears in your
              calendar — the engine will match events automatically.
            </p>
            <button className={styles.emptyAddBtn} onClick={() => setShowAdd(true)}>
              Add your first course
            </button>
          </div>
        ) : (
          profiles.length > 0 && (
            <div className={styles.courseGrid}>
              {profiles.map(profile => (
                <CourseCard
                  key={profile.id}
                  profile={profile}
                  localValues={getLocalValues(profile)}
                  onSliderChange={handleSliderChange}
                  onSliderRelease={handleSliderRelease}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════
          PANEL 2 — 7-Day Cognitive Forecast
          ══════════════════════════════════════════════════════════ */}
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>7-Day Cognitive Forecast</h2>
            <p className={styles.panelHint}>
              Load vectors compiled from your iCal feeds and course intensity profiles.
              Composite Load Score (CLS) represents weighted strain on a 0–100 scale.
            </p>
          </div>
          <ForecastLegend />
        </div>

        {profiles.length === 0 ? (
          <p className={styles.forecastEmpty}>
            Configure course intensities above to activate the weekly forecast.
          </p>
        ) : (
          <>
            <div className={styles.forecast}>
              {strainMatrix.map(day => (
                <DayStrainColumn
                  key={day.dateISO}
                  day={day}
                  isToday={day.dateISO === todayISO}
                />
              ))}
            </div>

            <div className={styles.barAxis}>
              <span>0</span>
              <span className={styles.axisLabel}>Composite Load Index (0–100)</span>
              <span>100</span>
            </div>

            {warnings.length > 0 && (
              <div className={styles.warnings}>
                {warnings.map(day => (
                  <StrainWarningBanner key={day.dateISO} day={day} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
