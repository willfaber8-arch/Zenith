'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — GPA Simulator
 * Phase 3 · Step 3.3 — Predictive Cumulative GPA Simulator
 *
 * Architecture:
 *   • Historical semesters — locked IDB records; grade editable via
 *     inline select dropdown, changes persist immediately.
 *   • Projected semesters — What-If sandbox; grade controlled by
 *     smooth range sliders; slider state is held in React for instant
 *     recalculation, then flushed to IDB on pointer-up.
 *   • Cumulative GPA recalculates on every render using the
 *     authoritative IDB values + any in-flight slider overrides.
 * ════════════════════════════════════════════════════════════════
 */

import {
  useState, useMemo, useCallback, useRef,
  type FormEvent, type CSSProperties,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type GpaSemester, type GpaCourse } from '@/lib/db'
import {
  calcGpa, fmtGpa, gpaTier, gradeTier, roundGpa,
  gradeFromIndexScale, indexFromGradeScale,
  gradeFromIndex, indexFromGrade,
  getGradeList, getGradePoints, getGpaMax,
  GRADES, GRADE_POINTS,
  type GradeKey, type GpaTier, type ScaleType,
} from '@/utils/gpaMath'
import type { GpaScale } from '@/config/universities'
import styles from './GpaSimulator.module.css'

/* ── Constants ───────────────────────────────────────────────── */

const GPA_MAX           = 4.3
const DEFAULT_TARGET    = 3.5
const CREDIT_OPTIONS    = [1, 2, 3, 4, 5, 6] as const
const TERM_OPTIONS      = ['fall', 'spring', 'summer'] as const
const CURRENT_YEAR      = new Date().getFullYear()

/* ── Seed data (Cornell CS engineering sample record) ─────────── */

const SAMPLE_SEMESTERS: Array<{
  name: string; term: 'fall'|'spring'|'summer'; year: number; isProjected: 0|1
  courses: Array<{ code: string; name: string; credits: number; grade: GradeKey }>
}> = [
  {
    name: 'Fall 2023', term: 'fall', year: 2023, isProjected: 0,
    courses: [
      { code: 'CS 1110',   name: 'Introduction to Computing Using Python', credits: 4, grade: 'A'  },
      { code: 'MATH 1910', name: 'Calculus for Engineers',                 credits: 4, grade: 'B+' },
      { code: 'PHYS 1112', name: 'Physics I: Mechanics',                   credits: 4, grade: 'B'  },
      { code: 'FWS 1234',  name: 'First-Year Writing Seminar',             credits: 3, grade: 'A-' },
    ],
  },
  {
    name: 'Spring 2024', term: 'spring', year: 2024, isProjected: 0,
    courses: [
      { code: 'CS 2110',   name: 'Object-Oriented Programming & Data Structures', credits: 4, grade: 'A-' },
      { code: 'MATH 2210', name: 'Linear Algebra',                                credits: 4, grade: 'B+' },
      { code: 'PHYS 1116', name: 'Physics II: Electromagnetism',                  credits: 4, grade: 'B+' },
      { code: 'CS 2800',   name: 'Discrete Structures',                           credits: 4, grade: 'A'  },
    ],
  },
  {
    name: 'Fall 2024', term: 'fall', year: 2024, isProjected: 1,
    courses: [
      { code: 'MATH 2220', name: 'Multivariable Calculus',       credits: 4, grade: 'B+' },
      { code: 'CS 3110',   name: 'Data Structures & Functional Programming', credits: 4, grade: 'B+' },
      { code: 'ECE 2100',  name: 'Introduction to Circuits',     credits: 3, grade: 'B'  },
      { code: 'CS 4780',   name: 'Machine Learning',             credits: 3, grade: 'A-' },
    ],
  },
]

/* ── Helpers ─────────────────────────────────────────────────── */

function termIndex(term: 'fall'|'spring'|'summer'): number {
  return term === 'spring' ? 0 : term === 'summer' ? 1 : 2
}

function semDisplayOrder(year: number, term: 'fall'|'spring'|'summer'): number {
  return year * 10 + termIndex(term)
}

function termLabel(term: 'fall'|'spring'|'summer'): string {
  return term.charAt(0).toUpperCase() + term.slice(1)
}

