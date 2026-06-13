'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * BiosphereRenderer — Games Tab · Step 5.2
 * Automated Visual Evolution Script
 *
 * Reads the `unlockedAssets` array (flat string IDs from Step 5.1)
 * and maps each id onto a pre-calculated, absolutely-positioned
 * slot inside a shared container.  All slots are always in the
 * DOM; unlocking an asset adds `.assetSlotActive`, triggering the
 * CSS spring entrance transition.  No element ever moves or
 * reflows — zero layout shift by construction.
 *
 * Three environment renderers:
 *   'aquarium' → kelp_forest · substrate_rocks · neon_fauna
 *   'terminal' → ambient_pulse_lines · mainframe_node · uptime_registry
 *   'zoo'      → enclosure_perimeter · botanical_canopy · fauna_sprites
 *
 * Design constraints:
 *   • Pure CSS Modules + design-token CSS custom properties.
 *   • No external canvas / animation libraries.
 *   • `currentStage` drives `data-stage` on the root; CSS rules
 *     target [data-stage] to tune animation speed at higher tiers.
 *   • `resolveActiveSlots()` is the public API for external consumers
 *     (codex panels, analytics) — returns the typed RenderingSlot[].
 * ════════════════════════════════════════════════════════════════
 */

import {
  useState,
  useEffect,
  useMemo,
  memo,
} from 'react'
import type { ReactNode } from 'react'
import styles from './BiosphereRenderer.module.css'

/* ════════════════════════════════════════════════════════════════
   §1  PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

/**
 * Describes one rendered asset slot — the atom of the visual grid.
 * `cssClasses` carries the actual composed CSS Module class string
 * so external consumers can apply it directly as a `className`.
 */
export interface RenderingSlot {
  /** Asset identifier matching the `EnvironmentalAsset.id` from Step 5.1. */
  coordinateId: string
  /** Space-separated CSS Module class string applied to the slot wrapper. */
  cssClasses: string
  /** The fully-constructed React node for this slot's visual layer. */
  renderElement: ReactNode
}

/** Props accepted by the default BiosphereRenderer export. */
export interface BiosphereRendererProps {
  /** Which of the three visual environments to render. */
  activeModuleId: 'terminal' | 'aquarium' | 'zoo'
  /**
   * Flat array of unlocked asset IDs parsed from the
   * `BiosphereStateRecord.unlockedAssets` array (Step 5.1).
   * Each string is compared against the slot coordinate registry.
   */
  unlockedAssets: string[]
  /** Current ecosystem tier (1–5). Stamped as `data-stage` on the root. */
  currentStage: number
}

/* ════════════════════════════════════════════════════════════════
   §2  STATIC DATA — never mutated at runtime
   ════════════════════════════════════════════════════════════════ */

/**
 * Terminal code lines shown in the scrolling mainframe monitor.
 * Drawn from authentic Zenith internal API surface to reinforce
 * the "real system" aesthetic of the sci-fi environment.
 */
const CODE_LINES: readonly string[] = [
  '> db.biosphere_states.toArray()     →  3 rows',
  '> resource_inventory.count()        →  6',
  '> useLiveQuery() latency            →  0.3ms',
  '> crucible_jobs.status              →  idle',
  '> memory_pressure                   →  0.02 MB/s',
  '> gc_cycles_total                   →  18',
  '> frame_budget_used                 →  12.4ms / 16.6ms',
  '> IndexedDB read_ops                →  204',
  '> biosphere_tick                    →  stable ✓',
  '> stage_threshold_eval              →  evaluating',
  '> ecosystem_integrity               →  ■■■■□  80%',
  '> organic_spore_flux                →  +2.4 / hr',
  '> data_shard_velocity               →  +0.8 / hr',
  '> ambient_pulse_lines               →  active',
  '> fauna_registry                    →  loaded',
  '> kelp_photosynthesis_rate          →  1.22 μmol/s',
  '> substrate_ph_value                →  7.43',
  '> uptime_anchor                     →  measuring',
] as const

/**
 * Individual kelp stalk descriptors.
 * `leftPct` is the horizontal offset within the kelp forest slot.
 * `heightPct` is the stalk height relative to the slot's full height.
 * `animDelay` staggers the sway so each stalk moves independently.
 */
