'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * BiosphereWidgetHost — Cross-Pillar Component Pinning Shell
 * Step 5.3 — Context-Aware Layout Adaptation
 *
 * A portal-style wrapper that projects any active biosphere
 * environment viewport into non-Games spaces (Study Shield cockpit,
 * Home dashboard) while adapting its footprint, opacity, and
 * interactivity to suit the host context.
 *
 * Context adaptation rules:
 *
 *   games_tab      → Full pane (w-full h-full min-h-[400px]).
 *                    Full interactivity. Renders the home-pinned
 *                    environment; falls back to terminal when none
 *                    is pinned.
 *
 *   study_shield   → Horizontal cockpit strip (w-full h-32).
 *                    Interactivity disabled via `inert`.
 *                    Frosted-glass backdrop-filter overlay blends
 *                    moving bio-assets beneath the Pomodoro timer.
 *                    Reads `isActiveStudyDisplay` pin.
 *
 *   dashboard_home → Square grid tile (max-w-sm aspect-square).
 *                    Full interactivity. Stage overlay in bottom-
 *                    right corner shows "Stage: 0N".
 *                    Reads `isActiveHomeDisplay` pin.
 *
 * Exclusive Mount Rule:
 *   Only one environment can be the active display per context.
 *   Pin mutations route through `setExclusivePinnedDisplay` in
 *   BiosphereStateManager (§11b), which enforces atomicity across
 *   all three environment rows in a single Dexie transaction.
 *   External callers use `useBiospherePinning` to trigger pins.
 *
 * Design constraints:
 *   • Never duplicates BiosphereRenderer layout logic (Step 5.2).
 *   • CSS Modules only — no inline style objects beyond opacity
 *     (driven by ContextDisplayConfig.opacityAlpha at runtime).
 *   • SSR-safe: useBiosphereState handles the gamesDb null-cast.
 * ════════════════════════════════════════════════════════════════
 */

import { useMemo }             from 'react'
import { useBiosphereState }   from '@/hooks/useBiosphereState'
import BiosphereRenderer       from '@/components/games/base/BiosphereRenderer'
import type { BiosphereStateRecord } from '@/lib/gamesDb'
import type { BiosphereStateMap }    from '@/hooks/useBiosphereState'
import styles from './BiosphereWidgetHost.module.css'

/* ════════════════════════════════════════════════════════════════
   §1  PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

/**
 * The three spaces into which a biosphere environment can be projected.
 * Each context triggers a distinct layout configuration in the host.
 */
export type LayoutContextType =
  | 'games_tab'       // Primary shell view — full size, full interactivity
  | 'study_shield'    // Ambient cockpit strip — distraction-free, frosted overlay
  | 'dashboard_home'  // Minimal dashboard tile — square card, stage badge

/**
 * Props accepted by the default BiosphereWidgetHost export.
 *
 * `fallbackFallbackClassName` is an optional escape hatch — it is appended
 * to the host's class list so parent containers can fine-tune the
 * host's own box model without overriding internal layout classes.
 */
export interface BiosphereWidgetHostProps {
  context: LayoutContextType
  fallbackFallbackClassName?: string
}

/**
 * Static descriptor for how the host should behave in each context.
 * Exported so external panels (e.g. a settings page) can read the
 * intended config without importing the full component.
 */
export interface ContextDisplayConfig {
  /** Human-readable size descriptor (mirrors Tailwind notation). */
  dimensions:    string
  /** Whether the rendered biosphere accepts pointer / keyboard events. */
  interactivity: boolean
  /** Renderer layer opacity (0–1). Applied inline to the renderer wrapper. */
  opacityAlpha:  number
  /** CSS blur value applied to the frosted-glass overlay. */
  blurStrength:  string
}

/* ════════════════════════════════════════════════════════════════
   §2  CONTEXT CONFIGURATION MAP
   ════════════════════════════════════════════════════════════════ */

/**
 * Static configuration object exported so callers can inspect the
 * design spec for each context without mounting the component.
 */
export const CONTEXT_CONFIGS: Readonly<Record<LayoutContextType, ContextDisplayConfig>> = {
  games_tab: {
    dimensions:    'w-full h-full min-h-[400px]',
    interactivity: true,
    opacityAlpha:  1.0,
    blurStrength:  '0px',
  },
  study_shield: {
    dimensions:    'w-full h-32',
    interactivity: false,
    opacityAlpha:  0.4,
    blurStrength:  '12px',
  },
  dashboard_home: {
    dimensions:    'aspect-square max-w-sm',
    interactivity: true,
    opacityAlpha:  1.0,
    blurStrength:  '0px',
  },
} as const

/* ════════════════════════════════════════════════════════════════
   §3  CSS MODULE CLASS MAP
   ════════════════════════════════════════════════════════════════ */

const CONTEXT_CLASS: Record<LayoutContextType, string> = {
  games_tab:      styles.hostGamesTab,
  study_shield:   styles.hostStudyShield,
  dashboard_home: styles.hostDashboardHome,
}

