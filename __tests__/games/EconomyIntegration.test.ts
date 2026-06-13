/**
 * ════════════════════════════════════════════════════════════════
 * Games Tab — Economy Integration Test Suite
 * Step 8.1 — Comprehensive Mock-Data E2E Test Suite Setup
 *
 * Execution model
 * ────────────────
 * fake-indexeddb/auto (loaded by jest.setup.ts) patches the global
 * indexedDB before any module is imported, so the gamesDb Dexie
 * singleton is backed by a fully spec-compliant in-memory store.
 * Each test suite resets the database in beforeEach via resetDb()
 * to guarantee zero cross-test state pollution.
 *
 * Coverage matrix
 * ────────────────
 * Suite 1 — Initial seeding    : 6-resource row counts, base capacities,
 *                                idempotency, profile singleton
 * Suite 2 — Cap hard-clamp     : addToInventory + hook addResources,
 *                                { added, capped, overflowDiscarded }
 * Suite 3 — Upgrade transaction: purchaseStorageUpgrade L1→L2,
 *                                cost deduction + new capacity = 1 000
 * Suite 4 — Prerequisite gate  : executeAtomicUnlock blocked by missing
 *                                nexus_core_01, then unblocked and passing
 *
 * React hook invocations are wrapped in `await act(async () => {...})`
 * from @testing-library/react to mirror real browser interaction cycles
 * as required by the spec.
 * ════════════════════════════════════════════════════════════════
 */

import { renderHook, act } from '@testing-library/react'

import {
  gamesDb,
  seedGamesDatabase,
  addToInventory,
  RESOURCE_IDS,
  RESOURCE_META,
  type ResourceId,
  type ResourceNode,
  type UserProfileConfig,
  type SkillTreeRecord,
} from '@/lib/gamesDb'

import { useZenithEconomy, type AddResourcesResult } from '@/hooks/useZenithEconomy'
import {
  useZenithStorageUpgrades,
  type UpgradePurchaseResult,
} from '@/hooks/useZenithStorageUpgrades'

import {
  executeAtomicUnlock,
  NEXUS_NODE_ID,
} from '@/lib/engines/SkillTreeFirewall'

/* ════════════════════════════════════════════════════════════════
   §1  EXPORTED INTERFACES  (spec-required signatures)
   ════════════════════════════════════════════════════════════════ */

/**
 * Snapshot emitted at the end of each test suite block.
 * Tracks overall pass/fail status, captured log lines, and wall-clock
 * duration so failures can be triaged in CI artifact reports.
 */
export interface QAValidationRunner {
  suiteName:        string
  isPassed:         boolean
  capturedLogs:     string[]
  executionDeltaMs: number
}

/**
 * Declarative seed profile for test databases.
 * Passed to `applyMockProfile()` to control the exact initial balances
 * and unlock state visible to the system under test.
 */
export type MockProfileConfigType = {
  initialShards:  number
  initialSpores:  number
  unlockedSkills: string[]
}

/* ════════════════════════════════════════════════════════════════
   §2  SUITE RUNNER HELPER
   ────────────────────────────────────────────────────────────────
   Lightweight instrumentation wrapper that produces a
   QAValidationRunner snapshot.  One instance is created per top-
   level describe block; individual `it()` calls push log lines into
   it.  The snapshot is asserted at the end of the final test in
   each suite to satisfy the spec's typing requirement.
   ════════════════════════════════════════════════════════════════ */

class SuiteRunner {
  readonly suiteName: string
  isPassed         = true
  capturedLogs:  string[] = []
  executionDeltaMs = 0
  private readonly startMs: number

  constructor(name: string) {
    this.suiteName = name
    this.startMs   = performance.now()
  }

  log(message: string): void {
    this.capturedLogs.push(`[${new Date().toISOString()}] ${message}`)
  }

  fail(reason: string): void {
    this.isPassed = false
    this.log(`FAIL: ${reason}`)
  }