const KELP_CONFIGS: readonly {
  leftPct:    number
  heightPct:  number
  widthPx:    number
  animDelay:  string
}[] = [
  { leftPct:  4, heightPct: 80, widthPx: 5, animDelay: '0s'   },
  { leftPct: 12, heightPct: 64, widthPx: 4, animDelay: '0.9s' },
  { leftPct: 20, heightPct: 85, widthPx: 5, animDelay: '1.5s' },
  { leftPct: 29, heightPct: 70, widthPx: 4, animDelay: '0.4s' },
  { leftPct: 37, heightPct: 75, widthPx: 5, animDelay: '2.1s' },
  { leftPct: 46, heightPct: 60, widthPx: 4, animDelay: '0.7s' },
] as const

/**
 * Neon fauna particle descriptors.
 * Each particle is an independently animated floating circle.
 * `topPct` positions it vertically within the fauna slot.
 * `sizePx` and `color` are applied inline for per-particle variety.
 */
const NEON_FAUNA_CONFIGS: readonly {
  topPct:       number
  sizePx:       number
  animDelay:    string
  animDuration: string
  color:        string
}[] = [
  { topPct: 14, sizePx: 10, animDelay: '0s',    animDuration: '9s',  color: 'var(--accent-green)'  },
  { topPct: 38, sizePx:  7, animDelay: '3.2s',  animDuration: '13s', color: 'var(--accent-purple)' },
  { topPct: 58, sizePx:  9, animDelay: '6.0s',  animDuration: '8s',  color: 'var(--accent-green)'  },
  { topPct: 24, sizePx:  5, animDelay: '1.5s',  animDuration: '16s', color: 'var(--accent-purple)' },
] as const

/**
 * Zoo fauna sprite descriptors.
 * Each sprite is a monospace glyph that steps across the habitat.
 * `topPct` distributes them vertically; `animDelay` staggers movement
 * so they never overlap.
 */
const FAUNA_SPRITE_CONFIGS: readonly {
  glyph:        string
  topPct:       number
  animDelay:    string
  animDuration: string
}[] = [
  { glyph: '◉', topPct:  0, animDelay: '0s',   animDuration: '12s' },
  { glyph: '△', topPct: 35, animDelay: '4.0s', animDuration: '9s'  },
  { glyph: '◆', topPct: 65, animDelay: '7.5s', animDuration: '15s' },
] as const

/**
 * SVG `d` attribute values for the botanical canopy leaf clusters.
 * Three overlapping organic quadratic-bezier paths drawn near the
 * top-right corner of the zoo environment.
 */
const BOTANICAL_PATHS: readonly string[] = [
  'M 0 50 Q 25 5  60 30 Q 85  5 120 45 Z',
  'M 40 10 Q 70 -15 110 20 Q 140  0 170 35 Z',
  'M 20 75 Q 50 40  85 65 Q 115 35 150 60 Z',
] as const

/* ════════════════════════════════════════════════════════════════
   §3  PURE UTILITIES
   ════════════════════════════════════════════════════════════════ */

/**
 * Formats a total-seconds integer as `HH:MM:SS` for the uptime display.
 */
function formatUptime(totalSeconds: number): string {
  const hours   = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return (
    String(hours  ).padStart(2, '0') + ':' +
    String(minutes).padStart(2, '0') + ':' +
    String(seconds).padStart(2, '0')
  )
}

/* ════════════════════════════════════════════════════════════════
   §4  AQUARIUM LAYER ELEMENTS
   Each sub-component is wrapped in React.memo — the biosphere
   container re-renders whenever unlockedAssets changes, and
   unchanged leaf elements should not repaint.
   ════════════════════════════════════════════════════════════════ */

/**
 * Substrate rocks: a flat dark bar across the aquarium floor with
 * an irregular silhouette created by stacked, offset border-radius divs.
 */
const SubstrateRocksElement = memo(function SubstrateRocksElement() {
  return (
    <div className={styles.substrateRocks} aria-hidden="true">
      {/* Base floor bar */}
      <div className={styles.substrateFloor} />
      {/* Silhouette contour bumps — three fixed rock forms */}
      <div className={styles.substrateContour} data-pos="left"   />
      <div className={styles.substrateContour} data-pos="center" />
      <div className={styles.substrateContour} data-pos="right"  />
    </div>
  )
})

/**
 * Kelp forest: a repeating column of slender vertical stalks anchored
 * at the aquarium floor, each swaying on an independent delay.
 */
