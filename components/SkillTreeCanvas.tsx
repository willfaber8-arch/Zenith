/**
 * components/SkillTreeCanvas.tsx — Constellation Node Viewport
 * Phase 7 · Step 7.2 — Branching Skill Trees & Focus Perks
 *
 * Three-lane SVG + absolute-positioned canvas:
 *   1. SVG layer   — cubic-bezier wire paths coloured by connection state
 *   2. Branch lane dividers + headers
 *   3. Node card layer — 72px circles in 4 visual states
 *   4. Popup overlay  — detail card with cost, prereq, effect, unlock CTA
 *
 * Canvas is 960 × 560 logical px; scrolls horizontally on narrow viewports.
 */

'use client'

import {
  useState, useCallback, useMemo,
  type MouseEvent,
} from 'react'
import {
  SKILL_TREE_DATA,
  SKILL_TREE_CONNECTIONS,
  SKILL_TREE_MAP,
  computeNodeStates,
  resolveNodeState,
  CANVAS_W, CANVAS_H, NODE_RADIUS,
  type SkillNodeRuntime,
  type SkillBranch,
} from '@/types/skillTree'
import type { PurchaseResult } from '@/hooks/useSkillTree'
import styles from './SkillTreeCanvas.module.css'

/* ════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════ */

const NODE_DIAMETER = NODE_RADIUS * 2          // 72
const CTRL_RATIO    = 0.44                      // bezier handle fraction of Δy
const POPUP_W       = 240
const POPUP_FLIP_Y  = CANVAS_H * 0.47          // y above this → popup below; else above
const POPUP_HEIGHT  = 230                       // approximate popup height for "above" calc

/* Branch visual metadata */
const BRANCH_META: Record<SkillBranch, { label: string; icon: string; cx: number; cls: string }> = {
  SCHOLASTIC_FOCUS:     { label: 'Scholastic Focus',     icon: '◈', cx: 160, cls: styles.branchScholastic },
  ERGONOMIC_RESILIENCE: { label: 'Ergonomic Resilience', icon: '◉', cx: 480, cls: styles.branchErgonomic  },
  HABIT_MASTERY:        { label: 'Habit Mastery',        icon: '≡', cx: 800, cls: styles.branchHabit      },
}

/** Returns the branch-scoped CSS variable class for a given SkillBranch */
function bc(branch: SkillBranch): string { return BRANCH_META[branch].cls }

/* ════════════════════════════════════════════════════════════
   SVG PATH HELPERS
   ════════════════════════════════════════════════════════════ */

function bezierPath(
  fx: number, fy: number,   // from node centre
  tx: number, ty: number,   // to node centre
): string {
  const fromY = fy + NODE_RADIUS
  const toY   = ty - NODE_RADIUS
  const dy    = toY - fromY
  const ctrl  = dy * CTRL_RATIO
  return (
    `M ${fx} ${fromY} ` +
    `C ${fx} ${fromY + ctrl}, ` +
    `${tx} ${toY - ctrl}, ` +
    `${tx} ${toY}`
  )
}

function wireClass(fromUnlocked: boolean, toUnlocked: boolean): string {
  if (fromUnlocked && toUnlocked) return styles.wireActive
  if (fromUnlocked)               return styles.wirePartial
  return styles.wireLocked
}

/* ════════════════════════════════════════════════════════════
   POPUP COMPONENT
   ════════════════════════════════════════════════════════════ */

interface PopupProps {
  node:            SkillNodeRuntime
  availableTokens: number
  onPurchase:      () => void
  onClose:         () => void
  isPurchasing:    boolean
}

