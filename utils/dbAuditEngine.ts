/**
 * utils/dbAuditEngine.ts
 * Phase 12.1 — Advanced Multi-Database Schema Auditing
 *
 * Background client-side audit engine that:
 *   1. Validates field types, enum membership, and numeric bounds
 *      across three primary tables (assignments, userProfile, vocab_cards)
 *   2. Silently patches missing or corrupted fields rather than wiping data
 *   3. Purges vocab_cards whose deckId references a non-existent VocabDeck
 *   4. Returns a structured MasterAuditReport consumed by the boot cinematic
 *
 * Design constraints:
 *   · No React imports — pure async utility, safe for any call site
 *   · All IDB access is guarded by the SSR window check
 *   · Each table audit is isolated: one failure cannot block others
 *   · Non-destructive: rows are patched in-place, never blindly dropped
 *     (except orphaned FK rows, which are structurally invalid by definition)
 */

import { db } from '@/lib/db'
import type {
  TableDescriptor,
  FieldRule,
  AuditIssue,
  TableAuditResult,
  MasterAuditReport,
} from '@/types/dbAudit'
import {
  ASSIGNMENTS_DESCRIPTOR,
  USER_PROFILE_DESCRIPTOR,
  VOCAB_CARDS_DESCRIPTOR,
} from '@/types/dbAudit'

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/** Monotonic timer helper — avoids Date.now() drift for duration measurements */
function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/**
 * Evaluates a single row against a TableDescriptor.
 * Returns a patch object containing only the fields that need updating,
 * or `null` if the row is fully compliant.
 *
 * Intentionally works on `Record<string, unknown>` so it can be used
 * against raw IDB rows that may carry legacy fields not present in
 * the current TypeScript interface.
 */
function evaluateRow(
  row: Record<string, unknown>,
  descriptor: TableDescriptor,
  rowId: number | string,
): { patch: Record<string, unknown>; issues: AuditIssue[] } | null {
  const patch: Record<string, unknown> = {}
  const issues: AuditIssue[]          = []

  for (const [field, rule] of Object.entries(descriptor)) {
    const rawValue = row[field]
    const isAbsent = rawValue === undefined || rawValue === null

    // ── optionalLegacy: skip entirely if the field is not present ──
    if (rule.optionalLegacy && isAbsent) continue

    // ── Inject default for absent required fields ──────────────────
    if (isAbsent) {
      if (rule.default !== undefined) {
        const injectable = rule.default === 0 && field === 'createdAt'
          ? Date.now()   // createdAt=0 sentinel → real timestamp
          : rule.default
        patch[field] = injectable
        issues.push({
          rowId,
          field,
          reason: `Field absent; injected default: ${JSON.stringify(injectable)}`,
          action: 'patched',
          patch:  { [field]: injectable },
        })
      }
      continue
    }

    const value = rawValue as unknown

    // ── Type mismatch ──────────────────────────────────────────────
    if (rule.type && typeof value !== rule.type) {
      const fallback = rule.default ?? (rule.type === 'number' ? (rule.nanFallback ?? 0) : '')
      patch[field] = fallback
      issues.push({
        rowId,
        field,
        reason: `Expected ${rule.type}, found ${typeof value}; reset to ${JSON.stringify(fallback)}`,
        action: 'patched',
        patch:  { [field]: fallback },
      })
      continue
    }

    // ── Number-specific validation ────────────────────────────────
    if (rule.type === 'number' && typeof value === 'number') {
      if (!isFinite(value) || isNaN(value)) {
        const recovery = rule.nanFallback ?? rule.default ?? rule.min ?? 0
        patch[field] = recovery
        issues.push({
          rowId,
          field,
          reason: `Non-finite value (${value}); reset to ${recovery}`,
          action: 'patched',
          patch:  { [field]: recovery },
        })
        continue
      }

      // Clamp to bounds (both checks can apply — clamp min then max)
      let clamped = value
      if (rule.min !== undefined && clamped < rule.min) clamped = rule.min
      if (rule.max !== undefined && clamped > rule.max) clamped = rule.max

      if (clamped !== value) {
        patch[field] = clamped
        issues.push({
          rowId,
          field,
          reason: `Value ${value} outside [${rule.min ?? '−∞'}, ${rule.max ?? '+∞'}]; clamped to ${clamped}`,
          action: 'patched',
          patch:  { [field]: clamped },
        })
      }
    }

    // ── Enum validation ────────────────────────────────────────────
    if (rule.allowedValues && typeof value === 'string') {
      if (!(rule.allowedValues as readonly unknown[]).includes(value)) {
        const recovery = (rule.default as string) ?? rule.allowedValues[0]
        patch[field] = recovery
        issues.push({
          rowId,
          field,
          reason: `"${value}" not in allowed values [${rule.allowedValues.join(' | ')}]; reset to "${recovery}"`,
          action: 'patched',
          patch:  { [field]: recovery },
        })
      }
    }
  }

  return Object.keys(patch).length > 0 ? { patch, issues } : null
}

