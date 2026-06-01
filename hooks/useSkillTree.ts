/**
 * hooks/useSkillTree.ts — Atomic Skill Tree Acquisition Engine
 * Phase 7 · Step 7.2 — Branching Skill Trees & Focus Perks
 *
 * Responsibilities:
 *   1. Reads userProfile.unlockedSkillNodeIds + availableSkillTokens from IDB
 *      via useLiveQuery (reactive — any external write triggers re-render).
 *   2. Initialises availableSkillTokens on first access: retroactively awards
 *      1 token per level-up (currentLevel − 1) so existing players start with
 *      earned tokens.
 *   3. purchaseSkillNode() validates all three gate conditions (tokens, not
 *      already unlocked, prerequisite present) then runs a single atomic IDB
 *      update to deduct cost and insert the node ID.
 *   4. Exports awardSkillToken() as a standalone async helper so other systems
 *      (level-up handler, quest completion, legendary task archival) can call
 *      it without importing the full hook.
 */

'use client'

import { useMemo, useEffect }         from 'react'
import { useLiveQuery }               from 'dexie-react-hooks'
import {
  computeNodeStates,
  computeModifiers,
  SKILL_TREE_MAP,
  DEFAULT_MODIFIERS,
  type SkillNodeRuntime,
  type SkillModifiers,
} from '@/types/skillTree'

/* ── Lazy DB import (SSR-safe) ───────────────────────────────── */

async function getDbSafe() {
  const { getDb } = await import('@/lib/db')
  return getDb()
}

/* ══════════════════════════════════════════════════════════════
   STANDALONE HELPERS  (importable without the hook)
   ══════════════════════════════════════════════════════════════ */

/**
 * Award `amount` skill tokens to the user's profile.
 * Safe to call from anywhere in the client tree.
 * Called by: RPG level-up handler, legendary quest completion, etc.
 */
export async function awardSkillToken(amount = 1): Promise<void> {
  try {
    const db      = await getDbSafe()
    const profile = await db.userProfile.get(1)
    if (!profile) return
    const current = profile.availableSkillTokens ?? 0
    await db.userProfile.update(1, { availableSkillTokens: current + amount })
  } catch {
    // Swallow silently — token awards are non-critical
  }
}

/* ══════════════════════════════════════════════════════════════
   PURCHASE RESULT
   ══════════════════════════════════════════════════════════════ */

export interface PurchaseResult {
  success: boolean
  reason?:
    | 'insufficient_tokens'
    | 'already_unlocked'
    | 'prerequisite_not_met'
    | 'node_not_found'
    | 'profile_not_found'
    | 'db_error'
}

/* ══════════════════════════════════════════════════════════════
   HOOK RETURN SHAPE
   ══════════════════════════════════════════════════════════════ */

export interface SkillTreeHook {
  /** Runtime-enriched nodes (isUnlocked + isAvailable injected) */
  nodes:            SkillNodeRuntime[]
  /** Aggregated modifier values from all unlocked nodes */
  modifiers:        SkillModifiers
  /** Array of currently unlocked node IDs */
  unlockedIds:      string[]
  /** How many tokens the user can currently spend */
  availableTokens:  number
  /** Total tokens spent across all time */
  totalSpent:       number
  /** Whether the IDB query has returned its first result */
  isLoading:        boolean
  /** Validates + executes an atomic skill node purchase */
  purchaseSkillNode: (nodeId: string) => Promise<PurchaseResult>
}

/* ══════════════════════════════════════════════════════════════
   MAIN HOOK
   ══════════════════════════════════════════════════════════════ */

export function useSkillTree(): SkillTreeHook {

  /* ── 1. Reactive profile read ────────────────────────────── */
  const profile = useLiveQuery(
    () => {
      if (typeof window === 'undefined') return undefined
      try {
        const { getDb } = require('@/lib/db') as typeof import('@/lib/db')
        return getDb().userProfile.get(1)
      } catch { return undefined }
    },
    [],
  )

  const isLoading = profile === undefined

  /* ── 2. One-time token initialisation ───────────────────── */
  /*
   * When availableSkillTokens is undefined (player has never visited the
   * skill tree), retroactively grant 1 token per past level-up so they
   * start with a meaningful amount to spend.
   * Level 1 = 0 tokens.  Level 5 = 4 tokens.
   */
  useEffect(() => {
    if (!profile || profile.availableSkillTokens !== undefined) return
    const retroTokens = Math.max(0, (profile.currentLevel ?? 1) - 1)
    getDbSafe().then(db =>
      db.userProfile.update(1, { availableSkillTokens: retroTokens }),
    )
  }, [profile])

  /* ── 3. Derive runtime values ────────────────────────────── */
  const unlockedIds     = profile?.unlockedSkillNodeIds ?? []
  const availableTokens = profile?.availableSkillTokens ?? 0

  const totalSpent = useMemo(
    () => unlockedIds.reduce((acc, id) => acc + (SKILL_TREE_MAP.get(id)?.cost ?? 0), 0),
    [unlockedIds],
  )

  const nodes = useMemo(
    () => computeNodeStates(unlockedIds, availableTokens),
    [unlockedIds, availableTokens],
  )

  const modifiers = useMemo(
    () => computeModifiers(unlockedIds),
    [unlockedIds],
  )

  /* ── 4. Atomic purchase handler ─────────────────────────── */
  /*
   * Gate checks (in order):
   *   a) Node exists in SKILL_TREE_MAP
   *   b) Node is not already in unlockedIds
   *   c) User has enough availableSkillTokens
   *   d) Prerequisite nodeId is present in unlockedIds (or node has none)
   *
   * If all pass: single atomic IDB update deducting cost + inserting nodeId.
   * useLiveQuery fires immediately after, propagating the change everywhere.
   */
  async function purchaseSkillNode(nodeId: string): Promise<PurchaseResult> {
    const nodeDef = SKILL_TREE_MAP.get(nodeId)
    if (!nodeDef) return { success: false, reason: 'node_not_found' }

    /* (b) Already unlocked? */
    if (unlockedIds.includes(nodeId)) {
      return { success: false, reason: 'already_unlocked' }
    }

    /* (c) Sufficient tokens? */
    if (availableTokens < nodeDef.cost) {
      return { success: false, reason: 'insufficient_tokens' }
    }

    /* (d) Prerequisite present? */
    if (nodeDef.prerequisiteNodeId !== null) {
      if (!unlockedIds.includes(nodeDef.prerequisiteNodeId)) {
        return { success: false, reason: 'prerequisite_not_met' }
      }
    }

    /* ── Atomic IDB write ──────────────────────────────────── */
    try {
      const db      = await getDbSafe()
      const current = await db.userProfile.get(1)
      if (!current) return { success: false, reason: 'profile_not_found' }

      const newTokens      = (current.availableSkillTokens ?? 0) - nodeDef.cost
      const newUnlocked    = [
        ...(current.unlockedSkillNodeIds ?? []),
        nodeId,
      ]

      await db.userProfile.update(1, {
        availableSkillTokens:  newTokens,
        unlockedSkillNodeIds:  newUnlocked,
      })

      return { success: true }
    } catch {
      return { success: false, reason: 'db_error' }
    }
  }

  /* ── 5. Return ───────────────────────────────────────────── */
  return {
    nodes,
    modifiers:        isLoading ? DEFAULT_MODIFIERS : modifiers,
    unlockedIds,
    availableTokens,
    totalSpent,
    isLoading,
    purchaseSkillNode,
  }
}