/* ════════════════════════════════════════════════════════════════
   §4  PURE ENVIRONMENT RESOLVER
   ────────────────────────────────────────────────────────────────
   Determines which BiosphereStateRecord to render for the given
   context by consulting the pin flags on the live states map.
   ════════════════════════════════════════════════════════════════ */

function resolveActiveRecord(
  context: LayoutContextType,
  states: BiosphereStateMap | null,
): BiosphereStateRecord | null {
  if (!states) return null

  const ordered = [states.terminal, states.aquarium, states.zoo] as const

  if (context === 'study_shield') {
    // Show the environment pinned for the study cockpit display.
    return ordered.find(r => r.isActiveStudyDisplay) ?? null
  }

  if (context === 'dashboard_home') {
    // Show the environment pinned for the home dashboard display.
    return ordered.find(r => r.isActiveHomeDisplay) ?? null
  }

  // games_tab: prefer the home-pinned environment for visual continuity;
  // fall back to terminal (always seeded, even at stage 1 / zero assets).
  return ordered.find(r => r.isActiveHomeDisplay) ?? states.terminal
}

/* ════════════════════════════════════════════════════════════════
   §5  MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function BiosphereWidgetHost({
  context,
  fallbackFallbackClassName,
}: BiosphereWidgetHostProps) {

  const { isLoading, states } = useBiosphereState()

  const config       = CONTEXT_CONFIGS[context]
  const contextClass = CONTEXT_CLASS[context]

  const activeRecord = useMemo(
    () => resolveActiveRecord(context, states),
    [context, states],
  )

  // Compose root class list — filter falsy entries for clean output
  const rootClasses = [
    styles.hostBase,
    contextClass,
    fallbackFallbackClassName,
  ].filter(Boolean).join(' ')

  /* ── Phase 1: IDB boot frame skeleton ─────────────────────── */
  if (isLoading) {
    return (
      <div
        className={`${rootClasses} ${styles.skeletonState}`}
        aria-hidden="true"
        aria-label="Loading biosphere"
      />
    )
  }

  /* ── Phase 2: No environment pinned for this context ────────
     study_shield and dashboard_home require an explicit pin.
     games_tab always resolves (terminal fallback handles it).   */
  if (!activeRecord) {
    const hint =
      context === 'study_shield'
        ? 'Pin an environment in the Games Tab → Biosphere Station → ⊙ to enable ambient cockpit mode.'
        : 'Pin an environment in the Games Tab → Biosphere Station → ⊙ to show it on the home dashboard.'

    return (
      <div className={rootClasses} role="status" aria-label="No biosphere pinned">
        <div className={styles.unpinnedState}>
          <span className={styles.unpinnedGlyph} aria-hidden="true">◫</span>
          <p className={styles.unpinnedLabel}>No biosphere pinned</p>
          <p className={styles.unpinnedHint}>{hint}</p>
        </div>
      </div>
    )
  }

  /* ── Phase 3: Active record resolved — render the biosphere ─ */
  const unlockedIds  = activeRecord.unlockedAssets.map(a => a.id)
  const isInteractive = config.interactivity
  const stageLabel   = String(activeRecord.currentStage).padStart(2, '0')

  return (
    <div
      className={rootClasses}
      aria-label={`${activeRecord.environmentId} biosphere — ${context.replace('_', ' ')} display`}
    >
      {/* ── Renderer layer ─────────────────────────────────────
          opacity driven by ContextDisplayConfig.opacityAlpha.
          `inert` is set for study_shield to fully suppress all
          pointer events, keyboard focus, and accessibility tree
          participation — cleaner than pointer-events: none alone. */}
      <div
        className={styles.rendererLayer}
        style={{ opacity: config.opacityAlpha }}
        aria-hidden={!isInteractive ? true : undefined}
        inert={!isInteractive ? true : undefined}
      >
        <BiosphereRenderer
          activeModuleId={activeRecord.environmentId}
          unlockedAssets={unlockedIds}
          currentStage={activeRecord.currentStage}
        />
      </div>

      {/* ── Study Shield frosted-glass overlay ─────────────────
          Rendered above the renderer (z-index: 1) in the local
          stacking context.  backdrop-filter: blur() frosts the
          renderer pixels behind this overlay, creating the
          ambient "bio-assets beneath the Pomodoro timer" effect. */}
      {context === 'study_shield' && (
        <div className={styles.studyShieldOverlay} aria-hidden="true" />
      )}

      {/* ── Dashboard stage badge ───────────────────────────────
          Tiny monospaced counter in the bottom-right corner —
          "Stage: 01" through "Stage: 05". */}
      {context === 'dashboard_home' && (
        <div
          className={styles.stageBadge}
          aria-label={`Ecosystem stage ${activeRecord.currentStage} of 5`}
        >
          Stage: {stageLabel}
        </div>
      )}
    </div>
  )
}