/** Produce an empty (passing) TableAuditResult for early-return paths */
function emptyResult(tableName: string, durationMs = 0): TableAuditResult {
  return {
    tableName,
    rowsScanned: 0,
    rowsPatched:  0,
    rowsRemoved:  0,
    issues:       [],
    durationMs,
    ok:           true,
  }
}

// ─────────────────────────────────────────────────────────────
// Table-specific audit functions
// ─────────────────────────────────────────────────────────────

/**
 * Audits the `assignments` table.
 * Validates title type, status/priority enum membership, and ensures
 * createdAt is a real timestamp.  Legacy `category` fields are cleaned
 * if present but not injected into rows that never had them.
 */
async function auditAssignments(): Promise<TableAuditResult> {
  const t0         = now()
  const tableName  = 'assignments'

  try {
    const rows = await db.assignments.toArray()
    let rowsPatched = 0
    const allIssues: AuditIssue[] = []

    const pendingWrites: Array<{ id: number; patch: Record<string, unknown> }> = []

    for (const row of rows) {
      const raw  = row as unknown as Record<string, unknown>
      const id   = row.id as number
      const result = evaluateRow(raw, ASSIGNMENTS_DESCRIPTOR, id)

      if (result) {
        pendingWrites.push({ id, patch: result.patch })
        allIssues.push(...result.issues)
      }
    }

    // Batch-write all patches — one IDB update per affected row
    await Promise.all(
      pendingWrites.map(({ id, patch }) =>
        db.assignments.update(id, patch as Partial<typeof rows[0]>)
      )
    )
    rowsPatched = pendingWrites.length

    return {
      tableName,
      rowsScanned: rows.length,
      rowsPatched,
      rowsRemoved: 0,
      issues:      allIssues,
      durationMs:  now() - t0,
      ok:          true,
    }
  } catch (err) {
    return {
      ...emptyResult(tableName, now() - t0),
      ok:    false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Audits the `userProfile` singleton (id = 1).
 * Validates userName is a non-corrupted string.
 * Applies legacy RPG field cleanup (currentLevel, healthPoints, etc.)
 * if those fields somehow survived the schema strip — prevents stale
 * NaN/Infinity values from corrupting downstream numeric operations.
 */
async function auditUserProfile(): Promise<TableAuditResult> {
  const t0        = now()
  const tableName = 'userProfile'

  try {
    const profile = await db.userProfile.get(1)
    if (!profile) return emptyResult(tableName, now() - t0)

    const raw    = profile as unknown as Record<string, unknown>
    const result = evaluateRow(raw, USER_PROFILE_DESCRIPTOR, 1)

    if (result) {
      await db.userProfile.update(1, result.patch as Partial<typeof profile>)
      return {
        tableName,
        rowsScanned: 1,
        rowsPatched:  1,
        rowsRemoved:  0,
        issues:       result.issues,
        durationMs:   now() - t0,
        ok:           true,
      }
    }

    return { ...emptyResult(tableName, now() - t0), rowsScanned: 1 }
  } catch (err) {
    return {
      ...emptyResult(tableName, now() - t0),
      ok:    false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Audits the `vocab_cards` table.
 *
 * Two passes:
 *   1. SM-2 field validation — clamps easeFactor (≥ 1.3) and
 *      reviewIntervalDays (≥ 1); resets NaN values to SM-2 defaults.
 *   2. Orphan cleanup — any card whose deckId does not match an
 *      existing VocabDeck row is removed.  Cards cannot function
 *      without a parent deck; keeping them would break the review
 *      scheduler and cause unresolvable deck-count mismatches.
 */
async function auditVocabCards(): Promise<TableAuditResult> {
  const t0        = now()
  const tableName = 'vocab_cards'

  try {
    // Load decks first to build the valid-ID reference set
    const decks        = await db.vocab_decks.toArray()
    const validDeckIds = new Set(decks.map(d => d.id))

    const cards = await db.vocab_cards.toArray()
    let rowsPatched  = 0
    let rowsRemoved  = 0
    const allIssues: AuditIssue[] = []

    const patchQueue:  Array<{ id: string; patch: Record<string, unknown> }> = []
    const removeQueue: string[] = []

    for (const card of cards) {
      const id  = card.id

      // ── Pass 1: Orphan detection ───────────────────────────────────
      if (!validDeckIds.has(card.deckId)) {
        removeQueue.push(id)
        allIssues.push({
          rowId:  id,
          field:  'deckId',
          reason: `deckId "${card.deckId}" has no matching VocabDeck; card is orphaned`,
          action: 'removed',
        })
        continue  // no point patching fields on a card about to be deleted
      }

      // ── Pass 2: SM-2 field validation ─────────────────────────────
      const raw    = card as unknown as Record<string, unknown>
      const result = evaluateRow(raw, VOCAB_CARDS_DESCRIPTOR, id)

      if (result) {
        patchQueue.push({ id, patch: result.patch })
        allIssues.push(...result.issues)
      }
    }

    // Apply patches
    await Promise.all(
      patchQueue.map(({ id, patch }) =>
        db.vocab_cards.update(id, patch as Partial<typeof cards[0]>)
      )
    )
    rowsPatched = patchQueue.length

    // Remove orphans
    if (removeQueue.length > 0) {
      await db.vocab_cards.bulkDelete(removeQueue)
    }
    rowsRemoved = removeQueue.length

    return {
      tableName,
      rowsScanned: cards.length,
      rowsPatched,
      rowsRemoved,
      issues:      allIssues,
      durationMs:  now() - t0,
      ok:          true,
    }
  } catch (err) {
    return {
      ...emptyResult(tableName, now() - t0),
      ok:    false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Master entry point
// ─────────────────────────────────────────────────────────────

/**
 * Runs the full multi-table audit pass and returns a structured report.
 *
 * Safe to call from any client-side context (useEffect, event handler,
 * or layout-level boot hooks).  Always resolves — never throws — so
 * callers do not need try/catch wrappers.
 *
 * Typical runtime on an average user dataset: 40 – 180 ms.
 */
export async function runMasterDatabaseAudit(): Promise<MasterAuditReport> {
  const startedAt = Date.now()

  // SSR guard — IDB is a browser-only API
  if (typeof window === 'undefined' || !db) {
    return {
      startedAt,
      completedAt:      startedAt,
      durationMs:       0,
      totalRowsScanned: 0,
      totalIssues:      0,
      totalRepairs:     0,
      tables:           [],
      hadRepairs:       false,
      fatalTables:      [],
    }
  }

  // Run all three table audits in parallel — they read/write disjoint tables
  const [assignmentsResult, profileResult, vocabResult] = await Promise.all([
    auditAssignments(),
    auditUserProfile(),
    auditVocabCards(),
  ])

  const tables      = [assignmentsResult, profileResult, vocabResult]
  const fatalTables = tables.filter(t => !t.ok).map(t => t.tableName)

  const totalRowsScanned = tables.reduce((s, t) => s + t.rowsScanned, 0)
  const totalIssues      = tables.reduce((s, t) => s + t.issues.length, 0)
  const totalRepairs     = tables.reduce((s, t) => s + t.rowsPatched + t.rowsRemoved, 0)
  const completedAt      = Date.now()

  return {
    startedAt,
    completedAt,
    durationMs:  completedAt - startedAt,
    totalRowsScanned,
    totalIssues,
    totalRepairs,
    tables,
    hadRepairs:  totalRepairs > 0,
    fatalTables,
  }
}

// ─────────────────────────────────────────────────────────────
// Named re-exports for unit testing and selective invocation
// ─────────────────────────────────────────────────────────────
export { evaluateRow, auditAssignments, auditUserProfile, auditVocabCards }
export type { TableDescriptor, FieldRule }
