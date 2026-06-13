/**
 * Zenith OS — AI Roadmap IDB Injector
 * Phase 8 · Step 8.2 — Atomic Assignment Table Transaction Utility
 *
 * Pure async utility — no React imports.
 * Accepts the AI-generated task array and writes every row into the
 * 'assignments' table inside a single Dexie rw transaction so the
 * whole roadmap either lands atomically or rolls back on any error.
 *
 * Mapping logic:
 *   AI 'title'        → assignment.title
 *   AI 'category'     → assignment.courseId  (closest schema equivalent)
 *   AI 'daysFromNow'  → assignment.dueDate   (ISO "YYYY-MM-DD" calculated from today)
 *   fixed 'pending'   → assignment.status
 *   derived priority  → assignment.priority  (based on daysFromNow proximity)
 *   '✦ AI Roadmap'    → assignment.notes     (provenance marker)
 */

import { db } from '@/lib/db'
import type { Priority } from '@/lib/db'

/* ── Re-export the shared task shape ─────────────────────────── */

export interface RoadmapTask {
  title:       string
  category:    'Academic' | 'Life'
  daysFromNow: number
}

export interface RoadmapInjectionResult {
  injectedIds:  number[]
  injectedCount: number
}

/* ── Helpers ──────────────────────────────────────────────────── */

/**
 * Convert a daysFromNow integer to an ISO-8601 calendar string.
 * Uses local date arithmetic so the due date aligns with the user's timezone.
 */
export function daysFromNowToISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + Math.max(1, Math.round(days)))
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Derive a Priority level from how many days away the task is.
 * Near-term milestones are higher priority to surface them in views.
 */
export function priorityFromDays(days: number): Priority {
  if (days <= 3)  return 'high'
  if (days <= 7)  return 'medium'
  return 'low'
}

/* ── Core injector ────────────────────────────────────────────── */

/**
 * Write every task in the roadmap array to the 'assignments' IDB table
 * inside a single atomic Dexie transaction.
 *
 * Returns the array of auto-generated assignment IDs so callers can
 * scroll to or highlight the newly created rows.
 */
export async function injectAIGeneratedRoadmap(
  tasks: RoadmapTask[],
): Promise<RoadmapInjectionResult> {
  if (!tasks || tasks.length === 0) {
    return { injectedIds: [], injectedCount: 0 }
  }

  const now = Date.now()
  const injectedIds: number[] = []

  await db.transaction('rw', db.assignments, async () => {
    for (const task of tasks) {
      const id = await db.assignments.add({
        title:     task.title,
        dueDate:   daysFromNowToISO(task.daysFromNow),
        courseId:  task.category,   // 'Academic' | 'Life' stored as courseId
        status:    'pending',
        priority:  priorityFromDays(task.daysFromNow),
        notes:     '✦ AI Roadmap',
        createdAt: now,
        updatedAt: now,
      })
      injectedIds.push(id as number)
    }
  })

  return { injectedIds, injectedCount: injectedIds.length }
}
