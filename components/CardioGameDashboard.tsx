'use client'

/**
 * Zenith OS — Retro Trail Explorer & Base Builder HUD
 * Phase 8 · Step 8.3 — Interactive retro game interface
 *
 * Layout:
 *   GameHeader  — tier badge + live inventory strip
 *   TrailPanel  — trail selection or active-run progress map
 *   BasePanel   — ASCII blueprint canvas + upgrade controls
 */

import { useState, useCallback } from 'react'
import { useCardioGame }          from '@/hooks/useCardioGame'
import type {
  Trail, ResourceType, BaseTier,
  LogProgressResult, PurchaseResult,
} from '@/types/cardioGame'
import { TRAILS, TIER_DEFINITIONS, RESOURCE_META } from '@/types/cardioGame'
import styles                                        from './CardioGameDashboard.module.css'

/* ════════════════════════════════════════════════════════════════
   ASCII blueprint templates
   Pure ASCII — no emoji in the art to avoid glyph-width drift.
   Feature overlays are positioned via CSS atop the pre block.
   ════════════════════════════════════════════════════════════════ */

function getAsciiArt(tier: BaseTier): string {
  if (tier === 'CAMPSITE') {
    return [
      '  T                 T  ',
      '                       ',
      '       .       .       ',
      '      / \\     / \\      ',
      '     /   \\___/   \\     ',
      '    |     [ ]     |    ',
      '    |_____________|    ',
      '  . . . . . . . . . .  ',
      '  ~~~~~~~~~~~~~~~~~~~~~',
    ].join('\n')
  }
  if (tier === 'LOG_CABIN') {
    return [
      '  T    _________    T  ',
      '      /         \\     ',
      '     /___________\\    ',
      '     |     |     |    ',
      '     |  [=]|     |    ',
      '     |     |_____|    ',
      '     |_____________|  ',
      '  . . . . . . . . . . ',
      '  ~~~~~~~~~~~~~~~~~~~~',
    ].join('\n')
  }
  // MINI_CASTLE
  return [
    '  T |_| |_| |_| |_| T ',
    '    |               |  ',
    '    |    _______    |  ',
    '    |   |   #   |   |  ',
    '    |   |       |   |  ',
    '    |   |_______|   |  ',
    '    |_______________|  ',
    '  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~  ',
    '  ~~~~~~~~~~~~~~~~~~~~~~',
  ].join('\n')
}

/* ── Feature badge positions (% within blueprint canvas) ─────── */

type FeaturePos = { top: string; left: string; symbol: string }

const FEATURE_POSITIONS: Record<string, FeaturePos> = {
  // CAMPSITE features
  'Campfire Ring':   { top: '50%',  left: '50%',  symbol: '🔥' },
  'Supply Cache':    { top: '50%',  left: '12%',  symbol: '📦' },
  'Lookout Post':    { top: '12%',  left: '50%',  symbol: '👁' },
  'Stone Path':      { top: '75%',  left: '50%',  symbol: '·' },
  // LOG_CABIN features
  'Stone Fireplace': { top: '55%',  left: '18%',  symbol: '🔥' },
  'Garden Patch':    { top: '72%',  left: '78%',  symbol: '🌿' },
  'Wind Chimes':     { top: '18%',  left: '80%',  symbol: '♪'  },
  'Herb Garden':     { top: '72%',  left: '18%',  symbol: '🌱' },
  // MINI_CASTLE features
  'Stone Watchtower':{ top: '10%',  left: '10%',  symbol: '🗼' },
  'Royal Banners':   { top: '10%',  left: '82%',  symbol: '⚑'  },
  'Moat & Bridge':   { top: '80%',  left: '50%',  symbol: '≈'  },
  'Great Hall':      { top: '48%',  left: '50%',  symbol: '⚔'  },
}

/* ════════════════════════════════════════════════════════════════
   Sub-components
   ════════════════════════════════════════════════════════════════ */

/* ── Base Blueprint Canvas ───────────────────────────────────── */
function BaseBlueprintCanvas({
  tier,
  unlockedFeatures,
  tierDef,
}: {
  tier:             BaseTier
  unlockedFeatures: string[]
  tierDef:          typeof TIER_DEFINITIONS[number]
}) {
  const art = getAsciiArt(tier)

  return (
    <div className={styles.blueprint} role="img" aria-label={`Base camp: ${tier}`}>
      <span className={styles.blueprintTierLabel}>{tierDef.symbol}</span>
      <pre className={styles.blueprintArt}>{art}</pre>

      {/* Feature overlays — animate in with CSS spring on first unlock */}
      {unlockedFeatures.map(feat => {
        const pos = FEATURE_POSITIONS[feat]
        if (!pos) return null
        return (
          <div
            key={feat}
            className={styles.featureBadge}
            style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -50%)' }}
            title={feat}
          >
            <span className={styles.featureBadgeSymbol}>{pos.symbol}</span>
            {feat}
          </div>
        )
      })}
    </div>
  )
}

