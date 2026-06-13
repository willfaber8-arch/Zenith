'use client'

/**
 * lib/dynamicViews.tsx
 * Phase 12.2 — Next.js App Router Lazy-Loading Registry
 *
 * Every export here is a `next/dynamic` descriptor with `ssr: false`.
 * Importing from this file gives you a React component that:
 *   1. Renders the cozy shimmer <ViewSkeleton> immediately.
 *   2. Downloads the actual view chunk in the background.
 *   3. Swaps the skeleton for the live component with zero layout shift.
 *
 * CLASSIFICATION
 * ──────────────
 * PRIMARY (user-specified targets — mandatory lazy):
 *   LazyFriendsNetworkView     PeerJS / WebRTC — large network library
 *   LazyBackgroundCanvasManager  hardware-accelerated canvas loop
 *   LazyBookTrackerView        Goodreads CSV parser + heavy table logic
 *   LazyTournamentHubView      SVG wheel + bracket builder (new view)
 *
 * EXTENDED (performance optimisations — never needed for initial route):
 *   LazyGamesTabShell          Arcade hub shell — imports all canvas games
 *   LazyGamesArcade            All six canvas games in one chunk
 *   LazyTrailHunterView        Leaflet map + 70-trail dataset
 *   LazyAquascapingView        Three-pane: validator / cart / water log
 *   LazyVocabBuilderView       SM-2 spaced-repetition engine
 *   LazyMealPlanningView       4-tab planner + recipe importer
 *   LazySubscriptionPackagesView  Burn-rate analytics
 *   LazyStatsView              8-metric analytics dashboard
 *   LazyPersonalBrandView      LinkedIn post generator (streams)
 *   LazyWorldEventsView        RSS proxy consumer
 *   LazyWorkoutsView           Cardio log + biome builder
 *   LazyHabitsView             Habit grid + analytics chart
 *   LazyCalendarView           iCal feeds + monthly/weekly grid
 *
 * RULE: Never import these here for server-side rendering.
 * All views in this file are client-only by necessity (canvas, IDB,
 * localStorage, WebRTC, Web Audio).
 *
 * SKELETON VARIANTS
 * ─────────────────
 *   'default'  Two tall cards + three short rows  (most views)
 *   'split'    Two equal side-by-side panes        (FriendsNetwork, Games)
 *   'wide'     Single full-width tall card          (Analytics, GPA)
 */

import dynamic from 'next/dynamic'
import ViewSkeleton, { type SkeletonVariant } from '@/components/ViewSkeleton'

/* ── Loading factory ─────────────────────────────────────────── */

/**
 * Returns a named React component that renders <ViewSkeleton variant={v}>.
 * Named function (not arrow) so React DevTools shows "SkeletonLoader".
 * `loading` prop in next/dynamic requires a component (not a JSX element).
 */
function makeSkeleton(variant: SkeletonVariant) {
  return function SkeletonLoader() {
    return <ViewSkeleton variant={variant} />
  }
}

/** For components that render visually outside the viewport area (canvas
 *  backgrounds, etc.) — show nothing during load rather than a skeleton card. */
function EmptyLoader() { return null }

/* ═══════════════════════════════════════════════════════════════
   PRIMARY TARGETS
   ═══════════════════════════════════════════════════════════════ */

/**
 * FriendsNetworkView — dynamically imports PeerJS (the largest network
 * dependency in the codebase) via a custom SSR-safe `import('peerjs')` hook.
 * Keeping it lazy prevents PeerJS from bloating the initial JS bundle.
 */
export const LazyFriendsNetworkView = dynamic(
  () => import('@/components/views/FriendsNetworkView'),
  {
    ssr:     false,
    loading: makeSkeleton('split'),
  },
)

/**
 * BackgroundCanvasManager — hardware-accelerated canvas animation loop.
 * This runs a requestAnimationFrame loop 60fps from the moment it mounts.
 * Lazy-loading it shaves ~18 KB from the initial parse budget and means the
 * RAF loop doesn't compete with first-paint hydration.
 */
