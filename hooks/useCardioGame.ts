'use client'

/**
 * Zenith OS — Trail Explorer Game Hook
 * Phase 8 · Step 8.3 — Core state + action engine
 *
 * Provides:
 *   activeRun           — the single ACTIVE cardio_run row (or null)
 *   completedRuns       — most recent 10 completed runs
 *   inventory           — live Record<ResourceType, number> balance
 *   baseState           — singleton BaseUpgrade row
 *   isLoading           — boot frame guard
 *   startRun            — create a new ACTIVE run
 *   logCardioProgress   — add miles, trigger bonus drops + jackpot
 *   purchaseBaseUpgrade — atomic deduct + advance tier/step
 *   abandonRun          — cancel an in-progress run (no reward)
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLiveQuery }                               from 'dexie-react-hooks'
import { db }                                         from '@/lib/db'
import type {
  CardioRun, BaseInventory, BaseUpgrade, ResourceType,
  LogProgressResult, PurchaseResult, Trail,
} from '@/types/cardioGame'
import { TIER_DEFINITIONS, RESOURCE_META }            from '@/types/cardioGame'

/* ── Seeder ──────────────────────────────────────────────────── */

let seedFired = false

async function seedCardioGame(): Promise<void> {
  if (seedFired) return
  seedFired = true

  // Seed base_inventory (3 rows) — bulkPut is idempotent
  const invCount = await db.base_inventory.count()
  if (invCount < 3) {
    await db.base_inventory.bulkPut([
      { resourceName: 'Parchment Wood', quantity: 0 },
      { resourceName: 'River Stones',   quantity: 0 },
      { resourceName: 'Iron Ore',        quantity: 0 },
    ])
  }

  // Seed base_upgrades singleton (id=1)
  const existing = await db.base_upgrades.get(1)
  if (!existing) {
    await db.base_upgrades.put({
      id:               1,
      currentTier:      'CAMPSITE',
      stepProgress:     0,
      unlockedFeatures: [],
    })
  }
}

/* ── Hook ────────────────────────────────────────────────────── */