/* ── Resource cost chip ──────────────────────────────────────── */
function CostChip({
  res,
  amount,
  have,
}: {
  res:    ResourceType
  amount: number
  have:   number
}) {
  const meta = RESOURCE_META[res]
  const met  = have >= amount
  const cls  =
    res === 'Parchment Wood' ? styles.costChipPW :
    res === 'River Stones'   ? styles.costChipRS :
                               styles.costChipIO

  return (
    <span className={`${styles.costChip} ${cls} ${met ? styles.costChipMet : styles.costChipShort}`}>
      {meta.symbol} ×{amount}
      {!met && <span> ({have})</span>}
    </span>
  )
}

/* ── Trail panel ─────────────────────────────────────────────── */
function TrailPanel() {
  const {
    activeRun, completedRuns, inventory,
    startRun, logCardioProgress, abandonRun,
  } = useCardioGame()

  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null)
  const [milesInput,    setMilesInput]    = useState('')
  const [lastResult,    setLastResult]    = useState<LogProgressResult | null>(null)
  const [logging,       setLogging]       = useState(false)

  const handleBeginRun = useCallback(async () => {
    if (!selectedTrail || activeRun) return
    await startRun(selectedTrail)
    setSelectedTrail(null)
  }, [selectedTrail, activeRun, startRun])

  const handleLogMiles = useCallback(async () => {
    const miles = parseFloat(milesInput)
    if (!miles || miles <= 0 || !activeRun) return
    setLogging(true)
    const result = await logCardioProgress(miles)
    setLastResult(result)
    setMilesInput('')
    setLogging(false)
  }, [milesInput, activeRun, logCardioProgress])

  const progressPct = activeRun
    ? Math.min(100, (activeRun.accumulatedMiles / activeRun.targetDistanceMiles) * 100)
    : 0

  /* ── Active run view ─────────────────────────────────────── */
  if (activeRun) {
    const resMeta = RESOURCE_META[activeRun.resourceYieldType]
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Active Trail</span>
          <span className={styles.activeRunLabel}>
            <span className={styles.activeDot} />
            RUNNING
          </span>
        </div>

        <div className={styles.panelBody}>
          {/* Run title */}
          <div className={styles.runTitle}>{activeRun.trailName}</div>

          {/* Destination label */}
          <div className={styles.runDestLabel}>
            [ Destination: {activeRun.trailName} — {activeRun.targetDistanceMiles.toFixed(1)} mi ]
          </div>

          {/* Trail progress map */}
          <div className={styles.trailMap} role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <span className={styles.trailStartFlag}>⛺</span>
            <span className={styles.trailEndFlag}>🌲</span>

            <div className={styles.trailLine}>
              <div className={styles.trailLineFill} style={{ width: `${progressPct}%` }} />

              {/* Checkpoint dots at 25 / 50 / 75 % */}
              {[25, 50, 75].map(pct => (
                <div
                  key={pct}
                  className={`${styles.trailNodeDot} ${progressPct >= pct ? styles.trailNodeDotPassed : ''}`}
                  style={{ left: `${pct}%` }}
                />
              ))}
            </div>

            {/* Runner character */}
            <div
              className={styles.trailRunner}
              style={{ left: `calc(20px + ${progressPct}% * (100% - 40px) / 100)` }}
              aria-hidden="true"
            >
              🏃
            </div>

            <div className={styles.trailDistLabel}>
              {activeRun.accumulatedMiles.toFixed(2)} / {activeRun.targetDistanceMiles.toFixed(1)} mi
            </div>
          </div>

          {/* Reward preview */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize:   '0.62rem',
            letterSpacing: '0.06em',
            color:      resMeta.color,
            padding:    'var(--sp-2) var(--sp-4)',
            background: `rgba(${resMeta.color}, 0.08)`,
            borderRadius: 'var(--r-sm)',
            border:     `1px solid ${resMeta.color}33`,
            textAlign:  'center',
          }}>
            Reward on completion: +{activeRun.resourceAmount} {activeRun.resourceYieldType}
          </div>

          {/* Log miles form */}
          <div className={styles.logForm}>
            <div className={styles.logField}>
              <label className={styles.logLabel} htmlFor="miles-input">
                Log Distance (mi)
              </label>
              <input
                id="miles-input"
                type="number"
                min={0.1}
                step={0.1}
                max={activeRun.targetDistanceMiles}
                className={styles.logInput}
                placeholder="e.g. 1.5"
                value={milesInput}
                onChange={e => setMilesInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleLogMiles() }}
              />
            </div>
            <button
              className={styles.logBtn}
              onClick={() => void handleLogMiles()}
              disabled={!milesInput || parseFloat(milesInput) <= 0 || logging}
            >
              {logging ? '...' : 'Log Miles'}
            </button>
          </div>

          {/* Progress result notice */}
          {lastResult && (
            <div className={`${styles.progressNotice} ${lastResult.completed ? styles.progressNoticeComplete : ''}`}>
              {lastResult.message}
              {lastResult.bonusDrops.length > 0 && (
                <div className={styles.noticeBonusDrop}>
                  ✦ Found along the trail: {lastResult.bonusDrops.map(d => `+${d.amount} ${d.resourceType}`).join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Abandon */}
          <button className={styles.abandonBtn} onClick={() => void abandonRun()}>
            Abandon Run
          </button>
        </div>
      </div>
    )
  }

  /* ── Trail selection view ────────────────────────────────── */
  const rewardClass = (res: ResourceType) =>
    res === 'Parchment Wood' ? styles.trailRewardPW :
    res === 'River Stones'   ? styles.trailRewardRS :
                               styles.trailRewardIO

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Choose a Trail</span>
        <span className={styles.panelTitle}>{completedRuns.length} completed</span>
      </div>

      <div className={styles.panelBody}>
        <div className={styles.trailList}>
          {TRAILS.map(trail => {
            const isSelected = selectedTrail?.name === trail.name
            const diffCls =
              trail.difficulty === 'Easy'     ? styles.diffEasy     :
              trail.difficulty === 'Moderate' ? styles.diffModerate :
                                                styles.diffHard
            return (
              <div
                key={trail.name}
                className={`${styles.trailCard} ${isSelected ? styles.trailCardSelected : ''}`}
                onClick={() => setSelectedTrail(isSelected ? null : trail)}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelectedTrail(isSelected ? null : trail) }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.trailName}>{trail.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--d-muted)', marginTop: '2px' }}>
                    {trail.description}
                  </div>
                </div>
                <div className={styles.trailMeta}>
                  <span className={`${styles.diffBadge} ${diffCls}`}>{trail.difficulty}</span>
                  <span className={styles.trailDist}>{trail.distanceMiles} mi</span>
                  <span className={`${styles.trailReward} ${rewardClass(trail.resourceYieldType)}`}>
                    +{trail.resourceAmount} {RESOURCE_META[trail.resourceYieldType].symbol}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <button
          className={styles.beginBtn}
          onClick={() => void handleBeginRun()}
          disabled={!selectedTrail}
        >
          {selectedTrail
            ? `[ Begin: ${selectedTrail.name} ]`
            : '[ Select a trail to begin ]'}
        </button>

        {/* Recent completions */}
        {completedRuns.length > 0 && (
          <div className={styles.runHistory}>
            <div className={styles.runHistoryTitle}>Recent Runs</div>
            {completedRuns.slice(0, 4).map(run => (
              <div key={run.id} className={styles.runHistoryRow}>
                <span className={styles.runHistoryName}>{run.trailName}</span>
                <span className={styles.runHistoryDist}>{run.targetDistanceMiles} mi</span>
                <span className={styles.runHistoryRes}>
                  +{run.resourceAmount} {RESOURCE_META[run.resourceYieldType].symbol}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Base panel ──────────────────────────────────────────────── */
function BasePanel() {
  const {
    inventory, baseState,
    nextUpgrade, canAffordUpgrade,
    purchaseBaseUpgrade,
  } = useCardioGame()

  const [lastUpgrade, setLastUpgrade] = useState<PurchaseResult | null>(null)

  const handleUpgrade = useCallback(async () => {
    const result = await purchaseBaseUpgrade()
    setLastUpgrade(result)
    if (!result.success) {
      setTimeout(() => setLastUpgrade(null), 4000)
    } else {
      setTimeout(() => setLastUpgrade(null), 5000)
    }
  }, [purchaseBaseUpgrade])

  if (!baseState) {
    return (
      <div className={styles.panel}>
        <div className={styles.emptyState}>Initialising base…</div>
      </div>
    )
  }

  const tierDef   = TIER_DEFINITIONS.find(t => t.tier === baseState.currentTier)!
  const isFinalTier = !tierDef.nextTier
  const isMaxSteps  = baseState.stepProgress >= tierDef.maxSteps
  const isFullyMaxed = isFinalTier && isMaxSteps

  /* Step progress pips */
  const totalPips = tierDef.maxSteps
  const filledPips = baseState.stepProgress

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Base Camp</span>
        <div style={{ display: 'flex', gap: '3px' }}>
          {Array.from({ length: totalPips }).map((_, i) => (
            <span
              key={i}
              className={`${styles.stepPip} ${i < filledPips ? styles.stepPipFilled : ''}`}
            />
          ))}
        </div>
      </div>

      <div className={styles.panelBody}>
        {/* Blueprint canvas */}
        <BaseBlueprintCanvas
          tier={baseState.currentTier}
          unlockedFeatures={baseState.unlockedFeatures}
          tierDef={tierDef}
        />

        {/* Inventory */}
        <div className={styles.inventoryRow}>
          {(['Parchment Wood', 'River Stones', 'Iron Ore'] as ResourceType[]).map(res => {
            const qtyCls =
              res === 'Parchment Wood' ? styles.inventoryQtyPW :
              res === 'River Stones'   ? styles.inventoryQtyRS :
                                         styles.inventoryQtyIO
            return (
              <div key={res} className={styles.inventoryItem}>
                <span className={`${styles.inventoryQty} ${qtyCls}`}>
                  {inventory[res]}
                </span>
                <span className={styles.inventoryName}>
                  {RESOURCE_META[res].label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Upgrade section */}
        {isFullyMaxed ? (
          <div className={styles.upgradeSection}>
            <div className={styles.upgradeMaxed}>
              ✦ YOUR BASE IS FULLY UPGRADED ✦
            </div>
          </div>
        ) : (
          <div className={styles.upgradeSection}>
            <div className={styles.upgradeTitle}>
              {isMaxSteps ? 'Tier Upgrade Available' : 'Next Enhancement'}
            </div>

            {nextUpgrade && (
              <>
                <div className={styles.upgradeLabel}>{nextUpgrade.label}</div>

                <div className={styles.upgradeCosts}>
                  {Object.entries(nextUpgrade.costs).map(([res, amt]) => (
                    <CostChip
                      key={res}
                      res={res as ResourceType}
                      amount={amt ?? 0}
                      have={inventory[res as ResourceType] ?? 0}
                    />
                  ))}
                </div>

                {lastUpgrade && (
                  <div className={styles.upgradeNotice}>
                    {lastUpgrade.success
                      ? lastUpgrade.tierUpgraded
                        ? `✦ Base upgraded to ${lastUpgrade.newTier?.replace('_', ' ')}!`
                        : `✦ ${lastUpgrade.featureUnlocked} constructed!`
                      : `✗ ${lastUpgrade.reason}`}
                  </div>
                )}

                <button
                  className={`${styles.upgradeBtn} ${nextUpgrade.isTierUpgrade ? styles.upgradeBtnTier : ''}`}
                  onClick={() => void handleUpgrade()}
                  disabled={!canAffordUpgrade}
                >
                  {canAffordUpgrade
                    ? `[ Build — ${nextUpgrade.label} ]`
                    : '[ Gather more resources ]'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   CardioGameDashboard — root component
   ════════════════════════════════════════════════════════════════ */

export default function CardioGameDashboard() {
  const { inventory, baseState, isLoading, RESOURCE_META: rm } = useCardioGame()

  if (isLoading) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.emptyState}>Initialising trail system…</div>
      </div>
    )
  }

  const tierDef = TIER_DEFINITIONS.find(t => t.tier === (baseState?.currentTier ?? 'CAMPSITE'))!

  return (
    <div className={styles.dashboard}>

      {/* ── Header: tier + inventory ──────────────────────── */}
      <div className={styles.gameHeader}>
        <span className={styles.tierBadge}>{tierDef.symbol}</span>

        <div className={styles.headerInventory}>
          {(['Parchment Wood', 'River Stones', 'Iron Ore'] as const).map(res => {
            const meta   = rm[res]
            const symCls =
              res === 'Parchment Wood' ? styles.resParchment :
              res === 'River Stones'   ? styles.resStone :
                                         styles.resIron
            return (
              <div key={res} className={styles.headerResource}>
                <span className={`${styles.resSymbol} ${symCls}`}>{meta.symbol}</span>
                <span className={styles.resQty}>{inventory[res]}</span>
              </div>
            )
          })}
        </div>

        <span className={styles.headerSpacer} />
        <span className={styles.headerMeta}>
          Step {baseState?.stepProgress ?? 0} / {tierDef.maxSteps}
        </span>
      </div>

      {/* ── Two-column game grid ──────────────────────────── */}
      <div className={styles.gameLayout}>
        <TrailPanel />
        <BasePanel />
      </div>

    </div>
  )
}
