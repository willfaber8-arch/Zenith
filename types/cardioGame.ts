/**
 * Zenith OS — Retro Trail Explorer & Base Builder
 * Phase 8 · Step 8.3 — Static schemas, constants, and derived types
 *
 * Three IDB tables:
 *   cardio_runs     — one active trail run at a time; tracks mile accumulation
 *   base_inventory  — key/value store (resourceName PK) for 3 resource types
 *   base_upgrades   — singleton (id=1) tracking tier + step progress + features
 */

/* ── Core enums ─────────────────────────────────────────────── */

export type ResourceType = 'Parchment Wood' | 'River Stones' | 'Iron Ore'
export type RunStatus    = 'ACTIVE' | 'COMPLETED'
export type BaseTier     = 'CAMPSITE' | 'LOG_CABIN' | 'MINI_CASTLE'

/* ── IDB row interfaces ──────────────────────────────────────── */

/** One trail run — created when the player starts a route. */
export interface CardioRun {
  id:                  string        // UUID PK — explicit, no auto-increment
  trailName:           string
  targetDistanceMiles: number
  accumulatedMiles:    number
  status:              RunStatus     // * indexed — query active run
  resourceYieldType:   ResourceType
  resourceAmount:      number        // jackpot amount on completion
  createdAt:           number        // * indexed — UTC ms
}

/** One row per resource type (3 rows total). */
export interface BaseInventory {
  resourceName: ResourceType   // PK string
  quantity:     number
}

/** Singleton (id = 1) — current base camp state. */
export interface BaseUpgrade {
  id:               number       // always 1
  currentTier:      BaseTier
  stepProgress:     number       // 0 … maxSteps-1 within the current tier
  unlockedFeatures: string[]     // accumulated list of every unlocked feature name
}

/* ── Trail definitions ───────────────────────────────────────── */

export interface Trail {
  name:              string
  description:       string
  distanceMiles:     number
  difficulty:        'Easy' | 'Moderate' | 'Hard'
  resourceYieldType: ResourceType
  resourceAmount:    number   // awarded on completion
  regionLabel:       string  // shown on the trail destination node
}

export const TRAILS: Trail[] = [
  {
    name:              'Whispering Pines Orchard',
    description:       'A gentle loop through ancient pines',
    distanceMiles:     1.5,
    difficulty:        'Easy',
    resourceYieldType: 'Parchment Wood',
    resourceAmount:    5,
    regionLabel:       'Orchard Gate',
  },
  {
    name:              'Mossy Creek Hollow',
    description:       'Follow the brook through misty ravines',
    distanceMiles:     2.5,
    difficulty:        'Easy',
    resourceYieldType: 'River Stones',
    resourceAmount:    5,
    regionLabel:       'Creek Crossing',
  },
  {
    name:              'Copper Ridge Path',
    description:       'Winding ridge through mineral-rich foothills',
    distanceMiles:     3.0,
    difficulty:        'Moderate',
    resourceYieldType: 'Iron Ore',
    resourceAmount:    4,
    regionLabel:       'Ridge Summit',
  },
  {
    name:              'Fernwood Valley Run',
    description:       'Dense fern corridors and mossy boulders',
    distanceMiles:     4.0,
    difficulty:        'Moderate',
    resourceYieldType: 'Parchment Wood',
    resourceAmount:    9,
    regionLabel:       'Valley Floor',
  },
  {
    name:              'Stoneback Mesa Circuit',
    description:       'Exposed sandstone plateaus with vast views',
    distanceMiles:     5.0,
    difficulty:        'Hard',
    resourceYieldType: 'River Stones',
    resourceAmount:    10,
    regionLabel:       'Mesa Overlook',
  },
  {
    name:              'Ironwood Summit Push',
    description:       'Grueling climb through ancient iron-bark trees',
    distanceMiles:     6.0,
    difficulty:        'Hard',
    resourceYieldType: 'Iron Ore',
    resourceAmount:    8,
    regionLabel:       'Summit Peak',
  },
]

/* ── Base upgrade tier system ────────────────────────────────── */