function tierCSSClass(tier: GpaTier): string {
  return tier // tier values match data-tier attribute names directly
}

/** Classify margin to target as onTrack / nearMiss / offTrack */
function marginClass(margin: number): 'onTrack' | 'nearMiss' | 'offTrack' {
  if (margin >= 0)     return 'onTrack'
  if (margin >= -0.1)  return 'nearMiss'
  return 'offTrack'
}

/* ════════════════════════════════════════════════════════════════
   SUB-COMPONENT — GradeSlider (projected courses only)
   ════════════════════════════════════════════════════════════════ */

function GradeSlider({
  courseId,
  grade,
  onChange,
  onRelease,
}: {
  courseId:  number
  grade:     string
  onChange:  (id: number, idx: number) => void
  onRelease: (id: number, idx: number) => void
}) {
  const idx      = indexFromGrade(grade)
  const fillPct  = `${(idx / 10) * 100}%`
  const tier     = gradeTier(grade)

  return (
    <div className={styles.sliderCell}>
      <span
        className={styles.sliderGradeLabel}
        data-tier={tier}
        style={{ color: tier === 'distinction' || tier === 'honors'
          ? 'var(--accent-green)'
          : tier === 'good' ? 'var(--accent-purple)'
          : 'var(--text-dark)'
        }}
      >
        {grade}
      </span>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={idx}
        className={styles.gradeSlider}
        style={{ '--fill-pct': fillPct } as CSSProperties}
        aria-label={`Grade for course ${courseId}`}
        aria-valuetext={grade}
        onChange={e => onChange(courseId, Number(e.target.value))}
        onPointerUp={e => onRelease(courseId, Number((e.target as HTMLInputElement).value))}
      />
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   SUB-COMPONENT — AddCourseForm
   ════════════════════════════════════════════════════════════════ */

function AddCourseForm({
  semesterId,
  isProjected,
  onAdd,
  onCancel,
}: {
  semesterId:  number
  isProjected: boolean
  onAdd:       (semesterId: number, code: string, name: string, credits: number, grade: GradeKey) => void
  onCancel:    () => void
}) {
  const [code,    setCode]    = useState('')
  const [name,    setName]    = useState('')
  const [credits, setCredits] = useState(3)
  const [grade,   setGrade]   = useState<GradeKey>('B+')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim()) return
    onAdd(semesterId, code.trim().toUpperCase(), name.trim(), credits, grade)
    setCode(''); setName(''); setCredits(3); setGrade('B+')
  }

  return (
    <form onSubmit={handleSubmit} className={styles.addCourseRow}>
      <div className={styles.formField}>
        <label className={styles.formLabel}>Code</label>
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="CS 3110"
          className={`${styles.formInput} ${styles.md}`}
          autoFocus
        />
      </div>

      <div className={styles.formField} style={{ flex: 1 }}>
        <label className={styles.formLabel}>Course Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Data Structures & Functional Programming"
          className={styles.formInput}
          style={{ width: '100%' }}
        />
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Credits</label>
        <div className={styles.creditPills}>
          {CREDIT_OPTIONS.map(n => (
            <button
              key={n}
              type="button"
              className={`${styles.creditPill} ${credits === n ? styles.active : ''}`}
              onClick={() => setCredits(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Grade</label>
        <select
          value={grade}
          onChange={e => setGrade(e.target.value as GradeKey)}
          className={styles.formSelect}
        >
          {[...GRADES].reverse().map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className={styles.formActions}>
        <button
          type="submit"
          className={`${styles.formSubmitBtn} ${isProjected ? styles.green : ''}`}
        >
          Add
        </button>
        <button type="button" className={styles.formCancelBtn} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/* ════════════════════════════════════════════════════════════════
   SUB-COMPONENT — AddSemesterForm
   ════════════════════════════════════════════════════════════════ */

function AddSemesterForm({
  isProjected,
  onAdd,
  onCancel,
}: {
  isProjected: boolean
  onAdd:       (name: string, term: 'fall'|'spring'|'summer', year: number, isProjected: 0|1) => void
  onCancel:    () => void
}) {
  const [term, setTerm] = useState<'fall'|'spring'|'summer'>(isProjected ? 'fall' : 'spring')
  const [year, setYear] = useState(isProjected ? CURRENT_YEAR : CURRENT_YEAR - 1)

  const generatedName = `${termLabel(term)} ${year}`

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const y = Math.max(1990, Math.min(2100, year))
    onAdd(generatedName, term, y, isProjected ? 1 : 0)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`${styles.addSemForm} ${isProjected ? styles.addSemFormProjected : ''}`}
    >
      <div className={styles.formField}>
        <label className={styles.formLabel}>Term</label>
        <select
          value={term}
          onChange={e => setTerm(e.target.value as 'fall'|'spring'|'summer')}
          className={styles.formSelect}
        >
          {TERM_OPTIONS.map(t => (
            <option key={t} value={t}>{termLabel(t)}</option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Year</label>
        <input
          type="number"
          min={1990}
          max={2100}
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className={`${styles.formInput} ${styles.sm}`}
          style={{ width: '72px' }}
        />
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Preview</label>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)', paddingTop: '7px' }}>
          {generatedName}
        </span>
      </div>

      <div className={styles.formActions}>
        <button
          type="submit"
          className={`${styles.formSubmitBtn} ${isProjected ? styles.green : ''}`}
        >
          {isProjected ? 'Add Projection' : 'Add Semester'}
        </button>
        <button type="button" className={styles.formCancelBtn} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/* ════════════════════════════════════════════════════════════════
   SUB-COMPONENT — SemesterCard (collapsible)
   ════════════════════════════════════════════════════════════════ */

function SemesterCard({
  semester,
  courses,
  sliderOverrides,
  onSliderChange,
  onSliderRelease,
  onDeleteSemester,
  onDeleteCourse,
  onAddCourse,
  onUpdateGrade,
}: {
  semester:       GpaSemester
  courses:        GpaCourse[]
  sliderOverrides: Map<number, string>
  onSliderChange:  (id: number, idx: number) => void
  onSliderRelease: (id: number, idx: number) => void
  onDeleteSemester: (id: number) => void
  onDeleteCourse:   (id: number) => void
  onAddCourse:      (semId: number, code: string, name: string, credits: number, grade: GradeKey) => void
  onUpdateGrade:    (id: number, grade: GradeKey) => void
}) {
  const [open,       setOpen]       = useState(true)
  const [addingCourse, setAddingCourse] = useState(false)
  const [editingId,  setEditingId]  = useState<number | null>(null)
  const isProjected = semester.isProjected === 1

  /* Per-semester GPA (respects slider overrides for projected) */
  const semCoursesForCalc = courses.map(c => ({
    credits: c.credits,
    grade:   isProjected ? (sliderOverrides.get(c.id!) ?? c.grade) : c.grade,
  }))
  const semSummary = calcGpa(semCoursesForCalc)

  const handleGradeChange = (courseId: number, grade: GradeKey) => {
    setEditingId(null)
    onUpdateGrade(courseId, grade)
  }

  const handleAddCourse = (semId: number, code: string, name: string, credits: number, grade: GradeKey) => {
    onAddCourse(semId, code, name, credits, grade)
    setAddingCourse(false)
  }

  return (
    <div className={`${styles.card} ${isProjected ? styles.projected : ''}`}>

      {/* Header — toggle + stats */}
      <div className={styles.cardHeader} role="button" tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`${semester.name} — ${fmtGpa(semSummary.gpa, semSummary.totalCredits)} GPA, ${semSummary.totalCredits} credits`}
      >
        {/* Chevron */}
        <svg
          className={`${styles.cardHeaderChevron} ${open ? styles.open : ''}`}
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}
          aria-hidden="true"
        >
          <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div className={styles.cardHeaderInfo}>
          <span className={styles.cardSemName}>{semester.name}</span>
          {isProjected && <span className={styles.cardProjectedTag}>What-If</span>}
        </div>

        <div className={styles.cardStats}>
          {semSummary.totalCredits > 0 && (
            <>
              <span className={styles.cardGpa}>{fmtGpa(semSummary.gpa, semSummary.totalCredits)}</span>
              <span className={styles.cardCredits}>{semSummary.totalCredits} cr</span>
            </>
          )}
        </div>

        {/* Delete semester button */}
        <button
          type="button"
          className={styles.cardDeleteBtn}
          onClick={e => { e.stopPropagation(); onDeleteSemester(semester.id!) }}
          aria-label={`Delete ${semester.name}`}
        >
          ×
        </button>
      </div>

      {/* Collapsible body — CSS grid-template-rows trick */}
      <div className={`${styles.cardBodyWrap} ${open ? styles.open : ''}`}>
        <div className={styles.cardBodyInner}>
          <div className={styles.cardBody}>

            {courses.length === 0 && !addingCourse && (
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-dark)', fontStyle: 'italic' }}>
                No courses yet — add one below.
              </p>
            )}

            {/* Course rows */}
            <div className={styles.courseList}>
              {courses.map(course => {
                const effectiveGrade = isProjected
                  ? (sliderOverrides.get(course.id!) ?? course.grade)
                  : course.grade
                const tier = gradeTier(effectiveGrade)
                const isEditing = editingId === course.id

                return (
                  <div key={course.id} className={styles.courseRow}>
                    <span className={styles.courseCode}>{course.courseCode}</span>
                    <span className={styles.courseName}>{course.courseName}</span>
                    <span className={styles.courseCredits}>{course.credits}cr</span>

                    {/* Grade: slider for projected, badge/select for historical */}
                    {isProjected ? (
                      <GradeSlider
                        courseId={course.id!}
                        grade={effectiveGrade}
                        onChange={onSliderChange}
                        onRelease={onSliderRelease}
                      />
                    ) : isEditing ? (
                      <select
                        className={styles.gradeSelect}
                        value={effectiveGrade}
                        autoFocus
                        onChange={e => handleGradeChange(course.id!, e.target.value as GradeKey)}
                        onBlur={() => setEditingId(null)}
                      >
                        {[...GRADES].reverse().map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        className={styles.gradeBadge}
                        data-tier={tier}
                        onClick={() => setEditingId(course.id!)}
                        title="Click to edit grade"
                      >
                        {effectiveGrade}
                      </button>
                    )}

                    {/* Delete course */}
                    <button
                      type="button"
                      className={styles.courseDeleteBtn}
                      onClick={() => onDeleteCourse(course.id!)}
                      aria-label={`Remove ${course.courseCode}`}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Add course form */}
            {addingCourse && (
              <AddCourseForm
                semesterId={semester.id!}
                isProjected={isProjected}
                onAdd={handleAddCourse}
                onCancel={() => setAddingCourse(false)}
              />
            )}

            {!addingCourse && (
              <button
                type="button"
                className={styles.addCourseBtn}
                onClick={() => setAddingCourse(true)}
              >
                + Add Course
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   SUB-COMPONENT — GpaMetricPanel
   ════════════════════════════════════════════════════════════════ */

function GpaMetricPanel({
  historicalGpa,
  historicalCredits,
  projectedGpa,
  projectedCredits,
  targetGpa,
  onTargetChange,
}: {
  historicalGpa:     number
  historicalCredits: number
  projectedGpa:      number
  projectedCredits:  number
  targetGpa:         number
  onTargetChange:    (v: number) => void
}) {
  const totalCredits = historicalCredits + projectedCredits
  const tier         = totalCredits > 0 ? gpaTier(projectedGpa) : 'good'
  const margin       = totalCredits > 0 ? roundGpa(projectedGpa - targetGpa, 3) : 0
  const mClass       = marginClass(margin)

  const gpaPct    = Math.min(100, (projectedGpa / GPA_MAX) * 100)
  const targetPct = Math.min(100, (targetGpa  / GPA_MAX) * 100)

  const onTrack   = projectedGpa >= targetGpa

  return (
    <div className={styles.metricPanel}>

      {/* Large GPA display */}
      <div className={styles.gpaRow}>
        <span
          className={styles.gpaNumber}
          data-tier={tierCSSClass(tier)}
        >
          {fmtGpa(projectedGpa, totalCredits)}
        </span>
        {totalCredits > 0 && (
          <span className={styles.gpaTierBadge} data-tier={tierCSSClass(tier)}>
            {tier === 'distinction' ? "Dean's List" :
             tier === 'honors'      ? 'Honors'      :
             tier === 'good'        ? 'Good'         :
             tier === 'satisfactory'? 'Satisfactory' : 'At Risk'}
          </span>
        )}
      </div>

      {/* Breakdown: historical vs projected */}
      <div className={styles.gpaBreakdown}>
        <div className={styles.breakdownItem}>
          <span className={styles.breakdownLabel}>Historical</span>
          <span className={`${styles.breakdownValue} ${totalCredits > 0 ? '' : ''}`}>
            {fmtGpa(historicalGpa, historicalCredits)}
          </span>
          <span className={styles.breakdownCredits}>{historicalCredits} credit hours</span>
        </div>

        {projectedCredits > 0 && (
          <div className={styles.breakdownItem}>
            <span className={styles.breakdownLabel}>With Projections</span>
            <span className={`${styles.breakdownValue} ${styles.primary}`}>
              {fmtGpa(projectedGpa, totalCredits)}
            </span>
            <span className={styles.breakdownCredits}>+{projectedCredits} projected</span>
          </div>
        )}
      </div>

      {/* Target GPA bar */}
      <div className={styles.targetRow}>
        <span className={styles.targetLabel}>Target</span>
        <input
          type="number"
          min={0}
          max={GPA_MAX}
          step={0.05}
          value={targetGpa}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onTargetChange(Math.max(0, Math.min(GPA_MAX, v)))
          }}
          className={styles.targetInput}
          aria-label="Target GPA"
        />

        <div className={styles.targetBarWrap} role="presentation">
          <div className={styles.targetBarTrack} />
          {totalCredits > 0 && (
            <div
              className={styles.targetBarFill}
              style={{
                width:      `${gpaPct}%`,
                background: onTrack ? 'var(--accent-green)' : 'var(--accent-purple)',
              }}
            />
          )}
          {/* Target marker line */}
          <div
            className={styles.targetMarker}
            style={{ left: `${targetPct}%` }}
            aria-hidden="true"
          />
          <span
            className={styles.targetMarkerLabel}
            style={{ left: `${targetPct}%` }}
            aria-hidden="true"
          >
            {targetGpa.toFixed(1)}
          </span>
        </div>

        {/* Margin indicator bubble */}
        {totalCredits > 0 && (
          <div className={`${styles.targetMargin} ${styles[mClass]}`} role="status" aria-live="polite">
            {onTrack
              ? `✓  ${Math.abs(margin).toFixed(3)} above target`
              : `△  ${Math.abs(margin).toFixed(3)} below target`}
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MAIN EXPORT — GpaSimulator
   ════════════════════════════════════════════════════════════════ */

export default function GpaSimulator({ gpaScale = '4.3' }: { gpaScale?: GpaScale }) {
  const scale: ScaleType = gpaScale
  /* ── IDB data ────────────────────────────────────────────── */
  const rawSemesters = useLiveQuery(
    () => db?.gpaSemesters.orderBy('displayOrder').toArray() ?? [],
    [], [] as GpaSemester[],
  )
  const rawCourses = useLiveQuery(
    () => db?.gpaCourses.toArray() ?? [],
    [], [] as GpaCourse[],
  )

  /* ── UI state ────────────────────────────────────────────── */
  const [sliderOverrides,    setSliderOverrides]    = useState<Map<number, string>>(new Map())
  const [targetGpa,          setTargetGpa]          = useState(DEFAULT_TARGET)
  const [isAddingHistorical, setIsAddingHistorical] = useState(false)
  const [isAddingProjected,  setIsAddingProjected]  = useState(false)

  /* ── Derived data ─────────────────────────────────────────── */
  const semesters = rawSemesters ?? []
  const courses   = rawCourses   ?? []

  const coursesBySem = useMemo<Map<number, GpaCourse[]>>(() => {
    const map = new Map<number, GpaCourse[]>()
    for (const c of courses) {
      const list = map.get(c.semesterId) ?? []
      list.push(c)
      map.set(c.semesterId, list)
    }
    return map
  }, [courses])

  const historical = useMemo(
    () => semesters.filter(s => s.isProjected === 0),
    [semesters],
  )
  const projected = useMemo(
    () => semesters.filter(s => s.isProjected === 1),
    [semesters],
  )

  /* ── GPA computations ────────────────────────────────────── */
  const historicalCourses = useMemo(() =>
    historical.flatMap(s => (coursesBySem.get(s.id!) ?? []).map(c => ({
      credits: c.credits, grade: c.grade,
    }))), [historical, coursesBySem])

  const projectedCourses = useMemo(() =>
    projected.flatMap(s => (coursesBySem.get(s.id!) ?? []).map(c => ({
      credits: c.credits,
      grade:   sliderOverrides.get(c.id!) ?? c.grade,
    }))), [projected, coursesBySem, sliderOverrides])

  const historicalSummary = useMemo(() => calcGpa(historicalCourses, scale), [historicalCourses, scale])
  const cumulativeSummary = useMemo(
    () => calcGpa([...historicalCourses, ...projectedCourses], scale),
    [historicalCourses, projectedCourses, scale],
  )

  const isEmpty = semesters.length === 0

  /* ── Debounce ref for IDB slider writes ───────────────────── */
  const sliderWriteRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  /* ── Action handlers ──────────────────────────────────────── */

  const handleSeedData = useCallback(async () => {
    if (!db) return
    await db.transaction('rw', db.gpaSemesters, db.gpaCourses, async () => {
      for (const sem of SAMPLE_SEMESTERS) {
        const semId = await db.gpaSemesters.add({
          name:         sem.name,
          term:         sem.term,
          year:         sem.year,
          displayOrder: semDisplayOrder(sem.year, sem.term),
          isProjected:  sem.isProjected,
        })
        for (const c of sem.courses) {
          await db.gpaCourses.add({
            semesterId: semId as number,
            courseCode: c.code,
            courseName: c.name,
            credits:    c.credits,
            grade:      c.grade,
          })
        }
      }
    })
  }, [])

  const handleAddSemester = useCallback(async (
    name: string,
    term: 'fall'|'spring'|'summer',
    year: number,
    isProjected: 0|1,
  ) => {
    if (!db) return
    await db.gpaSemesters.add({
      name,
      term,
      year,
      displayOrder: semDisplayOrder(year, term),
      isProjected,
    })
    if (isProjected) setIsAddingProjected(false)
    else             setIsAddingHistorical(false)
  }, [])

  const handleDeleteSemester = useCallback(async (semId: number) => {
    if (!db) return
    await db.transaction('rw', db.gpaSemesters, db.gpaCourses, async () => {
      await db.gpaCourses.where('semesterId').equals(semId).delete()
      await db.gpaSemesters.delete(semId)
    })
  }, [])

  const handleAddCourse = useCallback(async (
    semId: number, code: string, name: string, credits: number, grade: GradeKey,
  ) => {
    if (!db) return
    await db.gpaCourses.add({ semesterId: semId, courseCode: code, courseName: name, credits, grade })
  }, [])

  const handleDeleteCourse = useCallback(async (courseId: number) => {
    if (!db) return
    setSliderOverrides(prev => { const next = new Map(prev); next.delete(courseId); return next })
    await db.gpaCourses.delete(courseId)
  }, [])

  const handleUpdateGrade = useCallback(async (courseId: number, grade: GradeKey) => {
    if (!db) return
    await db.gpaCourses.update(courseId, { grade })
  }, [])

  /* Live slider: update React state immediately for instant GPA feedback */
  const handleSliderChange = useCallback((courseId: number, idx: number) => {
    const grade = gradeFromIndex(idx)
    setSliderOverrides(prev => new Map(prev).set(courseId, grade))
  }, [])

  /* On pointer-up: debounce the IDB write so rapid dragging doesn't flood IDB */
  const handleSliderRelease = useCallback((courseId: number, idx: number) => {
    const grade = gradeFromIndex(idx)
    setSliderOverrides(prev => new Map(prev).set(courseId, grade))

    const existing = sliderWriteRef.current.get(courseId)
    if (existing) clearTimeout(existing)

    const t = setTimeout(async () => {
      if (db) await db.gpaCourses.update(courseId, { grade })
      sliderWriteRef.current.delete(courseId)
    }, 150)
    sliderWriteRef.current.set(courseId, t)
  }, [])

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className={`${styles.simulator} anim-scale-in`}>

      {/* ── Metric panel ──────────────────────────────────── */}
      {!isEmpty && (
        <GpaMetricPanel
          historicalGpa={historicalSummary.gpa}
          historicalCredits={historicalSummary.totalCredits}
          projectedGpa={cumulativeSummary.gpa}
          projectedCredits={projectedCourses.reduce((s, c) => s + c.credits, 0)}
          targetGpa={targetGpa}
          onTargetChange={setTargetGpa}
        />
      )}

      {/* ── Empty state ───────────────────────────────────── */}
      {isEmpty && (
        <div className={`${styles.emptyCard} anim-fade-in`}>
          <p className={styles.emptyTitle}>No academic record found.</p>
          <p className={styles.emptyBody}>
            Add your historical semesters to calculate your cumulative GPA,
            then use What-If projections to simulate future grades and hit
            your target.
          </p>
          <div className={styles.emptyActions}>
            <button
              type="button"
              className={styles.seedBtn}
              onClick={handleSeedData}
            >
              Load Cornell CS Sample Record
            </button>
            <button
              type="button"
              className={styles.formSubmitBtn}
              onClick={() => setIsAddingHistorical(true)}
            >
              Add First Semester
            </button>
          </div>
        </div>
      )}

      {/* ── Historical semesters ──────────────────────────── */}
      <section className={`${styles.semSection} anim-slide-in delay-1`}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Historical Semesters</h2>
            <p className={styles.sectionHint}>Completed academic record — click a grade to edit</p>
          </div>
          {!isAddingHistorical && (
            <button
              type="button"
              className={styles.sectionAddBtn}
              onClick={() => setIsAddingHistorical(true)}
            >
              + Add Semester
            </button>
          )}
        </div>

        {historical.map(sem => (
          <SemesterCard
            key={sem.id}
            semester={sem}
            courses={coursesBySem.get(sem.id!) ?? []}
            sliderOverrides={sliderOverrides}
            onSliderChange={handleSliderChange}
            onSliderRelease={handleSliderRelease}
            onDeleteSemester={handleDeleteSemester}
            onDeleteCourse={handleDeleteCourse}
            onAddCourse={handleAddCourse}
            onUpdateGrade={handleUpdateGrade}
          />
        ))}

        {isAddingHistorical && (
          <AddSemesterForm
            isProjected={false}
            onAdd={handleAddSemester}
            onCancel={() => setIsAddingHistorical(false)}
          />
        )}
      </section>

      {/* ── What-If projections ───────────────────────────── */}
      <section className={`${styles.semSection} anim-slide-in delay-2`}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>What-If Projections</h2>
            <p className={styles.sectionHint}>Drag sliders to simulate future grades — GPA updates instantly</p>
          </div>
          {!isAddingProjected && (
            <button
              type="button"
              className={styles.sectionAddBtn}
              onClick={() => setIsAddingProjected(true)}
            >
              + Add Projection
            </button>
          )}
        </div>

        {projected.map(sem => (
          <SemesterCard
            key={sem.id}
            semester={sem}
            courses={coursesBySem.get(sem.id!) ?? []}
            sliderOverrides={sliderOverrides}
            onSliderChange={handleSliderChange}
            onSliderRelease={handleSliderRelease}
            onDeleteSemester={handleDeleteSemester}
            onDeleteCourse={handleDeleteCourse}
            onAddCourse={handleAddCourse}
            onUpdateGrade={handleUpdateGrade}
          />
        ))}

        {projected.length === 0 && !isAddingProjected && !isEmpty && (
          <div className={styles.emptyCard} style={{ borderColor: 'rgba(82,204,163,0.12)' }}>
            <p className={styles.emptyTitle}>No projections yet.</p>
            <p className={styles.emptyBody}>
              Add a future semester and use the grade sliders to model
              different outcomes before the term begins.
            </p>
          </div>
        )}

        {isAddingProjected && (
          <AddSemesterForm
            isProjected={true}
            onAdd={handleAddSemester}
            onCancel={() => setIsAddingProjected(false)}
          />
        )}
      </section>

    </div>
  )
}