export const LazyBackgroundCanvasManager = dynamic(
  () => import('@/components/BackgroundCanvasManager'),
  {
    ssr:     false,
    loading: EmptyLoader,   // invisible — canvas sits behind all other z-layers
  },
)

/**
 * BookTrackerView — Goodreads CSV import logic + sortable/filterable table.
 * The Papaparse-style CSV parser is bundled with this view; keeping it lazy
 * saves ~22 KB on routes that never visit the Literary Ledger.
 */
export const LazyBookTrackerView = dynamic(
  () => import('@/components/views/BookTrackerView'),
  {
    ssr:     false,
    loading: makeSkeleton('default'),
  },
)

/**
 * TournamentHubView — SVG Wheel of Names + single-elimination Bracket Builder.
 * New view added in Phase 12.2. Lazy from day one — never been in the initial
 * bundle. The inline SVG arc math + bracket state is non-trivial.
 */
export const LazyTournamentHubView = dynamic(
  () => import('@/components/views/TournamentHubView'),
  {
    ssr:     false,
    loading: makeSkeleton('default'),
  },
)

/* ═══════════════════════════════════════════════════════════════
   EXTENDED TARGETS
   ═══════════════════════════════════════════════════════════════ */

/**
 * GamesTabShell — the full Arcade Hub split-screen shell.
 * Bringing in GamesTabShell also pulls in: BiosphereRenderer, SkillTreeCanvas,
 * all six canvas game files, CosmicCrucibleEngine, and three Dexie hooks for
 * the games DB.  This is the heaviest single view chunk in the project.
 */
export const LazyGamesTabShell = dynamic(
  () => import('@/components/games/GamesTabShell'),
  {
    ssr:     false,
    loading: makeSkeleton('split'),
  },
)

/**
 * GamesArcade — the six-game arcade panel rendered inside GamesTabShell's
 * `arcadeContent` slot.  Extracted to its own file (components/games/GamesArcade.tsx)
 * so it can be independently lazy-loaded — meaning the six canvas game
 * implementations only download when the user clicks into the Arcade tab.
 */
export const LazyGamesArcade = dynamic(
  () => import('@/components/games/GamesArcade'),
  {
    ssr:     false,
    loading: makeSkeleton('default'),
  },
)

/**
 * TrailHunterView — embeds Leaflet.js + react-leaflet + CartoDB tile layer.
 * Leaflet is one of the larger map dependencies; keeping it lazy means users
 * who never visit Trail Hunter never pay for it.
 */
export const LazyTrailHunterView = dynamic(
  () => import('@/components/views/TrailHunterView'),
  {
    ssr:     false,
    loading: makeSkeleton('default'),
  },
)

/**
 * AquascapingView — three-pane view: Ecosystem Validator, Supplier Cart,
 * Water Parameter Logger. The water log embeds a pure SVG chart; the cart
 * has a 22-item catalog with vendor math. Reasonably heavy.
 */
export const LazyAquascapingView = dynamic(
  () => import('@/components/views/AquascapingView'),
  {
    ssr:     false,
    loading: makeSkeleton('default'),
  },
)

/**
 * VocabBuilderView — SM-2 spaced-repetition engine with flip-card HUD.
 * Full deck CRUD + IDB v19 schema. Lazy because most sessions don't visit
 * the Polyglot Vault.
 */
export const LazyVocabBuilderView = dynamic(
  () => import('@/components/views/VocabBuilderView'),
  {
    ssr:     false,
    loading: makeSkeleton('default'),
  },
)

/**
 * MealPlanningView — 4-tab planner, recipe URL importer, macro tracking.
 * The recipe import calls /api/recipe-import and handles OG tag parsing;
 * the meal grid has 52 ingredient items. Lazy keeps weekly planners light.
 */
export const LazyMealPlanningView = dynamic(
  () => import('@/components/views/MealPlanningView'),
  {
    ssr:     false,
    loading: makeSkeleton('wide'),
  },
)

