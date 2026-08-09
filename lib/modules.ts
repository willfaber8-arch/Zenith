/* ════════════════════════════════════════════════════════════════════
   Zenith Module Registry — the single source of truth for what a module
   is, where it appears, and what it contributes to the dashboard.

   ── WHY THIS FILE EXISTS ────────────────────────────────────────────

   Adding a module used to mean editing four places that had no
   knowledge of each other:

     1. ViewId union            (lib/nav-config.ts)
     2. NAV_CONFIG tree         (lib/nav-config.ts)
     3. resolveView() switch    (components/ViewRouter.tsx)
     4. WIDGET_VIEWS map        (lib/hooks/useSandboxConfig.ts)

   Nothing enforced agreement between them, and they had already drifted:
   `workouts`, `subscriptions`, `friends-network` and `tournament-hub`
   all shipped working views and dashboard widgets while being absent
   from the sidebar entirely — reachable only by clicking a widget.

   Now: one entry here, one view component, done. The nav tree, the
   router and the widget→module mapping are all derived from this array,
   so they cannot disagree.

   ── ADDING A MODULE ─────────────────────────────────────────────────

     1. Add an entry below (id, label, description, icon, color, nav,
        widgets, enabled).
     2. Create components/views/<Name>View.tsx.
     3. Register it in MODULE_VIEWS in components/ViewRouter.tsx.

   Nothing in AppShell, the dashboard, or the category system needs to
   change. Set `enabled: false` to build a module in the open without
   surfacing it to the user — it stays out of the nav and the router
   renders it as unavailable.

   ── WHY NOT FILE-BASED ROUTES ───────────────────────────────────────

   Zenith is a single client-routed surface: app/page.tsx renders
   <ViewRouter/>, and vercel.json rewrites every path back to it. That
   is what makes view switching instant with no server round trip, and
   what the two-phase cross-fade in ViewRouter depends on. Modules are
   therefore registry entries rather than /app/<module>/page.tsx folders.
   Code splitting is preserved by lib/dynamicViews.tsx, which wraps the
   heavy views in next/dynamic — so a module still only downloads when
   it is opened.
   ════════════════════════════════════════════════════════════════════ */

export type CategoryId = 'essentials' | 'creator' | 'vault'

export type ViewId =
  | 'home'
  | 'outlook'
  // Essentials → Scholastic
  | 'uni-hub'
  | 'study-shield'
  | 'vocab-builder'
  // Essentials → Life
  | 'calendar'
  | 'habits'
  | 'workouts'
  | 'wellness'
  | 'meal-planning'
  | 'world-events'
  | 'sports'
  | 'personal-brand'
  | 'subscriptions'
  | 'game-finder'
  | 'friends-network'
  | 'book-tracker'
  | 'tournament-hub'
  // Creator's Choice
  | 'trail-hunter'
  | 'botanist'
  | 'games'
  | 'cube-timer'
  // Personalized Vault
  | 'notes'
  | 'custom-links'
  | 'stats'
  // System
  | 'settings'
  | 'help'

/** Sidebar placement. `null` = routable but deliberately not listed. */
export interface ModuleNavPlacement {
  category: CategoryId
  /** Sub-heading within the category. Omit for a direct category child. */
  group?:   'overview' | 'scholastic' | 'life'
  /** Ascending sort within the group. */
  order:    number
}

export interface ZenithModule {
  id:    ViewId
  label: string
  /** One line, shown in the module directory and as nav tooltip copy. */
  description: string
  /** Lucide icon name. Kept as a string so this file stays render-free
   *  and importable from anywhere, including the server. */
  icon:  string
  /** Unique hex accent — drives nav hover glow and widget top-edge. */
  color: string
  /** false = hidden from nav and refused by the router. Build-time flag,
   *  distinct from the user's own per-item hide (zenith_hidden_nav_items_v1). */
  enabled: boolean
  /** Where it sits in the sidebar, or null for system / deep-link-only. */
  nav: ModuleNavPlacement | null
  /** Dashboard widget keys this module contributes. Inverted into the
   *  widget→module lookup the widget grid uses for click-through. */
  widgets: readonly string[]
}

/* ── The registry ──────────────────────────────────────────────────── */

