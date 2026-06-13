/**
 * types/dbAudit.ts
 * Phase 12.1 — Advanced Multi-Database Schema Auditing
 *
 * Strict TypeScript descriptor types for the field-level validation
 * rules used by dbAuditEngine.  One FieldRule per field; one
 * TableDescriptor per table.  No Dexie or React imports — this file
 * is a pure type library, safe to import from any context.
 */

// ─────────────────────────────────────────────────────────────
// Primitive rule atoms
// ─────────────────────────────────────────────────────────────

export type FieldType = 'string' | 'number' | 'boolean'

export interface FieldRule {
  /**
   * Expected JS typeof for the stored value.
   * A mismatch triggers a patch attempt (using `default` or `nanFallback`).
   */
  type?: FieldType

  /**
   * If the field is completely absent from the row, silently inject this
   * value.  No `default` → absent field is left alone.
   */
  default?: unknown

  /**
   * For string fields: the exhaustive set of valid values.
   * Stored values outside this set are reset to `default` (or the first
   * allowed value if `default` is not specified).
   */
  allowedValues?: readonly string[]

  /**
   * For number fields: lower bound (inclusive).
   * Values below this are clamped to `min`.
   */
  min?: number

  /**
   * For number fields: upper bound (inclusive).
   * Values above this are clamped to `max`.
   */
  max?: number

  /**
   * For number fields: recovery baseline when the stored value is NaN,
   * Infinity, -Infinity, null, or undefined.
   * If absent, falls back to `default` then `min` then 0.
   */
  nanFallback?: number

  /**
   * When true, this rule is applied ONLY if the field is already present
   * on the row.  If the field is absent the rule is silently skipped.
   *
   * Use for legacy or stripped fields (e.g. old RPG stats that were removed
   * from the UserProfile schema) — audit will clean stale data without
   * injecting the field into rows created after the removal.
   */
  optionalLegacy?: boolean
}

/**
 * Map of field name → validation rule for one database table.
 * Only fields that need validation need to appear here; unmentioned
 * fields are read, stored, and left untouched.
 */
export type TableDescriptor = Record<string, FieldRule>

// ─────────────────────────────────────────────────────────────
// Canonical table descriptors (exported for reuse / testing)
// ─────────────────────────────────────────────────────────────

/**
 * assignments — academic task entries.
 * Validates required scalars and cleans up legacy `category` values
 * that may exist on rows created before the field was removed.
 */
export const ASSIGNMENTS_DESCRIPTOR: TableDescriptor = {
  title: {
    type:    'string',
    default: '(Untitled)',
  },
  status: {
    type:         'string',
    allowedValues: ['pending', 'in_progress', 'completed', 'overdue'] as const,
    default:      'pending',
  },
  createdAt: {
    type:        'number',
    nanFallback: 0,
    default:     0,  // epoch 0 is a safe sentinel; caller can post-process if needed
  },
  priority: {
    type:         'string',
    allowedValues: ['low', 'medium', 'high', 'critical'] as const,
    default:      'medium',
  },
  // Legacy field — only validate / strip if present on the row
  category: {
    type:          'string',
    allowedValues: ['Academic', 'Life'] as const,
    optionalLegacy: true,
  },
}

/**
 * userProfile — singleton row (id = 1).
 * Validates the lean current schema fields.
 * Legacy RPG scalars (currentLevel, healthPoints, goldPoints,
 * availableSkillTokens) are marked `optionalLegacy: true` — they are
 * cleaned if found on old rows but are never injected into fresh rows.
 */
export const USER_PROFILE_DESCRIPTOR: TableDescriptor = {
  userName: {
    type:    'string',
    default: '',
  },
  // ── Legacy RPG fields (stripped in major restructure R) ──────────
  // If any of these survive in stale IDB rows, enforce safe numeric bounds
  // and reset NaN/null values so they cannot corrupt downstream math.
  currentLevel: {
    type:           'number',
    min:            1,
    nanFallback:    1,
    default:        1,
    optionalLegacy: true,
  },
  healthPoints: {
    type:           'number',
    min:            0,
    max:            1000,
    nanFallback:    100,
    default:        100,
    optionalLegacy: true,
  },
  goldPoints: {
    type:           'number',
    min:            0,
    nanFallback:    0,
    default:        0,
    optionalLegacy: true,
  },
  availableSkillTokens: {
    type:           'number',
    min:            0,
    nanFallback:    0,
    default:        0,
    optionalLegacy: true,
  },
}

/**
 * vocab_cards — SM-2 spaced-repetition flashcard entries.
 * Enforces algorithm boundary constraints on the two core SM-2 fields.
 * Orphaned deckId cleanup is handled separately in the engine
 * (requires a Set of valid deck IDs that cannot be expressed as a FieldRule).
 */
export const VOCAB_CARDS_DESCRIPTOR: TableDescriptor = {
  easeFactor: {
    type:        'number',
    min:         1.3,
    nanFallback: 2.5,   // SM-2 default EF
  },
  reviewIntervalDays: {
    type:        'number',
    min:         1,
    nanFallback: 1,
  },
  consecutiveSuccesses: {
    type:        'number',
    min:         0,
    nanFallback: 0,
  },
  stabilityFactor: {
    type:        'number',
    min:         0,
    max:         1,
    nanFallback: 0,
  },
}

// ─────────────────────────────────────────────────────────────
// Result interfaces
// ─────────────────────────────────────────────────────────────

/** A single field-level anomaly recorded during a table scan */
export interface AuditIssue {
  /** Primary key value of the affected row */
  rowId:  number | string
  /** Field name that triggered the rule */
  field:  string
  /** Human-readable explanation of what was wrong */
  reason: string
  /** What the engine did in response */
  action: 'patched' | 'removed' | 'skipped'
  /** The exact `{ field: newValue }` object written back, when action === 'patched' */
  patch?: Record<string, unknown>
}

/** Outcome of scanning one complete table */
export interface TableAuditResult {
  tableName:   string
  rowsScanned: number
  rowsPatched: number
  rowsRemoved: number
  issues:      AuditIssue[]
  durationMs:  number
  /** false only when the table audit threw an unrecoverable error */
  ok:          boolean
  /** Populated when ok === false */
  error?:      string
}

/** The aggregated outcome of a full multi-table audit pass */
export interface MasterAuditReport {
  startedAt:        number
  completedAt:      number
  durationMs:       number
  totalRowsScanned: number
  totalIssues:      number
  /** Patches applied + rows removed */
  totalRepairs:     number
  tables:           TableAuditResult[]
  hadRepairs:       boolean
  /** Names of tables whose audit threw and were skipped entirely */
  fatalTables:      string[]
}