/**
 * SubscriptionPackagesView — burn-rate analytics + IDB v21 subscription_items.
 * Hardware-accelerated gauge via CSS custom property animation.
 */
export const LazySubscriptionPackagesView = dynamic(
  () => import('@/components/views/SubscriptionPackagesView'),
  {
    ssr:     false,
    loading: makeSkeleton('default'),
  },
)

/**
 * StatsView — 8-metric analytics dashboard with useLiveQuery aggregation
 * across habits, pomodoro sessions, GPA, and arcade economy tables.
 */
export const LazyStatsView = dynamic(
  () => import('@/components/views/StatsView'),
  {
    ssr:     false,
    loading: makeSkeleton('wide'),
  },
)

/**
 * PersonalBrandView — career resource grid + LinkedIn Post Generator.
 * The generator streams from /api/chat; ReadableStream reader is client-only.
 */
export const LazyPersonalBrandView = dynamic(
  () => import('@/components/views/PersonalBrandView'),
  {
    ssr:     false,
    loading: makeSkeleton('default'),
  },
)

/**
 * WorldEventsView — RSS proxy consumer for BBC / NPR / The Guardian.
 * Fetches /api/world-news on mount; source filter tabs + card grid.
 */
export const LazyWorldEventsView = dynamic(
  () => import('@/components/views/WorldEventsView'),
  {
    ssr:     false,
    loading: makeSkeleton('default'),
  },
)

/**
 * WorkoutsView — cardio log + Cozy Biome builder.
 * Biome builder embeds CSS keyframe animations and uses MediaRecorder API.
 */
export const LazyWorkoutsView = dynamic(
  () => import('@/components/views/WorkoutsView'),
  {
    ssr:     false,
    loading: makeSkeleton('default'),
  },
)

/**
 * HabitsView — daily habit grid, 7-day matrix, 30-day analytics chart.
 * The confetti burst uses a canvas RAF loop; IDB v15 habitCompletions.
 */
export const LazyHabitsView = dynamic(
  () => import('@/components/views/HabitsView'),
  {
    ssr:     false,
    loading: makeSkeleton('default'),
  },
)

/**
 * CalendarView — iCal feed aggregator + week / month / agenda grid.
 * Fetches /api/cal-proxy for each feed subscription; pure-TS iCal parser.
 * The month grid is a 42-cell CSS grid — medium weight.
 */
export const LazyCalendarView = dynamic(
  () => import('@/components/views/CalendarView'),
  {
    ssr:     false,
    loading: makeSkeleton('wide'),
  },
)

/* ═══════════════════════════════════════════════════════════════
   ROOT-LEVEL OVERLAYS (conditionally rendered, never needed at first paint)
   ═══════════════════════════════════════════════════════════════ */

/** AiCopilotSidebar — slide-over chat panel with streaming Anthropic responses.
 *  Only opens when the user clicks the ◎ button; never visible at first paint. */
export const LazyAiCopilotSidebar = dynamic(
  () => import('@/components/AiCopilotSidebar'),
  { ssr: false, loading: EmptyLoader },
)

/** TutorialSpotlight — first-time user walkthrough shown for 3 sessions only.
 *  Saves ~8 KB of modal/animation code from the initial parse budget. */
export const LazyTutorialSpotlight = dynamic(
  () => import('@/components/TutorialSpotlight'),
  { ssr: false, loading: EmptyLoader },
)

/** OnboardingCinematic — first-session boot cinematic that self-removes.
 *  Contains a full database audit engine; never needed after first visit. */
export const LazyOnboardingCinematic = dynamic(
  () => import('@/components/OnboardingCinematic'),
  { ssr: false, loading: EmptyLoader },
)

/** CursorTrailManager — parchment-gold particle dust trail (pointer-events:none).
 *  Pure canvas RAF loop; deferring it means the loop doesn't compete with hydration. */
export const LazyCursorTrailManager = dynamic(
  () => import('@/components/CursorTrailManager'),
  { ssr: false, loading: EmptyLoader },
)
