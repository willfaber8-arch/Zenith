'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * SkillTreeCanvas — Games Tab · Step 6.1
 * Interactive SVG Progression Tree Renderer
 *
 * Renders a 10-node, 3-branch skill tree inside a 800×600 SVG
 * viewBox using only inline JSX SVG — no external canvas or drawing
 * libraries.  CSS custom-property tokens (var(--*)) resolve inside
 * SVG text and presentation attributes, preserving the Zenith design
 * system.
 *
 * Layout structure:
 *   Core Nexus Gateway          (400, 100)  — root, always unlockable
 *   ├─ Branch A · Aesthetic     (left)      — (200,250) → (150,400) → (100,550)
 *   ├─ Branch B · Efficiency    (centre)    — (400,250) → (400,400) → (400,550)
 *   └─ Branch C · Cultivation   (right)     — (600,250) → (650,400) → (700,550)
 *
 * Node state machine (driven entirely by `unlockedNodeIds` prop):
 *   locked    — one or more prerequisites missing from unlockedNodeIds
 *   available — all prerequisites met; node not yet unlocked
 *   unlocked  — id present in unlockedNodeIds
 *
 * Connector state machine:
 *   inactive — parent is locked
 *   partial  — parent is available (prerequisites met, not yet unlocked)
 *   active   — parent is unlocked
 *
 * Design constraints:
 *   • Pure JSX SVG — no canvas API, no external library.
 *   • All colours via CSS design-token custom properties.
 *   • CSS Modules for all state-driven presentation (no inline styles
 *     except the single `opacity` scalar driven by ContextDisplayConfig).
 *   • `overflow="visible"` on the SVG so bottom-row node labels (y ≈ 602)
 *     render outside the 600-unit viewBox; the .canvasWrap container's
 *     `overflow: hidden` clips at the rendered boundary.
 * ════════════════════════════════════════════════════════════════
 */

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from 'react'
import styles from './SkillTreeCanvas.module.css'

/* ════════════════════════════════════════════════════════════════
   §1  PUBLIC TYPES
   (exported as required by the Step 6.1 specification)
   ════════════════════════════════════════════════════════════════ */

export interface SkillTreeNode {
  /** Unique slug identifier — used as React key and dependency ref. */
  id: string
  /** Short human-readable name rendered below the node circle. */
  label: string
  /** Single-sentence description shown in the in-canvas popup. */
  description: string
  /** SVG x coordinate within the 800 × 600 viewBox. */
  x: number
  /** SVG y coordinate within the 800 × 600 viewBox. */
  y: number
  /**
   * IDs of nodes that must appear in `unlockedNodeIds` before this
   * node transitions from `locked` to `available`.
   * Empty array = immediately available (root node).
   */
  prerequisites: string[]
  /** Determines the branch colour tinting in the popup badge. */
  branch: 'nexus' | 'aesthetic' | 'efficiency' | 'cultivation' | 'synergy'
}

export interface SkillTreeCanvasProps {
  /**
   * Flat array of node IDs the player has unlocked.
   * Sourced from the Dexie `skill_tree` table in the Games DB.
   * The canvas is fully declarative — it derives all visual state
   * from this prop with zero internal mutation.
   */
  unlockedNodeIds: string[]
  /**
   * Called when the player clicks an `available` or `unlocked` node.
   * Locked nodes do not fire this callback.
   */
  onNodeClick: (node: SkillTreeNode) => void
}

/* ════════════════════════════════════════════════════════════════
   §2  INTERNAL TYPES
   ════════════════════════════════════════════════════════════════ */

type NodeState      = 'locked' | 'available' | 'unlocked'
type ConnectorState = 'inactive' | 'partial' | 'active'

/** A bezier connector between two nodes in the tree. */
interface TreeConnector {
  /** `id` of the parent (prerequisite) node. */
  from: string
  /** `id` of the child (dependent) node. */
  to:   string
  /** Full SVG `d` attribute string for the cubic bezier path. */
  path: string
}

