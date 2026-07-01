'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * GamesTabShell — Step 2.1
 * 4th Navigation Element · Split-Screen Shell Layout
 *
 * Asymmetric dual-pane viewport shell:
 *   Left  (40 %) — BiospherePane: live biosphere display area
 *                  + real-time resource inventory ticker
 *   Right (60 %) — ArcadePane: game carousel + Crucible, Upgrades,
 *                  Codex tabs
 *
 * Slot architecture:
 *   Every content region exposes a typed prop slot. When a slot is
 *   not provided the shell renders a styled placeholder. Subsequent
 *   step components are dropped in by passing the slot prop — no
 *   layout rewiring required.
 *
 * Transitions:
 *   All layout shifts, tab switches, and pane toggles use the spring
 *   curve cubic-bezier(0.25,1,0.5,1) at 500 ms to guarantee liquid
 *   motion consistent with Zenith's motion system.
 * ════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useLiveQuery }              from 'dexie-react-hooks'
import { useZenithEconomy }          from '@/hooks/useZenithEconomy'
import { useCosmicCrucible }         from '@/hooks/useCosmicCrucible'
import { useZenithStorageUpgrades, type UpgradeMatrixNode } from '@/hooks/useZenithStorageUpgrades'
import { useSkillTreeActions }       from '@/hooks/useSkillTreeActions'
import { CRUCIBLE_RECIPES }          from '@/lib/engines/CosmicCrucibleEngine'
import { SKILL_TREE_MAP }            from '@/lib/engines/SkillTreeFirewall'
import { RESOURCE_IDS, RESOURCE_META, type ResourceId, gamesDb, purchaseTheme, setActiveTheme, purchaseBackground, grantBackground, equipBackground, purchasePerk } from '@/lib/gamesDb'
import { PACK_BACKGROUND_GRANTS } from '@/lib/shopCatalog'
import { SHOP_BACKGROUND_PRESETS, resolveShopBackground } from '@/lib/shopBackgrounds'
import { THEME_DEFINITIONS } from '@/lib/themeDefinitions'
import SkillTreeCanvas, { type SkillTreeNode } from '@/components/games/skills/SkillTreeCanvas'
import { peekRequestedTab, consumeRequestedTab, subscribeGamesTab } from '@/lib/gamesNavState'
import { SHOP_CATALOG_STATIC, type ShopCatalogItem } from '@/lib/shopCatalog'
import { CUSTOM_THEME_ID }           from '@/lib/customTheme'
import { setPreviewId, clearPreview, subscribePreview, getPreviewId } from '@/lib/themePreview'
import { setBgPreviewId, clearBgPreview, subscribeBgPreview, getBgPreviewId } from '@/lib/bgPreview'
import { useNav }                    from '@/lib/NavContext'
import styles from './GamesTabShell.module.css'

/* ── Module-level constants ─────────────────────────────────────── */

/** Resources that can be upgraded (cosmetic_points has null/infinite capacity). */
const UPGRADEABLE_IDS: readonly ResourceId[] = [
  'raw_data_shards',
  'organic_spores',
  'cosmic_dust',
  'quantum_fuel',
  'stardust_glass',
] as const

/* ── Cosmetic Shop catalog: sourced from lib/shopCatalog.ts ─── */
type ShopItem = ShopCatalogItem
const SHOP_CATALOG = SHOP_CATALOG_STATIC

/* ════════════════════════════════════════════════════════════════
   §1  PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

/** Right-pane navigation tabs. */
export type GamesRightTab = 'arcade' | 'crucible' | 'upgrades' | 'skills' | 'shop'

/** Left-pane biosphere station selector. */
export type BiosphereStation = 'terminal' | 'aquarium' | 'zoo'

/**
 * Content slot props for GamesTabShell.
 *
 * Every slot is optional — when omitted the shell renders a
 * type-matched placeholder that preserves the layout geometry.
 * Pass a slot prop to replace its placeholder with a real component.
 */
export interface GamesTabShellSlots {
  /**
   * Left pane · BiosphereStation viewport.
   * Drop in the live biosphere display component here.
   * Selected station type (terminal | aquarium | zoo) is passed
   * to the biosphere station sub-selector — components can read
   * it from `activeStation` if rendered via `biosphereContent`.
   */
  biosphereContent?: React.ReactNode

  /**
   * Right pane · Arcade Core tab.
   * Receives the game carousel / selection grid.
   */
  arcadeContent?: React.ReactNode

  /**
   * Right pane · Crucible tab.
   * When provided, fully replaces the built-in Crucible mini-panel.
   * When absent, the shell renders a live job-list from
   * `useCosmicCrucible` so the tab is useful immediately.
   */
  crucibleContent?: React.ReactNode

  /**
   * Right pane · Upgrades tab.
   * Receives the storage upgrade purchase interface.
   */
  upgradesContent?: React.ReactNode
}

/* ════════════════════════════════════════════════════════════════
   §2  STATIC CONFIG
   ════════════════════════════════════════════════════════════════ */

interface RightTabMeta {
  id: GamesRightTab
  label: string
  icon: string
}

const RIGHT_TABS: RightTabMeta[] = [
  { id: 'arcade',   label: 'Arcade',   icon: '⬡' },
  { id: 'crucible', label: 'Crucible', icon: '◈' },
  { id: 'upgrades', label: 'Storage',  icon: '↑' },
  { id: 'skills',   label: 'Skills',   icon: '⟡' },
  { id: 'shop',     label: 'Shop',     icon: '✦' },
]

interface StationMeta {
  id: BiosphereStation
  label: string
}

