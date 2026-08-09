'use client'

/**
 * ViewRouter.tsx
 * Phase 12.2 — Lazy-loaded view switcher
 *
 * Two-phase cross-fade transition:
 *   1. Exit: opacity → 0, scale → 0.98  (200ms ease)
 *   2. Swap displayed view, then:
 *      Enter: opacity → 1, scale → 1   (300ms ease-out)
 *
 * Heavy views are resolved from lib/dynamicViews.tsx which wraps each
 * view in `next/dynamic({ ssr: false })`.  When the router switches to
 * a view that hasn't been downloaded yet, the shimmer <ViewSkeleton>
 * appears for the duration of the chunk download, then the live component
 * mounts seamlessly — zero layout shift.
 *
 * Lightweight views (HomeView, UniHubView, StudyShieldView, BotanistView,
 * SlopeDayView/WellnessView, CustomLinksView, PlaceholderView, SettingsView)
 * remain as direct synchronous imports because they are small enough that
 * splitting them would add more network round-trips than they save.
 */

import { useState, useEffect, type JSX } from 'react'
import { useNav }       from '@/lib/NavContext'
import type { ViewId }  from '@/lib/nav-config'
import {
  MODULE_REGISTRY, MODULE_MAP, isModuleEnabled,
} from '@/lib/modules'

/* ── Synchronous imports (small, used frequently) ──────────── */
import HomeView        from '@/components/views/HomeView'
import OutlookView     from '@/components/views/OutlookView'
import UniHubView      from '@/components/views/UniHubView'
import StudyShieldView from '@/components/views/StudyShieldView'
import BotanistView    from '@/components/views/BotanistView'
import WellnessView    from '@/components/views/SlopeDayView'
import CustomLinksView from '@/components/views/CustomLinksView'
import NotesView       from '@/components/views/NotesView'
import PlaceholderView from '@/components/views/PlaceholderView'
import SettingsView    from '@/components/views/SettingsView'
import HelpView        from '@/components/views/HelpView'
import SportsView      from '@/components/views/SportsView'

/* ── Lazy imports (heavy, infrequently-needed on initial load) ── */
import {
  LazyCalendarView             as CalendarView,
  LazyHabitsView               as HabitsView,
  LazyTrailHunterView          as TrailHunterView,
  LazyFriendsNetworkView       as FriendsNetworkView,
  LazyBookTrackerView          as BookTrackerView,
  LazyTournamentHubView        as TournamentHubView,
  LazyGamesTabShell            as GamesTabShell,
  LazyGamesArcade              as GamesArcade,
  LazyPuzzleLounge             as PuzzleLounge,
  LazyVocabBuilderView         as VocabBuilderView,
  LazyMealPlanningView         as MealPlanningView,
  LazySubscriptionPackagesView as SubscriptionPackagesView,
  LazyStatsView                as StatsView,
  LazyPersonalBrandView        as PersonalBrandView,
  LazyWorldEventsView          as WorldEventsView,
  LazyWorkoutsView             as WorkoutsView,
  LazyCubeTimerView            as CubeTimerView,
} from '@/lib/dynamicViews'

/* GameFinderView is small (wraps a single component) — keep synchronous */
import GameFinderView from '@/components/views/GameFinderView'

/* ── View resolver ────────────────────────────────────────────── */

/**
 * ViewId → element factory.
 *
 * A map rather than a switch so it can be checked against the module
 * registry: every enabled module must have an entry here, and every entry
 * must name a real module. A typo or a half-added module now shows up as
 * a dev-time warning instead of silently falling through to the home view.
 *
 * Factories (not elements) so a lazy chunk is only constructed when the
 * view is actually rendered.
 */
const MODULE_VIEWS: Record<ViewId, () => JSX.Element> = {
  'home':            () => <HomeView />,
  'outlook':         () => <OutlookView />,
  'uni-hub':         () => <UniHubView />,
  'calendar':        () => <CalendarView />,
  'study-shield':    () => <StudyShieldView />,
  'trail-hunter':    () => <TrailHunterView />,
  'botanist':        () => <BotanistView />,
  'cube-timer':      () => <CubeTimerView />,
  'wellness':        () => <WellnessView />,
  'habits':          () => <HabitsView />,
  'notes':           () => <NotesView />,
  'custom-links':    () => <CustomLinksView />,
  'meal-planning':   () => <MealPlanningView />,
  'workouts':        () => <WorkoutsView />,
  'world-events':    () => <WorldEventsView />,
  'sports':          () => <SportsView />,
  'personal-brand':  () => <PersonalBrandView />,
  'vocab-builder':   () => <VocabBuilderView />,
  'subscriptions':   () => <SubscriptionPackagesView />,
  'game-finder':     () => <GameFinderView />,
  'friends-network': () => <FriendsNetworkView />,
  'book-tracker':    () => <BookTrackerView />,
  'tournament-hub':  () => <TournamentHubView />,
  'stats':           () => <StatsView />,
  'settings':        () => <SettingsView />,
  'help':            () => <HelpView />,

  /**
   * GamesTabShell accepts an `arcadeContent` slot prop.
   * By passing LazyGamesArcade as the slot, the six canvas games are
   * split into a *second* separate chunk that only downloads when the
   * user navigates to the Arcade tab — not on initial Games Hub mount.
   */
  'games': () => (
    <GamesTabShell arcadeContent={<GamesArcade />} puzzleContent={<PuzzleLounge />} />
  ),
}

/* Registry ↔ router agreement check. Dev-only: a mismatch is a wiring
   mistake, not a user-facing error, and the cost of finding it at the
   moment you add a module is far lower than finding it in production. */
if (process.env.NODE_ENV !== 'production') {
  for (const m of MODULE_REGISTRY) {
    if (m.enabled && !MODULE_VIEWS[m.id]) {
      console.warn(`[modules] "${m.id}" is enabled in the registry but has no view in ViewRouter.`)
    }
  }
  for (const id of Object.keys(MODULE_VIEWS) as ViewId[]) {
    if (!MODULE_MAP.has(id)) {
      console.warn(`[modules] ViewRouter renders "${id}", which is not in the module registry.`)
    }
  }
}

function resolveView(id: ViewId): JSX.Element {
  /* A module turned off in the registry must not be reachable, even via a
     stale localStorage view id or a hand-edited deep link. */
  if (!isModuleEnabled(id)) return <HomeView />

  const factory = MODULE_VIEWS[id]
  return factory ? factory() : <HomeView />
}

/* ── ViewRouter ───────────────────────────────────────────────── */

const EXIT_MS = 200

export default function ViewRouter() {
  const { activeView } = useNav()
  const [displayed, setDisplayed] = useState<ViewId>(activeView)
  const [visible,   setVisible]   = useState(true)

  useEffect(() => {
    if (activeView === displayed) return

    setVisible(false)

    const t = setTimeout(() => {
      setDisplayed(activeView)
      setVisible(true)
    }, EXIT_MS)

    return () => clearTimeout(t)
  }, [activeView]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'scale(1)' : 'scale(0.98)',
        transition: visible
          ? `opacity 300ms cubic-bezier(0.16,1,0.3,1),
             transform 300ms cubic-bezier(0.16,1,0.3,1)`
          : `opacity ${EXIT_MS}ms ease,
             transform ${EXIT_MS}ms ease`,
        pointerEvents: visible ? undefined : 'none',
      }}
    >
      {resolveView(displayed)}
    </div>
  )
}