/* ════════════════════════════════════════════════════════════════
   §3  STATIC LAYOUT DATA
   ────────────────────────────────────────────────────────────────
   All coordinates are within viewBox="0 0 800 600".
   Bezier control points sit at the mid-Y between parent and child
   so curves never cross sibling branches.
   ════════════════════════════════════════════════════════════════ */

const NODE_RADIUS  = 36   // circle r in SVG units
const LABEL_OFFSET = 52   // px below node centre for label text

/**
 * Complete ordered node registry — 4 branches, 13 nodes total.
 * Node IDs match SkillTreeFirewall.SKILL_TREE_REGISTRY exactly so
 * useLiveQuery data flows directly from the engine to the canvas.
 *
 * Layout: 4 branches spread across viewBox 0 0 800 600.
 *   A (aesthetic)  x≈140  B (efficiency) x≈300
 *   C (cultivation) x≈500  D (synergy)    x≈660
 */
export const TREE_NODES: readonly SkillTreeNode[] = [
  /* ── Central Nexus Gateway (root) ──────────────────────────── */
  {
    id:            'nexus_core_01',
    label:         'Core Nexus',
    description:   'Gateway to all skill specializations.',
    x:             400,
    y:             90,
    prerequisites: [],
    branch:        'nexus',
  },

  /* ── Branch A · Aesthetic Resonance (Cosmetics Path) ────── */
  {
    id:            'a1_preview',
    label:         'Previews',
    description:   'Preview any cosmetic before purchasing.',
    x:             140,
    y:             240,
    prerequisites: ['nexus_core_01'],
    branch:        'aesthetic',
  },
  {
    id:            'a2_particles',
    label:         'Particles',
    description:   'Unlock particle effect overlays.',
    x:             110,
    y:             390,
    prerequisites: ['a1_preview'],
    branch:        'aesthetic',
  },
  {
    id:            'a3_typography',
    label:         'Typography',
    description:   'Premium UI typography pack unlocked.',
    x:             80,
    y:             540,
    prerequisites: ['a2_particles'],
    branch:        'aesthetic',
  },

  /* ── Branch B · Quantum Efficiency (Gameplay Multipliers) ── */
  {
    id:            'b1_refinery',
    label:         'Refinery Boost',
    description:   'Crucible transmutation yield +15%.',
    x:             300,
    y:             240,
    prerequisites: ['nexus_core_01'],
    branch:        'efficiency',
  },
  {
    id:            'b2_shield',
    label:         'Mine Shield',
    description:   'One protected reveal per session.',
    x:             300,
    y:             390,
    prerequisites: ['b1_refinery'],
    branch:        'efficiency',
  },
  {
    id:            'b3_harvest',
    label:         'Harvest ×',
    description:   'All harvest payouts earn +20% bonus.',
    x:             300,
    y:             540,
    prerequisites: ['b2_shield'],
    branch:        'efficiency',
  },

  /* ── Branch C · Ecosphere Cultivation (Biosphere Modules) ── */
  {
    id:            'c1_aquarium',
    label:         'Aquarium',
    description:   'Unlock the Aquarium biosphere station.',
    x:             500,
    y:             240,
    prerequisites: ['nexus_core_01'],
    branch:        'cultivation',
  },
  {
    id:            'c2_zoo',
    label:         'Zoo Module',
    description:   'Unlock the Zoo biosphere station.',
    x:             500,
    y:             390,
    prerequisites: ['c1_aquarium'],
    branch:        'cultivation',
  },
  {
    id:            'c3_projection',
    label:         'Cross-Pillar',
    description:   'Enable BiosphereWidgetHost projection.',
    x:             500,
    y:             540,
    prerequisites: ['c2_zoo'],
    branch:        'cultivation',
  },

  /* ── Branch D · Synergy Convergence (Cross-System Mastery) ── */
  {
    id:            'd1_synthesis',
    label:         'Synthesis',
    description:   'Cross-branch synergy — boost all yields by 5%.',
    x:             660,
    y:             240,
    prerequisites: ['nexus_core_01'],
    branch:        'synergy',
  },
  {
    id:            'd2_resonance',
    label:         'Resonance',
    description:   'Resource resonance — unlock premium Crucible slots.',
    x:             690,
    y:             390,
    prerequisites: ['d1_synthesis'],
    branch:        'synergy',
  },
  {
    id:            'd3_convergence',
    label:         'Convergence',
    description:   'Full convergence — master all branches.',
    x:             720,
    y:             540,
    prerequisites: ['d2_resonance'],
    branch:        'synergy',
  },
] as const satisfies SkillTreeNode[]