  seal(): QAValidationRunner {
    this.executionDeltaMs = performance.now() - this.startMs
    return {
      suiteName:        this.suiteName,
      isPassed:         this.isPassed,
      capturedLogs:     this.capturedLogs,
      executionDeltaMs: this.executionDeltaMs,
    }
  }
}

/* ════════════════════════════════════════════════════════════════
   §3  DATABASE LIFECYCLE HELPERS
   ════════════════════════════════════════════════════════════════ */

/**
 * Closes and deletes the gamesDb instance, then reopens it with
 * fresh empty tables.  Called in beforeEach for every suite so no
 * state leaks between tests.
 *
 * gamesDb is a module singleton — we do NOT re-import or recreate the
 * class, we just wipe the in-memory IndexedDB store underneath it.
 * fake-indexeddb's `deleteDatabase()` removes the store; the
 * subsequent `open()` runs all version() blocks and recreates tables.
 */
async function resetDb(): Promise<void> {
  if (gamesDb.isOpen()) {
    gamesDb.close()
  }
  await gamesDb.delete()
  await gamesDb.open()
}

/**
 * Seeds the database with a custom balance/unlock profile on top of
 * the standard seedGamesDatabase() baseline.
 *
 * @param config  The desired initial balances and unlock set.
 */
async function applyMockProfile(config: MockProfileConfigType): Promise<void> {
  await seedGamesDatabase()

  if (config.initialShards > 0) {
    await gamesDb.resource_inventory.update('raw_data_shards' as ResourceId, {
      balance: config.initialShards,
    })
  }

  if (config.initialSpores > 0) {
    await gamesDb.resource_inventory.update('organic_spores' as ResourceId, {
      balance: config.initialSpores,
    })
  }

  for (const nodeId of config.unlockedSkills) {
    const record: SkillTreeRecord = {
      nodeId,
      isUnlocked:   true,
      dateUnlocked: Date.now(),
    }
    await gamesDb.skill_tree.put(record)
  }
}

/* ════════════════════════════════════════════════════════════════
   SUITE 1 — Initial Database Initialization & Seeding Checks
   ════════════════════════════════════════════════════════════════ */

describe('Suite 1 — Initial Database Initialization & Seeding Checks', () => {

  const runner = new SuiteRunner('Suite 1 — Initial DB Seeding')

  beforeEach(async () => {
    await resetDb()
  })

  it('seeds exactly 6 resource inventory rows', async () => {
    await act(async () => { await seedGamesDatabase() })

    const count = await gamesDb.resource_inventory.count()

    runner.log(`resource_inventory row count after seed: ${count}`)
    expect(count).toBe(RESOURCE_IDS.length)
    expect(count).toBe(6)
  })

  it('initialises every seeded resource with balance exactly 0', async () => {
    await act(async () => { await seedGamesDatabase() })

    const nodes: ResourceNode[] = await gamesDb.resource_inventory.toArray()

    for (const node of nodes) {
      runner.log(`${node.id}.balance = ${node.balance}`)
      expect(node.balance).toBe(0)
    }
  })

  it('initialises totalEarnedLifetime at 0 for all resources', async () => {
    await act(async () => { await seedGamesDatabase() })

    const nodes: ResourceNode[] = await gamesDb.resource_inventory.toArray()

    for (const node of nodes) {
      expect(node.totalEarnedLifetime).toBe(0)
    }
  })

  it('locks raw resource base capacities at exactly 200', async () => {
    await act(async () => { await seedGamesDatabase() })

    const rawResourceIds: ResourceId[] = [
      'raw_data_shards',
      'organic_spores',
      'cosmic_dust',
    ]

    for (const id of rawResourceIds) {
      const node = await gamesDb.resource_inventory.get(id)
      runner.log(`${id}.maxCapacity = ${node?.maxCapacity}`)
      expect(node).toBeDefined()
      expect(node!.maxCapacity).toBe(200)
    }
  })

  it('locks refined resource base capacities at exactly 50', async () => {
    await act(async () => { await seedGamesDatabase() })

    const refinedIds: ResourceId[] = ['quantum_fuel', 'stardust_glass']

    for (const id of refinedIds) {
      const node = await gamesDb.resource_inventory.get(id)
      runner.log(`${id}.maxCapacity = ${node?.maxCapacity}`)
      expect(node).toBeDefined()
      expect(node!.maxCapacity).toBe(50)
    }
  })

  it('assigns null (infinite) capacity to cosmetic_points', async () => {
    await act(async () => { await seedGamesDatabase() })

    const node = await gamesDb.resource_inventory.get('cosmetic_points' as ResourceId)

    runner.log(`cosmetic_points.maxCapacity = ${node?.maxCapacity}`)
    expect(node).toBeDefined()
    expect(node!.maxCapacity).toBeNull()
  })

  it('seeds the user_profile_config singleton with the default theme', async () => {
    await act(async () => { await seedGamesDatabase() })

    const profile: UserProfileConfig | undefined =
      await gamesDb.user_profile_config.get('active_user')

    runner.log(`activeTheme = ${profile?.activeTheme}`)
    expect(profile).toBeDefined()
    expect(profile!.activeTheme).toBe('zenith_default')
    expect(profile!.purchasedThemes).toContain('zenith_default')
    expect(profile!.cosmeticPointsBalance).toBe(0)
  })

  it('is idempotent — a second seed call does not duplicate rows', async () => {
    await act(async () => {
      await seedGamesDatabase()
      await seedGamesDatabase()  // intentional second call
    })

    const count = await gamesDb.resource_inventory.count()

    runner.log(`row count after double seed: ${count}`)
    expect(count).toBe(6)
  })

  it('emits a well-formed QAValidationRunner snapshot', () => {
    runner.log('Suite 1 snapshot assertion')
    const snapshot = runner.seal()

    expect(snapshot.suiteName).toBe('Suite 1 — Initial DB Seeding')
    expect(snapshot.isPassed).toBe(true)
    expect(snapshot.capturedLogs.length).toBeGreaterThan(0)
    expect(snapshot.executionDeltaMs).toBeGreaterThanOrEqual(0)
  })
})