export const MODULE_REGISTRY: readonly ZenithModule[] = [
  /* ── Home / system ───────────────────────────────────────────────── */
  {
    id: 'home', label: 'Home',
    description: 'Your dashboard — a live summary pulled from every enabled module.',
    icon: 'LayoutDashboard', color: '#7c95ff', enabled: true,
    nav: null,   // rendered as its own nav button above the categories
    widgets: ['timerWidget', 'stopwatch', 'counter'],
  },
  {
    id: 'settings', label: 'Settings',
    description: 'Themes, account, data backup and restore, privacy.',
    icon: 'Settings', color: '#9ba3c4', enabled: true,
    nav: null,   // sidebar footer
    widgets: [],
  },
  {
    id: 'help', label: 'Help & Feedback',
    description: 'Guided tour, shortcuts, and how Zenith handles your data.',
    icon: 'CircleHelp', color: '#9ba3c4', enabled: true,
    nav: null,   // sidebar footer
    widgets: [],
  },

  /* ── Essentials · Overview ───────────────────────────────────────── */
  {
    id: 'outlook', label: 'Daily Outlook',
    description: 'Today at a glance — schedule, tasks and weather in one column.',
    icon: 'Sunrise', color: '#7c95ff', enabled: true,
    nav: { category: 'essentials', group: 'overview', order: 0 },
    widgets: [],
  },

  /* ── Essentials · Scholastic ─────────────────────────────────────── */
  {
    id: 'uni-hub', label: 'University Hub',
    description: 'Campus resources, GPA, cognitive load and campus finances.',
    icon: 'GraduationCap', color: '#6366f1', enabled: true,
    nav: { category: 'essentials', group: 'scholastic', order: 0 },
    widgets: ['uniHub', 'gpaWidget'],
  },
  {
    id: 'study-shield', label: 'Study Shield',
    description: 'Focus sessions, AI study tools and shared focus rooms.',
    icon: 'ShieldCheck', color: '#38bdf8', enabled: true,
    nav: { category: 'essentials', group: 'scholastic', order: 1 },
    widgets: ['pomodoroPreview', 'studyStreak'],
  },
  {
    id: 'vocab-builder', label: 'Vocab Builder',
    description: 'Spaced-repetition vocabulary with an SM-2 review schedule.',
    icon: 'Languages', color: '#06b6d4', enabled: true,
    nav: { category: 'essentials', group: 'scholastic', order: 2 },
    widgets: ['vocabTracker'],
  },

  /* ── Essentials · Life ───────────────────────────────────────────── */
  {
    id: 'habits', label: 'Habits',
    description: 'Daily habit tracking with streaks and 30-day trends.',
    icon: 'Repeat', color: '#f87171', enabled: true,
    nav: { category: 'essentials', group: 'life', order: 0 },
    widgets: ['habitSummary'],
  },
  {
    id: 'calendar', label: 'Universal Calendar',
    description: 'Personal events, iCal feeds and generated class schedules.',
    icon: 'CalendarDays', color: '#60a5fa', enabled: true,
    nav: { category: 'essentials', group: 'life', order: 1 },
    widgets: ['calendarToday', 'localWeather'],
  },
  {
    id: 'meal-planning', label: 'Meal Planning',
    description: 'Weekly meal planner, recipes, budget and kitchen setup.',
    icon: 'UtensilsCrossed', color: '#86efac', enabled: true,
    nav: { category: 'essentials', group: 'life', order: 2 },
    widgets: ['mealToday'],
  },
  {
    id: 'wellness', label: 'Mental Wellness',
    description: 'Mood logging with a monthly history calendar.',
    icon: 'HeartPulse', color: '#f9a8d4', enabled: true,
    nav: { category: 'essentials', group: 'life', order: 3 },
    widgets: ['wellnessCheck'],
  },
  {
    id: 'book-tracker', label: 'Library',
    description: 'Reading shelves, Kindle highlights and cover art.',
    icon: 'Library', color: '#f97316', enabled: true,
    nav: { category: 'essentials', group: 'life', order: 4 },
    widgets: ['readingTracker'],
  },
  /* These four shipped with working views and dashboard widgets but were
     never added to NAV_CONFIG, so the only way to reach them was to click
     their widget. Listing them is the drift this registry exists to stop. */
  {
    id: 'workouts', label: 'Workouts',
    description: 'Cardio logging, Vitality Points and the Cozy Biome.',
    icon: 'Dumbbell', color: '#fb923c', enabled: true,
    nav: { category: 'essentials', group: 'life', order: 5 },
    widgets: ['cardioSummary'],
  },
  {
    id: 'subscriptions', label: 'Subscriptions',
    description: 'Recurring expenses with a monthly burn-rate gauge.',
    icon: 'CreditCard', color: '#fda4af', enabled: true,
    nav: { category: 'essentials', group: 'life', order: 6 },
    widgets: [],
  },
  {
    id: 'friends-network', label: 'Friend Ledger',
    description: 'Peer-to-peer friend sync, leaderboard and letterbox.',
    icon: 'Users', color: '#5eead4', enabled: true,
    // Reached from the sidebar footer's "Friends" button, so deliberately
    // not also listed under Life — that would render it twice.
    nav: null,
    widgets: ['letterbox', 'distanceTracker'],
  },

  /* ── Creator's Choice ────────────────────────────────────────────── */
  {
    id: 'trail-hunter', label: 'Trail Hunter',
    description: 'Hiking trail directory with filters and GPX export.',
    icon: 'Mountain', color: '#22c55e', enabled: true,
    nav: { category: 'creator', order: 0 },
    widgets: [],
  },
  {
    id: 'botanist', label: 'Botanist Guide',
    description: 'Houseplant care tracker with a 30-species catalog.',
    icon: 'Sprout', color: '#4ade80', enabled: true,
    nav: { category: 'creator', order: 1 },
    widgets: [],
  },
  {
    id: 'games', label: 'Arcade',
    description: 'Arcade games, the crucible economy and biosphere.',
    icon: 'Gamepad2', color: '#a3e635', enabled: true,
    nav: { category: 'creator', order: 2 },
    widgets: ['arcadeEconomy'],
  },
  {
    id: 'sports', label: 'Sports Tracker',
    description: 'Followed teams, fixtures and results.',
    icon: 'Trophy', color: '#34d399', enabled: true,
    nav: { category: 'creator', order: 3 },
    widgets: ['sportsTeams'],
  },
  {
    id: 'cube-timer', label: 'Cube Timer',
    description: 'Speedsolving timer with scrambles and session stats.',
    icon: 'Box', color: '#10b981', enabled: true,
    nav: { category: 'creator', order: 4 },
    widgets: [],
  },
  {
    id: 'world-events', label: 'World Events',
    description: 'Headlines from BBC World, NPR and The Guardian.',
    icon: 'Newspaper', color: '#818cf8', enabled: true,
    nav: { category: 'creator', order: 5 },
    widgets: ['newsHeadline'],
  },
  {
    id: 'personal-brand', label: 'Personal Brand Hub',
    description: 'Career resources and an AI post generator.',
    icon: 'Briefcase', color: '#fbbf24', enabled: true,
    nav: { category: 'creator', order: 6 },
    widgets: [],
  },
  {
    id: 'game-finder', label: 'Game Hub',
    description: 'Multiplayer game directory with a filter matrix.',
    icon: 'Joystick', color: '#c084fc', enabled: true,
    nav: { category: 'creator', order: 7 },
    widgets: [],
  },
  {
    id: 'tournament-hub', label: 'Tournament Hub',
    description: 'Brackets and standings for friend competitions.',
    icon: 'Swords', color: '#e879f9', enabled: true,
    nav: { category: 'creator', order: 8 },
    widgets: [],
  },

  /* ── Personalized Vault ──────────────────────────────────────────── */
  {
    id: 'notes', label: 'Notes',
    description: 'Somewhere to put a thought before you know what it is.',
    icon: 'NotebookPen', color: '#eab308', enabled: true,
    nav: { category: 'vault', order: 0 },
    widgets: ['notesRecent'],
  },
  {
    id: 'custom-links', label: 'Custom Link Manager',
    description: 'Your own categorised bookmarks with fetched favicons.',
    icon: 'Link', color: '#94a3b8', enabled: true,
    nav: { category: 'vault', order: 1 },
    widgets: ['customLinks'],
  },
  {
    id: 'stats', label: 'Stats & Analytics',
    description: 'Cross-module analytics and the arcade economy ledger.',
    icon: 'ChartLine', color: '#f59e0b', enabled: true,
    nav: { category: 'vault', order: 2 },
    widgets: [],
  },
]

/* ── Lookups ───────────────────────────────────────────────────────── */

export const MODULE_MAP: ReadonlyMap<ViewId, ZenithModule> =
  new Map(MODULE_REGISTRY.map(m => [m.id, m]))

export function getModule(id: ViewId): ZenithModule | undefined {
  return MODULE_MAP.get(id)
}

/** Build-time availability. Distinct from the user's own sidebar hiding. */
export function isModuleEnabled(id: ViewId): boolean {
  return MODULE_MAP.get(id)?.enabled ?? false
}

export const ENABLED_MODULES: readonly ZenithModule[] =
  MODULE_REGISTRY.filter(m => m.enabled)

/**
 * widget key → owning module id.
 *
 * Derived by inverting each module's `widgets`, so a widget cannot end up
 * pointing at a module that does not claim it. Previously this was a
 * hand-maintained map in useSandboxConfig with no link to the nav at all.
 */
export const WIDGET_OWNER: Readonly<Record<string, ViewId>> =
  Object.fromEntries(
    MODULE_REGISTRY.flatMap(m => m.widgets.map(w => [w, m.id] as const)),
  )
