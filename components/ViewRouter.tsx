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

/* ── Synchronous imports (small, used frequently) ──────────── */
import HomeView        from '@/components/views/HomeView'
import UniHubView      from '@/components/views/UniHubView'
import StudyShieldView from '@/components/views/StudyShieldView'
import BotanistView    from '@/components/views/BotanistView'
import WellnessView    from '@/components/views/SlopeDayView'
import CustomLinksView from '@/components/views/CustomLinksView'
import PlaceholderView from '@/components/views/PlaceholderView'
import SettingsView    from '@/components/views/SettingsView'

/* ── Lazy imports (heavy, infrequently-needed on initial load) ── */
import {
  LazyCalendarView             as CalendarView,
  LazyHabitsView               as HabitsView,
  LazyAquascapingView          as AquascapingView,
  LazyTrailHunterView          as TrailHunterView,
  LazyFriendsNetworkView       as FriendsNetworkView,
  LazyBookTrackerView          as BookTrackerView,
  LazyTournamentHubView        as TournamentHubView,
  LazyGamesTabShell            as GamesTabShell,
  LazyGamesArcade              as GamesArcade,
  LazyVocabBuilderView         as VocabBuilderView,
  LazyMealPlanningView         as MealPlanningView,
  LazySubscriptionPackagesView as SubscriptionPackagesView,
  LazyStatsView                as StatsView,
  LazyPersonalBrandView        as PersonalBrandView,
  LazyWorldEventsView          as WorldEventsView,
  LazyWorkoutsView             as WorkoutsView,
} from '@/lib/dynamicViews'

/* GameFinderView is small (wraps a single component) — keep synchronous */
import GameFinderView from '@/components/views/GameFinderView'

/* ── View resolver ────────────────────────────────────────────── */

function resolveView(id: ViewId): JSX.Element {
  if (id === 'home')            return <HomeView />
  if (id === 'uni-hub')         return <UniHubView />
  if (id === 'calendar')        return <CalendarView />
  if (id === 'study-shield')    return <StudyShieldView />
  if (id === 'aquascaping')     return <AquascapingView />
  if (id === 'trail-hunter')    return <TrailHunterView />
  if (id === 'botanist')        return <BotanistView />
  if (id === 'wellness')        return <WellnessView />
  if (id === 'habits')          return <HabitsView />
  if (id === 'custom-links')    return <CustomLinksView />
  if (id === 'meal-planning')   return <MealPlanningView />
  if (id === 'workouts')        return <WorkoutsView />
  if (id === 'world-events')    return <WorldEventsView />
  if (id === 'personal-brand')  return <PersonalBrandView />
  if (id === 'vocab-builder')   return <VocabBuilderView />
  if (id === 'subscriptions')   return <SubscriptionPackagesView />
  if (id === 'game-finder')     return <GameFinderView />
  if (id === 'friends-network') return <FriendsNetworkView />
  if (id === 'book-tracker')    return <BookTrackerView />
  if (id === 'tournament-hub')  return <TournamentHubView />
  if (id === 'stats')           return <StatsView />
  if (id === 'settings')        return <SettingsView />

  if (id === 'games') {
    /**
     * GamesTabShell accepts an `arcadeContent` slot prop.
     * By passing LazyGamesArcade as the slot, the six canvas games are
     * split into a *second* separate chunk that only downloads when the
     * user navigates to the Arcade tab — not on initial Games Hub mount.
     *
     * Load order:
     *   1. User clicks "Arcade Hub" → GamesTabShell chunk downloads
     *      (shell, BiosphereRenderer, SkillTree, Crucible, economy hooks)
     *   2. GamesTabShell renders with shimmer in arcadeContent slot
     *   3. User clicks "Arcade ⬡" tab → GamesArcade chunk downloads
     *      (Minesweeper, ScriptingMatrix, ShiftMatrix, 2048, BioSynth, ZenSnake)
     */
    return <GamesTabShell arcadeContent={<GamesArcade />} />
  }

  return <HomeView />
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