const STATIONS: StationMeta[] = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'aquarium', label: 'Aquarium' },
  { id: 'zoo',      label: 'Zoo' },
]

/* ════════════════════════════════════════════════════════════════
   §3  INTERNAL SUB-COMPONENTS
   ════════════════════════════════════════════════════════════════ */

/* ── Resource inventory ticker ──────────────────────────────────
   Renders all six resources from the live economy hook with a
   proportional fill bar for capped resources.                    */

function ResourceTicker() {
  const { resources, isAtCapacity } = useZenithEconomy()

  return (
    <div className={styles.resourceSection}>
      <p className={styles.resourceSectionTitle}>Inventory</p>
      <div className={styles.resourceGrid}>
        {RESOURCE_IDS.map(id => {
          const node = resources[id]
          const meta = RESOURCE_META[id]
          const atCap = isAtCapacity(id)
          const isInfinite = meta.maxCapacity === null

          const fillPct = isInfinite || !node
            ? 0
            : Math.round((node.balance / meta.maxCapacity!) * 100)

          const dotClass =
            meta.category === 'raw'      ? styles.resourceDotRaw
            : meta.category === 'refined' ? styles.resourceDotRefined
            : styles.resourceDotCurrency

          return (
            <div
              key={id}
              className={`${styles.resourceRow} ${atCap ? styles.resourceAtCap : ''}`}
            >
              {/* Colour-coded category dot */}
              <span className={`${styles.resourceDot} ${dotClass}`} aria-hidden="true" />

              {/* Name */}
              <span className={styles.resourceName} title={meta.name}>
                {meta.name}
              </span>

              {/* Balance */}
              <span className={styles.resourceBalance}>
                {node?.balance.toLocaleString() ?? '—'}
                {!isInfinite && (
                  <span style={{ color: 'var(--text-dark)', fontWeight: 400 }}>
                    /{meta.maxCapacity!.toLocaleString()}
                  </span>
                )}
              </span>

              {/* Capacity bar or infinity indicator */}
              {isInfinite ? (
                <div className={styles.resourceInfinite}>∞</div>
              ) : (
                <div className={styles.resourceBarTrack}>
                  <div
                    className={styles.resourceBarFill}
                    style={{ '--fill-pct': `${fillPct}%` } as React.CSSProperties}
                    role="progressbar"
                    aria-valuenow={fillPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${meta.name} capacity`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Biosphere viewport placeholder ─────────────────────────────
   Shown in the left pane when no `biosphereContent` slot is
   passed. Communicates what will render here and which station
   type is currently selected.                                    */

function BiospherePlaceholder({ station }: { station: BiosphereStation }) {
  const glyphs: Record<BiosphereStation, string> = {
    terminal: '◧',
    aquarium: '〰',
    zoo:      '◉',
  }
  const descriptions: Record<BiosphereStation, string> = {
    terminal: 'Command interface feeds from the data nexus.',
    aquarium: 'Living aquatic ecosystem with real-time parameters.',
    zoo:      'Habitat grid — resident species telemetry incoming.',
  }

  return (
    <div className={styles.placeholder} role="status" aria-label={`${station} station awaiting signal`}>
      <div className={styles.placeholderGlyph} aria-hidden="true">
        {glyphs[station]}
      </div>
      <p className={styles.placeholderTitle}>Awaiting Signal</p>
      <p className={styles.placeholderDesc}>{descriptions[station]}</p>
    </div>
  )
}

/* ── Arcade placeholder ─────────────────────────────────────────
   Shown on the Arcade tab when no `arcadeContent` slot is passed. */

function ArcadePlaceholder() {
  return (
    <div className={styles.placeholder} role="status">
      <div className={styles.placeholderGlyph} aria-hidden="true">⬡</div>
      <p className={styles.placeholderTitle}>Game Modules Loading</p>
      <p className={styles.placeholderDesc}>
        The arcade carousel initialises here. Select a game terminal to deploy.
      </p>
    </div>
  )
}

/* ── Cosmetic Shop Panel ────────────────────────────────────────
   Browse and purchase themes + packs using ✦ Cosmetic Points.    */

function ShopPanel() {
  const { cosmeticPoints } = useZenithEconomy()
  const profile = useLiveQuery(
    () => gamesDb.user_profile_config.get('active_user'),
    [],
  )
  const { navigate } = useNav()
  const [catFilter, setCatFilter]   = useState<'all' | 'theme' | 'pack' | 'background' | 'perk'>('all')
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [activating, setActivating] = useState<string | null>(null)
  const [equipping,  setEquipping]  = useState<string | null>(null)
  const [shopMsg, setShopMsg]       = useState<{ text: string; ok: boolean } | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(getPreviewId())
  const [bgPreviewing, setBgPreviewing] = useState<string | null>(getBgPreviewId())

  useEffect(() => subscribePreview(setPreviewing), [])
  useEffect(() => subscribeBgPreview(setBgPreviewing), [])
  // Never let a preview outlive the shop view.
  useEffect(() => () => { clearPreview(); clearBgPreview() }, [])

  const togglePreview   = (id: string) => setPreviewId(previewing === id ? null : id)
  const toggleBgPreview = (id: string) => setBgPreviewId(bgPreviewing === id ? null : id)

  const ownedThemes  = useMemo(() => new Set(profile?.purchasedThemes  ?? ['zenith_default']), [profile])
  const ownedBgs     = useMemo(() => new Set(profile?.purchasedBackgrounds ?? []),              [profile])
  const unlockedPerks = useMemo(() => new Set(profile?.unlockedPerks ?? []),                   [profile])
  const activeThemeId = profile?.activeTheme      ?? 'zenith_default'
  const activeBgId    = profile?.activeBackground ?? null

  /* Compute accent + bg hex for inline background swatches */
  const accentHex = useMemo(() => {
    const def = THEME_DEFINITIONS[activeThemeId]
    return def?.swatch ?? '#68d9a0'
  }, [activeThemeId])
  const bgHex = useMemo(() => {
    const def = THEME_DEFINITIONS[activeThemeId]
    return (def?.vars as Record<string, string> | undefined)?.['--bg-main'] ?? '#0b0d13'
  }, [activeThemeId])
  const streakSavers  = profile?.streakSaverCount ?? 0

  const filtered = catFilter === 'all'
    ? SHOP_CATALOG_STATIC
    : SHOP_CATALOG_STATIC.filter(i => i.category === catFilter)

  const handlePurchaseTheme = async (item: ShopCatalogItem) => {
    setPurchasing(item.id)
    const result = await purchaseTheme(item.id, item.cost)
    setPurchasing(null)
    if (!result.ok) {
      setShopMsg({ text: result.reason ?? 'Purchase failed.', ok: false })
    } else {
      // If it's a pack, also grant its bundled background
      const bgGrant = PACK_BACKGROUND_GRANTS[item.id]
      if (bgGrant) await grantBackground(bgGrant)
      setShopMsg({ text: `${item.name} unlocked!`, ok: true })
    }
    setTimeout(() => setShopMsg(null), 3_500)
  }

  const handlePurchaseBackground = async (item: ShopCatalogItem) => {
    setPurchasing(item.id)
    const result = await purchaseBackground(item.id, item.cost)
    setPurchasing(null)
    if (!result.ok) {
      setShopMsg({ text: result.reason ?? 'Purchase failed.', ok: false })
    } else {
      setShopMsg({ text: `${item.name} unlocked!`, ok: true })
    }
    setTimeout(() => setShopMsg(null), 3_500)
  }

  const handlePurchasePerk = async (item: ShopCatalogItem) => {
    // Streak savers grant 5 or 15; analytics vault grants 0 (permanent unlock)
    const grantCount = item.id === 'perk_streak_saver_5' ? 5 : item.id === 'perk_streak_saver_15' ? 15 : 0
    setPurchasing(item.id)
    const result = await purchasePerk(item.id, item.cost, grantCount)
    setPurchasing(null)
    if (!result.ok) {
      setShopMsg({ text: result.reason ?? 'Purchase failed.', ok: false })
    } else if (grantCount > 0) {
      setShopMsg({ text: `+${grantCount} Streak Savers added! Total: ${streakSavers + grantCount}`, ok: true })
    } else {
      setShopMsg({ text: `${item.name} unlocked!`, ok: true })
    }
    setTimeout(() => setShopMsg(null), 3_500)
  }

  const handleActivate = async (themeId: string) => {
    setActivating(themeId)
    await setActiveTheme(themeId)
    setActivating(null)
  }

  const handleEquipBackground = async (bgId: string | null) => {
    if (bgId) setEquipping(bgId)
    await equipBackground(bgId)
    setEquipping(null)
  }

  const CAT_LABELS: Record<string, string> = {
    all: 'All Items', theme: 'Themes', pack: 'Packs', background: 'Backgrounds', perk: 'Perks',
  }

  /* When a background is being previewed, flood the shop panel's own background
     with that pattern so the user sees it in context (the per-card swatch shows
     a thumbnail; this shows it full-bleed behind the grid). */
  const shopPreviewSpec = bgPreviewing
    ? resolveShopBackground(bgPreviewing, accentHex, bgHex)
    : null

  return (
    <div
      className={styles.shopRoot}
      style={shopPreviewSpec ? {
        backgroundImage:  shopPreviewSpec.image,
        backgroundSize:   shopPreviewSpec.size,
        backgroundRepeat: shopPreviewSpec.repeat,
      } : undefined}
    >
      {/* ── Balance header ─────────────────────────────── */}
      <div className={styles.shopHeader}>
        <div>
          <p className={styles.sectionHeading}>Cosmetic Shop</p>
          <p className={styles.shopSubtitle}>
            Spend ✦ Credits on themes, backgrounds, packs, and perks.
          </p>
        </div>
        <div className={styles.shopBalanceChip}>
          <span className={styles.shopBalanceIcon}>✦</span>
          <span className={styles.shopBalanceValue}>{cosmeticPoints.toLocaleString()}</span>
        </div>
      </div>

      {/* ── Category filter ────────────────────────────── */}
      <div className={styles.shopCatBar}>
        {(['all', 'theme', 'pack', 'background', 'perk'] as const).map(cat => (
          <button
            key={cat}
            className={`${styles.shopCatBtn} ${catFilter === cat ? styles.shopCatBtnActive : ''}`}
            onClick={() => setCatFilter(cat)}
          >
            {CAT_LABELS[cat]}
          </button>
        ))}
      </div>

      {shopMsg && (
        <p className={`${styles.shopMsg} ${shopMsg.ok ? styles.shopMsgOk : styles.shopMsgErr}`}>
          {shopMsg.text}
        </p>
      )}

      {/* ── Item grid ──────────────────────────────────── */}
      <div className={styles.shopGrid}>
        {filtered.map(item => {
          const isThemeOrPack = item.category === 'theme' || item.category === 'pack'
          const isBg   = item.category === 'background'
          const isPerk = item.category === 'perk'

          // bg_default is the baseline texture: always owned, equipped when
          // no shop background is active, and "equipping" it clears the override.
          const isDefaultBg = item.id === 'bg_default'

          /* Ownership / equipped state per category */
          const owned    = isThemeOrPack ? ownedThemes.has(item.id)
                         : isBg          ? (isDefaultBg || ownedBgs.has(item.id))
                         :                  unlockedPerks.has(item.id)
          const equipped = isThemeOrPack ? activeThemeId === item.id
                         : isBg          ? (isDefaultBg ? !activeBgId : activeBgId === item.id)
                         :                  false
          // Streak savers are always re-purchasable
          const isRepurchasable = item.id === 'perk_streak_saver_5' || item.id === 'perk_streak_saver_15'
          const canBuy   = !owned || isRepurchasable
          const canAfford = cosmeticPoints >= item.cost
          const isProcessing = purchasing === item.id || activating === item.id || equipping === item.id

          /* Inline pattern swatch for background items */
          const bgSpec = isBg ? resolveShopBackground(item.id, accentHex, bgHex) : null

          return (
            <div
              key={item.id}
              className={[
                styles.shopCard,
                owned    ? styles.shopCardOwned    : '',
                equipped ? styles.shopCardEquipped : '',
              ].join(' ')}
            >
              {item.tag && (
                <span className={styles.shopTag}>{item.tag}</span>
              )}

              {bgSpec ? (
                <div
                  className={styles.shopBgSwatch}
                  style={{
                    backgroundImage:  bgSpec.image,
                    backgroundSize:   bgSpec.size,
                    backgroundRepeat: bgSpec.repeat,
                  }}
                />
              ) : (
                <div className={styles.shopCardIcon}>{item.icon}</div>
              )}
              <p className={styles.shopCardName}>{item.name}</p>
              <p className={styles.shopCardTagline}>{item.tagline}</p>

              {/* Streak saver count chip */}
              {item.id === 'perk_streak_saver_5' && streakSavers > 0 && (
                <p className={styles.shopPerkBalance}>🔥 {streakSavers} saved</p>
              )}

              <div className={styles.shopCardFooter}>
                {/* Theme / pack actions */}
                {isThemeOrPack && (
                  equipped ? (
                    <span className={styles.shopEquippedLabel}>✓ Equipped</span>
                  ) : owned && item.id === CUSTOM_THEME_ID ? (
                    <button
                      className={styles.shopEquipBtn}
                      onClick={() => navigate('settings', null)}
                    >
                      Customize →
                    </button>
                  ) : owned ? (
                    <button
                      className={styles.shopEquipBtn}
                      onClick={() => void handleActivate(item.id)}
                      disabled={isProcessing}
                    >
                      {activating === item.id ? '···' : 'Equip'}
                    </button>
                  ) : (
                    <button
                      className={`${styles.shopBuyBtn} ${!canAfford ? styles.shopBuyBtnLocked : ''}`}
                      onClick={() => void handlePurchaseTheme(item)}
                      disabled={!canAfford || isProcessing}
                      title={!canAfford ? `Need ${item.cost - cosmeticPoints} more ✦` : undefined}
                    >
                      {purchasing === item.id ? '···' : (
                        <><span className={styles.shopBuyIcon}>✦</span>{item.cost === 0 ? 'Free' : item.cost.toLocaleString()}</>
                      )}
                    </button>
                  )
                )}

                {/* Background actions */}
                {isBg && (
                  owned ? (
                    equipped ? (
                      <span className={styles.shopEquippedLabel}>✓ Equipped</span>
                    ) : (
                      <button
                        className={styles.shopEquipBtn}
                        onClick={() => void handleEquipBackground(isDefaultBg ? null : item.id)}
                        disabled={isProcessing}
                      >
                        {equipping === item.id ? '···' : 'Equip'}
                      </button>
                    )
                  ) : (
                    <button
                      className={`${styles.shopBuyBtn} ${!canAfford ? styles.shopBuyBtnLocked : ''}`}
                      onClick={() => void handlePurchaseBackground(item)}
                      disabled={!canAfford || isProcessing}
                      title={!canAfford ? `Need ${item.cost - cosmeticPoints} more ✦` : undefined}
                    >
                      {purchasing === item.id ? '···' : (
                        <><span className={styles.shopBuyIcon}>✦</span>{item.cost.toLocaleString()}</>
                      )}
                    </button>
                  )
                )}

                {/* Perk actions */}
                {isPerk && (
                  owned && !isRepurchasable ? (
                    <span className={styles.shopEquippedLabel}>✓ Unlocked</span>
                  ) : (
                    <button
                      className={`${styles.shopBuyBtn} ${!canAfford ? styles.shopBuyBtnLocked : ''}`}
                      onClick={() => void handlePurchasePerk(item)}
                      disabled={!canAfford || isProcessing}
                      title={!canAfford ? `Need ${item.cost - cosmeticPoints} more ✦` : undefined}
                    >
                      {purchasing === item.id ? '···' : (
                        <><span className={styles.shopBuyIcon}>✦</span>{item.cost.toLocaleString()}</>
                      )}
                    </button>
                  )
                )}

                {/* Theme / pack preview */}
                {isThemeOrPack && (
                  <button
                    type="button"
                    className={`${styles.shopPreviewBtn} ${previewing === item.id ? styles.shopPreviewBtnOn : ''}`}
                    onClick={() => togglePreview(item.id)}
                  >
                    {previewing === item.id ? '■ Stop' : '◉ Preview'}
                  </button>
                )}

                {/* Background preview (not for the baseline default) */}
                {isBg && !isDefaultBg && (
                  <button
                    type="button"
                    className={`${styles.shopPreviewBtn} ${bgPreviewing === item.id ? styles.shopPreviewBtnOn : ''}`}
                    onClick={() => toggleBgPreview(item.id)}
                  >
                    {bgPreviewing === item.id ? '■ Stop' : '◉ Preview'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Skills Panel ────────────────────────────────────────────────
   Interactive skill tree — unlock nodes to boost game rewards.   */

function SkillsPanel() {
  const { unlockedNodeIds, isLoading, executeNodeUnlock, getNodeLockReason } = useSkillTreeActions()
  const { resources } = useZenithEconomy()
  const [selectedNode, setSelectedNode] = useState<SkillTreeNode | null>(null)
  const [unlocking,    setUnlocking]    = useState(false)
  const [skillMsg,     setSkillMsg]     = useState<{ text: string; ok: boolean } | null>(null)

  const handleNodeClick = useCallback((node: SkillTreeNode) => {
    setSelectedNode(node)
    setSkillMsg(null)
  }, [])

  const handleUnlock = useCallback(async () => {
    if (!selectedNode) return
    setUnlocking(true)
    const result = await executeNodeUnlock(selectedNode.id)
    setUnlocking(false)
    if (result.success) {
      setSkillMsg({ text: `${selectedNode.label} unlocked!`, ok: true })
    } else {
      const msgs: Record<string, string> = {
        PREREQUISITE_LOCKED:  'Prerequisites not yet met.',
        INSUFFICIENT_FUNDS:   'Insufficient resources.',
        ALREADY_UNLOCKED:     'Already unlocked.',
        NODE_NOT_FOUND:       'Node not found.',
      }
      setSkillMsg({ text: msgs[result.error ?? ''] ?? 'Unlock failed.', ok: false })
    }
    setTimeout(() => setSkillMsg(null), 3_500)
  }, [selectedNode, executeNodeUnlock])

  const lockReason = selectedNode ? getNodeLockReason(selectedNode.id) : null
  const nodeDef    = selectedNode ? SKILL_TREE_MAP.get(selectedNode.id) : null

  if (isLoading) {
    return (
      <div className={styles.skillsLoading}>
        <span>Initialising skill tree…</span>
      </div>
    )
  }

  return (
    <div className={styles.skillsWrap}>
      <SkillTreeCanvas
        unlockedNodeIds={[...unlockedNodeIds]}
        onNodeClick={handleNodeClick}
      />

      {selectedNode && (
        <div className={styles.skillNodeDetail}>
          <div className={styles.skillNodeInfo}>
            <p className={styles.skillNodeName}>{selectedNode.label}</p>
            <p className={styles.skillNodeDesc}>{selectedNode.description}</p>
            {nodeDef && lockReason !== 'ALREADY_UNLOCKED' && (
              <div className={styles.skillCostRow}>
                {nodeDef.costs.map(cost => {
                  const bal = resources[cost.resourceId as ResourceId]?.balance ?? 0
                  const met = bal >= cost.amount
                  return (
                    <span
                      key={cost.resourceId}
                      className={`${styles.skillCostChip} ${met ? styles.skillCostChipMet : ''}`}
                    >
                      {cost.amount.toLocaleString()}
                      {' '}{RESOURCE_META[cost.resourceId as ResourceId]?.name ?? cost.resourceId}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          <div className={styles.skillNodeActions}>
            {lockReason === 'ALREADY_UNLOCKED' ? (
              <span className={styles.skillUnlockedBadge}>✓ Unlocked</span>
            ) : lockReason === 'READY' ? (
              <button
                className={styles.skillUnlockBtn}
                onClick={() => void handleUnlock()}
                disabled={unlocking}
              >
                {unlocking ? '···' : 'Unlock'}
              </button>
            ) : (
              <span className={styles.skillLockedLabel}>
                {lockReason === 'PREREQUISITE_LOCKED' ? 'Prerequisites needed' : 'Need more resources'}
              </span>
            )}
            {skillMsg && (
              <span className={skillMsg.ok ? styles.skillMsgOk : styles.skillMsgErr}>
                {skillMsg.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Full Crucible Panel ────────────────────────────────────────
   Shows all 5 recipes with Queue buttons + active job list.
   Replaces the old read-only mini-panel.                         */

function CruciblePanel() {
  const { resources }                                           = useZenithEconomy()
  const { activeJobs, startTransmutation, claimCompletedJob, getRemainingTime } = useCosmicCrucible()
  const [submitting,   setSubmitting]   = useState<string | null>(null)
  const [queueErrors,  setQueueErrors]  = useState<Record<string, string>>({})

  const fmtRemaining = (s: number): string => {
    if (s <= 0) return 'READY'
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
    return `${m}m ${String(sec).padStart(2, '0')}s`
  }

  const fmtDuration = (s: number): string =>
    s >= 3600 ? `${s / 3600}h` : `${s / 60}m`

  const handleQueue = async (recipeId: string) => {
    setSubmitting(recipeId)
    const result = await startTransmutation(recipeId)
    setSubmitting(null)
    if (!result.success && result.error) {
      setQueueErrors(prev => ({ ...prev, [recipeId]: result.error! }))
      setTimeout(() => setQueueErrors(prev => {
        const next = { ...prev }
        delete next[recipeId]
        return next
      }), 3_500)
    }
  }

  const recipes = Object.values(CRUCIBLE_RECIPES)

  return (
    <div className={styles.cruciblePanel}>

      {/* ── Recipe submission cards ─────────────────────── */}
      <div className={styles.panelSection}>
        <p className={styles.sectionHeading}>Transmutation Recipes</p>
        <div className={styles.recipeGrid}>
          {recipes.map(recipe => {
            const node       = resources[recipe.inputResourceId]
            const balance    = node?.balance ?? 0
            const canAfford  = balance >= recipe.inputAmount
            const job        = activeJobs.find(j => j.recipeId === recipe.recipeId)
            const isProc     = job?.status === 'processing'
            const isReady    = job?.status === 'completed'
            const remaining  = job ? getRemainingTime(job.id) : 0
            const err        = queueErrors[recipe.recipeId]
            const isActive   = isProc || isReady

            return (
              <article
                key={recipe.recipeId}
                className={[
                  styles.recipeCard,
                  isActive          ? styles.recipeCardActive  : '',
                  !canAfford && !job ? styles.recipeCardDimmed : '',
                ].join(' ')}
              >
                {/* Status dot */}
                <div
                  className={[
                    styles.recipeStatusDot,
                    isReady ? styles.recipeStatusDotReady
                    : isProc  ? styles.recipeStatusDotProcessing
                    :           styles.recipeStatusDotIdle,
                  ].join(' ')}
                  aria-hidden="true"
                />

                {/* Recipe info */}
                <div className={styles.recipeInfo}>
                  <p className={styles.recipeName}>{recipe.displayName}</p>
                  <p className={[
                    styles.recipeMeta,
                    isReady ? styles.recipeMetaReady : isProc ? styles.recipeMetaProcessing : '',
                  ].join(' ')}>
                    {isReady
                      ? `+${recipe.outputAmount} ✦ ready to claim`
                      : isProc
                      ? `${fmtRemaining(remaining)} remaining`
                      : `${recipe.inputAmount.toLocaleString()} ${node?.name ?? recipe.inputResourceId} → +${recipe.outputAmount} ✦ · ${fmtDuration(recipe.durationSeconds)}`
                    }
                  </p>
                  {err && <span className={styles.recipeMetaError}>{err}</span>}
                </div>

                {/* Balance indicator — only when idle */}
                {!job && (
                  <span className={[
                    styles.recipeBalance,
                    !canAfford ? styles.recipeBalanceLow : '',
                  ].join(' ')}>
                    {balance.toLocaleString()}
                    <span style={{ color: 'var(--text-dark)', fontWeight: 400 }}>
                      /{recipe.inputAmount.toLocaleString()}
                    </span>
                  </span>
                )}

                {/* Action */}
                {isReady ? (
                  <button
                    className={styles.jobClaimBtn}
                    onClick={() => void claimCompletedJob(job!.id)}
                    aria-label={`Claim ${recipe.outputAmount} ✦`}
                  >
                    Claim
                  </button>
                ) : isProc ? (
                  <span className={styles.processingBadge}>Processing</span>
                ) : (
                  <button
                    className={styles.queueBtn}
                    onClick={() => void handleQueue(recipe.recipeId)}
                    disabled={!canAfford || submitting === recipe.recipeId}
                    aria-label={`Queue ${recipe.displayName}`}
                  >
                    {submitting === recipe.recipeId ? '···' : 'Queue'}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      </div>

      {/* ── Active jobs summary (only when jobs exist) ───── */}
      {activeJobs.length > 0 && (
        <div>
          <p className={styles.cruciblePanelHeading}>
            Active — {activeJobs.length} job{activeJobs.length !== 1 ? 's' : ''}
          </p>
          <div className={styles.jobGrid}>
            {activeJobs.map(job => {
              const recipe    = CRUCIBLE_RECIPES[job.recipeId]
              const remaining = getRemainingTime(job.id)
              const isReady   = job.status === 'completed' || remaining === 0
              return (
                <article key={job.id} className={styles.jobCard}>
                  <div
                    className={`${styles.jobStatusDot} ${isReady ? styles.jobStatusCompleted : styles.jobStatusProcessing}`}
                    aria-hidden="true"
                  />
                  <div className={styles.jobInfo}>
                    <p className={styles.jobRecipe}>{recipe?.displayName ?? job.recipeId}</p>
                    <p className={`${styles.jobTimer} ${isReady ? styles.jobTimerReady : ''}`}>
                      {isReady ? `+${recipe?.outputAmount ?? '?'} ✦ ready` : `Completes in ${fmtRemaining(remaining)}`}
                    </p>
                  </div>
                  {isReady && (
                    <button
                      className={styles.jobClaimBtn}
                      onClick={() => void claimCompletedJob(job.id)}
                    >
                      Claim
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Storage Upgrade Panel ──────────────────────────────────────── */

function UpgradesPanel() {
  const { resources }                                             = useZenithEconomy()
  const { getUpgradeMatrix, purchaseStorageUpgrade }              = useZenithStorageUpgrades()
  const [matrices,     setMatrices]     = useState<Record<string, UpgradeMatrixNode | null>>({})
  const [upgrading,    setUpgrading]    = useState<string | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)

  /* Reload matrix data whenever any resource balance/capacity changes. */
  useEffect(() => {
    const load = async () => {
      const entries = await Promise.all(
        UPGRADEABLE_IDS.map(async id => [id, await getUpgradeMatrix(id)] as const),
      )
      setMatrices(Object.fromEntries(entries))
    }
    void load()
  // getUpgradeMatrix is stable (useCallback []); resources is the true dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources])

  const handleUpgrade = async (resourceId: string) => {
    setUpgrading(resourceId)
    setUpgradeError(null)
    const result = await purchaseStorageUpgrade(resourceId)
    setUpgrading(null)
    if (!result.success && result.error) {
      setUpgradeError(result.error)
      setTimeout(() => setUpgradeError(null), 4_000)
    }
  }

  /* True once the first async load resolves (matrices has at least one key). */
  const loaded = Object.keys(matrices).length > 0

  /* Inventory summary (merged from the former Codex tab). */
  const cpNode         = resources['cosmetic_points']
  const totalHarvested = RESOURCE_IDS
    .filter(id => RESOURCE_META[id].isHarvested)
    .reduce((sum, id) => sum + (resources[id]?.totalEarnedLifetime ?? 0), 0)

  return (
    <div>
      {/* ── Inventory: live resource balances ─────────────── */}
      <div className={styles.codexSummary}>
        <div className={styles.codexSummaryStat}>
          <p className={styles.codexSummaryLabel}>✦ Balance</p>
          <p className={styles.codexSummaryValue}>
            {(cpNode?.balance ?? 0).toLocaleString()}
          </p>
        </div>
        <div className={styles.codexSummaryStat}>
          <p className={styles.codexSummaryLabel}>✦ Total Earned</p>
          <p className={styles.codexSummaryValue}>
            {(cpNode?.totalEarnedLifetime ?? 0).toLocaleString()}
          </p>
        </div>
        <div className={styles.codexSummaryStat}>
          <p className={styles.codexSummaryLabel}>Resources Harvested</p>
          <p className={styles.codexSummaryValue}>
            {totalHarvested.toLocaleString()}
          </p>
        </div>
      </div>

      <p className={styles.sectionHeading}>Inventory</p>

      <div className={styles.codexColHeader}>
        <span />
        <span />
        <span className={styles.codexColHeaderLabel}>Balance</span>
        <span className={styles.codexColHeaderLabel}>Lifetime</span>
      </div>

      <div className={styles.codexTable}>
        {RESOURCE_IDS.map(id => {
          const node = resources[id]
          const meta = RESOURCE_META[id]
          const dotClass =
            meta.category === 'raw'      ? styles.resourceDotRaw
            : meta.category === 'refined' ? styles.resourceDotRefined
            : styles.resourceDotCurrency

          return (
            <div key={id} className={styles.codexRow}>
              <span className={`${styles.resourceDot} ${dotClass}`} aria-hidden="true" />
              <span className={styles.codexRowLabel}>{meta.name}</span>
              <span className={styles.codexRowCurrent}>
                {(node?.balance ?? 0).toLocaleString()}
              </span>
              <span className={styles.codexRowLifetime}>
                {(node?.totalEarnedLifetime ?? 0).toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── Storage capacity upgrades ─────────────────────── */}
      <p className={styles.sectionHeading} style={{ marginTop: 'var(--sp-6)' }}>Storage Expansion</p>

      {upgradeError && (
        <p className={styles.upgradeErrorMsg}>{upgradeError}</p>
      )}

      <div className={styles.upgradeGrid}>
        {UPGRADEABLE_IDS.map(id => {
          const node      = resources[id]
          const meta      = RESOURCE_META[id]
          const matrix    = matrices[id]
          const currentCap = node?.maxCapacity ?? meta.maxCapacity ?? 0
          const isMax     = loaded && matrix === null
          // Use loose != null so both undefined (not yet loaded) and null (max level) are excluded.
          const canAfford = !isMax && matrix != null && matrix.costs.every(
            cost => (resources[cost.resourceId]?.balance ?? 0) >= cost.amountRequired,
          )

          /* Derive level label from capacity. Raw: 200/1k/5k  Refined: 50/250/1250 */
          const capToLevel: Record<number, number> = {
            200: 1, 1_000: 2, 5_000: 3,
            50: 1, 250: 2, 1_250: 3,
          }
          const level = capToLevel[currentCap] ?? 1

          return (
            <div
              key={id}
              className={[
                styles.upgradeCard,
                isMax      ? styles.upgradeCardMax       : '',
                canAfford  ? styles.upgradeCardAffordable : '',
              ].join(' ')}
            >
              {/* Left: resource info + cost breakdown */}
              <div>
                <p className={styles.upgradeName}>{meta.name}</p>

                <div className={styles.upgradeCapRow}>
                  <span className={styles.upgradeCapCurrent}>
                    {currentCap.toLocaleString()}
                  </span>
                  {matrix && (
                    <>
                      <span className={styles.upgradeCapArrow}>→</span>
                      <span className={styles.upgradeCapNext}>
                        {matrix.newCapacity.toLocaleString()}
                      </span>
                    </>
                  )}
                  <span className={styles.upgradeLevelBadge}>
                    Lv {level}{isMax ? ' / MAX' : ''}
                  </span>
                </div>

                {matrix && (
                  <div className={styles.upgradeCosts}>
                    {matrix.costs.map(cost => {
                      const bal = resources[cost.resourceId]?.balance ?? 0
                      const met = bal >= cost.amountRequired
                      const costMeta = RESOURCE_META[cost.resourceId as ResourceId]
                      return (
                        <span
                          key={cost.resourceId}
                          className={[
                            styles.upgradeCostChip,
                            met ? styles.upgradeCostChipMet : '',
                          ].join(' ')}
                        >
                          {cost.amountRequired.toLocaleString()} {costMeta?.name ?? cost.resourceId}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Right: action button */}
              <div className={styles.upgradeActions}>
                {isMax ? (
                  <span className={styles.upgradeMaxBadge}>Max</span>
                ) : (
                  <button
                    className={styles.upgradeBtn}
                    disabled={!canAfford || upgrading === id || !matrix}
                    onClick={() => void handleUpgrade(id)}
                    aria-label={`Upgrade ${meta.name} storage`}
                  >
                    {upgrading === id ? '···' : 'Upgrade'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   §4  MAIN SHELL COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function GamesTabShell({
  biosphereContent,
  arcadeContent,
  crucibleContent,
  upgradesContent,
}: GamesTabShellSlots = {}) {

  /* ── Internal navigation state ────────────────────────────── */
  // peek (pure) for the initial value; the mount effect below consumes it.
  const [rightTab, setRightTab] = useState<GamesRightTab>(
    () => (peekRequestedTab() as GamesRightTab) ?? 'arcade',
  )
  const [activeStation,   setActiveStation]   = useState<BiosphereStation>('terminal')
  const [bioPaneOpenMob,  setBioPaneOpenMob]  = useState(false)

  /* Consume any pending deep-link on mount, and keep listening so a request
     fired while the shell is already on screen still switches the tab. */
  useEffect(() => {
    const pending = consumeRequestedTab()
    if (pending) setRightTab(pending as GamesRightTab)
    return subscribeGamesTab(tab => setRightTab(tab as GamesRightTab))
  }, [])

  /* ── Active crucible job count for tab badge ─────────────── */
  const { activeJobs } = useCosmicCrucible()
  const processingCount = activeJobs.filter(j => j.status === 'processing').length

  const handleTabChange = useCallback((tab: GamesRightTab) => {
    setRightTab(tab)
  }, [])

  /* ── Right-pane content resolution ─────────────────────────
     Renders the provided slot if supplied, otherwise the matching
     built-in placeholder / mini-panel.                           */
  function resolveRightContent(): React.ReactNode {
    switch (rightTab) {
      case 'arcade':   return arcadeContent   ?? <ArcadePlaceholder />
      case 'crucible': return crucibleContent ?? <CruciblePanel />
      case 'upgrades': return upgradesContent ?? <UpgradesPanel />
      case 'skills':   return <SkillsPanel />
      case 'shop':     return <ShopPanel />
    }
  }

  /* ── Computed pane class names ──────────────────────────────
     The left pane collapses on mobile when bioPaneOpenMob is false.
     On desktop, bioPaneOpenMob is irrelevant — the pane is always
     visible via the 40 % width in CSS.                           */
  const bioPaneClass = [
    styles.biospherePane,
    !bioPaneOpenMob ? styles.biospherePaneClosed : styles.biospherePaneOpenMobile,
  ].join(' ')

  return (
    <div className={`${styles.shell} anim-fade-in`} data-view="games">

      {/* ════════════════════════════════════════════════════════
          LEFT PANE — BIOSPHERE STATION
          ════════════════════════════════════════════════════════ */}
      <aside className={bioPaneClass} aria-label="Biosphere Station">

        {/* Pane header */}
        <header className={styles.paneHeader}>
          <div className={styles.headerRow}>
            <h2 className={styles.paneTitle}>Biosphere Station</h2>
            <div className={styles.liveBadge} aria-label="Live connection active">
              <div className={styles.liveDot} aria-hidden="true" />
              LIVE
            </div>
          </div>
        </header>

        {/* Station type selector */}
        <nav className={styles.stationSelector} aria-label="Biosphere station selector">
          {STATIONS.map(station => (
            <button
              key={station.id}
              className={`${styles.stationBtn} ${
                activeStation === station.id ? styles.stationBtnActive : ''
              }`}
              onClick={() => setActiveStation(station.id)}
              aria-pressed={activeStation === station.id}
              aria-label={`Switch to ${station.label} station`}
            >
              {station.label}
            </button>
          ))}
        </nav>

        {/* Biosphere display viewport */}
        <section className={styles.biosphereViewport} aria-label="Biosphere display">
          {biosphereContent ?? <BiospherePlaceholder station={activeStation} />}
        </section>

        {/* Resource inventory ticker */}
        <ResourceTicker />

      </aside>

      {/* ════════════════════════════════════════════════════════
          RIGHT PANE — ARCADE CORE TERMINAL
          ════════════════════════════════════════════════════════ */}
      <main className={styles.arcadePane} aria-label="Arcade Core Terminal">

        {/* Pane header */}
        <header className={styles.paneHeader}>
          <div className={styles.headerRow}>
            <h2 className={styles.paneTitle}>Arcade Core Terminal</h2>
          </div>

          {/* Mobile toggle — reveals/hides the biosphere pane */}
          <button
            className={styles.biosaToggle}
            onClick={() => setBioPaneOpenMob(prev => !prev)}
            aria-expanded={bioPaneOpenMob}
            aria-label={bioPaneOpenMob ? 'Hide Biosphere Station' : 'Show Biosphere Station'}
          >
            {bioPaneOpenMob ? '✕' : '◧'}
          </button>
        </header>

        {/* Right-pane tab bar */}
        <nav className={styles.paneTabBar} aria-label="Arcade terminal navigation">
          {RIGHT_TABS.map(tab => (
            <button
              key={tab.id}
              className={`${styles.paneTab} ${rightTab === tab.id ? styles.paneTabActive : ''}`}
              onClick={() => handleTabChange(tab.id)}
              role="tab"
              aria-selected={rightTab === tab.id}
              aria-controls={`games-panel-${tab.id}`}
            >
              <span className={styles.tabIcon} aria-hidden="true">{tab.icon}</span>
              {tab.label}

              {/* Job count badge on the Crucible tab */}
              {tab.id === 'crucible' && processingCount > 0 && (
                <span className={styles.tabBadge} aria-label={`${processingCount} active jobs`}>
                  {processingCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Tab content — each panel fades in on switch */}
        <section
          id={`games-panel-${rightTab}`}
          className={styles.arcadeViewport}
          role="tabpanel"
          aria-label={`${rightTab} panel`}
        >
          <div key={rightTab} className={styles.tabPanel}>
            {resolveRightContent()}
          </div>
        </section>

      </main>

    </div>
  )
}