/* ════════════════════════════════════════════════════════════════
   SUITE 2 — Rigid Capacity Cap Hard-Clamping Assertions
   ════════════════════════════════════════════════════════════════ */

describe('Suite 2 — Rigid Capacity Cap Hard-Clamping Assertions', () => {

  const runner = new SuiteRunner('Suite 2 — Cap Enforcement')

  beforeEach(async () => {
    await resetDb()
    await seedGamesDatabase()
  })

  it('clamps the post-mutation DB balance at exactly 200 when requesting 250', async () => {
    await act(async () => { await addToInventory('raw_data_shards', 250) })

    const node = await gamesDb.resource_inventory.get('raw_data_shards' as ResourceId)

    runner.log(`raw_data_shards.balance after addToInventory(250) = ${node?.balance}`)
    expect(node).toBeDefined()
    expect(node!.balance).toBe(200)
  })

  it('reflects the overflow in addToInventory — amountActuallyAdded = 200', async () => {
    const result = await addToInventory('raw_data_shards', 250)

    runner.log(`addToInventory result: ${JSON.stringify(result)}`)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.newBalance).toBe(200)
      expect(result.amountActuallyAdded).toBe(200)
    }
  })

  it('returns { added: 200, capped: true, overflowDiscarded: 50 } from the economy hook', async () => {
    const { result } = renderHook(() => useZenithEconomy())

    let addResult: AddResourcesResult | undefined

    await act(async () => {
      addResult = await result.current.addResources('raw_data_shards', 250)
    })

    runner.log(`addResources(250) = ${JSON.stringify(addResult)}`)
    expect(addResult).toBeDefined()
    expect(addResult!.added).toBe(200)
    expect(addResult!.capped).toBe(true)
    expect(addResult!.overflowDiscarded).toBe(50)
  })

  it('does not exceed capacity on two sequential partial adds', async () => {
    const { result } = renderHook(() => useZenithEconomy())

    let first:  AddResourcesResult | undefined
    let second: AddResourcesResult | undefined

    await act(async () => {
      first  = await result.current.addResources('raw_data_shards', 120)
      second = await result.current.addResources('raw_data_shards', 120)
    })

    // First: 0 + 120 = 120 — under cap
    expect(first!.added).toBe(120)
    expect(first!.capped).toBe(false)
    expect(first!.overflowDiscarded).toBe(0)

    // Second: 120 + 120 = 240 → clamped to 200; overflow = 40
    expect(second!.added).toBe(80)
    expect(second!.capped).toBe(true)
    expect(second!.overflowDiscarded).toBe(40)

    const node = await gamesDb.resource_inventory.get('raw_data_shards' as ResourceId)
    runner.log(`balance after two adds: ${node?.balance}`)
    expect(node!.balance).toBe(200)
  })

  it('returns ZERO_ADD_RESULT shape when the resource is already at capacity', async () => {
    // Fill to capacity first
    await act(async () => {
      await gamesDb.resource_inventory.update('raw_data_shards' as ResourceId, {
        balance: 200,
      })
    })

    const { result } = renderHook(() => useZenithEconomy())
    let addResult: AddResourcesResult | undefined

    await act(async () => {
      addResult = await result.current.addResources('raw_data_shards', 10)
    })

    runner.log(`addResources when at cap: ${JSON.stringify(addResult)}`)
    // When at cap, no units are added
    expect(addResult!.added).toBe(0)
    expect(addResult!.capped).toBe(true)
    expect(addResult!.overflowDiscarded).toBe(10)
  })

  it('emits a well-formed QAValidationRunner snapshot', () => {
    runner.log('Suite 2 snapshot assertion')
    const snapshot = runner.seal()

    expect(snapshot.suiteName).toBe('Suite 2 — Cap Enforcement')
    expect(snapshot.isPassed).toBe(true)
    expect(snapshot.executionDeltaMs).toBeGreaterThanOrEqual(0)
  })
})