export function useCardioGame() {
  const [seeded, setSeeded] = useState(false)

  // Seed on mount (idempotent)
  useEffect(() => {
    seedCardioGame().then(() => setSeeded(true))
  }, [])

  /* ── Live IDB queries ──────────────────────────────────────── */

  // Use .toArray() (not .first()) so an empty result set returns [] rather than
  // undefined — which is indistinguishable from useLiveQuery's boot-frame undefined.
  const rawActiveRuns = useLiveQuery(
    () => db.cardio_runs.where('status').equals('ACTIVE').toArray(),
  )
  const rawCompletedRuns = useLiveQuery(
    () => db.cardio_runs
      .where('status').equals('COMPLETED')
      .reverse()
      .limit(10)
      .sortBy('createdAt'),
  )
  const rawInventory = useLiveQuery(() => db.base_inventory.toArray())
  const rawBaseState = useLiveQuery(() => db.base_upgrades.get(1))

  // isLoading is only true during the initial boot frame when queries have not
  // yet emitted. Once seeded, all three will resolve ([] / row / []) immediately.
  const isLoading =
    !seeded ||
    rawActiveRuns === undefined ||
    rawInventory  === undefined ||
    rawBaseState  === undefined

  // Derive a single active run (or null) from the array query
  const rawActiveRun = rawActiveRuns?.[0] ?? null

  /* ── Derived inventory map ─────────────────────────────────── */
  const inventory = useMemo<Record<ResourceType, number>>(() => {
    const base: Record<ResourceType, number> = {
      'Parchment Wood': 0,
      'River Stones':   0,
      'Iron Ore':       0,
    }
    if (!rawInventory) return base
    for (const row of rawInventory) base[row.resourceName] = row.quantity
    return base
  }, [rawInventory])

  /* ── Start a trail run ─────────────────────────────────────── */
  const startRun = useCallback(async (trail: Trail): Promise<void> => {
    if (rawActiveRuns && rawActiveRuns.length > 0) return   // already active

    const run: CardioRun = {
      id:                  crypto.randomUUID(),
      trailName:           trail.name,
      targetDistanceMiles: trail.distanceMiles,
      accumulatedMiles:    0,
      status:              'ACTIVE',
      resourceYieldType:   trail.resourceYieldType,
      resourceAmount:      trail.resourceAmount,
      createdAt:           Date.now(),
    }
    await db.cardio_runs.add(run)
  }, [rawActiveRun])

  /* ── Log progress miles ────────────────────────────────────── */
  const logCardioProgress = useCallback(
    async (miles: number): Promise<LogProgressResult> => {
      const run = rawActiveRun
      if (!run || run.status !== 'ACTIVE') {
        return { newAccumulatedMiles: 0, bonusDrops: [], completed: false, message: 'No active run.' }
      }

      /* Bonus drops: 10% chance per whole mile, proportional for fractions */
      const bonusDrops: { resourceType: ResourceType; amount: number }[] = []
      const wholeMiles = Math.floor(miles)
      for (let i = 0; i < wholeMiles; i++) {
        if (Math.random() < 0.10) {
          bonusDrops.push({ resourceType: run.resourceYieldType, amount: 1 })
        }
      }
      const frac = miles - wholeMiles
      if (frac > 0 && Math.random() < 0.10 * frac) {
        bonusDrops.push({ resourceType: run.resourceYieldType, amount: 1 })
      }

      const newAccumulated = +(Math.min(
        run.accumulatedMiles + miles,
        run.targetDistanceMiles,
      ).toFixed(2))

      const completed         = newAccumulated >= run.targetDistanceMiles
      const bonusTotal        = bonusDrops.reduce((s, d) => s + d.amount, 0)
      const mainReward        = completed ? run.resourceAmount : 0
      const totalResourceGain = bonusTotal + mainReward

      /* Atomic IDB transaction */
      await db.transaction('rw', [db.cardio_runs, db.base_inventory], async () => {
        await db.cardio_runs.update(run.id, {
          accumulatedMiles: newAccumulated,
          status:           completed ? 'COMPLETED' : 'ACTIVE',
        })

        if (totalResourceGain > 0) {
          const inv = await db.base_inventory.get(run.resourceYieldType)
          await db.base_inventory.update(run.resourceYieldType, {
            quantity: (inv?.quantity ?? 0) + totalResourceGain,
          })
        }
      })

      const messages: string[] = []
      if (completed) {
        messages.push(`Trail complete! +${mainReward} ${run.resourceYieldType} collected.`)
      }
      if (bonusTotal > 0) {
        messages.push(`Found ${bonusTotal} bonus resource${bonusTotal > 1 ? 's' : ''} along the way!`)
      }
      if (!completed && bonusTotal === 0) {
        const remaining = (run.targetDistanceMiles - newAccumulated).toFixed(2)
        messages.push(`Logged ${miles.toFixed(2)} mi — ${remaining} mi to go.`)
      }

      return {
        newAccumulatedMiles: newAccumulated,
        bonusDrops,
        completed,
        runReward: completed
          ? { resourceType: run.resourceYieldType, amount: mainReward }
          : undefined,
        message: messages.join(' '),
      }
    },
    [rawActiveRun],
  )

  /* ── Purchase next base upgrade ────────────────────────────── */
  const purchaseBaseUpgrade = useCallback(
    async (): Promise<PurchaseResult> => {
      const base = rawBaseState
      if (!base) return { success: false, reason: 'Base state not loaded.' }

      const tierDef = TIER_DEFINITIONS.find(t => t.tier === base.currentTier)
      if (!tierDef) return { success: false, reason: 'Unknown tier.' }

      const isMaxSteps = base.stepProgress >= tierDef.maxSteps
      const isFinalTier = !tierDef.nextTier

      if (isMaxSteps && isFinalTier) {
        return { success: false, reason: 'Your base is fully upgraded!' }
      }

      /* Determine which upgrade to apply */
      let costs: Partial<Record<ResourceType, number>>
      let featureName: string | undefined
      let tierUpgraded = false
      let newTier: typeof tierDef.nextTier

      if (isMaxSteps && tierDef.tierUpgradeCosts) {
        costs       = tierDef.tierUpgradeCosts
        tierUpgraded = true
        newTier      = tierDef.nextTier
      } else {
        const step   = tierDef.steps[base.stepProgress]
        costs        = step.costs
        featureName  = step.featureName
      }

      /* Affordability check */
      for (const [res, amount] of Object.entries(costs)) {
        const have = inventory[res as ResourceType] ?? 0
        if (have < (amount ?? 0)) {
          const lacking = (amount ?? 0) - have
          return { success: false, reason: `Need ${lacking} more ${res}.` }
        }
      }

      /* Atomic purchase */
      await db.transaction('rw', [db.base_inventory, db.base_upgrades], async () => {
        // Deduct costs
        for (const [res, amount] of Object.entries(costs)) {
          const inv = await db.base_inventory.get(res as ResourceType)
          await db.base_inventory.update(res as ResourceType, {
            quantity: (inv?.quantity ?? 0) - (amount ?? 0),
          })
        }

        // Advance upgrade state
        if (tierUpgraded && newTier) {
          await db.base_upgrades.update(1, {
            currentTier:      newTier,
            stepProgress:     0,
            unlockedFeatures: [...base.unlockedFeatures],
          })
        } else if (featureName) {
          await db.base_upgrades.update(1, {
            stepProgress:     base.stepProgress + 1,
            unlockedFeatures: [...base.unlockedFeatures, featureName],
          })
        }
      })

      return { success: true, featureUnlocked: featureName, tierUpgraded, newTier }
    },
    [rawBaseState, inventory],
  )

  /* ── Abandon active run ────────────────────────────────────── */
  const abandonRun = useCallback(async (): Promise<void> => {
    const run = rawActiveRun
    if (!run) return
    await db.cardio_runs.delete(run.id)
  }, [rawActiveRun])

  /* ── Next upgrade descriptor (for UI) ─────────────────────── */
  const nextUpgrade = useMemo(() => {
    if (!rawBaseState) return null
    const tierDef = TIER_DEFINITIONS.find(t => t.tier === rawBaseState.currentTier)
    if (!tierDef) return null

    const isMaxSteps  = rawBaseState.stepProgress >= tierDef.maxSteps
    const isFinalTier = !tierDef.nextTier

    if (isMaxSteps && isFinalTier) return null

    if (isMaxSteps && tierDef.tierUpgradeCosts) {
      const nextTierDef = TIER_DEFINITIONS.find(t => t.tier === tierDef.nextTier)
      return {
        label:       `Upgrade to ${nextTierDef?.displayName ?? tierDef.nextTier}`,
        featureName: undefined as string | undefined,
        costs:       tierDef.tierUpgradeCosts,
        isTierUpgrade: true,
      }
    }

    const step = tierDef.steps[rawBaseState.stepProgress]
    return {
      label:         `Build ${step.featureName}`,
      featureName:   step.featureName,
      costs:         step.costs,
      isTierUpgrade: false,
    }
  }, [rawBaseState])

  /* ── Can afford next upgrade? ──────────────────────────────── */
  const canAffordUpgrade = useMemo(() => {
    if (!nextUpgrade) return false
    return Object.entries(nextUpgrade.costs).every(
      ([res, amt]) => (inventory[res as ResourceType] ?? 0) >= (amt ?? 0),
    )
  }, [nextUpgrade, inventory])

  return {
    activeRun:          rawActiveRun ?? null,
    completedRuns:      rawCompletedRuns ?? [],
    inventory,
    baseState:          rawBaseState ?? null,
    isLoading,
    nextUpgrade,
    canAffordUpgrade,
    RESOURCE_META,
    startRun,
    logCardioProgress,
    purchaseBaseUpgrade,
    abandonRun,
  }
}
