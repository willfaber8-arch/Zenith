'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith Games Tab — useSkillTreeActions
 * Step 6.2 — Nexus Gateway Access Firewall · React Controller
 *
 * Bridges the pure SkillTreeFirewall engine into the React lifecycle.
 * Provides:
 *
 *   • Reactive unlock set — `useLiveQuery` on `skill_tree` delivers
 *     an always-current `Set<string>` of unlocked node IDs so any
 *     component consuming this hook re-renders the instant a new
 *     unlock is committed.
 *
 *   • Reactive resource balances — `useLiveQuery` on
 *     `resource_inventory` streams a `Map<ResourceId, ResourceNode>`
 *     so the synchronous `getNodeLockReason` can evaluate cost
 *     shortfalls without an IDB round-trip.
 *
 *   • Synchronous `getNodeLockReason` — uses both live maps above
 *     to produce a machine-readable lock status during the render
 *     cycle with zero async overhead.
 *
 *   • `isNodeUnlockable` — async, reads live reactive data for
 *     speed but matches the `Promise<boolean>` signature required
 *     by `SkillFirewallResult`.
 *
 *   • `executeNodeUnlock` — delegates to `executeAtomicUnlock` in
 *     the engine, which owns all transactional logic.
 *
 * Usage:
 *   const {
 *     isLoading, unlockedNodeIds,
 *     isNodeUnlockable, executeNodeUnlock, getNodeLockReason,
 *   } = useSkillTreeActions()
 * ════════════════════════════════════════════════════════════════
 */

import { useMemo, useCallback } from 'react'
import { useLiveQuery }         from 'dexie-react-hooks'
import { gamesDb }              from '@/lib/gamesDb'
import type { ResourceId, ResourceNode, SkillTreeRecord } from '@/lib/gamesDb'
import {
  SKILL_TREE_MAP,
  executeAtomicUnlock,
  type SkillFirewallResult,
  type NodeCostElement,
} from '@/lib/engines/SkillTreeFirewall'

/* ════════════════════════════════════════════════════════════════
   §1  PUBLIC RETURN TYPE
   ════════════════════════════════════════════════════════════════ */

/**
 * Extended interface returned by `useSkillTreeActions`.
 *
 * Extends `SkillFirewallResult` with reactive metadata consumed by
 * `SkillTreeCanvas` and any summary panels that need the full unlock
 * list without querying the DB themselves.
 */
export interface SkillTreeActionsResult extends SkillFirewallResult {
  /**
   * Reactive array of all currently unlocked node IDs.
   * Updated automatically whenever a new unlock is committed.
   * Feed directly into `SkillTreeCanvas.unlockedNodeIds`.
   */
  readonly unlockedNodeIds: readonly string[]

  /**
   * All full `SkillTreeRecord` rows from `skill_tree`, ordered by
   * `dateUnlocked` ascending.  Useful for timeline / progress panels.
   */
  readonly unlockHistory: readonly SkillTreeRecord[]

  /**
   * True for exactly one event-loop tick while the two `useLiveQuery`
   * subscriptions are resolving on initial mount.
   */
  readonly isLoading: boolean
}

/* ════════════════════════════════════════════════════════════════
   §2  HOOK
   ════════════════════════════════════════════════════════════════ */

