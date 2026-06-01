/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — RPG Lifecycle Engine Service
 * Phase 5 · Step 5.1 — Grit-Style Habit Stacking & RPG Lifecycle Engine
 *
 * Architecture:
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  IndexedDB (Dexie)                                      │
 *   │   habits (updating hook)   ─────▶  processXpGain()     │
 *   │   assignments (updating)   ─────▶  processXpGain()     │
 *   │                                                         │
 *   │   Overdue scan (on init + every 30 min)                 │
 *   │     assignments[high/critical, past due, !completed]    │
 *   │       ──▶  processHpDamage()                            │
 *   └──────────────────────────────────────┬──────────────────┘
 *                                          │
 *                          updates userProfile in IDB
 *                          writes dedup key to rpgEventLog
 *                          emits RpgEvent to subscribers
 *
 * Deduplication:
 *   rpgEventLog has a UNIQUE index on eventKey.
 *   Each event type gets a deterministic key:
 *     habit:       "h:<id>:<YYYY-MM-DD>"   — one award per day per habit
 *     assignment:  "a:<id>:done"           — awarded once on completion
 *     overdue:     "od:<id>:<YYYY-MM-DD>"  — one penalty per overdue day
 *
 * Multi-tab safety:
 *   The unique index means only the first tab that processes an event
 *   will succeed; all others get a ConstraintError and abort safely.
 * ════════════════════════════════════════════════════════════════
 */

import {
  db,
  type Habit,
  type Assignment,
} from '@/lib/db'
import {
  habitXp,
  assignmentXp,
  applyXpGain,
  applyHpDamage,
  OVERDUE_HP_DAMAGE,
  type HabitDifficulty,
} from '@/utils/rpgEngine'

/* ════════════════════════════════════════════════════════════════
   PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

export type RpgEvent =
  | { type: 'level_up';  level: number }
  | { type: 'defeat';    level: number }
  | { type: 'xp_gain';   amount: number; source: 'habit' | 'assignment' }
  | { type: 'hp_damage'; amount: number }

/* ════════════════════════════════════════════════════════════════
   SINGLETON ACCESSOR
   ════════════════════════════════════════════════════════════════ */

let _instance: ZenithRpgEngine | null = null

/**
 * Returns the process-scoped singleton engine.
 * Safe to call multiple times — returns the same instance.
 */
export function getRpgEngine(): ZenithRpgEngine {
  if (!_instance) _instance = new ZenithRpgEngine()
  return _instance
}

/* ════════════════════════════════════════════════════════════════
   ENGINE CLASS
   ════════════════════════════════════════════════════════════════ */

export class ZenithRpgEngine {

  private _hooksRegistered = false
  private _overdueTimer:    ReturnType<typeof setInterval> | null = null
  private _listeners        = new Set<(e: RpgEvent) => void>()

  /* ── Status subscription ────────────────────────────────── */