export interface UpgradeStep {
  stepIndex:   number
  featureName: string
  costs:       Partial<Record<ResourceType, number>>
}

export interface TierDefinition {
  tier:              BaseTier
  displayName:       string
  symbol:            string     // primary glyph for UI
  maxSteps:          number     // how many in-tier steps before tier upgrade available
  steps:             UpgradeStep[]
  tierUpgradeCosts?: Partial<Record<ResourceType, number>>
  nextTier?:         BaseTier
}

export const TIER_DEFINITIONS: TierDefinition[] = [
  {
    tier:        'CAMPSITE',
    displayName: 'Campsite',
    symbol:      'CAMPSITE',
    maxSteps:    4,
    steps: [
      { stepIndex: 1, featureName: 'Campfire Ring',  costs: { 'Parchment Wood': 3, 'River Stones': 1 } },
      { stepIndex: 2, featureName: 'Supply Cache',   costs: { 'Parchment Wood': 3, 'River Stones': 2 } },
      { stepIndex: 3, featureName: 'Lookout Post',   costs: { 'Parchment Wood': 5, 'River Stones': 2 } },
      { stepIndex: 4, featureName: 'Stone Path',     costs: { 'Parchment Wood': 4, 'River Stones': 4 } },
    ],
    tierUpgradeCosts: { 'Parchment Wood': 10, 'River Stones': 5 },
    nextTier: 'LOG_CABIN',
  },
  {
    tier:        'LOG_CABIN',
    displayName: 'Log Cabin',
    symbol:      'LOG CABIN',
    maxSteps:    4,
    steps: [
      { stepIndex: 1, featureName: 'Stone Fireplace', costs: { 'Parchment Wood': 5, 'River Stones': 3 } },
      { stepIndex: 2, featureName: 'Garden Patch',    costs: { 'Parchment Wood': 5, 'River Stones': 3, 'Iron Ore': 2 } },
      { stepIndex: 3, featureName: 'Wind Chimes',     costs: { 'River Stones': 5, 'Iron Ore': 3 } },
      { stepIndex: 4, featureName: 'Herb Garden',     costs: { 'Parchment Wood': 6, 'River Stones': 4, 'Iron Ore': 3 } },
    ],
    tierUpgradeCosts: { 'Parchment Wood': 15, 'River Stones': 10, 'Iron Ore': 8 },
    nextTier: 'MINI_CASTLE',
  },
  {
    tier:        'MINI_CASTLE',
    displayName: 'Mini Castle',
    symbol:      'MINI CASTLE',
    maxSteps:    4,
    steps: [
      { stepIndex: 1, featureName: 'Stone Watchtower', costs: { 'River Stones': 8,  'Iron Ore': 5  } },
      { stepIndex: 2, featureName: 'Royal Banners',    costs: { 'Parchment Wood': 8, 'Iron Ore': 6  } },
      { stepIndex: 3, featureName: 'Moat & Bridge',    costs: { 'River Stones': 10,  'Iron Ore': 8  } },
      { stepIndex: 4, featureName: 'Great Hall',       costs: { 'Parchment Wood': 12,'River Stones': 8, 'Iron Ore': 10 } },
    ],
    // Terminal tier — no further upgrade
  },
]

export const RESOURCE_META: Record<ResourceType, { label: string; symbol: string; color: string }> = {
  'Parchment Wood': { label: 'Parchment Wood', symbol: 'PW', color: '#c4a05e' },
  'River Stones':   { label: 'River Stones',   symbol: 'RS', color: '#7a95a8' },
  'Iron Ore':       { label: 'Iron Ore',        symbol: 'IO', color: '#6a8099' },
}

/* ── Action result types ─────────────────────────────────────── */

export interface BonusDrop {
  resourceType: ResourceType
  amount:       number
}

export interface LogProgressResult {
  newAccumulatedMiles: number
  bonusDrops:          BonusDrop[]
  completed:           boolean
  runReward?:          { resourceType: ResourceType; amount: number }
  message:             string
}

export interface PurchaseResult {
  success:          boolean
  reason?:          string
  featureUnlocked?: string
  tierUpgraded?:    boolean
  newTier?:         BaseTier
}