export function useSkillTreeActions(): SkillTreeActionsResult {

  /* ── §2a  Reactive DB streams ──────────────────────────────────
     Two independent useLiveQuery subscriptions.  dexie-react-hooks v4
     accepts max 2 arguments — no third defaultResult param.         */

  /**
   * All rows currently in `skill_tree`.
   * `undefined` during the IDB boot frame (useLiveQuery contract).
   */
  const rawSkillTreeRecords = useLiveQuery<SkillTreeRecord[]>(
    () => gamesDb?.skill_tree.toArray() ?? Promise.resolve([]),
    [],
  )

  /**
   * All rows in `resource_inventory`.
   * `undefined` during the IDB boot frame.
   */
  const rawInventoryRecords = useLiveQuery<ResourceNode[]>(
    () => gamesDb?.resource_inventory.toArray() ?? Promise.resolve([]),
    [],
  )

  /* ── §2b  Loading boundary ─────────────────────────────────────
     Both queries must resolve before we expose live data.          */
  const isLoading =
    rawSkillTreeRecords === undefined ||
    rawInventoryRecords === undefined

  /* ── §2c  Unlock set — O(1) membership test ───────────────────
     useMemo so the Set is recreated only when the raw records array
     reference changes (i.e., after a real DB mutation).            */

  const unlockedSet = useMemo<Set<string>>(() => {
    if (!rawSkillTreeRecords) return new Set()
    return new Set(
      rawSkillTreeRecords
        .filter(r => r.isUnlocked)
        .map(r => r.nodeId),
    )
  }, [rawSkillTreeRecords])

  /** Sorted unlock history — most-recently unlocked last. */
  const unlockHistory = useMemo<readonly SkillTreeRecord[]>(() => {
    if (!rawSkillTreeRecords) return []
    return [...rawSkillTreeRecords].sort((a, b) => a.dateUnlocked - b.dateUnlocked)
  }, [rawSkillTreeRecords])

  /** Convenience array for `SkillTreeCanvas.unlockedNodeIds`. */
  const unlockedNodeIds = useMemo<readonly string[]>(
    () => Array.from(unlockedSet),
    [unlockedSet],
  )

  /* ── §2d  Resource balance map — O(1) cost lookups ────────────
     `Map<ResourceId, ResourceNode>` built from the live inventory.
     Enables synchronous balance checks in `getNodeLockReason`.     */

  const resourceMap = useMemo<ReadonlyMap<ResourceId, ResourceNode>>(() => {
    const m = new Map<ResourceId, ResourceNode>()
    for (const node of rawInventoryRecords ?? []) {
      m.set(node.id, node)
    }
    return m
  }, [rawInventoryRecords])

  /* ── §2e  getNodeLockReason (synchronous) ──────────────────────
     Evaluates node state against cached reactive data.
     Safe to call during the React render cycle.
     Dependency array: [unlockedSet, resourceMap] — the two live maps.
     Reference identity changes only when IDB data changes.         */

  const getNodeLockReason = useCallback(
    (
      nodeId: string,
    ):
      | 'PREREQUISITE_LOCKED'
      | 'INSUFFICIENT_FUNDS'
      | 'READY'
      | 'ALREADY_UNLOCKED' => {
      /* Already unlocked — no further checks needed */
      if (unlockedSet.has(nodeId)) return 'ALREADY_UNLOCKED'

      /* Unknown node — treat as permanently locked */
      const def = SKILL_TREE_MAP.get(nodeId)
      if (!def) return 'PREREQUISITE_LOCKED'

      /* Prerequisite check — all must be present in the unlock set */
      const prereqsMet = def.prerequisites.every(id => unlockedSet.has(id))
      if (!prereqsMet) return 'PREREQUISITE_LOCKED'

      /* Balance check — every cost dimension must be ≥ required amount */
      const balancesMet = def.costs.every((cost: NodeCostElement) => {
        const record  = resourceMap.get(cost.resourceId as ResourceId)
        const balance = record?.balance ?? 0
        return balance >= cost.amount
      })
      if (!balancesMet) return 'INSUFFICIENT_FUNDS'

      return 'READY'
    },
    [unlockedSet, resourceMap],
  )

  /* ── §2f  isNodeUnlockable (async) ────────────────────────────
     Uses cached reactive data for speed — no additional IDB reads.
     Wrapped in `Promise.resolve` to match the `Promise<boolean>`
     contract in SkillFirewallResult without redundant await overhead.
     Returns false for already-unlocked nodes (cannot unlock twice). */

  const isNodeUnlockable = useCallback(
    async (nodeId: string): Promise<boolean> => {
      /* Already unlocked = not unlockable again */
      if (unlockedSet.has(nodeId)) return false

      const def = SKILL_TREE_MAP.get(nodeId)
      if (!def) return false

      /* Prerequisites — all must be present in the live unlock set */
      const prereqsMet = def.prerequisites.every(id => unlockedSet.has(id))
      if (!prereqsMet) return false

      /* Balances — every cost element must be satisfiable right now */
      const balancesMet = def.costs.every((cost: NodeCostElement) => {
        const record  = resourceMap.get(cost.resourceId as ResourceId)
        const balance = record?.balance ?? 0
        return balance >= cost.amount
      })

      return balancesMet
    },
    [unlockedSet, resourceMap],
  )

  /* ── §2g  executeNodeUnlock (async) ───────────────────────────
     Delegates entirely to the engine's `executeAtomicUnlock`, which
     owns all three phases: prerequisite scan, pre-flight check, and
     the atomic Dexie transaction.

     The hook adds no business logic here — it is a thin stable
     wrapper so callers can treat the function as a useCallback dep
     without the engine import leaking into component files.

     Dependency array is empty because `executeAtomicUnlock` is a
     module-level function with a stable reference.               */

  const executeNodeUnlock = useCallback(
    async (
      nodeId: string,
    ): Promise<{ success: boolean; error?: string; updatedNodeId?: string }> => {
      return executeAtomicUnlock(nodeId)
    },
    [],
  )

  /* ── §2h  Return surface ───────────────────────────────────── */

  return {
    /* SkillFirewallResult */
    isNodeUnlockable,
    executeNodeUnlock,
    getNodeLockReason,

    /* Extended fields */
    unlockedNodeIds,
    unlockHistory,
    isLoading,
  }
}