const KelpForestElement = memo(function KelpForestElement() {
  return (
    <div className={styles.kelpForestWrap} aria-hidden="true">
      {KELP_CONFIGS.map((cfg, i) => (
        <div
          key={i}
          className={styles.kelpStalk}
          style={{
            left:             `${cfg.leftPct}%`,
            height:           `${cfg.heightPct}%`,
            width:            `${cfg.widthPx}px`,
            animationDelay:   cfg.animDelay,
          }}
        />
      ))}
    </div>
  )
})

/**
 * Neon fauna: small glowing circles that drift left-to-right across
 * the upper portion of the aquarium, each at an independent speed
 * and delay to simulate multiple distinct organisms.
 */
const NeonFaunaElement = memo(function NeonFaunaElement() {
  return (
    <div className={styles.neonFaunaWrap} aria-hidden="true">
      {NEON_FAUNA_CONFIGS.map((cfg, i) => (
        <div
          key={i}
          className={styles.neonFaunaParticle}
          style={{
            top:              `${cfg.topPct}%`,
            width:            `${cfg.sizePx}px`,
            height:           `${cfg.sizePx}px`,
            background:       cfg.color,
            boxShadow:        `0 0 ${cfg.sizePx + 4}px ${cfg.color}`,
            animationDelay:   cfg.animDelay,
            animationDuration: cfg.animDuration,
          }}
        />
      ))}
    </div>
  )
})

/* ════════════════════════════════════════════════════════════════
   §5  TERMINAL LAYER ELEMENTS
   ════════════════════════════════════════════════════════════════ */

/**
 * Ambient pulse lines: a full-bleed SVG grid of horizontal, vertical,
 * and geometric accent paths rendered at very low opacity behind all
 * other terminal content. Pulses slowly on an ease-in-out cycle.
 */
const AmbientPulseLinesElement = memo(function AmbientPulseLinesElement() {
  return (
    <svg
      className={styles.ambientLinesSvg}
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* 8 horizontal grid lines */}
      {Array.from({ length: 9 }, (_, i) => (
        <line
          key={`h${i}`}
          x1="0"   y1={i * 50}
          x2="400" y2={i * 50}
          stroke="currentColor" strokeWidth="0.5"
        />
      ))}

      {/* 8 vertical grid lines */}
      {Array.from({ length: 9 }, (_, i) => (
        <line
          key={`v${i}`}
          x1={i * 50} y1="0"
          x2={i * 50} y2="400"
          stroke="currentColor" strokeWidth="0.5"
        />
      ))}

      {/* Geometric accent: outer rectangle */}
      <rect
        x="30"  y="30" width="340" height="340"
        fill="none" stroke="currentColor" strokeWidth="0.8"
      />

      {/* Geometric accent: inner rectangle */}
      <rect
        x="90"  y="90" width="220" height="220"
        fill="none" stroke="currentColor" strokeWidth="0.5"
      />

      {/* Geometric accent: centre circle */}
      <circle
        cx="200" cy="200" r="75"
        fill="none" stroke="currentColor" strokeWidth="0.7"
      />

      {/* Corner accent marks */}
      <path
        d="M 30 60 L 30 30 L 60 30"
        fill="none" stroke="currentColor" strokeWidth="1.5"
      />
      <path
        d="M 370 60 L 370 30 L 340 30"
        fill="none" stroke="currentColor" strokeWidth="1.5"
      />
      <path
        d="M 30 340 L 30 370 L 60 370"
        fill="none" stroke="currentColor" strokeWidth="1.5"
      />
      <path
        d="M 370 340 L 370 370 L 340 370"
        fill="none" stroke="currentColor" strokeWidth="1.5"
      />
    </svg>
  )
})

/**
 * Mainframe node: a centred floating terminal window displaying
 * a continuously scrolling stream of system monitoring output.
 * Simulates real-time memory and DB telemetry on a sci-fi display.
 */