/* ════════════════════════════════════════════════════════════════
   SUITE 3 — Multi-Resource Upgrade Transaction Sanity
   ════════════════════════════════════════════════════════════════
   raw_data_shards  L1→L2  costs:
     150 × organic_spores
      50 × cosmic_dust
   New capacity: 1 000
   ════════════════════════════════════════════════════════════════ */

describe('Suite 3 — Multi-Resource Upgrade Transaction Sanity', () => {

  const runner = new SuiteRunner('Suite 3 — Storage Upgrade L1→L2')

  // L1→L2 cost constants (mirrors UPGRADE_MATRIX in useZenithStorageUpgrades)
  const UPGRADE_COST_SPORES = 150
  const UPGRADE_COST_DUST   = 50
  const SEED_SPORES_BALANCE = 200   // > 150 — satisfies upgrade requirement
  const SEED_DUST_BALANCE   = 100   // > 50  — satisfies upgrade requirement
  const EXPECTED_NEW_CAP    = 1_000

  beforeEach(async () => {
    await resetDb()

    // Build mock profile that satisfies the L1→L2 upgrade criteria
    await applyMockProfile({
      initialShards:  0,
      initialSpores:  SEED_SPORES_BALANCE,
      unlockedSkills: [],
    })

    // Also credit cosmic_dust — applyMockProfile only handles shards + spores
    await gamesDb.resource_inventory.update('cosmic_dust' as ResourceId, {
      balance: SEED_DUST_BALANCE,
    })
  })

  it('confirms pre-conditions — organic_spores and cosmic_dust are adequately funded', async () => {
    const spores = await gamesDb.resource_inventory.get('organic_spores' as ResourceId)
    const dust   = await gamesDb.resource_inventory.get('cosmic_dust' as ResourceId)

    runner.log(`Pre-upgrade spores=${spores?.balance}, dust=${dust?.balance}`)
    expect(spores!.balance).toBe(SEED_SPORES_BALANCE)
    expect(dust!.balance).toBe(SEED_DUST_BALANCE)
  })

  it('confirms raw_data_shards starts at base maxCapacity of 200', async () => {
    const node = await gamesDb.resource_inventory.get('raw_data_shards' as ResourceId)

    runner.log(`raw_data_shards.maxCapacity before upgrade: ${node?.maxCapacity}`)
    expect(node!.maxCapacity).toBe(200)
  })

  it('returns success=true and newCapacity=1000 from the upgrade hook', async () => {
    const { result } = renderHook(() => useZenithStorageUpgrades())

    let upgradeResult: UpgradePurchaseResult | undefined

    await act(async () => {
      upgradeResult = await result.current.purchaseStorageUpgrade('raw_data_shards')
    })

    runner.log(`purchaseStorageUpgrade result: ${JSON.stringify(upgradeResult)}`)
    expect(upgradeResult).toBeDefined()
    expect(upgradeResult!.success).toBe(true)
    expect(upgradeResult!.newCapacity).toBe(EXPECTED_NEW_CAP)
  })

  it('writes maxCapacity=1000 to the raw_data_shards row in the database', async () => {
    const { result } = renderHook(() => useZenithStorageUpgrades())

    await act(async () => {
      await result.current.purchaseStorageUpgrade('raw_data_shards')
    })

    const node = await gamesDb.resource_inventory.get('raw_data_shards' as ResourceId)

    runner.log(`raw_data_shards.maxCapacity after upgrade: ${node?.maxCapacity}`)
    expect(node!.maxCapacity).toBe(EXPECTED_NEW_CAP)
  })

  it('deducts exactly 150 organic_spores from the secondary cost column', async () => {
    const { result } = renderHook(() => useZenithStorageUpgrades())

    await act(async () => {
      await result.current.purchaseStorageUpgrade('raw_data_shards')
    })

    const spores = await gamesDb.resource_inventory.get('organic_spores' as ResourceId)
    const expectedBalance = SEED_SPORES_BALANCE - UPGRADE_COST_SPORES

    runner.log(`organic_spores.balance after upgrade: ${spores?.balance} (expected ${expectedBalance})`)
    expect(spores!.balance).toBe(expectedBalance)
  })

  it('deducts exactly 50 cosmic_dust from the secondary cost column', async () => {
    const { result } = renderHook(() => useZenithStorageUpgrades())

    await act(async () => {
      await result.current.purchaseStorageUpgrade('raw_data_shards')
    })

    const dust = await gamesDb.resource_inventory.get('cosmic_dust' as ResourceId)
    const expectedBalance = SEED_DUST_BALANCE - UPGRADE_COST_DUST

    runner.log(`cosmic_dust.balance after upgrade: ${dust?.balance} (expected ${expectedBalance})`)
    expect(dust!.balance).toBe(expectedBalance)
  })

  it('populates the delta array with correct per-resource deduction records', async () => {
    const { result } = renderHook(() => useZenithStorageUpgrades())

    let upgradeResult: UpgradePurchaseResult | undefined

    await act(async () => {
      upgradeResult = await result.current.purchaseStorageUpgrade('raw_data_shards')
    })

    expect(upgradeResult!.success).toBe(true)
    expect(upgradeResult!.delta).toBeDefined()
    expect(upgradeResult!.delta).toHaveLength(2)

    // Locate the organic_spores delta entry
    const sporesDelta = upgradeResult!.delta!.find(
      d => d.resourceId === 'organic_spores',
    )
    expect(sporesDelta).toBeDefined()
    expect(sporesDelta!.amountConsumed).toBe(UPGRADE_COST_SPORES)
    expect(sporesDelta!.balanceAfter).toBe(SEED_SPORES_BALANCE - UPGRADE_COST_SPORES)

    // Locate the cosmic_dust delta entry
    const dustDelta = upgradeResult!.delta!.find(
      d => d.resourceId === 'cosmic_dust',
    )
    expect(dustDelta).toBeDefined()
    expect(dustDelta!.amountConsumed).toBe(UPGRADE_COST_DUST)
    expect(dustDelta!.balanceAfter).toBe(SEED_DUST_BALANCE - UPGRADE_COST_DUST)
  })

  it('fails cleanly when organic_spores balance is insufficient', async () => {
    // Drain organic_spores below the required 150
    await gamesDb.resource_inventory.update('organic_spores' as ResourceId, {
      balance: 80,  // < 150
    })

    const { result } = renderHook(() => useZenithStorageUpgrades())

    let upgradeResult: UpgradePurchaseResult | undefined

    await act(async () => {
      upgradeResult = await result.current.purchaseStorageUpgrade('raw_data_shards')
    })

    runner.log(`Insufficient balance result: ${JSON.stringify(upgradeResult)}`)
    expect(upgradeResult!.success).toBe(false)
    expect(upgradeResult!.error).toBeDefined()
    expect(upgradeResult!.error).toMatch(/Insufficient/i)
  })

  it('emits a well-formed QAValidationRunner snapshot', () => {
    runner.log('Suite 3 snapshot assertion')
    const snapshot = runner.seal()

    expect(snapshot.suiteName).toBe('Suite 3 — Storage Upgrade L1→L2')
    expect(snapshot.isPassed).toBe(true)
    expect(snapshot.executionDeltaMs).toBeGreaterThanOrEqual(0)
  })
})