/**
 * All 9 bezier connector paths.
 * Each `path` uses a cubic bezier `C` command:
 *   M fromX,fromY  C cp1X,cp1Y cp2X,cp2Y toX,toY
 * Control points are placed at the mid-Y between the two nodes so
 * curves bend horizontally then continue vertically — preventing
 * crossing with adjacent branch curves.
 */
const TREE_CONNECTORS: readonly TreeConnector[] = [
  /* Root → Tier-1 ─────────────────────────────────────────── */
  { from: 'nexus_core_01', to: 'a1_preview',   path: 'M 400,90 C 400,165 140,165 140,240'  },
  { from: 'nexus_core_01', to: 'b1_refinery',  path: 'M 400,90 C 400,165 300,165 300,240'  },
  { from: 'nexus_core_01', to: 'c1_aquarium',  path: 'M 400,90 C 400,165 500,165 500,240'  },
  { from: 'nexus_core_01', to: 'd1_synthesis', path: 'M 400,90 C 400,165 660,165 660,240'  },

  /* Branch A — Aesthetic Resonance ──────────────────────────  */
  { from: 'a1_preview',   to: 'a2_particles',  path: 'M 140,240 C 140,315 110,315 110,390' },
  { from: 'a2_particles', to: 'a3_typography', path: 'M 110,390 C 110,465 80,465 80,540'   },

  /* Branch B — Quantum Efficiency ────────────────────────────  */
  { from: 'b1_refinery', to: 'b2_shield',      path: 'M 300,240 C 300,315 300,315 300,390' },
  { from: 'b2_shield',   to: 'b3_harvest',     path: 'M 300,390 C 300,465 300,465 300,540' },

  /* Branch C — Ecosphere Cultivation ─────────────────────────  */
  { from: 'c1_aquarium', to: 'c2_zoo',         path: 'M 500,240 C 500,315 500,315 500,390' },
  { from: 'c2_zoo',      to: 'c3_projection',  path: 'M 500,390 C 500,465 500,465 500,540' },

  /* Branch D — Synergy Convergence ───────────────────────────  */
  { from: 'd1_synthesis', to: 'd2_resonance',   path: 'M 660,240 C 660,315 690,315 690,390' },
  { from: 'd2_resonance', to: 'd3_convergence', path: 'M 690,390 C 690,465 720,465 720,540' },
] as const

/** Unicode glyph centred inside each node circle. */
const NODE_GLYPHS: Readonly<Record<string, string>> = {
  nexus_core_01:  '◎',
  a1_preview:     '◇',
  a2_particles:   '◈',
  a3_typography:  '◆',
  b1_refinery:    '△',
  b2_shield:      '▲',
  b3_harvest:     '◉',
  c1_aquarium:    '○',
  c2_zoo:         '⊙',
  c3_projection:  '◫',
  d1_synthesis:   '⊕',
  d2_resonance:   '⊗',
  d3_convergence: '✦',
} as const

/** Branch header labels rendered between the root and tier-1 nodes. */
const BRANCH_HEADERS: readonly {
  x:     number
  label: string
}[] = [
  { x: 140, label: 'AESTHETIC' },
  { x: 300, label: 'EFFICIENCY' },
  { x: 500, label: 'CULTIVATION' },
  { x: 660, label: 'SYNERGY' },
] as const

