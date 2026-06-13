/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — GPA Math Utilities
 * Phase 3 · Step 3.3 — Predictive Cumulative GPA Simulator
 *
 * Pure functions — zero React or Dexie imports.
 * Implements Cornell University's standard decimal grade scale (4.3 max).
 * Source: https://registrar.cornell.edu/records/grades
 * ════════════════════════════════════════════════════════════════
 */

/* ── Grade dictionaries ──────────────────────────────────────── */

/**
 * Cornell 4.3 decimal scale — A+ = 4.3 (official Cornell policy).
 * Source: https://registrar.cornell.edu/records/grades
 */
export const GRADE_POINTS_4_3 = {
  'A+': 4.3,
  'A':  4.0,
  'A-': 3.7,
  'B+': 3.3,
  'B':  3.0,
  'B-': 2.7,
  'C+': 2.3,
  'C':  2.0,
  'C-': 1.7,
  'D':  1.0,
  'F':  0.0,
} as const

/**
 * Standard 4.0 scale used by most universities (no A+).
 */
export const GRADE_POINTS_4_0 = {
  'A':  4.0,
  'A-': 3.7,
  'B+': 3.3,
  'B':  3.0,
  'B-': 2.7,
  'C+': 2.3,
  'C':  2.0,
  'C-': 1.7,
  'D+': 1.3,
  'D':  1.0,
  'F':  0.0,
} as const

/** Default export — Cornell scale (backward-compatible) */
export const GRADE_POINTS = GRADE_POINTS_4_3

export type GradeKey43 = keyof typeof GRADE_POINTS_4_3
export type GradeKey40 = keyof typeof GRADE_POINTS_4_0
export type GradeKey   = GradeKey43   // default (Cornell)

/** Which scale to use — matches GpaScale in university config */
export type ScaleType = '4.3' | '4.0'

/** Returns the grade-point dictionary for a given scale */
export function getGradePoints(scale: ScaleType): Record<string, number> {
  return scale === '4.3'
    ? GRADE_POINTS_4_3 as Record<string, number>
    : GRADE_POINTS_4_0 as Record<string, number>
}

/** Maximum achievable GPA on a given scale */
export function getGpaMax(scale: ScaleType): number {
  return scale === '4.3' ? 4.3 : 4.0
}

/** Backward-compatible constant (Cornell) */
export const GPA_MAX = 4.3

/** Cornell scale ordered worst → best (slider indices 0–10) */
export const GRADES: readonly GradeKey[] = [
  'F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+',
]

/** Standard 4.0 scale ordered worst → best (slider indices 0–10) */
export const GRADES_4_0: readonly GradeKey40[] = [
  'F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A',
]

/** Returns the ordered grade array for a given scale */
export function getGradeList(scale: ScaleType): readonly string[] {
  return scale === '4.3' ? GRADES : GRADES_4_0
}

/* ── Slider ↔ grade converters ───────────────────────────────── */

/** Slider index → grade key for a given scale */
export function gradeFromIndexScale(idx: number, scale: ScaleType): string {
  const list = getGradeList(scale)
  return list[Math.max(0, Math.min(list.length - 1, Math.round(idx)))]
}

/** Grade key → slider index for a given scale */
export function indexFromGradeScale(grade: string, scale: ScaleType): number {
  const list = getGradeList(scale) as readonly string[]
  const i = list.indexOf(grade)
  return i === -1 ? Math.floor(list.length * 0.72) : i  // default ~B+
}

/** Slider index (0–10) → grade key — Cornell scale (backward-compat) */
export function gradeFromIndex(idx: number): GradeKey {
  return GRADES[Math.max(0, Math.min(10, Math.round(idx)))]
}

/** Grade key → slider index (0–10) — Cornell scale (backward-compat) */
export function indexFromGrade(grade: string): number {
  const i = (GRADES as readonly string[]).indexOf(grade)
  return i === -1 ? 7 : i
}

/* ── Types ───────────────────────────────────────────────────── */

/** Minimal course data required to compute a GPA contribution */
export interface CourseMeta {
  credits: number
  grade:   GradeKey | string
}

export interface GpaSummary {
  totalCredits:  number
  /** Rounded to 4 decimal places (internal precision) */
  qualityPoints: number
  /** Rounded to 3 decimal places (display precision) */
  gpa:           number
}

export type GpaTier =
  | 'distinction'   // ≥ 3.7  — Dean's List / top honors tier
  | 'honors'        // ≥ 3.5  — On-track for competitive programs
  | 'good'          // ≥ 3.0  — Solid academic standing
  | 'satisfactory'  // ≥ 2.0  — Meets minimum continuation requirements
  | 'at-risk'       //  < 2.0 — Academic probation risk

/* ── Core algorithm ──────────────────────────────────────────── */

/**
 * Multi-course weighted GPA calculation.
 *
 * Algorithm:
 *   totalCredits  = Σ course.credits
 *   qualityPoints = Σ (course.credits × GRADE_POINTS[course.grade])
 *   GPA           = qualityPoints / totalCredits
 *
 * An empty course list returns 0 for all fields — callers must check
 * totalCredits before displaying GPA to avoid misleading zeroes.
 */
export function calcGpa(courses: CourseMeta[], scale: ScaleType = '4.3'): GpaSummary {
  if (courses.length === 0) {
    return { totalCredits: 0, qualityPoints: 0, gpa: 0 }
  }

  const pts_map = getGradePoints(scale)
  let totalCredits  = 0
  let qualityPoints = 0

  for (const { credits, grade } of courses) {
    const pts = pts_map[grade] ?? 0
    totalCredits  += credits
    qualityPoints += credits * pts
  }

  return {
    totalCredits,
    qualityPoints: roundGpa(qualityPoints, 4),
    gpa: totalCredits > 0
      ? roundGpa(qualityPoints / totalCredits, 3)
      : 0,
  }
}

/* ── Rounding ────────────────────────────────────────────────── */

/**
 * Arithmetic rounding to `digits` decimal places.
 *
 * Uses the multiply-round-divide approach to sidestep
 * floating-point accumulation drift that affects `Number.toFixed`.
 *
 * Example: roundGpa(3.74666…, 3) → 3.747
 */
export function roundGpa(value: number, digits: number): number {
  const factor = Math.pow(10, digits)
  return Math.round(value * factor) / factor
}

/* ── Display helpers ─────────────────────────────────────────── */

/**
 * Format a GPA value for UI output — always 3 decimal places.
 * Returns the em-dash "—" when there are no credit hours on record,
 * preventing a misleading "0.000" from being shown to new users.
 */
export function fmtGpa(gpa: number, totalCredits: number): string {
  return totalCredits === 0 ? '—' : gpa.toFixed(3)
}

/** Map a GPA value to a qualitative achievement tier */
export function gpaTier(gpa: number): GpaTier {
  if (gpa >= 3.7) return 'distinction'
  if (gpa >= 3.5) return 'honors'
  if (gpa >= 3.0) return 'good'
  if (gpa >= 2.0) return 'satisfactory'
  return 'at-risk'
}

/** Map a single letter grade to a GpaTier via its quality-point value */
export function gradeTier(grade: string): GpaTier {
  return gpaTier((GRADE_POINTS as Record<string, number>)[grade] ?? 0)
}

/** Human-readable tier label for display in indicators and badges */
export function tierLabel(tier: GpaTier): string {
  switch (tier) {
    case 'distinction':  return 'Dean\'s List'
    case 'honors':       return 'Honors'
    case 'good':         return 'Good Standing'
    case 'satisfactory': return 'Satisfactory'
    case 'at-risk':      return 'At Risk'
  }
}