const MainframeNodeElement = memo(function MainframeNodeElement() {
  return (
    <div
      className={styles.mainframeNode}
      aria-label="System monitoring output — mainframe node"
      role="region"
    >
      {/* Traffic-light-style title bar */}
      <div className={styles.codeHeader} aria-hidden="true">
        <span className={`${styles.codeHeaderDot} ${styles.dotRed}`}    />
        <span className={`${styles.codeHeaderDot} ${styles.dotAmber}`}  />
        <span className={`${styles.codeHeaderDot} ${styles.dotGreen}`}  />
        <span className={styles.codeHeaderTitle}>ZENITH OS  /  BIOSPHERE MONITOR</span>
      </div>

      {/* Scrolling code stream — content doubled for seamless loop */}
      <div className={styles.codeScrollMask} aria-hidden="true">
        <div className={styles.codeScrollInner}>
          {[...CODE_LINES, ...CODE_LINES].map((line, i) => (
            <div key={i} className={styles.codeLine}>
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

/**
 * Uptime registry: a compact telemetry widget in the top-right
 * corner showing a live HH:MM:SS counter since component mount
 * and a static 99.8% stability metric, with a blinking status dot.
 */
const UptimeRegistryElement = memo(function UptimeRegistryElement() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className={styles.uptimeRegistry}
      aria-label={`System uptime: ${formatUptime(seconds)}`}
      role="status"
    >
      {/* Live uptime counter */}
      <div className={styles.uptimeRow}>
        <span className={styles.uptimeLabel}>UPTIME</span>
        <span className={styles.uptimeValue}>{formatUptime(seconds)}</span>
      </div>

      {/* Static stability metric */}
      <div className={styles.uptimeRow}>
        <span className={styles.uptimeLabel}>STABILITY</span>
        <span className={styles.uptimeValue}>99.8%</span>
      </div>

      {/* Online indicator dot */}
      <div className={styles.uptimeDot} aria-hidden="true" />
    </div>
  )
})

/* ════════════════════════════════════════════════════════════════
   §6  ZOO LAYER ELEMENTS
   ════════════════════════════════════════════════════════════════ */

/**
 * Enclosure perimeter: four asymmetric wireframe boundary boxes
 * that divide the zoo habitat card into distinct habitat cells.
 * Each box is an absolutely-positioned border-only div.
 */
const EnclosurePerimeterElement = memo(function EnclosurePerimeterElement() {
  // Four asymmetric enclosure cells defined as {top, left, width, height} percentages
  const cells: { top: string; left: string; width: string; height: string }[] = [
    { top: '8%',  left: '5%',  width: '54%', height: '40%' },   // top-left large cell
    { top: '8%',  left: '63%', width: '32%', height: '40%' },   // top-right small cell
    { top: '54%', left: '5%',  width: '37%', height: '38%' },   // bottom-left small cell
    { top: '54%', left: '46%', width: '49%', height: '38%' },   // bottom-right large cell
  ]

  return (
    <div className={styles.enclosurePerimeter} aria-hidden="true">
      {cells.map((pos, i) => (
        <div
          key={i}
          className={styles.enclosureCell}
          style={{ top: pos.top, left: pos.left, width: pos.width, height: pos.height }}
        />
      ))}
    </div>
  )
})

/**
 * Botanical canopy: an SVG block of stylized leaf-cluster paths
 * positioned in the top-right margin of the zoo habitat.
 * Sways gently from its top-right anchor.
 */
const BotanicalCanopyElement = memo(function BotanicalCanopyElement() {
  return (
    <svg
      className={styles.botanicalCanopy}
      viewBox="0 0 200 120"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      preserveAspectRatio="xMaxYMin meet"
    >
      {BOTANICAL_PATHS.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="currentColor"
          opacity={0.32 - i * 0.07}
        />
      ))}
    </svg>
  )
})

/**
 * Fauna sprites: three glyph characters that step across the habitat
 * floor at different vertical levels, simulating small animals moving
 * through the enclosures using CSS `steps()` timing.
 */
const FaunaSpritesElement = memo(function FaunaSpritesElement() {
  return (
    <div className={styles.faunaSpritesWrap} aria-hidden="true">
      {FAUNA_SPRITE_CONFIGS.map((cfg, i) => (
        <span
          key={i}
          className={styles.faunaGlyph}
          style={{
            top:             `${cfg.topPct}%`,
            animationDelay:  cfg.animDelay,
            animationDuration: cfg.animDuration,
          }}
        >
          {cfg.glyph}
        </span>
      ))}
    </div>
  )
})

/* ════════════════════════════════════════════════════════════════
   §7  SLOT CONFIGURATION TABLES
   All slot positioning is declared here. Slot wrapper classes
   set `position`, `inset`, `z-index` — never `transform` (which
   would conflict with the `.assetSlotActive` scale transition).
   ════════════════════════════════════════════════════════════════ */

type ModuleId = BiosphereRendererProps['activeModuleId']

/**
 * Internal slot definition: coordinate ID + CSS Module class for
 * the slot wrapper's position within the container grid.
 */
interface SlotConfig {
  coordinateId: string
  slotClass:    string
}

/**
 * Returns the complete ordered slot grid for a given module.
 * The render order corresponds to visual z-index layering:
 * first entry = base layer (z lowest), last = foreground (z highest).
 */
function getSlotConfigs(moduleId: ModuleId): SlotConfig[] {
  switch (moduleId) {
    case 'aquarium':
      return [
        { coordinateId: 'substrate_rocks', slotClass: styles.slotSubstrateRocks },
        { coordinateId: 'kelp_forest',     slotClass: styles.slotKelpForest     },
        { coordinateId: 'neon_fauna',      slotClass: styles.slotNeonFauna      },
      ]
    case 'terminal':
      return [
        { coordinateId: 'ambient_pulse_lines', slotClass: styles.slotAmbientLines    },
        { coordinateId: 'mainframe_node',      slotClass: styles.slotMainframeNode   },
        { coordinateId: 'uptime_registry',     slotClass: styles.slotUptimeRegistry  },
      ]
    case 'zoo':
      return [
        { coordinateId: 'enclosure_perimeter', slotClass: styles.slotEnclosurePerimeter },
        { coordinateId: 'botanical_canopy',    slotClass: styles.slotBotanicalCanopy    },
        { coordinateId: 'fauna_sprites',       slotClass: styles.slotFaunaSprites       },
      ]
  }
}

/**
 * Returns the React node for a given `(moduleId, coordinateId)` pair.
 * Used both by the internal render loop and by `resolveActiveSlots`.
 *
 * Calling this function creates a React element descriptor — it does
 * not mount or render anything.  Safe to call outside the component.
 */
function getSlotContent(moduleId: ModuleId, coordinateId: string): ReactNode {
  if (moduleId === 'aquarium') {
    if (coordinateId === 'substrate_rocks') return <SubstrateRocksElement />
    if (coordinateId === 'kelp_forest')     return <KelpForestElement />
    if (coordinateId === 'neon_fauna')      return <NeonFaunaElement />
  }
  if (moduleId === 'terminal') {
    if (coordinateId === 'ambient_pulse_lines') return <AmbientPulseLinesElement />
    if (coordinateId === 'mainframe_node')      return <MainframeNodeElement />
    if (coordinateId === 'uptime_registry')     return <UptimeRegistryElement />
  }
  if (moduleId === 'zoo') {
    if (coordinateId === 'enclosure_perimeter') return <EnclosurePerimeterElement />
    if (coordinateId === 'botanical_canopy')    return <BotanicalCanopyElement />
    if (coordinateId === 'fauna_sprites')       return <FaunaSpritesElement />
  }
  return null
}

/* ════════════════════════════════════════════════════════════════
   §8  PUBLIC API — resolveActiveSlots
   Exported for external consumers (codex, analytics, debug panels).
   Returns only the slots currently active in the given module.
   ════════════════════════════════════════════════════════════════ */

/**
 * Returns the currently active `RenderingSlot[]` for the given module
 * and asset set.  Filters the full slot grid to entries whose
 * `coordinateId` is present in `activeSet`.
 *
 * Each returned slot carries:
 *   - `coordinateId`  — the asset ID string
 *   - `cssClasses`    — the composed CSS Module class string for the wrapper
 *   - `renderElement` — the fully-constructed React node (unmounted descriptor)
 *
 * This function is pure and safe to call outside the React tree.
 *
 * @example
 * const slots = resolveActiveSlots('aquarium', new Set(['kelp_forest']))
 * // → [{ coordinateId: 'kelp_forest', cssClasses: '...', renderElement: <KelpForestElement /> }]
 */
export function resolveActiveSlots(
  moduleId:  ModuleId,
  activeSet: Set<string>,
): RenderingSlot[] {
  return getSlotConfigs(moduleId)
    .filter(cfg => activeSet.has(cfg.coordinateId))
    .map(cfg => ({
      coordinateId:  cfg.coordinateId,
      cssClasses:    [cfg.slotClass, styles.assetSlot, styles.assetSlotActive].join(' '),
      renderElement: getSlotContent(moduleId, cfg.coordinateId),
    }))
}

/* ════════════════════════════════════════════════════════════════
   §9  STAGE INDICATOR
   ════════════════════════════════════════════════════════════════ */

/**
 * Compact tier badge in the top-left corner of the viewport.
 * Five progress pips visualise the stage-to-max-stage ratio.
 * Always present (not gated by asset unlock state).
 */
function StageIndicator({ currentStage }: { currentStage: number }) {
  return (
    <div
      className={styles.stageIndicator}
      aria-label={`Ecosystem tier ${currentStage} of 5`}
    >
      <span className={styles.stageTierLabel}>T{currentStage}</span>

      <div className={styles.stagePips} aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`${styles.stagePip} ${i < currentStage ? styles.stagePipFilled : ''}`}
          />
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   §10  EMPTY ENVIRONMENT PROMPT
   ════════════════════════════════════════════════════════════════ */

/**
 * Shown when the current module has no unlocked assets.
 * Provides an environment-specific glyph and onboarding hint.
 */
function EmptyEnvironment({ moduleId }: { moduleId: ModuleId }) {
  const MESSAGES: Record<ModuleId, { glyph: string; label: string; hint: string }> = {
    aquarium: {
      glyph: '〰',
      label: 'Ecosystem Empty',
      hint:  'Unlock substrate rocks or kelp forest to begin cultivation.',
    },
    terminal: {
      glyph: '◧',
      label: 'Terminal Offline',
      hint:  'Activate a mainframe node to initialise the monitoring display.',
    },
    zoo: {
      glyph: '◉',
      label: 'Habitat Unoccupied',
      hint:  'Establish an enclosure perimeter to begin habitat construction.',
    },
  }

  const m = MESSAGES[moduleId]

  return (
    <div className={styles.emptyState} role="status" aria-label={m.label}>
      <div className={styles.emptyGlyph} aria-hidden="true">{m.glyph}</div>
      <p className={styles.emptyLabel}>{m.label}</p>
      <p className={styles.emptyHint}>{m.hint}</p>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   §11  MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

/**
 * BiosphereRenderer — deterministic visual ecosystem canvas.
 *
 * Rendering contract:
 *   1. All possible slots for the current `activeModuleId` are always
 *      in the DOM (position: absolute within the container).
 *   2. Inactive slots have `opacity: 0; transform: scale(0.88);
 *      pointer-events: none` via `.assetSlot`.
 *   3. Active slots receive `.assetSlotActive`, triggering the
 *      700ms spring CSS transition — zero layout shift guaranteed.
 *   4. Slot content is conditionally rendered (not in DOM when inactive)
 *      so hooks in sub-elements (e.g. the uptime counter) only run
 *      when the asset is actually unlocked and visible.
 */
export default function BiosphereRenderer({
  activeModuleId,
  unlockedAssets,
  currentStage,
}: BiosphereRendererProps) {

  /* ── O(1) membership test for each slot ─────────────────────── */
  const unlockedSet = useMemo(
    () => new Set(unlockedAssets),
    [unlockedAssets],
  )

  /* ── Slot grid for the current module ───────────────────────── */
  const slotConfigs = useMemo(
    () => getSlotConfigs(activeModuleId),
    [activeModuleId],
  )

  const hasAnyUnlocked = unlockedSet.size > 0

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div
      className={styles.container}
      data-module={activeModuleId}
      data-stage={currentStage}
      role="img"
      aria-label={`${activeModuleId} biosphere environment — ecosystem tier ${currentStage}`}
    >

      {/* ════════════════════════════════════════════════════════
          DETERMINISTIC SLOT GRID
          All slots always in DOM; only visibility changes.
          Conditional content inside prevents hook leakage.
          ════════════════════════════════════════════════════════ */}
      {slotConfigs.map(cfg => {
        const isActive = unlockedSet.has(cfg.coordinateId)

        return (
          <div
            key={cfg.coordinateId}
            className={[
              cfg.slotClass,
              styles.assetSlot,
              isActive ? styles.assetSlotActive : '',
            ].filter(Boolean).join(' ')}
          >
            {/*
              Content rendered only when active — prevents the
              UptimeRegistryElement's setInterval from running
              while uptime_registry is not yet unlocked.
            */}
            {isActive ? getSlotContent(activeModuleId, cfg.coordinateId) : null}
          </div>
        )
      })}

      {/* ════════════════════════════════════════════════════════
          STAGE INDICATOR — always visible, z-index above all slots
          ════════════════════════════════════════════════════════ */}
      <StageIndicator currentStage={currentStage} />

      {/* ════════════════════════════════════════════════════════
          EMPTY STATE — shown only when no assets are unlocked
          ════════════════════════════════════════════════════════ */}
      {!hasAnyUnlocked && (
        <EmptyEnvironment moduleId={activeModuleId} />
      )}

    </div>
  )
}