/* ════════════════════════════════════════════════════════════════
   §4  LAYOUT CONSTANTS — popup geometry
   ════════════════════════════════════════════════════════════════ */

const POPUP_W       = 182   // popup card width in SVG units
const POPUP_H_BASE  = 80    // popup height: 1 description line
const POPUP_LINE_H  = 13    // additional height per extra line
const POPUP_PADDING = 12    // horizontal internal padding

/* ════════════════════════════════════════════════════════════════
   §5  PURE HELPER FUNCTIONS
   ════════════════════════════════════════════════════════════════ */

/**
 * Derives the display state of a single node based on the unlock set.
 */
function computeNodeState(
  node:        SkillTreeNode,
  unlockedSet: Set<string>,
): NodeState {
  if (unlockedSet.has(node.id)) return 'unlocked'
  const prereqsMet = node.prerequisites.every(id => unlockedSet.has(id))
  return prereqsMet ? 'available' : 'locked'
}

/**
 * Derives the display state of a connector from parent node's state.
 *   active   — parent is unlocked → full purple line
 *   partial  — parent is available (not yet unlocked) → dashed hint
 *   inactive — parent is locked → muted trace
 */
function computeConnectorState(
  fromNodeState: NodeState,
): ConnectorState {
  if (fromNodeState === 'unlocked')  return 'active'
  if (fromNodeState === 'available') return 'partial'
  return 'inactive'
}

/**
 * Naïve word-wrap: splits `text` into lines of at most `maxLen`
 * characters without breaking words.  Returns at most 2 lines so
 * the popup card height stays predictable.
 */
function wrapText(text: string, maxLen: number): string[] {
  const words   = text.split(' ')
  const lines: string[] = []
  let   current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maxLen) {
      if (current) lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 2)
}

/**
 * Computes the top-left SVG coordinates for the popup card so it
 * stays within the 800 × 600 viewBox regardless of node position.
 * Placement priority: right of the node → left → above.
 */
function computePopupPosition(
  nodeX:  number,
  nodeY:  number,
  popupH: number,
): { x: number; y: number } {
  const OFFSET = NODE_RADIUS + 14   // gap between node edge and card

  let x = nodeX + OFFSET
  let y = nodeY - popupH / 2

  // Shift left when the card overflows the right edge
  if (x + POPUP_W > 790) {
    x = nodeX - OFFSET - POPUP_W
  }

  // Clamp vertical: top/bottom margins of 10 SVG units
  y = Math.max(10, Math.min(y, 590 - popupH))

  return { x, y }
}