  /**
   * Subscribe to RPG lifecycle events.
   * @returns Unsubscribe function — call in useEffect cleanup.
   */
  subscribe(listener: (e: RpgEvent) => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  /* ── Initialisation ─────────────────────────────────────── */

  /**
   * Idempotent entry-point. Registers Dexie hooks once and
   * starts the periodic overdue scan.
   */
  init(): void {
    if (typeof window === 'undefined') return

    const safeDb = db as typeof db | null
    if (!safeDb) return

    this.registerHooks(safeDb)
    this.scheduleOverdueScan()
  }

  /* ── Stop overdue scan (call on unmount if needed) ─────── */

  dispose(): void {
    if (this._overdueTimer !== null) {
      clearInterval(this._overdueTimer)
      this._overdueTimer = null
    }
  }

  /* ════════════════════════════════════════════════════════
     PRIVATE — DEXIE HOOK REGISTRATION
     ════════════════════════════════════════════════════════ */

  private registerHooks(safeDb: NonNullable<typeof db>): void {
    if (this._hooksRegistered) return
    this._hooksRegistered = true

    /* ── habits: detect new completions via lastCompletedDate ── */
    safeDb.habits.hook(
      'updating',
      (modifications: Partial<Habit>, _primKey: unknown, obj: Habit) => {
        const newDate = modifications.lastCompletedDate
        // Only fire when lastCompletedDate is being set to a new value
        if (!newDate || typeof newDate !== 'string') return
        if (newDate === obj.lastCompletedDate) return

        const id         = obj.id as number
        const eventKey   = `h:${id}:${newDate}`
        const difficulty: HabitDifficulty = obj.difficulty ?? 'medium'
        // Use updated streakCount if included, otherwise assume +1
        const streak = modifications.streakCount ?? (obj.streakCount + 1)
        const xp     = habitXp(difficulty, streak)

        setTimeout(() => {
          this.processXpGain(eventKey, xp, 'habit').catch(() => {})
        }, 0)
      },
    )

    /* ── assignments: detect status → 'completed' transitions ── */
    safeDb.assignments.hook(
      'updating',
      (modifications: Partial<Assignment>, primKey: unknown, obj: Assignment) => {
        if (modifications.status !== 'completed') return
        if (obj.status === 'completed') return  // already done — no double award

        const id       = primKey as number
        const eventKey = `a:${id}:done`
        const priority = modifications.priority ?? obj.priority
        const xp       = assignmentXp(priority)

        setTimeout(() => {
          this.processXpGain(eventKey, xp, 'assignment').catch(() => {})
        }, 0)
      },
    )
  }

  /* ════════════════════════════════════════════════════════
     PRIVATE — XP / HP MUTATORS
     ════════════════════════════════════════════════════════ */

  private async processXpGain(
    eventKey: string,
    amount:   number,
    source:   'habit' | 'assignment',
  ): Promise<void> {
    const safeDb = db as typeof db | null
    if (!safeDb) return

    // Attempt to log first — unique index rejects duplicates atomically
    try {
      await safeDb.rpgEventLog.add({ eventKey, processedAt: Date.now() })
    } catch {
      return  // ConstraintError: already processed
    }

    const profile = await safeDb.userProfile.get(1)
    if (!profile) return

    const result = applyXpGain(profile, amount)

    await safeDb.userProfile.update(1, {
      expPoints:    result.expPoints,
      currentLevel: result.currentLevel,
      healthPoints: result.healthPoints,
    })

    this.emit({ type: 'xp_gain', amount, source })
    if (result.leveledUp) {
      this.emit({ type: 'level_up', level: result.currentLevel })
    }
  }

  private async processHpDamage(
    eventKey: string,
    damage:   number,
  ): Promise<void> {
    const safeDb = db as typeof db | null
    if (!safeDb) return

    try {
      await safeDb.rpgEventLog.add({ eventKey, processedAt: Date.now() })
    } catch {
      return  // already penalised
    }

    const profile = await safeDb.userProfile.get(1)
    if (!profile) return

    const result = applyHpDamage(profile, damage)

    await safeDb.userProfile.update(1, {
      expPoints:    result.expPoints,
      currentLevel: result.currentLevel,
      healthPoints: result.healthPoints,
    })

    this.emit({ type: 'hp_damage', amount: damage })
    if (result.defeatedAt !== undefined) {
      this.emit({ type: 'defeat', level: result.defeatedAt })
    }
  }

  /* ════════════════════════════════════════════════════════
     PRIVATE — OVERDUE SCAN
     ════════════════════════════════════════════════════════ */

  private scheduleOverdueScan(): void {
    if (this._overdueTimer !== null) return  // already scheduled

    // Initial scan 2 s after startup (after IDB is fully open)
    setTimeout(() => this.runOverdueScan().catch(() => {}), 2_000)

    // Periodic rescan every 30 minutes
    this._overdueTimer = setInterval(() => {
      this.runOverdueScan().catch(() => {})
    }, 30 * 60 * 1_000)
  }

  /**
   * Scans for high/critical assignments whose dueDate has passed
   * without being marked complete. Each overdue assignment inflicts
   * OVERDUE_HP_DAMAGE (20 HP) once per calendar day.
   */
  private async runOverdueScan(): Promise<void> {
    const safeDb = db as typeof db | null
    if (!safeDb) return

    const todayIso = new Date().toISOString().slice(0, 10)

    const overdueRows = await safeDb.assignments
      .filter(a =>
        (a.priority === 'high' || a.priority === 'critical') &&
        a.status !== 'completed'                             &&
        typeof a.dueDate === 'string'                        &&
        a.dueDate < todayIso
      )
      .toArray()

    for (const a of overdueRows) {
      const eventKey = `od:${a.id}:${todayIso}`
      await this.processHpDamage(eventKey, OVERDUE_HP_DAMAGE).catch(() => {})
    }
  }

  /* ════════════════════════════════════════════════════════
     PRIVATE — EVENT EMITTER
     ════════════════════════════════════════════════════════ */

  private emit(event: RpgEvent): void {
    this._listeners.forEach(fn => fn(event))
  }
}