function NodePopup({ node, availableTokens, onPurchase, onClose, isPurchasing }: PopupProps) {
  const prereqDef    = node.prerequisiteNodeId ? SKILL_TREE_MAP.get(node.prerequisiteNodeId) : null
  const canAfford    = availableTokens >= node.cost
  const isUnlocked   = node.isUnlocked

  /* Popup position — centre on node, flip above/below depending on y */
  const isLower   = node.position.y > POPUP_FLIP_Y
  const popupLeft = Math.max(8, Math.min(
    node.position.x - POPUP_W / 2,
    CANVAS_W - POPUP_W - 8,
  ))
  const popupStyle: React.CSSProperties = {
    left: popupLeft,
    ...(isLower
      ? { bottom: CANVAS_H - (node.position.y - NODE_RADIUS) + 12 }
      : { top:    node.position.y + NODE_RADIUS + 12 }),
  }

  return (
    <>
      {/* Invisible backdrop to catch outside-click */}
      <div className={styles.popupBackdrop} onClick={onClose} />

      <div
        className={`${styles.popup} ${bc(node.branch)}`}
        style={popupStyle}
        onClick={e => e.stopPropagation()}
      >
        {/* Header: title + branch tag */}
        <div className={styles.popupHeader}>
          <span className={styles.popupTitle}>{node.name}</span>
          <span className={styles.popupBranch}>
            {BRANCH_META[node.branch].label.split(' ')[0]}
          </span>
        </div>

        {/* Description */}
        <p className={styles.popupDesc}>{node.description}</p>

        {/* Effect pill */}
        <div className={styles.popupEffect}>
          <span className={styles.popupEffectIcon}>✦</span>
          <span className={styles.popupEffectLabel}>{node.modifierLabel}</span>
        </div>

        {/* Meta rows */}
        <div className={styles.popupMeta}>
          <div className={styles.popupMetaRow}>
            <span className={styles.popupMetaKey}>COST</span>
            <span className={`${styles.popupMetaVal} ${!canAfford && !isUnlocked ? styles.insufficient : ''}`}>
              {node.cost} token{node.cost !== 1 ? 's' : ''}
              {!isUnlocked && ` (${availableTokens} available)`}
            </span>
          </div>

          {prereqDef && (
            <div className={styles.popupMetaRow}>
              <span className={styles.popupMetaKey}>REQUIRES</span>
              <span className={styles.popupMetaVal}>{prereqDef.name}</span>
            </div>
          )}

          <div className={styles.popupMetaRow}>
            <span className={styles.popupMetaKey}>TIER</span>
            <span className={styles.popupMetaVal}>
              {node.tier === 0 ? 'Root' : node.tier === 3 ? 'Apex' : `Tier ${node.tier}`}
            </span>
          </div>
        </div>

        {/* CTA */}
        {isUnlocked ? (
          <div className={styles.unlockedBadge}>✓ UNLOCKED</div>
        ) : (
          <button
            className={styles.unlockBtn}
            onClick={onPurchase}
            disabled={!node.isAvailable || isPurchasing}
          >
            {isPurchasing ? 'Unlocking…' : `Unlock — ${node.cost} Token${node.cost !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </>
  )
}

/* ════════════════════════════════════════════════════════════
   MAIN CANVAS COMPONENT
   ════════════════════════════════════════════════════════════ */

interface SkillTreeCanvasProps {
  unlockedIds:      string[]
  availableTokens:  number
  onPurchase:       (nodeId: string) => Promise<PurchaseResult>
}

export default function SkillTreeCanvas({
  unlockedIds,
  availableTokens,
  onPurchase,
}: SkillTreeCanvasProps) {
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [animatingId,  setAnimatingId]  = useState<string | null>(null)
  const [isPurchasing, setIsPurchasing] = useState(false)

  /* ── Compute runtime node states ─────────────────────────── */
  const nodes = useMemo(
    () => computeNodeStates(unlockedIds, availableTokens),
    [unlockedIds, availableTokens],
  )
  const nodeMap = useMemo(
    () => new Map(nodes.map(n => [n.id, n])),
    [nodes],
  )

  /* ── SVG wire paths ──────────────────────────────────────── */
  const wirePaths = useMemo(() =>
    SKILL_TREE_CONNECTIONS.map(conn => {
      const from = SKILL_TREE_MAP.get(conn.from)
      const to   = SKILL_TREE_MAP.get(conn.to)
      if (!from || !to) return null

      const fromUnlocked = unlockedIds.includes(conn.from)
      const toUnlocked   = unlockedIds.includes(conn.to)

      return {
        key:   `${conn.from}-${conn.to}`,
        d:     bezierPath(from.position.x, from.position.y, to.position.x, to.position.y),
        cls:   wireClass(fromUnlocked, toUnlocked),
      }
    }).filter(Boolean) as { key: string; d: string; cls: string }[],
    [unlockedIds],
  )

  /* ── Interaction handlers ────────────────────────────────── */
  const handleNodeClick = useCallback((
    e: MouseEvent,
    nodeId: string,
    state: ReturnType<typeof resolveNodeState>,
  ) => {
    e.stopPropagation()
    if (state === 'locked') return
    setSelectedId(prev => (prev === nodeId ? null : nodeId))
  }, [])

  const handleCanvasClick = useCallback(() => {
    setSelectedId(null)
  }, [])

  const handlePurchase = useCallback(async () => {
    if (!selectedId || isPurchasing) return
    setIsPurchasing(true)
    const result = await onPurchase(selectedId)
    setIsPurchasing(false)

    if (result.success) {
      setAnimatingId(selectedId)
      setSelectedId(null)
      // Clear burst animation after it completes
      setTimeout(() => setAnimatingId(null), 900)
    }
  }, [selectedId, isPurchasing, onPurchase])

  /* ── Selected node reference ─────────────────────────────── */
  const selectedNode = selectedId ? nodeMap.get(selectedId) : null

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */
  return (
    <div className={styles.scrollWrapper}>
      <div
        className={styles.canvasRoot}
        onClick={handleCanvasClick}
        role="region"
        aria-label="Skill tree constellation"
      >

        {/* ── SVG layer: dividers + wires ─────────────────── */}
        <svg
          className={styles.wireSvg}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          aria-hidden="true"
        >
          {/* Branch lane dividers at x=320 and x=640 */}
          <line
            x1="320" y1="30" x2="320" y2={CANVAS_H - 20}
            className={styles.laneDivider}
          />
          <line
            x1="640" y1="30" x2="640" y2={CANVAS_H - 20}
            className={styles.laneDivider}
          />

          {/* Connection wires */}
          {wirePaths.map(w => (
            <path key={w.key} d={w.d} className={w.cls} />
          ))}
        </svg>

        {/* ── Branch headers ──────────────────────────────── */}
        {(Object.entries(BRANCH_META) as [SkillBranch, typeof BRANCH_META[SkillBranch]][]).map(
          ([branch, meta]) => (
            <div
              key={branch}
              className={`${styles.branchHeader} ${meta.cls}`}
              style={{ left: meta.cx }}
            >
              <span className={styles.branchIcon}>{meta.icon}</span>
              <span className={styles.branchLabel}>{meta.label}</span>
            </div>
          )
        )}

        {/* ── Node cards ──────────────────────────────────── */}
        {nodes.map(node => {
          const state       = resolveNodeState(node)
          const isSelected  = selectedId === node.id
          const isAnimating = animatingId === node.id

          const stateClass: Record<typeof state, string> = {
            locked:     styles.stateLocked,
            affordable: styles.stateAffordable,
            available:  styles.stateAvailable,
            unlocked:   styles.stateUnlocked,
          }

          const tierLabel: Record<0|1|2|3, string> = {
            0: 'root', 1: 'tier i', 2: 'tier ii', 3: 'apex',
          }

          return (
            <div
              key={node.id}
              role="button"
              tabIndex={state === 'locked' ? -1 : 0}
              aria-label={`${node.name} — ${state}`}
              aria-pressed={isSelected}
              className={[
                styles.nodeCard,
                bc(node.branch),
                stateClass[state],
                isSelected  ? styles.nodeCardSelected : '',
                isAnimating ? styles.nodeUnlocking    : '',
              ].filter(Boolean).join(' ')}
              style={{
                left: node.position.x - NODE_RADIUS,
                top:  node.position.y - NODE_RADIUS,
              }}
              onClick={e => handleNodeClick(e, node.id, state)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleNodeClick(e as unknown as MouseEvent, node.id, state)
                }
              }}
            >
              <span className={styles.nodeGlyph} aria-hidden="true">
                {node.glyph}
              </span>
              <span className={styles.nodeTier} aria-hidden="true">
                {tierLabel[node.tier]}
              </span>

              {/* Token cost badge */}
              {!node.isUnlocked && (
                <span className={styles.costBadge} aria-hidden="true">
                  {node.cost}
                </span>
              )}
              {node.isUnlocked && (
                <span className={styles.costBadge} aria-hidden="true">
                  ✓
                </span>
              )}
            </div>
          )
        })}

        {/* ── Node popup ──────────────────────────────────── */}
        {selectedNode && (
          <NodePopup
            node={selectedNode}
            availableTokens={availableTokens}
            onPurchase={handlePurchase}
            onClose={() => setSelectedId(null)}
            isPurchasing={isPurchasing}
          />
        )}

      </div>
    </div>
  )
}