/* ════════════════════════════════════════════════════════════════
   §6  MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function SkillTreeCanvas({
  unlockedNodeIds,
  onNodeClick,
}: SkillTreeCanvasProps) {

  /* ── 6a. State ─────────────────────────────────────────────── */

  /** The node whose popup card is currently visible. */
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  /**
   * The node ID currently playing the unlock-burst animation.
   * Set to the most-recently unlocked node ID for 700 ms, then null.
   */
  const [burstNodeId, setBurstNodeId] = useState<string | null>(null)

  /** Tracks previously seen unlock set to detect newly unlocked nodes. */
  const prevUnlockedRef = useRef<string[]>([])

  /* ── 6b. Derived data ──────────────────────────────────────── */

  /** O(1) membership test — rebuilt only when unlockedNodeIds changes. */
  const unlockedSet = useMemo(
    () => new Set(unlockedNodeIds),
    [unlockedNodeIds],
  )

  /** Pre-computed node states for all 10 nodes. */
  const nodeStates = useMemo(
    () => {
      const map = new Map<string, NodeState>()
      for (const node of TREE_NODES) {
        map.set(node.id, computeNodeState(node, unlockedSet))
      }
      return map
    },
    [unlockedSet],
  )

  /* ── 6c. Unlock burst detector ─────────────────────────────── */

  useEffect(() => {
    const prevSet    = new Set(prevUnlockedRef.current)
    const newlyUnlocked = unlockedNodeIds.filter(id => !prevSet.has(id))

    if (newlyUnlocked.length > 0) {
      const latest = newlyUnlocked[newlyUnlocked.length - 1]
      setBurstNodeId(latest)
      const timer = setTimeout(() => setBurstNodeId(null), 700)
      prevUnlockedRef.current = [...unlockedNodeIds]
      return () => clearTimeout(timer)
    }

    prevUnlockedRef.current = [...unlockedNodeIds]
  }, [unlockedNodeIds])

  /* ── 6d. Event handlers ────────────────────────────────────── */

  /** Called when a node group is clicked or activated via keyboard. */
  const handleNodeActivate = useCallback(
    (node: SkillTreeNode, e: React.SyntheticEvent) => {
      e.stopPropagation()   // prevent SVG background dismiss
      const state = nodeStates.get(node.id)
      if (state === 'locked') return

      // Toggle selection — clicking the same node closes the popup
      setSelectedNodeId(prev => prev === node.id ? null : node.id)
      onNodeClick(node)
    },
    [nodeStates, onNodeClick],
  )

  /** Dismisses the popup when the SVG background is clicked. */
  const handleBackgroundClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  /** Closes the popup via the × button inside the card. */
  const handlePopupClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setSelectedNodeId(null)
    },
    [],
  )

  /* ── 6e. Popup geometry ──────────────────────────────────────  */

  const selectedNode = useMemo(
    () => (selectedNodeId
      ? (TREE_NODES as readonly SkillTreeNode[]).find(n => n.id === selectedNodeId) ?? null
      : null),
    [selectedNodeId],
  )

  const popupDescLines = useMemo(
    () => selectedNode ? wrapText(selectedNode.description, 27) : [],
    [selectedNode],
  )

  const popupH = POPUP_H_BASE + (popupDescLines.length - 1) * POPUP_LINE_H

  const popupPos = useMemo(
    () => selectedNode
      ? computePopupPosition(selectedNode.x, selectedNode.y, popupH)
      : { x: 0, y: 0 },
    [selectedNode, popupH],
  )

  /* ── 6f. Render ──────────────────────────────────────────────  */

  return (
    <div className={styles.canvasWrap}>
      <svg
        viewBox="0 0 800 600"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
        overflow="visible"
        role="img"
        aria-label="Skill tree progression canvas — 10 nodes across 3 branches"
        onClick={handleBackgroundClick}
      >

        {/* ══════════════════════════════════════════════════════
            §A  BACKGROUND GRID (decorative — very low opacity)
            ══════════════════════════════════════════════════════ */}
        <defs>
          <pattern
            id="treeGrid"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 50 0 L 0 0 0 50"
              fill="none"
              stroke="rgba(124,149,255,0.04)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="800" height="600" fill="url(#treeGrid)" />

        {/* ══════════════════════════════════════════════════════
            §B  BRANCH HEADER LABELS
            Rendered between y=100 (root) and y=250 (tier-1).
            ══════════════════════════════════════════════════════ */}
        {BRANCH_HEADERS.map(bh => (
          <text
            key={bh.label}
            x={bh.x}
            y={178}
            className={styles.branchHeader}
          >
            {bh.label}
          </text>
        ))}

        {/* ══════════════════════════════════════════════════════
            §C  CONNECTOR PATHS — painted before nodes so nodes
                sit on top of their connecting bezier curves.
            ══════════════════════════════════════════════════════ */}
        <g aria-hidden="true">
          {TREE_CONNECTORS.map(conn => {
            const fromState   = nodeStates.get(conn.from) ?? 'locked'
            const connState   = computeConnectorState(fromState)

            return (
              <path
                key={`conn-${conn.from}--${conn.to}`}
                d={conn.path}
                className={styles.connector}
                data-state={connState}
              />
            )
          })}
        </g>

        {/* ══════════════════════════════════════════════════════
            §D  NODE GROUPS
            Each node is a <g> wrapping: selection ring, burst ring,
            main circle, glyph text, label text.
            Click + keyboard activation route through handleNodeActivate.
            ══════════════════════════════════════════════════════ */}
        {(TREE_NODES as readonly SkillTreeNode[]).map(node => {
          const nodeState  = nodeStates.get(node.id) ?? 'locked'
          const isSelected = selectedNodeId === node.id
          const isBursting = burstNodeId === node.id
          const isInteractive = nodeState !== 'locked'

          return (
            <g
              key={node.id}
              className={styles.nodeGroup}
              data-state={nodeState}
              onClick={e => handleNodeActivate(node, e)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleNodeActivate(node, e)
                }
              }}
              role={isInteractive ? 'button' : undefined}
              tabIndex={isInteractive ? 0 : undefined}
              aria-label={`${node.label}: ${node.description} — ${nodeState}`}
              aria-disabled={!isInteractive}
              aria-pressed={isSelected || undefined}
            >

              {/* Selection dashed ring — only on selected node */}
              {isSelected && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={NODE_RADIUS + 9}
                  className={styles.selectionRing}
                />
              )}

              {/* Burst ring — one-shot on newly unlocked nodes */}
              {isBursting && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={NODE_RADIUS}
                  className={styles.burstRing}
                />
              )}

              {/* Main node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_RADIUS}
                className={styles.nodeCircle}
                data-state={nodeState}
              />

              {/* Glyph symbol centred inside the circle */}
              <text
                x={node.x}
                y={node.y}
                className={styles.nodeGlyph}
                data-state={nodeState}
              >
                {NODE_GLYPHS[node.id] ?? '◌'}
              </text>

              {/* Label text below the circle */}
              <text
                x={node.x}
                y={node.y + LABEL_OFFSET}
                className={styles.nodeLabel}
                data-state={nodeState}
              >
                {node.label}
              </text>

            </g>
          )
        })}

        {/* ══════════════════════════════════════════════════════
            §E  POPUP CARD — in-canvas detail overlay
            Rendered last so it paints above all nodes.
            Clicking the × or the background dismisses it.
            ══════════════════════════════════════════════════════ */}
        {selectedNode && (
          <g
            className={styles.popupGroup}
            transform={`translate(${popupPos.x}, ${popupPos.y})`}
            aria-label={`Node detail: ${selectedNode.label}`}
          >
            {/* Background card */}
            <rect
              width={POPUP_W}
              height={popupH}
              rx={8}
              ry={8}
              className={styles.popupBg}
            />

            {/* Close (×) button — top-right corner */}
            <text
              x={POPUP_W - POPUP_PADDING}
              y={18}
              className={styles.popupClose}
              onClick={handlePopupClose}
              role="button"
              aria-label="Close node detail"
            >
              ×
            </text>

            {/* Node title */}
            <text
              x={POPUP_W / 2}
              y={22}
              className={styles.popupTitle}
            >
              {selectedNode.label}
            </text>

            {/* Horizontal rule beneath the title */}
            <line
              x1={POPUP_PADDING}
              y1={32}
              x2={POPUP_W - POPUP_PADDING}
              y2={32}
              className={styles.popupDivider}
            />

            {/* Description — up to 2 wrapped lines */}
            {popupDescLines.map((line, i) => (
              <text
                key={i}
                x={POPUP_W / 2}
                y={46 + i * POPUP_LINE_H}
                className={styles.popupDesc}
              >
                {line}
              </text>
            ))}

            {/* Branch tag at the bottom */}
            <text
              x={POPUP_W / 2}
              y={popupH - 10}
              className={styles.popupBranchTag}
              data-branch={selectedNode.branch}
            >
              {selectedNode.branch.toUpperCase()}
            </text>

          </g>
        )}

      </svg>
    </div>
  )
}
