# Zenith OS — Claude Code Context

## Project Overview

Zenith is a **local-first, minimalist Next.js life dashboard**. No backend, no remote auth — all persistence lives in IndexedDB. The UI aesthetic is Zen-like: high-contrast dark surfaces, low-saturation palette, and precise micro-interaction timing.

**Why it exists:** A unified personal productivity hub covering academics, habits, calendar, and creative tools — all in one offline-capable workspace.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) |
| Local persistence | IndexedDB via Dexie.js v4 (`lib/db.ts`) |
| Cloud persistence | Supabase (PostgreSQL) — `@supabase/supabase-js` |
| Weather | Open-Meteo API (no key, browser geolocation) |
| Fonts | Plus Jakarta Sans + Space Grotesk (Google Fonts via `next/font`) |
| Observability | `@vercel/analytics` (pageviews) + `@vercel/speed-insights` (LCP/INP/CLS) |
| Runtime | Node.js v24.16.0, npm 11.13.0 |

> **Tailwind v4 note:** No `tailwind.config.js` is used or processed. All design tokens live in `app/globals.css` under `@theme`. The file `tailwind.config.ts` exists as a reference/documentation artifact only.

> **Supabase env vars:** Copy `.env.local.example` → `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Without them, sync degrades gracefully to local-only mode.

---

## Dev Server

```bash
npm run dev   # runs on http://localhost:3000
```

Launch config: `.claude/launch.json` → `npm run dev`, port 3000.

---

## Design Token System

### The Two-Layer Pattern

All design values flow from a single source of truth in `app/globals.css`:

```
@theme { --color-bg-main: #0b0d13 }    ← Tailwind class: bg-bg-main
:root  { --bg-main: var(--color-bg-main) }  ← CSS var for component CSS Modules
```

**Rule:** Always change values in `@theme`. Both the Tailwind utility class and the component CSS variable alias update automatically.

### Color Palette

| Token | `@theme` name | `:root` alias | Value |
|---|---|---|---|
| Cosmos Black | `--color-bg-main` | `--bg-main` | `#0b0d13` |
| Indigo-Grey card | `--color-surface-card` | `--surface-card` | `#141923` |
| Periwinkle accent | `--color-accent-purple` | `--accent-purple` | `#7c95ff` |
| Ocean Sage accent | `--color-accent-green` | `--accent-green` | `#52cca3` |
| Soft White | `--color-text-primary` | `--text-primary` | `#e8eaf6` |
| Slate Grey | `--color-text-muted` | `--text-muted` | `#9ba3c4` |
| Guide Slate | `--color-text-dark` | `--text-dark` | `#5c6487` |
| Violet border | `--color-border-subtle` | `--border-subtle` | `rgba(124,149,255,0.10)` |

**Semantic derived tokens (`:root` only):**
- `--bg-hover` → `rgba(124,149,255,0.05)`
- `--bg-active` → `rgba(124,149,255,0.10)`
- `--accent-purple-dim` → `rgba(124,149,255,0.35)`
- `--shadow-card` → composite depth shadow + 1px border overlay

**Category background tints (`@theme`):**
- `--color-tint-essentials` → `#0d1020` (deep slate-indigo)
- `--color-tint-creator` → `#090f0b` (deep obsidian-green)
- `--color-tint-vault` → `#101010` (minimal charcoal-grey)

### Typography

| Role | Font | CSS variable | Next.js var |
|---|---|---|---|
| Body / utility | Plus Jakarta Sans | `--font-body` (alias → `--font-sans`) | `--font-jakarta` |
| Display / headings | Space Grotesk¹ | `--font-display` | `--font-cabinet` |
| Monospace | Cascadia Code | `--font-mono` | — |

¹ Space Grotesk is a stand-in for **Cabinet Grotesk** (Fontshare). To upgrade:
1. Download `.woff2` files from https://www.fontshare.com/fonts/cabinet-grotesk
2. Place in `/public/fonts/cabinet-grotesk/`
3. Replace `Space_Grotesk` in `layout.tsx` with `next/font/local` (template in layout.tsx comments)
4. No other files need changing — `--font-cabinet` cascade resolves automatically.

**Usage rule:** Always use `var(--font-display)` for headings and `var(--font-body)` for body text. Never hardcode font family names.

### Spacing Scale (4-point base)

`--sp-1` (4px) → `--sp-2` → `--sp-3` → `--sp-4` → `--sp-5` → `--sp-6` → `--sp-8` → `--sp-10` → `--sp-12` → `--sp-16` (64px)

### Border Radii

| Token | Value | Tailwind class |
|---|---|---|
| `--r-sm` | 4px | `rounded-sm` |
| `--r-md` | 8px | `rounded-md` |
| `--r-lg` | 14px | `rounded-lg` |
| `--r-xl` | 22px | `rounded-xl` |

### Motion

| Token | Value | Use case |
|---|---|---|
| `--ease-expo` | `cubic-bezier(0.16,1,0.3,1)` | Page/view entrances |
| `--ease-smooth` | `cubic-bezier(0.4,0,0.2,1)` | General state transitions |
| `--ease-nav` | `cubic-bezier(0.25,0.8,0.25,1)` | Nav item hover (Step 0.4 spec) |
| `--dur-fast` | `110ms` | Micro-interactions |
| `--dur-base` | `220ms` | Standard transitions |
| `--dur-slow` | `360ms` | Page-level entrances |
| `--transition-nav` | bg 0.4s + color 0.3s + box-shadow 0.4s | Sidebar nav items |

---

## Z-Index Layer Stack

All layers are in the **root stacking context**:

```
z-index:  0   ThemeBackground           — morphing category background tint (500ms)
z-index:  1   CosmosCanvas              — 115-star particle field, always above tint
z-index:  2   AppShell .shell           — all workspace UI, above stars
  z-index: 100  .sidebar                — within .shell stacking context
  z-index: 200  StudyLayoutContainer    — focus cockpit overlay (position:fixed, within .shell)
z-index: 50   AuthGate wrapper          — login overlay (when unauthenticated, outside .shell)
z-index: 299  AiCopilotSidebar backdrop — semi-transparent dimmer behind the panel
z-index: 300  AiCopilotSidebar panel    — slide-over chat panel (root stacking context)
z-index: 349  WidgetSandbox backdrop    — ManagePanel dismiss backdrop (position:fixed)
z-index: 350  WidgetSandbox ManagePanel — dashboard widget manage panel (position:fixed)
z-index: 400  HabitsView modal backdrop — habit create modal backdrop
z-index: 401  HabitsView modal          — habit create modal (position:fixed)
z-index: 500  SystemHandshake           — boot diagnostic overlay (Phase 6.5)
z-index: 550  HabitsView confetti       — completion burst canvas (pointer-events:none)
z-index: 600  Toast                     — notification stack, above everything
z-index: 700  TutorialSpotlight backdrop — dark blur overlay for first-time walkthrough
z-index: 701  TutorialSpotlight card    — floating step card (above Toast)
```

**Critical rule:** The cosmos stars (z-index: 1) must always remain visible regardless of category background changes. ThemeBackground (z-index: 0) morphs behind them.

**Study mode note:** `StudyLayoutContainer` is `position: fixed; z-index: 200` inside AppShell's stacking context (z: 2). It covers the sidebar and topbar visually while Toast (z: 600, outside `.shell`) remains visible above.

---

## Keyframe Library

Defined in `globals.css`, referenced by `@theme --animate-*` tokens:

| Keyframe | Description | Used by |
|---|---|---|
| `fadeIn` | opacity 0→1 | `.anim-fade-in`, `animate-fade-in` |
| `scaleIn` | opacity+scale 0.96→1 | `.anim-scale-in`, `animate-scale-in` |
| `slideIn` | opacity+translateY 10px→0 | `.anim-slide-in`, `animate-slide-in` |
| `slideInLeft` | opacity+translateX -10px→0 | sidebar entrance |
| `cardEnter` | opacity+translateY+scale | AuthGate card mount |
| `toastIn` | slide from right + scale | Toast notification enter |
| `toastOut` | reverse of toastIn | Toast notification exit |
| `spin` | 360° rotation | Auth loading spinner |
| `pulseGlow` | box-shadow pulse | StudyLayoutContainer title dot, active module indicators |

### Animation Utility Classes

```jsx
// Compose class + optional stagger delay
<div className="anim-slide-in delay-2">...</div>
```

Classes: `.anim-fade-in`, `.anim-scale-in`, `.anim-slide-in`
Delays: `.delay-1` (60ms), `.delay-2` (140ms), `.delay-3` (240ms), `.delay-4` (340ms)

Tailwind equivalents (from `@theme`): `animate-fade-in`, `animate-scale-in`, `animate-slide-in`

### Scrollbar Utilities

```jsx
<div className="scrollbar-zen">...</div>    // 5px themed, purple on hover
<div className="scrollbar-none">...</div>   // hidden (still scrollable)
<div className="scrollbar-thin">...</div>   // system thin, accent colour
```

---

## Provider Chain

`layout.tsx` renders providers in this order (innermost = highest priority):

```
NavProvider
  └─ NavBadgeProvider
       └─ AuthProvider
            └─ SyncProvider          (Phase 2.2 — bridges ZenithSyncEngine into React)
                 └─ ToastProvider
                      └─ StudyModeProvider   (Phase 3.1 — focus cockpit state + Escape handler)
                           └─ CopilotProvider      (Phase 7.1 — AI Co-Pilot open/close state)
                                ├─ ThemeBackground   (fixed, z-index: 0)
                                ├─ CosmosCanvas      (fixed, z-index: 1)
                                ├─ ErrorBoundary
                                │    └─ AppContent   (auth gate ↔ workspace orchestrator)
                                │         ├─ AuthGate     (fixed, z-index: 50, when !authed)
                                │         └─ AppShell     (z-index: 2, when authed)
                                │              └─ StudyLayoutContainer (fixed, z:200)
                                ├─ Toast              (fixed, z-index: 600)
                                └─ AiCopilotSidebar  (fixed, z-index: 300, auth-gated)
```

`AiCopilotSidebar` renders at the root level (outside AppShell) so its `position:fixed` z:300 is in the root stacking context, safely above AppShell (z:2) and below Toast (z:600).

---

## Navigation System

### Taxonomy (`lib/nav-config.ts`)

```
ZENITH ESSENTIALS (category: 'essentials', tint: #0d1020)
  SCHOLASTIC
    · University Hub    (view: 'uni-hub')         — 5 tabs: University Resources | Major Resources |
                                                             GPA Calculator | Cognitive Load | Finances
    · Study Shield      (view: 'study-shield')    — 3 tabs: AI Study | Focus Protocol | Focus Rooms
    · Polyglot Vault    (view: 'vocab-builder')   — SM-2 spaced-repetition vocab builder; IDB v19
  LIFE
    · Habits             (view: 'habits')          — advanced habit tracker (side-by-side analytics)
    · Universal Calendar (view: 'calendar')        — Personal tab + iCal Feeds tab
    · Workouts           (view: 'workouts')        — cardio log + Vitality Points + Cozy Biome builder
    · Meal Planning      (view: 'meal-planning')   — 4-tab: Weekly Planner | Recipes | Budget | Kitchen Setup
    · Mental Wellness    (view: 'wellness')        — mood logging + monthly mood history calendar
    · Personal Brand Hub (view: 'personal-brand')  — career links + LinkedIn post generator (AI-powered)
    · World Events       (view: 'world-events')    — live headlines: BBC World / NPR / The Guardian
    · Subscriptions      (view: 'subscriptions')   — recurring expense packager + burn-rate gauge; IDB v21
    · Game Finder        (view: 'game-finder')     — multiplayer game directory, 3-dimension filter matrix
    · Friend Ledger      (view: 'friends-network') — WebRTC P2P friend sync + multi-temporal leaderboard; IDB v22

CREATOR'S CHOICE (category: 'creator', tint: #090f0b)
    · Aquascaping Engine (view: 'aquascaping')
    · Trail Hunter       (view: 'trail-hunter')    — 70 trails across all US regions
    · Botanist Guide     (view: 'botanist')        — plant care tracker (30-plant catalog)
    · Arcade Hub         (view: 'games')           — Games Tab split-screen shell; left: Biosphere
                                                      Station (Terminal/Aquarium/Zoo) + resource ticker;
                                                      right: Arcade / Crucible / Upgrades / Codex tabs

PERSONALIZED VAULT (category: 'vault', tint: #101010)
    · Custom Link Manager (view: 'custom-links')   — category-tabbed link dashboard, auto-fetched favicons
    · Stats & Analytics   (view: 'stats')          — 8-metric overview, habits/study/events/economy

SYSTEM (not in nav sidebar — accessed from footer / internal routing)
    · Settings           (view: 'settings')        — theme picker, widget toggles, account, data export
                                                     Accessible via Settings button in sidebar footer
                                                     (navigate('settings', null))
```

### Per-Category Micro-Interaction Colours

| Category | Hover bg | Active bg | Border accent |
|---|---|---|---|
| essentials | `rgba(124,149,255,0.12)` | `rgba(124,149,255,0.18)` | `rgba(124,149,255,0.55)` |
| creator | `rgba(82,204,163,0.12)` | `rgba(82,204,163,0.18)` | `rgba(82,204,163,0.55)` |
| vault | `rgba(155,163,196,0.15)` | `rgba(155,163,196,0.22)` | `rgba(155,163,196,0.60)` |

These are injected as CSS custom properties (`--item-hover-bg`, `--item-active-bg`, `--item-accent`, `--item-border`) on each nav button element so the `:hover` and `.navItemActive` CSS rules resolve per-category without any JS hover state.

### Navigation State (`lib/NavContext.tsx`)

```ts
const { activeView, activeCategory, navigate } = useNav()
navigate('study-shield', 'essentials')   // switches view + triggers bg morph
navigate('home', null)                   // returns to home, resets bg tint
```

### Badge Counts (`lib/NavBadgeContext.tsx`)

```ts
const { setBadge } = useNavBadge()
setBadge('study-shield', 3)   // shows "3" pill on Study Shield nav item
setBadge('study-shield', 0)   // clears the badge
```

---

## Authentication (`lib/AuthContext.tsx`)

**localStorage key:** `zenith_session_active`

**Stored object:**
```json
{
  "userHandle": "Will",
  "sessionToken": "mock_jwt_1748000000000_abc123",
  "timestamp": 1748000000000
}
```

```ts
const { session, isReady, signIn, signOut } = useAuth()
// isReady: true after localStorage check completes (prevents flash)
// session: null when logged out, UserSession object when logged in
signIn('Will')    // writes to localStorage, triggers workspace reveal
signOut()         // clears localStorage, triggers auth gate reveal
```

---

## Toast System (`lib/ToastContext.tsx`)

```ts
const { toast } = useToast()
toast('Session terminated successfully.', 'info')    // types: info | success | error
toast('Workspace initialized.', 'success')
```

Toasts auto-dismiss: visible for 3.4s, then exit animation (380ms), then removed from DOM.
The `Toast` component always renders its container (`id="toast-container"`) even when empty.

---

## Study Mode (`lib/StudyModeContext.tsx`)

```ts
const { isStudyModeActive, sessionCount, enterStudyWorkspace, exitStudyWorkspace, incrementSession } = useStudyMode()

enterStudyWorkspace()   // activates cockpit — sidebar slides left, topbar slides up
exitStudyWorkspace()    // restores workspace — also triggered by Escape key
incrementSession()      // called by StudyPomodoroArena on each completed focus interval
```

**Transition contract (AppShell):**
- Sidebar: `translateX(-100%) + opacity:0` over 400ms `ease-out` on entry; reverses on exit
- Topbar wrapper: `translateY(-100%) + opacity:0` over 380ms on entry; reverses on exit
- `StudyLayoutContainer`: scales in from `scale(0.97)` + `opacity:0` to `scale(1)` + `opacity:1` (420ms expo)

**Mount/unmount pattern:** The cockpit uses `setTimeout(20)` for entrance (one browser frame guarantees the opacity:0 initial state is painted before the transition starts). Double-`rAF` was the original approach but React 18 StrictMode cancels the outer rAF ID during the simulated unmount, preventing `setVisible(true)` from ever firing. Exit uses a 450ms delayed unmount so the CSS exit transition completes before the Pomodoro timer unmounts.

**Session pips:** The top bar shows 4 pips (one Pomodoro cycle). Filled pips = `sessionCount % 4`.

---

## Primitive UI Components

### ZenHeading

```tsx
<ZenHeading
  eyebrow="Scholastic · University Hub"  // optional — inherits --cat-accent color automatically
  title="Design\nFoundations."           // newlines create visual line breaks
  subtitle="Supporting body copy."       // optional — muted paragraph below
  size="lg"                              // sm | md | lg
/>
```

Eyebrow color uses `var(--cat-accent, var(--accent-purple))` — automatically purple in Essentials,
green in Creator's Choice, slate in Vault. Never put "Phase X.X" or "Step Y.Z" in eyebrow strings.

### ZenCard

```tsx
<ZenCard
  eyebrow="Academic · Priority"
  title="Thesis Draft Due"
  body="Chapter 3 revision…"
  accent="purple"    // purple | green — overrides top-edge glow; omit to use --cat-accent
/>
```

Top-edge glow and hover border use `var(--cat-accent)` when no explicit `accent` prop override is set.

---

## Database (`lib/db.ts`)

Dexie.js v4 wraps IndexedDB. Database name: **`ZenithOS`**, current schema version **16**.

### Tables & Indices

| Table | PK | Indexed fields | Added |
|---|---|---|---|
| `assignments` | `++id` | `title, dueDate, courseId, status, priority, supabaseId` | v1+v2 |
| `habits` | `++id` | `name, frequency, streakCount, lastCompletedDate, category` | v1 |
| `habitCompletions` | `++id` | `habitId, date, [habitId+date]` (compound) | v15 |
| `workouts` | `++id` | `exerciseName, sets, reps, weight, logDate, type` | v1 |
| `quickNotes` | `++id` | `title, updatedAt, category` | v1 |
| `customBookmarks` | `++id` | `label, url, folderName` | v1 |
| `userProfile` | `id` (explicit, always 1) | `userName, universityName, majorIdentifier` | v1 |
| `pendingSyncQueue` | `++id` | `tableName, operation, timestamp, retryCount` | v2 |
| `calendarFeeds` | `++id` | `label, isActive, lastFetchedAt, createdAt` | v3+v4 |
| `calendarEvents` | `++id` | `feedId, uid, title, startMs, allDay, is1159, category` | v3 |
| `pomodoroSessions` | `++id?` | `sessionType, completedAt, startedAt` | v5 |
| `gpaSemesters` | `++id?` | `year, term, displayOrder, isProjected` | v6 |
| `gpaCourses` | `++id?` | `semesterId, grade` | v6 |
| `courseIntensityProfiles` | `++id?` | `courseCode, updatedAt` | v7 |
| `waterLogs` | `++id?` | `logDate, createdAt` | v8 |
| `houseplants` | `++id?` | `plantName, lastWateredDate` | v9 |
| `deliveries` | `++id?` | `carrier, status, estimatedArrival, createdAt` | v10 |
| `rpgEventLog` | `++id?` | `&eventKey, processedAt` | v11 (legacy, no TypeScript handle) |
| `mentalHealthLogs` | `++id?` | `logDate, createdAt` | v12 |
| `outboxMutations` | `id` (string UUID) | `tableName, action, timestamp` | v13 |
| `aquascapeLayouts` | `++id?` | `name, savedAt` | v14 |
| `habitCompletions` | `++id?` | `habitId, date, [habitId+date]` (compound) | v15 |
| `personalEvents` | `++id` | `title, startMs, allDay, category` | v16 |
| `mealPlanSlots` | `++id?` | `weekStart, dayIndex, mealType` | v17 |
| `savedMealRecipes` | `++id?` | `title, addedAt, category` | v17 |
| `cardioSessions` | `++id?` | `activityType, durationMinutes, logDate, completedAt` | v18 |
| `subscription_items` | `id` (string UUID) | `categoryBundle, billingCycle, renewalDateString` | v21 |
| `peer_friends` | `id` (string UUID) | `peerIdString, connectedAt` | v22 |
| `peer_leaderboard_snapshots` | `peerIdString` (string) | `snapshotTimestamp` | v22 |

**`CalendarFeed`** — iCal subscription: `label, url, color (hex), isActive (0|1), lastFetchedAt, createdAt`

**`CalendarEvent`** — normalised VEVENT: `feedId (FK), uid, title, startMs/endMs (UTC ms), allDay (0|1), is1159 (0|1), category, location?, description?`

**`is1159` flag** — set by `detect1159()` in `utils/calendarParser.ts` when the event's local `getHours()===23 && getMinutes()===59`. Routes the event to the deadline banner in CalendarView instead of the hourly grid.

### Key Types

```ts
type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'overdue'
type Priority         = 'low' | 'medium' | 'high' | 'critical'
type HabitFrequency   = 'daily' | 'specific_days'
type WorkoutType      = 'strength' | 'cardio' | 'mobility' | 'sport' | 'other'
type EventCategory    = 'scholastic' | 'exam' | 'life' | 'general'

// Phase 3.2 (Pomodoro)
interface PomodoroSession { id?, sessionType: 'work'|'short_break'|'long_break',
  durationMinutes, completedAt: number, startedAt: number, distractionCount }

// Phase 3.3 (GPA)
interface GpaSemester { id?, name, term: 'fall'|'spring'|'summer', year,
  displayOrder: number,  // year×10 + termIndex; enables IDB chronological sort
  isProjected: 0|1 }
interface GpaCourse   { id?, semesterId, courseCode, courseName, credits, grade }

// Phase 4.3 (Water Parameter Logger) — defined in utils/waterChemistry.ts
interface WaterLog { id?, logDate: string, pH: number,
  ammonia: number,   // ppm NH3/NH4+, 0–8
  nitrite: number,   // ppm NO2−, 0–5
  nitrate: number,   // ppm NO3−, 0–160
  notes?: string, createdAt: number }

// Advanced Habit Tracker (v15 + Phase 8 field additions)
interface Habit {
  id, name, frequency: HabitFrequency, streakCount, lastCompletedDate: string|null,
  category, activeDays: number[],      // empty = daily; 0=Sun…6=Sat
  targetCompletions: number,           // the goal value (e.g. 20 oz / 20 minutes)
  stepAmount?: number,                 // how much each tap adds (e.g. 5); default 1
  stepLabel?: string,                  // unit label for display (e.g. "oz", "min")
  goalDescription?: string,            // legacy text descriptor
  color?: string,                      // hex accent e.g. '#7c95ff'; drives border + ring
  allTimeHighStreak?: number,          // all-time best streak
  streakSaveUsed?: boolean,
  notes?, createdAt, supabaseId?
}
interface HabitCompletion {
  id?, habitId: number, date: string,  // ISO "YYYY-MM-DD"
  count: number                        // accumulated amount toward targetCompletions
}

// Phase 8 — Personal Calendar Events
interface PersonalEvent {
  id: number,                          // * PK auto-increment
  title: string,                       // * indexed
  startMs: number,                     // * indexed — UTC ms
  endMs: number,                       //   UTC ms
  allDay: 0 | 1,                       // * indexed
  color: string,                       //   hex accent
  category: string,                    // * indexed — 'personal'|'scholastic'|'exam'|'life'|'general'
  description?: string,
  createdAt: number,
}

// Meal Planning (v17)
type MealType = 'breakfast' | 'lunch' | 'dinner'
type PlanType = 'home' | 'dining_out' | 'takeout' | 'delivery'
interface MealIngredient { name: string; quantity: string; estimatedPrice: number }
interface MealPlanSlot {
  id?, weekStart: string, dayIndex: number, mealType: MealType,
  mealName: string, planType: PlanType, ingredients: MealIngredient[],
  estimatedCost: number, estimatedCalories: number, cookMinutes: number,
  recipeUrl?: string, notes?: string
}
interface SavedMealRecipe {
  id?, title: string, addedAt: number, category: string,
  url?: string, description?: string, cookTime?: number,
  equipment?: string, estimatedCost?: number, notes?: string
}

// Cardio (v18) — logged to IDB; VP economy in localStorage
interface CardioSession {
  id?,
  activityType:    string   // 'run'|'walk'|'bike'|'swim'|'row'|'hike'|'yoga'|'elliptical'|'other'
  durationMinutes: number   // session length in minutes
  distance?:       number   // optional
  distanceUnit?:   'mi' | 'km'
  vitalityEarned:  number   // VP awarded (1/min + 5 bonus ≥30 min)
  notes?:          string
  logDate:         string   // ISO "YYYY-MM-DD"
  completedAt:     number   // UTC ms
}
// VP economy (localStorage only — NOT IDB)
// key 'zenith_vitality_v1': { balance: number, lifetime: number }
// key 'zenith_cozy_biome_v1': { purchased: string[], activeBiome: 'aquarium'|'zoo' }
// VP formula: calcVP(mins) = mins + (mins >= 30 ? 5 : 0)

// CustomBookmark — v1 + description? field added (non-indexed, no migration)
interface CustomBookmark {
  id: number; label: string; url: string; folderName: string;
  description?: string; iconUrl?: string; addedAt: number; sortOrder?: number
}

// UserProfile — lean singleton (no XP/HP/Gold)
interface UserProfile { id, userName, universityName, majorIdentifier, avatarUrl?, lastActiveAt }

// Phase 6.4 (Sync Broker) — defined in types/syncQueue.ts
type OutboxTable  = 'assignments' | 'habits' | 'userProfile' | 'workouts'
type OutboxAction = 'CREATE' | 'UPDATE' | 'DELETE'
interface OutboxMutation { id: string, tableName: OutboxTable, action: OutboxAction,
  payload: Record<string, unknown>, timestamp: number, updatedAt: string }
```

### SSR Safety Pattern

```ts
// db is the real instance on client, null-cast on server
export const db: ZenithDatabase = typeof window !== 'undefined'
  ? new ZenithDatabase()
  : (null as unknown as ZenithDatabase)

// getDb() throws with a clear message if called server-side
export function getDb(): ZenithDatabase { ... }
```

All DB calls must be inside `useEffect`, event handlers, or `useLiveQuery` callbacks only. Never call at module scope in Server Components.

### Convenience Helpers

```ts
await seedUserProfile('Will')   // creates id=1 singleton if not exists (userName, empty strings, Date.now())
```

---

## Cloud Sync System (`services/syncEngine.ts`)

### Sync status states

```ts
type SyncStatus =
  | 'SAVED_LOCALLY'       // write landed in IDB; cloud sync pending
  | 'SYNCING'             // flushing pendingSyncQueue to Supabase
  | 'CLOUD_SYNCHRONIZED'  // queue empty; cloud mirrors local
  | 'OFFLINE_QUEUED'      // network down; items retained in IDB
```

### Using sync status in a component

```ts
const { status, triggerSync } = useSyncStatus()
```

### How the engine works

1. **Dexie hooks** fire on `assignments` (priority: `high`/`critical` only) and `userProfile`.
2. The `creating` hook injects `supabaseId = crypto.randomUUID()` directly onto `obj` — persisted atomically in the same IDB write.
3. A `setTimeout(0)` writes the pending item to `pendingSyncQueue` after that transaction commits.
4. A **1.5 s debounced drain** calls `reconcileLocalToCloud()`.
5. Reconciliation: checks `navigator.onLine` → checks Supabase session → **deduplicates queue** → flushes each item. Failed items increment `retryCount`; items exhausting `MAX_RETRIES = 3` are retired.
6. **LWW for `userProfile`**: fetches remote `updated_at` before upserting — skips upload if remote is newer.
7. A `window 'online'` listener triggers an immediate drain when connectivity restores.

---

## Sync Broker (`services/syncBroker.ts`)

Phase 6.4 companion to the engine. Extends sync coverage to **habits** and **workouts** and adds bulk-batched LWW upserts for all four tables. Runs in parallel with the engine — both systems are idempotent.

### Initialisation

Called automatically from `SyncProvider` alongside `engine.init()`:

```ts
import { initSyncBroker, processOutboxQueue } from '@/services/syncBroker'
initSyncBroker()         // registers hooks + online listener + initial drain
await processOutboxQueue() // exposed for explicit "retry" invocation
```

### How the broker works

1. **Dexie hooks** on all 4 tables write mutations to `outboxMutations` (IDB v13) via `db.outboxMutations.put()`. The `put()` call (not `add()`) naturally deduplicates same-id entries during rapid saves.
2. `supabaseId` is injected onto `Habit` and `Workout` records in the `creating` hook — persisted back into IDB as a stable cloud identity for subsequent UPDATE and DELETE hooks.
3. A **2 s debounced drain** calls `processOutboxQueue()`.
4. **`processOutboxQueue()`**: guards network + session → loads queue oldest-first → LWW dedup (DELETE beats UPDATE; latest timestamp wins among UPDATEs) → groups by `tableName` → for each table: one `SELECT id, updated_at WHERE id IN (...)` to fetch all remote timestamps → filters to local-wins records → one `upsert` call for the batch → one `delete` call for DELETEs → `bulkDelete` all flushed IDs atomically.
5. Failed items are tracked in an in-memory `Map<id, retryCount>`; exhausted items are retired (deleted from `outboxMutations`) after `MAX_RETRIES = 3`.
6. Status is broadcast through the shared `ZenithSyncEngine` stream via `getSyncEngine().reportStatus()`.

### SyncStatusIndicator

Full-panel widget that reads `useSyncStatus()` and displays the verbose label:

```tsx
import SyncStatusIndicator from '@/components/SyncStatusIndicator'
// Drop anywhere inside SyncProvider — e.g. bottom of the sidebar
<SyncStatusIndicator />
```

Fixed 26px height (no reflow on label change). `key={status}` remount replays `anim-slide-in` on every state change. Four states: `CLOUD_SYNCHRONIZED` → green, `SYNCING` → periwinkle (pulsing dot), `SAVED_LOCALLY` → guide-slate, `OFFLINE_QUEUED` → muted-slate (border shimmer).

---

## University Hub (`config/universities/`)

### Adding a new university

1. Create `config/universities/<id>.ts` exporting a `UniversityConfig`
2. Add `{ id, name, shortName, hasData: true }` to `UNIVERSITY_REGISTRY` in `config/universities/index.ts`
3. Add a `case '<id>'` block to `getUniversityConfig()` in the same file

### UniHubView state machine

```
profile === undefined        →  blank shell (IDB loading)
!profile.universityName      →  <UniSelector>  (autocomplete onboarding)
hasData && configLoading     →  pulsing "Loading…" label
!uniEntry || !hasData        →  <UniNoData>  (Coming Soon state)
uniConfig loaded             →  <UniversityHub key={name}>  (full resource grid)
```

**Currently live:** Cornell (34+ links, `currencyName: 'Big Red Bucks'`, `gpaScale: '4.3'`), Texas A&M (29+ links, `currencyName: 'Dining Dollars'`, `gpaScale: '4.0'`), UT Austin (29+ links, `currencyName: 'Dine In Dollars'`, `gpaScale: '4.0'`). Registry: 24 schools, 3 with `hasData: true`.

---

## Major Hub (`config/majors/`)

Architecture mirrors University Hub exactly: same lazy-loader, same state machine, same card pattern.

### Adding a new major

1. Create `config/majors/<id>.ts` exporting a `MajorConfig`
2. Add `{ id, name, shortName, hasData: true }` to `MAJOR_REGISTRY` in `config/majors/index.ts`
3. Add a `case '<id>'` block to `getMajorConfig()` in the same file

### MajorHubView state machine

```
profile === undefined        →  blank shell
!profile.majorIdentifier     →  <MajorSelector>  (combobox onboarding)
majorEntry?.hasData && loading →  pulsing label
!majorEntry || !hasData      →  <MajorNoData>  (Coming Soon)
majorConfig loaded           →  <MajorHub key={majorIdentifier}>
```

### Data shape

```ts
interface MajorLink     { id, title, description, url, tag? }
interface MajorCategory { id, label, links: MajorLink[] }
interface MajorConfig   { id, name, shortName, department, categories: MajorCategory[] }
```

**Currently live:** Engineering (6 categories, 25+ links), Business Administration (6 categories, 18+ links), Architecture (6 categories, 18+ links). Registry: 13 majors, 3 with `hasData: true`.

---

## Calendar Engine

### iCal proxy (`app/api/cal-proxy/route.ts`)

```
GET /api/cal-proxy?url=<ical-url>
```
Server-side fetch with `webcal://→https://` normalisation. 5-minute Next.js edge cache (`revalidate: 300`). Returns `text/calendar` to the browser, bypassing CORS.

### Parser (`utils/calendarParser.ts`)

```ts
const events = parseIcal(icalText)   // ParsedCalendarEvent[]
```

**Timezone strategy** — two-pass `Intl.DateTimeFormat` offset trick (no `date-fns-tz`):
1. Treat datetime components as UTC → `approxUtcMs`
2. Format `approxUtcMs` in the IANA timezone → get clock reading in that tz
3. `offset = approxUtcMs - tzFormattedMs`
4. `result = approxUtcMs + offset`

Handles: UTC (`Z`), TZID-qualified, floating (local), all-day (`VALUE=DATE`), Canvas `DUE` property.

### Live hook (`lib/hooks/useCalendarData.ts`)

```ts
const { feeds, events, isFetching, addFeed, deleteFeed, refreshFeed } = useCalendarData()

// addFeed validates URL, fetches via proxy, parses, deduplicates by UID, bulk-inserts
await addFeed('https://calendar.google.com/calendar/ical/…/basic.ics', 'My Calendar')
await deleteFeed(feedId)   // cascades event deletion
await refreshFeed(feed)    // wipes old events, re-fetches
```

Feed colours cycle through 6 presets: `#7c95ff` → `#52cca3` → `#ff8fa3` → `#ffb347` → `#a78bfa` → `#38bdf8`

### CalendarView (`components/views/CalendarView.tsx`)

**Week view:** CSS Grid `52px + repeat(7,1fr)`, `HOUR_PX = 60`, event pills absolutely positioned by `top = (startMins/60)*60px`, `height = (durationMins/60)*60px`. Current-time red line updates every 60s. Auto-scrolls to 2h before now on mount.

**Month view:** `MonthGrid` renders a 6-row × 7-col grid via `getMonthGridDays(year, month)` — always 42 cells, Monday-start. Days outside the current month are shown at 28% opacity. Up to 3 event pills per cell (sorted by startMs); overflow shown as "+N more". Clicking any day drills into week view for that week (`setWeekStart(getWeekStart(day))`; `setView('week')`). `monthStart` state is independent of `weekStart`. Nav bar shows `formatMonthRange(monthStart)` when in month view.

**11:59 PM banner row:** Extracted above the scrollable grid. Renders only when `is1159 === 1` events exist for the week. Only shown in week view. Periwinkle border + `pulseGlow` dot.

**Agenda view:** Groups next 60 days by ISO date, staggered `slideIn` per group.

**Keyboard:** `←` / `→` arrow keys navigate weeks in week view, months in month view (ignored when an input is focused).

**Course Schedule tab (Phase 10.3):** `calTab` type extended to `'personal' | 'feeds' | 'schedule'`. Third tab button with amber `#f59e0b` dot. When `calTab === 'schedule'`, renders `<UniversityScheduleReplicator onDone={() => setCalTab('personal')} />` above the week nav bar (same slot as FeedPanel). `onDone` auto-switches back to personal tab after generation. Generated events appear in `allEvents` (via `useCalendarData` useLiveQuery) with 0ms manual refresh — the CalendarFeed row created by the generator has `url: ''` (no remote fetch); `deleteFeed()` in the iCal Feeds tab cascades-deletes all generated class sessions.

---

## Pomodoro FSM (`lib/hooks/usePomodoroStateMachine.ts`)

```ts
type TimerState = 'IDLE' | 'WORK' | 'SHORT_BREAK' | 'LONG_BREAK' | 'PAUSED'
const machine = usePomodoroStateMachine()
// machine: { timerState, remaining, totalSecs, sessionCount, cyclePosition,
//            distractionCount, start, pause, resume, skip, reset, logDistraction }
```

**Timing precision:** `epochRef = Date.now()` at start/resume; each 250ms tick computes `remaining = max(0, remainAtStart − floor((now − epoch) / 1000))`. Immune to `setInterval` drift in background tabs.

**Phase transitions:** WORK → SHORT_BREAK (sessions 1–3) or LONG_BREAK (every 4th) auto-starts. Break → IDLE (user manually starts next block). Skip increments session count but does not log to IDB. Natural WORK completion → writes `PomodoroSession` to IDB.

**Exports:** `WORK_SECS = 1500`, `SHORT_BREAK_SECS = 300`, `LONG_BREAK_SECS = 900`, `SESSIONS_PER_LONG_BREAK = 4`

---

## GPA Calculator (`components/GpaSimulator.tsx`)

### Grade scales (`utils/gpaMath.ts`)

Two scales supported. `GpaSimulator` accepts a `gpaScale?: GpaScale` prop from `UniversityConfig`:

| Scale | Max | A+ | Universities |
|---|---|---|---|
| `'4.3'` | 4.3 | 4.3 | Cornell |
| `'4.0'` | 4.0 | — (A=4.0) | Texas A&M, UT Austin, most others |

`calcGpa(courses, scale?)` returns `{ totalCredits, qualityPoints, gpa }`. `roundGpa(v, digits)` uses multiply-round-divide.

```ts
import { calcGpa, fmtGpa, gpaTier, getGradeList, getGradePoints } from '@/utils/gpaMath'
const summary = calcGpa([{ credits: 4, grade: 'A-' }, { credits: 3, grade: 'B+' }], '4.0')
// → { totalCredits: 7, qualityPoints: 24.7, gpa: 3.529 }
```

### Data flow

```
db.gpaSemesters (isProjected: 0|1)
  └─ db.gpaCourses (semesterId FK)

React state: Map<courseId, string>   ← slider overrides for instant recalculation
IDB write:   debounced 150ms on pointerup

calcGpa(historicalCourses)          → historicalSummary
calcGpa([...historical, ...projected + overrides]) → cumulativeSummary
```

### Target GPA indicator

Margin = `projectedGpa − targetGpa`. Classes applied to the margin bubble:
- `≥ 0` → `.onTrack` (green)
- `≥ −0.1` → `.nearMiss` (amber)
- `< −0.1` → `.offTrack` (rose)

---

## Aquascaping Engine (`components/views/AquascapingView.tsx`)

Two-tab hub under Creator's Choice (Hardscape Simulator removed). All panes stay **always mounted** (display:none/block pattern) so state survives tab switches. The active pane fades in via `fadeIn` keyframe; the inactive panes are hidden with `display:none`.

### Tab 1 — Ecosystem Validator

```ts
// analyzeCompatibility(config, inhabitants) lives in utils/aquascapingMath.ts
// SPECIES_LIBRARY: 34 species (fish / shrimp / snail / plant)
// Six conflict types: temperature | ph | predator_prey | aggression | tank_size (min tank) | tank_size (bioload)
// Bioload: totalBioload / (gallons * 1.5) * 100 → capacityPct
```

**Bioload bar colour:**  `> 100%` → rose (critical) · `> 70%` → amber (warning) · otherwise → `--accent-green`

### Tab 2 — Supplier Cart

```ts
// calculatePricing(items, vendorMap) lives in utils/pricingMath.ts
// Buckets sorted: freeShippingUnlocked=true first, then alphabetical
// Grand total block uses key={estimatedGrandTotal+cumulativeShippingFees} to re-trigger anim-slide-in
```

**Free shipping unlock:** bucket border changes to `rgba(82,204,163,0.30)`; shipping row shows strikethrough + "FREE" in `--accent-green`; savings row appears in grand total.

### Tab 3 — Hardscape & Water Log

**Canvas:** `position:relative` wrapper with `padding-bottom` aspect-ratio trick. Elements are `position:absolute` divs sized via `(w/COLS)*100%` / `(h/ROWS)*100%`. Drag uses `dragRef` + document-level `mousemove`/`mouseup` via `useEffect`. Grid lines drawn via CSS `background-image` gradients. Layout persists in `localStorage` key `zenith_hardscape_v1`.

**Chart:** Pure SVG — no Recharts, no Chart.js. Smooth lines via cubic bezier `C` commands. Y-axis auto-scales using `niceMax()`. X-axis decimation: `step = max(1, ceil(n/7))`. Three series: NH3 amber `#f59e0b`, NO2 rose `#f87171`, NO3 sage `#52cca3`.

**Cycle auditor:** `analyzeCycleStatus(logs)` returns a `CycleStatus` with 6 `CyclePhase` values. Banner colour and text change per phase via `data-phase` CSS attribute selector. The `cycled` phase triggers `scaleIn` animation + `pulseGlow` dot.

---

## AI Co-Pilot (`components/AiCopilotSidebar.tsx`)

Phase 7.1 — context-aware LLM chat sidebar.

### Architecture

```
Client                                  Server
──────────────────────────────          ────────────────────────────
useCopilot() toggle                     POST /api/chat
  ↓                                       reads LLM_API_KEY (server-only)
AiCopilotSidebar                          injects contextPayload as system prompt
  ↓ on first open                         streams via Anthropic SDK ReadableStream
compileUserContextPayload()              ← UTF-8 text chunks
  IDB: assignments + habits + mentalHealthLogs (14 days)
  truncates notes at 110 chars
  returns { systemPrompt, stats }
  ↓
fetch('/api/chat', { body: { messages, contextPayload } })
  ↓ streams
setMessages(prev → append chunk)
```

### Key constants (`app/api/chat/route.ts`)

- `MAX_USER_MSG_CHARS = 4_000` — hard cap per user turn
- `MAX_HISTORY_MESSAGES = 20` — sliding window
- `MAX_TOKENS_RESPONSE = 1_024`
- `LLM_MODEL = process.env.LLM_MODEL ?? 'claude-haiku-4-5-20251001'`

### Usage

```ts
const { isOpen, toggle } = useCopilot()   // toggle from Topbar ◎ AI button
```

The Co-Pilot compiles its context once per sidebar open session. Calling `toggle()` a second time restores the existing conversation — messages persist until the user clicks ↺ (New Conversation).

---

## Skill Tree (`types/skillTree.ts`, `hooks/useSkillTree.ts`)

Phase 7.2 — branching perk system with atomic IDB acquisition.

### Three branches (18 nodes total, 4 tiers each)

| Branch | Modifier targets | Max cumulative effect |
|---|---|---|
| `SCHOLASTIC_FOCUS` | `assignmentGoldMultiplier`, `pomodoroMinuteBonus`, `assignmentXpBonus` | +50% gold · +15 min · +5 XP |
| `ERGONOMIC_RESILIENCE` | `fatigueRateMultiplier`, `deadlineHpMultiplier`, `recoveryHpBonus` | −60% fatigue · −25% HP loss · +15 HP |
| `HABIT_MASTERY` | `streakXpMultiplier`, `streakGraceDays` | +65% streak XP · 2 grace days |

### Token economy

- 1 token per level-up (awarded retroactively on first visit via `Math.max(0, currentLevel−1)`)
- 1 token per legendary/critical task archival (call `awardSkillToken()` at completion site)
- Root nodes cost 1 · Tier 1 cost 1 · Tier 2 cost 2 · Apex cost 3 → 10 tokens to max a branch

### Modifier access

```ts
const { modifiers } = useSkillModifiers()
// modifiers.fatigueRateMultiplier — read by FatigueContext
// modifiers.pomodoroMinuteBonus   — add to WORK_SECS in usePomodoroStateMachine
// modifiers.assignmentGoldMultiplier — multiply in awardGold call sites
```

### Canvas layout constants

```ts
CANVAS_W = 960   CANVAS_H = 560   NODE_RADIUS = 36
Branch x-centres: SCHOLASTIC=160, ERGONOMIC=480, HABIT=800
Tier y positions: root=80, tier1=210, tier2=340, apex=470
```

---

## Widget Sandbox

### `useSandboxConfig` — visibility config

```ts
const { config, toggleWidget, mounted } = useSandboxConfig()
// config: { urgentTasks, pomodoroPreview, habitSummary, localWeather }
// defaults: { urgentTasks: true, pomodoroPreview: false, habitSummary: true, localWeather: true }
// localStorage key: 'zenith_sandbox_config'
toggleWidget('pomodoroPreview')   // toggles and persists
```

### Reactive Hooks

```ts
const count = useLiveAssignmentBadges()   // also calls setBadge('study-shield', n)
const { habits, total, completedToday, percentage, todayISO } = useHabitProgress()
// SVG ring formula: strokeDashoffset = CIRC * (1 - percentage / 100)
// where CIRC = 2 * π * 38 ≈ 238.76
```

---

## Development Rules

1. **Never hardcode hex values** in component CSS. Always use `var(--bg-main)`, `var(--accent-purple)`, etc.
2. **Never hardcode font families**. Use `var(--font-display)` for headings, `var(--font-body)` for body, `var(--font-mono)` for code.
3. **Always use the spacing scale** (`var(--sp-4)`, not `1rem`). The values are identical — the token names make intent explicit.
4. **New views** → add a `ViewId` to `lib/nav-config.ts` and a `NavLink` entry in `NAV_CONFIG`, then handle it in `ViewRouter.tsx`.
5. **New modules** → create a file in `components/views/`, import in `ViewRouter.tsx`, add a case to `resolveView()`.
6. **Session-aware text** → use `useAuth()` → `session?.userHandle`. `GreetingHero` is the reference implementation.
7. **Notifications** → use `useToast()`. Do not use `alert()` or custom notification systems.
8. **CSS Modules** for all component styles. Global utility classes (`.anim-*`, `.scrollbar-*`, `.surface-*`) from `globals.css` can be applied directly as `className` strings.
9. **Client components** require `'use client'` only when they use React hooks or browser APIs. Server components should be the default.
10. **Animations** on mount: use `.anim-scale-in` for content panels, `.anim-fade-in` for overlays, `.anim-slide-in delay-N` for staggered lists.
11. **Database access** must be inside `useEffect`, event handlers, or `useLiveQuery` callbacks only. Never call `db.*` at module scope or in Server Components.
12. **Context setter stability** — any function passed as a `useEffect` dependency must be wrapped in `useCallback`. Unstable references (recreated each render) cause infinite loops. `setBadge` in `NavBadgeContext` is the canonical example.
13. **New reactive data** → add a hook to `lib/hooks/` using `useLiveQuery`. Never poll with `setInterval` for data that Dexie can stream live.
14. **Badge counts** → call `setBadge(viewId, count)` from `useLiveAssignmentBadges` or a parallel hook — not directly from component render code.
15. **Sync-aware mutations** — any DB write to `assignments` (priority: high/critical) or `userProfile` is automatically intercepted by the sync engine's Dexie hooks. No extra wiring needed at the call site.
16. **New university** → add a `UniversityConfig` file under `config/universities/`, register in `UNIVERSITY_REGISTRY`, and add a `case` to `getUniversityConfig()`. The lazy-loader handles bundling automatically.
17. **Key-driven remounts for animation replay** — use `key={someStableId}` on view components when navigating between instances of the same component (e.g. switching universities/majors) so entrance animations replay without manual state resets.
18. **New major** → mirrors the university pattern: add a `MajorConfig` file under `config/majors/`, register in `MAJOR_REGISTRY`, add a `case` to `getMajorConfig()`.
19. **iCal feeds** — always fetch via `/api/cal-proxy?url=…`, never directly from the browser (CORS). Use `parseIcal()` from `utils/calendarParser.ts`. Store events in `db.calendarEvents` with `feedId` FK and `is1159` flag pre-computed.
20. **`is1159` routing** — events with `is1159 === 1` must never appear in the hourly time grid. They belong exclusively in the `DeadlineBanners` section at the top of CalendarView.
21. **Study mode overlay** — `StudyLayoutContainer` is a `position:fixed; z-index:200` overlay inside AppShell. It uses `setTimeout(20)` for entrance (not double-rAF — StrictMode cancels the outer rAF) and a 450ms delayed unmount. Never trigger `enterStudyWorkspace()` from within the cockpit itself.
22. **Dexie `orderBy()` requires an index** — only fields listed in the schema string (version's `.stores()`) can be used with `.orderBy()` or `.where()`. To sort by a non-indexed field, use `.toArray()` and sort in JS.
23. **No Framer Motion** — the project has no animation library in deps. All transitions use CSS `transition` via inline styles or CSS Modules, matching the `--ease-expo` / `--ease-smooth` token curves.
24. **GPA slider overrides** — projected course grade changes are held in a `Map<courseId, string>` React state for instant recalculation. IDB writes are debounced 150ms on `pointerup` so rapid slider drags don't flood the database.
25. **Collapsible card animation** — use `grid-template-rows: 0fr → 1fr` with a transition on the wrapper div and `overflow: hidden` on the inner div. This is smoother than `max-height` because it doesn't require guessing a max value.
26. **Creator's Choice theming** — Creator's Choice components define local `--v-*` tokens at the root selector (e.g., `--v-card: #141c19`, `--v-surface: #111618`, `--v-border: rgba(82,204,163,0.10)`, `--v-accent: var(--accent-green)`). Never use global `--surface-card` / `--border-subtle` in these components — the green-tinted variants are intentional.
27. **Multi-tab pane pattern** — when a view contains multiple tabs with stateful components (e.g., AquascapingView), keep all panes always mounted and toggle `display:none`/`display:block` via CSS classes. Never use `key`-driven unmounting — it destroys cart/canvas/form state. Use `animation: fadeIn` on the active class for entrance polish.
28. **Pure SVG charts** — the project has no charting library. Build line charts as hand-rolled SVG with cubic bezier paths (`C x1 y1 x2 y2 x y` commands for smooth curves). Use `niceMax()` to round up the Y-axis ceiling to a clean step value. Decimate X-axis labels when `n > 7`.
29. **Hardscape canvas drag** — document-level drag (not canvas-level) is required so elements don't "slip" when the mouse moves faster than the element. Store drag start state in a `useRef` (not state) so mousemove handlers don't cause re-renders on every pixel. Use functional state updates (`setItems(prev => …)`) to avoid stale closure issues.
30. **Water log localStorage key** — hardscape layout uses `zenith_hardscape_v1`. Always version localStorage keys so schema changes don't crash on stale data.
31. **`useLiveQuery` accepts 1–2 arguments only** (`dexie-react-hooks` v4 removed the third `defaultResult` parameter). The return type is `T | undefined`; guard every usage with `?? []` or optional chaining. Never pass a third argument — it is a compile-time type error that breaks `npm run build`.
32. **Sync broker hooks all 4 tables** — habits and workouts now flow through `outboxMutations` via `syncBroker`. The engine's `pendingSyncQueue` continues to run for assignments/userProfile in parallel (idempotent upserts). Do not disable either hook system; they are additive by design.
33. **Vercel deployment** — `vercel.json` + `.github/workflows/deploy.yml` are both committed. The CI pipeline validates (typecheck + Playwright) before deploying. Never push directly to Vercel outside the pipeline for production builds. GitHub Secrets required: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
34. **CSS Modules forbid bare attribute selectors** — Next.js CSS Modules requires every selector to contain at least one local class or ID. Bare `[data-branch='X']` selectors (and even `:global([data-branch='X'])`) are rejected with "not pure". Always anchor attribute selectors to a local class.
35. **AI Co-Pilot context is compiled once per panel open** — `compileUserContextPayload()` runs on first `isOpen → true` transition (guarded by `contextStatus === 'idle'`). Do not re-run on every render or every message. The compiled `contextPayload` string is cached in component state for the duration of the session. If the user clicks ↺ (New Conversation), `handleClear()` resets `contextStatus` to `'idle'` so the next open re-compiles fresh context.
36. **Habit completion tracking** — daily counts live in `db.habitCompletions` (IDB v15), not on the `Habit` row. Query completions via `where('[habitId+date]').equals([id, isoDate])` using the compound index. Streak updates only fire on the first press that reaches `targetCompletions` for the day — not on every increment.
37. **No streak grace period** — the restore-streak feature has been removed. If a streak is broken it resets; no "Save Streak?" prompt. Each habit tracks `allTimeHighStreak` (non-indexed field, updated in `increment()` when `newStreak > allTimeHighStreak`). Displayed as 🏆 in edit mode.
38. **Habit colour** — stored as `color?: string` (hex) on the `Habit` record (non-indexed, no DB migration needed). Passed as `--habit-color` CSS custom property on the habit row div. Drives the row's `border-left` and the circle-progress ring `stroke` colour. Default is `#7c95ff`.
39. **Sidebar nav hide** — `useHiddenNavItems` reads/writes `zenith_hidden_nav_items_v1` in localStorage. NavLinkItem dispatches a `zenith:nav-ctx` CustomEvent on right-click (bubbles to AppShell listener). AppShell filters hidden ids from rendering. "Show Hidden (N)" footer button opens `hiddenMgrPanel`.
40. **University Hub is the single Scholastic hub** — `major-hub` nav item removed. MajorHub renders inside UniHubView's "Major Resources" tab. The two-step onboarding screen (pick uni → pick major) runs before the hub opens. Use `UniHubView` as the sole orchestrator for all university + major + GPA content.
41. **GPA scale per university** — `UniversityConfig.gpaScale: GpaScale` drives which grade dictionary is used. Always pass `gpaScale` from `uniConfig` to `<GpaSimulator gpaScale={gpaScale} />`. Never hardcode the scale inside GpaSimulator.
42. **Widget masonry layout** — `WidgetSandbox` uses CSS columns (`columns: 2`) for automatic masonry packing. Wide widgets get `column-span: all` via the `widgetWide` class on `AnimatedWidget`. Do not revert to CSS grid — columns packs items upward without JS.
43. **SystemHandshake unlock** — the scanning `useEffect` and the unlock timer are in separate effects. The scanning effect sets phase to 'success'/'fatal' only; a second effect watches `phase === 'success'` and owns the 1.5s unlock timer. This prevents the scanning cleanup from cancelling the timer via the `cancelled` flag.
44. **Habit step model (Phase 8)** — `targetCompletions` is the goal value (e.g. 20 oz). `stepAmount` is how much each tap adds (e.g. 5 oz); default 1 for simple habits. `increment()` calls `Math.min(prevCount + step, targetCompletions)` — never exceeds goal. Streak fires when `newCount >= targetCompletions && prevCount < targetCompletions`. The form requires `goal > 0` to enable Create. Remove "completions per day" — it no longer exists.
45. **Campus currency per university** — `UniversityConfig.currencyName?: string` (e.g. `'Big Red Bucks'`). `BrbBurnRate` accepts a `currencyName` prop (default: `'Campus Dollars'`). Pass from `uniConfig.currencyName` in UniHubView's Finances tab. Cornell='Big Red Bucks', Texas A&M='Dining Dollars', UT Austin='Dine In Dollars'.
46. **Personal calendar events** — stored in `db.personalEvents` (IDB v16). Synthetic feed (`id=PERSONAL_FEED_ID=-1`) merges personal events into the week grid. Per-event color set via `_color` extra field on the cast `CalendarEvent` — `EventPillEl` checks `event._color ?? feed?.color`. Calendar tab bar (`calTab`: 'personal'|'feeds') gates `FeedPanel` visibility and the `+ New Event` button. Show `EmptyPersonal` on personal tab and `EmptyCalendar` on feeds tab when no events exist.
47. **Botanist plant catalog** — `PLANT_CATALOG` (30 entries) is a static array in `BotanistView.tsx`. No DB migration needed for the new fields (`lightRequirement`, `lightPosition`, `humidity`, `healthRating`, `specialConditions`, `notes`) — all non-indexed on `Houseplant`. Health picker uses `db.houseplants.update(id, { healthRating, lastHealthCheck })`. The catalog search filters against `commonName` and `scientificName`.
48. **Trail Hunter dataset** — 70 trails in `data/trails.ts` spanning all US regions. Search matches against `trail.name` and `trail.locationRegion`. Distance filter is trail LENGTH (miles), not proximity to user. Max distance slider: 50 mi.
49. **Category theming via `--cat-*` tokens** — `AppShell.tsx` stamps `data-category={activeCategory ?? 'essentials'}` on `.viewport`. `AppShell.module.css` sets five inherited CSS vars per category: `--cat-accent`, `--cat-accent-dim`, `--cat-border`, `--cat-surface`, `--cat-card`. Essentials=purple, creator=green, vault=slate. `ZenHeading` eyebrow and `ZenCard` top-glow automatically consume `--cat-accent`. New view components should use `var(--cat-accent)` for their primary accent instead of hardcoding `var(--accent-purple)`.
50. **No phase labels in eyebrows** — Never put "Phase X.X" or "Step Y.Z" in a `ZenHeading eyebrow` string or any visible UI text. Use descriptive names only (e.g., `"Scholastic · Cognitive Load"`, `"Scholastic · Focus Rooms"`). Phase references belong in JSDoc comments only.
51. **CalendarView month grid** — `MonthGrid` is always 42 cells (6 rows × 7 cols, Monday-start). `monthStart` state (first day of month) is separate from `weekStart`. Month day click calls `setWeekStart(getWeekStart(day))` + `setView('week')`. The 11:59 deadline banner section only renders in week view — never show it in month or agenda view.
52. **Games Tab uses a separate Dexie database** — `lib/gamesDb.ts` (`ZenithGamesOS`) is fully isolated from `lib/db.ts` (`ZenithOS`). Never import `db` from `lib/db.ts` inside games tab code. Games hooks live in `hooks/` (project root) not `lib/hooks/`. `seedGamesDatabase()` must be called once from a client-side `useEffect` in the Games Tab root component before any read/write. `gamesDb` is null-cast on the server — all DB calls must be in `useEffect`, event handlers, or `useLiveQuery` callbacks.
53. **Crucible time-delta is epoch-based** — `CrucibleJob.targetTime` is a fixed UTC ms epoch set at submission. Remaining time is always computed as `Math.max(0, Math.floor((job.targetTime - Date.now()) / 1000))` — never from tick counts. This makes the countdown immune to `setInterval` drift, tab hibernation, and machine sleep. The catch-up phase (`runCatchUpPhase()`) on mount auto-credits any jobs that expired while the app was closed; live-completed jobs require `claimCompletedJob()`.
54. **Audio presets use stereo normalized buffers** — Noise presets must use `createBuffer(2, len, sampleRate)` (stereo) and normalize the channel data to a safe peak (≤0.70) after generation to prevent headphone clipping. Brown noise: 12s buffer, IIR filter, normalize, LP at 1200 Hz. White noise: 4s buffer, LP at 6 kHz. Never hardcode `* 3.5` amplitude on raw IIR output. `MUSIC_STREAMS` uses `embedUrl` (full `https://www.youtube-nocookie.com/embed/...` string) not a bare `ytId` field.
55. **GamesTabShell height anchoring** — `GamesTabShell` sets `height: calc(100vh - 52px); overflow: hidden` explicitly because `.viewport` in AppShell has `overflow-y: auto`, and the ViewRouter wrapper `<div>` has no explicit height. Using `height: 100%` on the shell would resolve against an auto-height parent. The 52px constant equals the Topbar height — update both if the Topbar height ever changes.
56. **CosmeticPointsIndicator is the global Games DB seeder** — `CosmeticPointsIndicator.tsx` calls `seedGamesDatabase()` on mount (idempotent). Because it lives in the Topbar (always mounted when authenticated), the Games DB is seeded before any game component needs it. Do NOT add `seedGamesDatabase()` calls to other global components — one seeder is sufficient. Game-specific components may call it locally only if they render without the Topbar (e.g., in tests).
57. **UniversalGameWrapper collect-gate pattern** — game components inside `UniversalGameWrapper` must NOT call `onGameComplete` directly from event handlers. The correct flow: (1) game ends → set local `refineResult` state → show a custom overlay; (2) user clicks "Collect" → call `handleCollectYield()` → call `onGameComplete(refinedYield)`. The wrapper transitions `playing → result`, unmounting the game and its overlay, then showing the economy outcome. This produces two sequential result screens: game overlay (detailed breakdown) → wrapper overlay (economy outcome).
58. **RefineScoreEvaluator pure engine pattern** — `lib/engines/RefineScoreEvaluator.ts` has zero React/Dexie imports. It accepts `GridCellSnapshot[]` (structural typing — `MinesweeperCell` satisfies it without an explicit import). All payout arithmetic uses integer operations; `efficiencyPermille` stores 0–1000 (parts-per-thousand) to avoid float division accumulation. The `isStorageCapped`/`discardedOverflow` fields in `RefineScoreSummary` default to `false`/`0` and are populated by the component after reading `addResources()` return values.
59. **payoutFormula identity for engine-scored games** — When a game component delegates payout calculation to a pure engine (e.g., `RefineScoreEvaluator`), set `payoutFormula={score => score}` in ViewRouter. This makes the engine the single source of truth so the game overlay and wrapper overlay always display the same numeric yield. Any scaling factor should live inside the engine's formula, not in the wrapper's `payoutFormula`.
60. **MinesweeperCore flag compound CSS selector** — `.cellHidden.cellFlagEligible:hover:not(:disabled)` uses two-class specificity to override the single-class `.cellHidden:hover` rule, changing only the border color to `--accent-purple`. This is valid in CSS Modules (generates `.abc123.def456:hover`). Never use bare attribute selectors (rule 34). The `cellFlagEligible` class is added in React when `canPlaceFlag && !cell.isRevealed && !cell.isFlagged` — removed automatically when the flag cap is reached.
61. **UniversalGameWrapper game canvas is 16:9** — `.canvas` in `UniversalGameWrapper.module.css` uses `aspect-ratio: 16 / 9`. Game components that fill it (via `.gameContainer { position: absolute; inset: 0 }`) receive a container whose height is always less than its width. For square game boards (e.g., MinesweeperCore), use `height: 100%; aspect-ratio: 1` on the board element — it takes the constraining height dimension and becomes square, centered horizontally.
62. **Canvas game RAF pattern (processFrameRef / frameRef)** — For canvas-based games (BioSynthesizer, ZenSnake, BiosphereRenderer sub-elements), the render loop uses a ref updated every render: `const frameRef = useRef<(ts: number) => void>((_ts) => {}); frameRef.current = (ts) => { ...; rafRef.current = requestAnimationFrame(t => frameRef.current(t)) }`. The `useEffect(() => { rafRef.current = requestAnimationFrame(t => frameRef.current(t)); return () => cancelAnimationFrame(rafRef.current) }, [])` runs once on mount. This eliminates stale closures without any deps array on the effect. The initial dummy function `(_ts) => {}` satisfies React 19's `useRef<T>` requirement for 1 argument.
63. **Canvas API constraint — no CSS functions** — `CanvasRenderingContext2D` does not support CSS functions like `color-mix()`, `var()`, or `rgba()` with CSS-variable arguments in `fillStyle`/`strokeStyle`. Always use literal hex strings (e.g. `'#52cca3'`) or `rgba(r,g,b,a)` with numeric values. Use `ctx.globalAlpha` for opacity variations. Design token hex values for canvas: `--accent-green` = `#52cca3`, `--accent-purple` = `#7c95ff`, `--bg-main` = `#0b0d13`, `--surface-card` = `#141923`.
64. **BiosphereStateManager UpdateSpec restriction** — Dexie's `UpdateSpec<T>` cannot be satisfied by a computed-key object literal `{ [field]: value }` because TypeScript widens the key type to `string`, making it incompatible with the strict per-field union. Always use explicit if/else branches with typed literal keys: `if (field === 'isActiveHomeDisplay') { await db.update(id, { isActiveHomeDisplay: value }) } else { await db.update(id, { isActiveStudyDisplay: value }) }`.
65. **BiosphereStateMap readonly keys — no Partial<> assignment** — `BiosphereStateMap = { readonly [K in BiosphereType]: BiosphereStateRecord }` uses readonly mapped keys. TypeScript 5 rejects bracket-assignment on `Partial<BiosphereStateMap>`. Use explicit `let terminal / aquarium / zoo` bindings instead: iterate rawRecords, assign each by environmentId check, then return `{ terminal, aquarium, zoo }` only when all three are defined.
66. **Biosphere slot determinism — zero layout shift** — All slots for the current module are always in the DOM as `position: absolute` wrappers. Inactive slots have `opacity: 0; transform: scale(0.88); pointer-events: none` via `.assetSlot`. Adding `.assetSlotActive` triggers the 700ms spring CSS transition. Slot content is conditionally rendered (`isActive ? getSlotContent() : null`) so hooks inside leaf components (e.g. uptime `setInterval`) only run when the asset is actually unlocked. Never use `display:none` on slots — it prevents the CSS transition from firing on reveal.
67. **seedBiosphereStates() call pattern** — `seedBiosphereStates()` must be called before any biosphere state read. The `useBiosphereState` hook auto-seeds when it detects `rawRecords?.length === 0` (guarded by `seederFired` useState flag). For components that use `BiosphereStateManager` functions directly without the hook, call `seedBiosphereStates()` in a `useEffect(() => { void seedBiosphereStates() }, [])` on mount.

68. **`!= null` vs `!== null` for async-loaded state** — When a value can be `undefined` (not yet loaded) OR `null` (loaded, intentionally absent), always use the loose `!= null` guard (catches both). Using strict `!== null` allows `undefined` through, causing crashes like `undefined.property`. Canonical example: `UpgradesPanel`'s matrix entries start as `undefined` (async `getUpgradeMatrix` hasn't resolved yet); using `matrix !== null` passed the guard and crashed on `matrix.costs`. Pattern: `matrix != null && matrix.costs.every(...)`.

69. **✦ Credits — not "CP"** — The cosmetic currency is displayed as `✦` throughout the UI (CosmeticPointsIndicator label, Crucible recipe output strings, CodexPanel summary). Never render the abbreviation "CP" in visible UI text — it is unclear to users. The internal resource ID remains `'cosmetic_points'` in IDB and TypeScript; only the visible label changes. `CosmeticPointsIndicator` is a `role="button"` that navigates to `games/creator` on click — do not revert it to a non-interactive `div`.

70. **Jest config for Next.js 15** — `jest.config.ts` must use `import nextJest from 'next/jest.js'` (ESM path with `.js` extension). `require('next/jest')` fails because Next.js 15 ships that module as ESM-only. `jest.setup.ts` must polyfill `structuredClone` via Node's `v8` module (`v8.deserialize(v8.serialize(val))`) before `import 'fake-indexeddb/auto'` — jsdom replaces the global scope with its own window and does not forward Node's built-in `structuredClone`; fake-indexeddb v6 requires it. The polyfill is guarded: `if (typeof (global as Record<string,unknown>).structuredClone === 'undefined')`.

71. **Runtime theming via CSS custom properties** — `ThemeApplicator` (mounted in `layout.tsx`) applies active cosmetic theme globally by calling `document.documentElement.style.setProperty(var, value)` for each entry in `THEME_DEFINITIONS[activeTheme].vars`. It first removes all vars in `ALL_THEMEABLE_VARS` to prevent stale bleed between theme switches. Only `:root` CSS var aliases (not `@theme` tokens) are overridden — Tailwind `@theme` vars are build-time only. Components using `var(--accent-purple)`, `var(--bg-main)` etc. update instantly without reload. zenith_default has empty `vars: {}` — removing overrides restores the `globals.css` baseline.

72. **Shop catalog single source of truth** — `lib/shopCatalog.ts` exports `ShopCatalogItem` + `SHOP_CATALOG_STATIC`. Both the GamesTabShell `ShopPanel` and `SettingsView` import from this file. Never re-define the catalog inline — it must be kept in sync between the Arcade Shop and the Settings Appearance section. The catalog ID strings must match the `THEME_DEFINITIONS` keys in `lib/themeDefinitions.ts` exactly.

73. **Voice input — Web Speech API pattern** — Use `window.SpeechRecognition || window.webkitSpeechRecognition` with an `any` cast (no stable TypeScript lib for this API). Set `interimResults: true` and `continuous: false` for push-to-talk UX. The `onresult` handler separates `isFinal` results (appended to input state) from interim results (shown as ghost text). Store the recognition instance in a `useRef<any>(null)` so `stop()` can be called from a toggle. Always provide a toast fallback when the API is unavailable.

74. **World news RSS proxy** — `app/api/world-news/route.ts` uses `Promise.allSettled` over multiple feed fetches so one unavailable source never blocks the others. XML parsing uses pure regex (`<item>` extraction + per-field tag regex + CDATA unwrap) — no external XML library. `revalidate: 600` on the route handler provides a 10-minute Next.js edge cache so rapid page navigations don't re-fetch. The `NewsArticle` interface is exported from the route file and imported by consumer views for type safety.

75. **Collapsible sidebar categories** — `useCollapsedCategories()` is defined at the top of `AppShell.tsx` (not a separate file). It stores a `Set<string>` of collapsed `CategoryId` values in `zenith_nav_collapsed_v1` localStorage (serialised as a JSON array). Toggling a category adds/removes its id from the set. The category label `<button>` uses `display:none` on `.categoryContent` when collapsed — not `height:0` — because the nav list items are not individually animated and `display:none` is sufficient. Never use `visibility:hidden` (still takes space).

76. **Vitality Points are localStorage-only** — The Vitality Point economy for the Workouts/Cozy Biome system uses two localStorage keys only: `zenith_vitality_v1` (`{ balance, lifetime }`) and `zenith_cozy_biome_v1` (`{ purchased: string[], activeBiome: 'aquarium'|'zoo' }`). Cardio sessions are logged to IDB (`cardioSessions` v18) for analytics, but the VP balance itself is never in IDB. This keeps the system lightweight and avoids a third Dexie database. Do NOT sync VP to Supabase — it is intentionally local-only.

77. **Cozy Biome is separate from the Arcade Biosphere** — `WorkoutsView.tsx` and the dashboard `CozyBiomeWidget` use their own standalone biome system (localStorage + CSS animations). They have **nothing to do with** the `BiosphereRenderer` / `BiosphereStateManager` / `gamesDb.biosphere_states` system in the Arcade Hub. The Arcade Biosphere is a progression system tied to the Games economy; the Cozy Biome is a relaxation feature tied to cardio. Never cross-wire them.

78. **`/api/chat` is the shared AI endpoint** — Both the AI Co-Pilot (`AiCopilotSidebar`) and the LinkedIn Post Generator (`PersonalBrandView`) call `POST /api/chat`. The generator passes a `contextPayload.systemPrompt` that overrides the Anthropic system message for that call. The Co-Pilot also passes a compiled context payload. The server always reads `contextPayload.systemPrompt` and injects it as the Anthropic system message — this is the extension point for any new AI feature.

79. **TutorialSpotlight session counting** — The tutorial increments `sessionsShown` in `zenith_tutorial_v1` on every mount (inside `useEffect([], [])`). It shows when `sessionsShown < 3` and is shown for exactly 3 page loads. Incrementing happens before `setShow(true)` so a hard refresh doesn't double-count. The "Skip tour" button calls `setShow(false)` immediately but does NOT reset the count — the user only skips the current session's display, not future sessions. After 3 sessions the overlay never appears again without clearing localStorage.

80. **WorldEventsView is the canonical news consumer** — `StatsView` no longer fetches or renders world news (removed in R8). The `NewsArticle` type from `/api/world-news/route.ts` is only imported by `WorldEventsView`. If you need headlines elsewhere, import `WorldEventsView` or refactor the fetch into a shared hook — do not re-add news fetching to StatsView.

81. **`calculateTrueMonthlyCost` is the single normalization point** — `types/finance.ts` exports this helper for converting any `SubscriptionItem` cost to a true monthly value: ANNUAL ÷ 12, MONTHLY pass-through. Never inline the ÷12 division anywhere else in the codebase. All aggregation in `useSubscriptionAnalytics` and all display in `SubscriptionPackagesView` calls this function. The `monthlyCost` field stores the raw per-billing-period input (annual price for annual items, monthly price for monthly items) — not the normalized value.

82. **Game Finder dataset is static — no IDB** — `DEFAULT_PEER_GAMES` in `types/gameFinder.ts` is a readonly array of 12 `PeerGame` entries. `useGameFinder` filters it entirely client-side with `useMemo`. There is no database table, no network call, and no seeding for the game directory. Any new entries must be added directly to the `DEFAULT_PEER_GAMES` array and the `types/gameFinder.ts` file. Do not introduce a dynamic dataset unless the catalog grows beyond ~50 entries.

84. **HomeView layout column** — `GoogleSearchHUD` (max-width 680px), `BiomeWidget` (max-width 900px), and the `.showcase` div (max-width 900px) all use `margin: 0 auto` and `padding: 0 var(--sp-8)` to align within the same center column. New home-screen sections must follow the same pattern to stay visually flush. Do not use full-bleed widths on home panel cards.

85. **BiomeWidget animation constraint** — All creature/decor motion in `BiomeWidget` must remain on the GPU compositor thread: use only `transform` (translateX, scaleY, scaleX) and `opacity`. Never animate `left`, `top`, `width`, or `height` during play. `contain: layout style paint` on `.scene` tells the browser this is a paint boundary — omitting it causes the browser to repaint the full viewport on every animation frame. `will-change: transform` on individual creature spans pre-promotes their GPU layer without promoting the whole card.

86. **Schedule generator local-time date strings** — `utils/scheduleGenerator.ts` must use `toLocalDateStr(d)` (year/month/date from local `Date` getters) instead of `d.toISOString().slice(0,10)` for the day-march loop. `toISOString()` converts to UTC first: a user in UTC+12 at local midnight produces `"2026-08-24"` instead of `"2026-08-25"`, causing every class to appear one day early. The same `new Date(y, m-1, d, h, min)` local constructor must be used in `buildSlotMs()` so events render at the correct wall-clock hour in CalendarView.

87. **Recurring events are expanded at import, not stored as rules** — `utils/recurrence.ts` turns an `RRULE` into concrete dates and `parseIcal` pushes one row per occurrence. The parser previously recognised RRULE and dropped it, so a weekly class arrived as a single event on its first date and the calendar looked empty while the toast reported a healthy count. Every occurrence shares a `seriesUid` and carries its own `uid` (`<baseUid>::<startMs>`), which is what makes each one an ordinary editable row. Expansion is bounded by `MAX_OCCURRENCES` and a two-year horizon — an RRULE with no COUNT and no UNTIL is legal and means forever.

88. **`seriesUid` is how "this event" and "all events" differ** — never add a second mechanism for recurrence scope. `lib/calendarMutations.ts` is the only place that decides which rows an edit or delete reaches, and it also picks the table: personal events live in `personalEvents`, imported ones in `calendarEvents`. A series edit deliberately never carries `startMs`/`endMs` across occurrences — times belong to the occurrence, and applying one to the series would stack every week onto the same date.

89. **Editing an imported event sets `locallyEdited: 1`** — `refreshFeed` deletes and re-imports a feed's events, which would silently revert your change. Flagged rows are left alone and their uids treated as already present. The consequence is honest and must stay visible: that event no longer tracks the feed, which is why the detail popover shows an "Edited here" chip.

90. **Habit days roll over at the configured cutoff, not midnight** — `utils/dayBoundary.ts` owns this. Habit-facing code calls `todayISO()` from `lib/hooks/useHabits` or `effectiveDateISO()`; non-habit features keep using `toLocalDateStr` and roll over at midnight, which is correct for them. `addHabitProgress`'s default date also respects the cutoff so a 2am auto-sync from a workout lands on the same day a manual tap would. The date is stepped by its *component*, never by subtracting 86,400,000 ms — a day is 23 or 25 hours twice a year. When the window is open the Habits view says so; a setting that silently rewrites what "today" means reads as a bug.

83. **WebRTC sync is ephemeral + temporal-evaluated** — `useFriendsNetwork` uses PeerJS for one-shot data exchange on connection open; the connection may close after the exchange. Snapshots are stored persistently in IDB (`peer_leaderboard_snapshots`) but are evaluated at receive time via `evaluateTemporalSnapshot()` which zeros `weeklyStudyMinutes` if the snapshot is > 7 days old and `monthlyStudyMinutes` if > 30 days old. `SELF_ID = 'self'` is the reserved PK for the user's own snapshot row — never use a real PeerJS ID as the self key. The gamesDb profile is always keyed `'active_user'` (not `1`); use `gdb.user_profile_config.get('active_user')` to read cosmetic points.

---
