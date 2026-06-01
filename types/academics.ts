/**
 * Zenith OS — Academic Analytics Types
 * Phase 3 · Step 3.4 — Course Load Matrix & Cognitive Load Map
 */

/** Intensity profile for a course stored in IndexedDB. */
export interface CourseIntensityProfile {
  id?:                   number  // PK auto-increment (omit on insert)
  courseCode:            string  // e.g. "CS 3110" — matched against calendar event titles
  courseName:            string  // e.g. "Data Structures & Functional Programming"
  mathIntensity:         number  // 1–10: abstract reasoning, proofs, calculus
  codingIntensity:       number  // 1–10: implementation, debugging, systems work
  memorizationIntensity: number  // 1–10: definitions, recall, vocabulary load
  createdAt:             number  // Unix ms
  updatedAt:             number  // Unix ms
}

/** Composite cognitive load breakdown derived from a CourseIntensityProfile. */
export interface CognitiveLoadScore {
  math:         number    // 0–100
  coding:       number    // 0–100
  memorization: number    // 0–100
  composite:    number    // 0–100 weighted (math 35%, coding 35%, mem 30%)
  tier:         LoadTier
}

export type LoadTier = 'low' | 'moderate' | 'high' | 'critical'

/** Per-day strain vector produced by the stress matrix forecasting algorithm. */
export interface DailyStrainVector {
  dateISO:        string    // "YYYY-MM-DD"
  dayLabel:       string    // "Mon" — abbreviated weekday
  fullDayLabel:   string    // "Monday" — full name used in warning messages
  mathLoad:       number    // 0–100
  codingLoad:     number    // 0–100
  memLoad:        number    // 0–100
  compositeLoad:  number    // 0–100 weighted
  eventCount:     number    // total calendar events on this day
  matchedCourses: string[]  // courseCode values matched from events
  warning?:       StrainWarning
}

export interface StrainWarning {
  status:  'HIGH_STRAIN' | 'MODERATE_STRAIN'
  message: string
}