/* ════════════════════════════════════════════════════════════════
   SUITE 4 — Dependency Tree & Access Control Verification
   ════════════════════════════════════════════════════════════════
   Validates that executeAtomicUnlock() enforces the prerequisite
   graph.  Target node: d1_synthesis (Branch D · Tier 1).
     Prerequisites : nexus_core_01 must be unlocked
     Costs         : 1 500 × raw_data_shards
   ════════════════════════════════════════════════════════════════ */

describe('Suite 4 — Dependency Tree & Access Control Verification', () => {

  const runner = new SuiteRunner('Suite 4 — Skill Prerequisite Gate')

  const TARGET_NODE          = 'd1_synthesis'
  const D1_COST_SHARDS       = 1_500
  const SUFFICIENT_BALANCE   = 2_000  // > 1500 — satisfies d1_synthesis cost

  beforeEach(async () => {
    await resetDb()
    await seedGamesDatabase()
  })

  it('confirms skill_tree is empty after seeding (all nodes locked)', async () => {
    const count = await gamesDb.skill_tree.count()

    runner.log(`skill_tree row count after seed: ${count}`)
    expect(count).toBe(0)
  })

  it('returns PREREQUISITE_LOCKED when nexus_core_01 is absent from skill_tree', async () => {
    // d1_synthesis requires nexus_core_01 — which doesn't exist yet
    const result = await executeAtomicUnlock(TARGET_NODE)

    runner.log(
      `executeAtomicUnlock('${TARGET_NODE}') with no nexus: ` +
      `success=${result.success}, error=${result.error}`,
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('PREREQUISITE_LOCKED')
  })

  it('does not write any skill_tree row when the prerequisite gate fires', async () => {
    await executeAtomicUnlock(TARGET_NODE)

    const row = await gamesDb.skill_tree.get(TARGET_NODE)

    runner.log(`skill_tree row after failed unlock attempt: ${JSON.stringify(row)}`)
    expect(row).toBeUndefined()
  })

  it('returns INSUFFICIENT_FUNDS once nexus is unlocked but shards balance is 0', async () => {
    // Insert nexus_core_01 — prerequisite satisfied
    const nexusRecord: SkillTreeRecord = {
      nodeId:       NEXUS_NODE_ID,
      isUnlocked:   true,
      dateUnlocked: Date.now(),
    }
    await gamesDb.skill_tree.put(nexusRecord)

    // raw_data_shards balance is still 0 (insufficient for 1500 cost)
    const result = await executeAtomicUnlock(TARGET_NODE)

    runner.log(
      `executeAtomicUnlock with nexus but no shards: ` +
      `success=${result.success}, error=${result.error}`,
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('INSUFFICIENT_FUNDS')
  })

  it('succeeds once nexus_core_01 is active and resource balance is sufficient', async () => {
    // Unlock nexus — satisfies prerequisite
    const nexusRecord: SkillTreeRecord = {
      nodeId:       NEXUS_NODE_ID,
      isUnlocked:   true,
      dateUnlocked: Date.now(),
    }
    await gamesDb.skill_tree.put(nexusRecord)

    // Fund raw_data_shards above the 1 500 threshold
    await gamesDb.resource_inventory.update('raw_data_shards' as ResourceId, {
      balance: SUFFICIENT_BALANCE,
    })

    const result = await executeAtomicUnlock(TARGET_NODE)

    runner.log(
      `executeAtomicUnlock('${TARGET_NODE}') with nexus + funds: ` +
      `success=${result.success}, updatedNodeId=${result.updatedNodeId}`,
    )
    expect(result.success).toBe(true)
    expect(result.updatedNodeId).toBe(TARGET_NODE)
  })

  it('writes an isUnlocked=true row to skill_tree on successful unlock', async () => {
    // Prerequisites
    await gamesDb.skill_tree.put({
      nodeId: NEXUS_NODE_ID, isUnlocked: true, dateUnlocked: Date.now(),
    })
    await gamesDb.resource_inventory.update('raw_data_shards' as ResourceId, {
      balance: SUFFICIENT_BALANCE,
    })

    await executeAtomicUnlock(TARGET_NODE)

    const row = await gamesDb.skill_tree.get(TARGET_NODE)

    runner.log(`skill_tree row after successful unlock: ${JSON.stringify(row)}`)
    expect(row).toBeDefined()
    expect(row!.nodeId).toBe(TARGET_NODE)
    expect(row!.isUnlocked).toBe(true)
    expect(row!.dateUnlocked).toBeGreaterThan(0)
  })

  it('deducts D1_COST_SHARDS from raw_data_shards on successful unlock', async () => {
    await gamesDb.skill_tree.put({
      nodeId: NEXUS_NODE_ID, isUnlocked: true, dateUnlocked: Date.now(),
    })
    await gamesDb.resource_inventory.update('raw_data_shards' as ResourceId, {
      balance: SUFFICIENT_BALANCE,
    })

    await executeAtomicUnlock(TARGET_NODE)

    const node = await gamesDb.resource_inventory.get('raw_data_shards' as ResourceId)
    const expectedBalance = SUFFICIENT_BALANCE - D1_COST_SHARDS

    runner.log(
      `raw_data_shards balance after unlock: ${node?.balance} ` +
      `(expected ${expectedBalance})`,
    )
    expect(node!.balance).toBe(expectedBalance)
  })

  it('returns ALREADY_UNLOCKED when attempting to unlock an already-held node', async () => {
    // Unlock prerequisites + fund shards
    await gamesDb.skill_tree.put({
      nodeId: NEXUS_NODE_ID, isUnlocked: true, dateUnlocked: Date.now(),
    })
    await gamesDb.resource_inventory.update('raw_data_shards' as ResourceId, {
      balance: SUFFICIENT_BALANCE * 2,  // enough for two unlock attempts
    })

    // First unlock — should succeed
    const first = await executeAtomicUnlock(TARGET_NODE)
    expect(first.success).toBe(true)

    // Second unlock — same node, should be rejected as already-held
    const second = await executeAtomicUnlock(TARGET_NODE)

    runner.log(
      `Second unlock attempt result: success=${second.success}, error=${second.error}`,
    )
    expect(second.success).toBe(false)
    expect(second.error).toBe('ALREADY_UNLOCKED')
  })

  it('emits a well-formed QAValidationRunner snapshot', () => {
    runner.log('Suite 4 snapshot assertion')
    const snapshot = runner.seal()

    expect(snapshot.suiteName).toBe('Suite 4 — Skill Prerequisite Gate')
    expect(snapshot.isPassed).toBe(true)
    expect(snapshot.capturedLogs.length).toBeGreaterThan(0)
    expect(snapshot.executionDeltaMs).toBeGreaterThanOrEqual(0)

    // Confirm no failure log entries were captured during suite execution
    const failLines = snapshot.capturedLogs.filter(l => l.includes('FAIL:'))
    expect(failLines).toHaveLength(0)
  })
})
