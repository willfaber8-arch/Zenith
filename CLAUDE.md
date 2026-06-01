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

## Key File Structure

```
app/
  globals.css          Design token system (@theme + :root + keyframes + @layer utilities)
  layout.tsx           Root layout — font loading, provider chain, layer stack comment
  page.tsx             Single entry point → renders <ViewRouter />
  api/
    cal-proxy/
      route.ts         Server-side iCal CORS proxy — webcal:// normalisation, 5-min cache

components/
  AppContent.tsx       Auth-aware wrapper — orchestrates auth gate ↔ workspace transitions
  AppShell.tsx         Sidebar + topbar shell; consumes StudyModeContext for slide-out transitions;
                       renders <StudyLayoutContainer /> as fixed overlay
  AppShell.module.css  Sidebar styles, nav item interactions, responsive drawer
  AuthGate.tsx         Full-viewport login overlay (cosmos backdrop shows through)
  AuthGate.module.css  Card styles, Google button, input, gradient submit button
  CosmosCanvas.tsx     Fixed background canvas — 115-star ambient particle system
  CosmosCanvas.module.css  z-index: 1 (above ThemeBackground, below AppShell)
  GreetingHero.tsx     Time-based greeting, live clock, date, weather slot
  GreetingHero.module.css  Syne display type, gradient name text, meta row
  MajorHub.tsx         Polymorphic major resource grid — mirrors UniversityHub card pattern
  MajorHub.module.css
  MajorSelector.tsx    Combobox onboarding picker for major declaration — mirrors UniSelector ARIA
  MajorSelector.module.css
  PomodoroCanvas.tsx        SVG radial ring (R=80, viewBox 200×200, 220×220px) — FSM-aware
                            arc in purple (WORK) / green (breaks) / 50% opacity (PAUSED);
                            `--fill-pct` CSS property drives track fill; session pips row below
  PomodoroCanvas.module.css
  StudyLayoutContainer.tsx  Full-bleed study cockpit (position:fixed, z:200) with:
                            CockpitTopBar, StudyPomodoroArena (FSM-backed, uses usePomodoroStateMachine
                            + PomodoroCanvas), StudySideDock (Notes/Cards/Audio tab placeholders).
                            Entrance animation uses setTimeout(20) instead of double-rAF — React 18
                            StrictMode cancelled the outer rAF ID before the inner could fire.
  StudyLayoutContainer.module.css  Added .distractionRow/.distractionBtn (amber) + .distractionCount
  SyncIndicator.tsx    Topbar sync status chip — 4 states, quiet dot after 3s synced
  SyncIndicator.module.css  syncPulse + queueBorderPulse keyframes, 4 color states
  SyncStatusIndicator.tsx   Full-panel ambient status widget (Phase 6.4) — 26px fixed height,
                            key={status} remount replays anim-slide-in, bracketed label format
                            [ SYSTEM STATUS: … ], 4-state colour system (green/periwinkle/slate/muted)
  SyncStatusIndicator.module.css  brokerPulse dot animation + offlinePulse border shimmer
  ThemeBackground.tsx  Fixed morphing background div (500ms category tint transition)
  ThemeBackground.module.css  z-index: 0
  Toast.tsx            Fixed bottom-right notification stack (always renders, id="toast-container")
  Toast.module.css     toastIn/toastOut animations, type-specific inset borders, z-index: 600
  UniSelector.tsx      Autocomplete university picker — combobox/listbox ARIA, keyboard nav
  UniSelector.module.css
  UniversityHub.tsx    Responsive resource link grid for a loaded university config
  UniversityHub.module.css  Card hover lift, tag pill, linkAction accent, auto-fill grid
  GpaSimulator.tsx     Predictive GPA module — historical locked semesters + What-If sliders.
                       Slider overrides in Map<courseId, string> for instant recalculation;
                       IDB writes debounced 150ms on pointer-up. SemesterCard uses
                       grid-template-rows: 0fr→1fr for smooth collapsible animation.
                       GpaMetricPanel: large GPA + tier badge + 4px target bar + margin bubble.
  GpaSimulator.module.css  data-tier CSS attributes for grade colour-coding; range input
                            styled via --fill-pct custom property
  ViewRouter.tsx       Two-phase fade/scale content switcher (exit 200ms → swap → enter 300ms);
                       live views: home, uni-hub, major-hub, calendar, gpa-calc, aquascaping
  Topbar.tsx           Sticky 52px bar — breadcrumb, SyncIndicator, weather chip, clock, user chip
  Topbar.module.css    Glass backdrop, responsive hamburger toggle
  AquascapingValidator.tsx   Ecosystem compatibility dashboard — two-panel layout (tank sliders +
                             species combobox left; bioload bar + conflict feed right). 34-species
                             library; 6-check analyzeCompatibility() engine imported from aquascapingMath.
  AquascapingValidator.module.css  Creator's Choice --v-* local tokens; slider fill gradient; anim-scale-in
                                   on conflict cards; pulseGlow on all-clear dot.
  SupplierCartSimulator.tsx  Multi-vendor cart aggregation dashboard — catalog autocomplete (22 items),
                             inline vendor reassignment, qty controls. calculatePricing() groups items by
                             vendor, evaluates freeShippingThreshold, outputs grand total with savings line.
                             Grand total block keyed on estimatedGrandTotal to re-trigger slideIn animation.
  SupplierCartSimulator.module.css  Sticky breakdown panel; strikethrough FREE shipping row;
                                    clamp()-sized display-font grand total.
  HardscapeSimulator.tsx     20×10 grid-snapped canvas workspace — palette of 6 element types
                             (Seiryu Stone, Dragon Stone, Spider Wood, Driftwood, Anubias, Java Fern);
                             document-level drag via dragRef + useEffect; W/H scale controls; 4 tank
                             presets (5G/10G/20G-L/29G). Layout persists in localStorage (key:
                             'zenith_hardscape_v1').
  HardscapeSimulator.module.css  Substrate dark #0b160e canvas; CSS grid-line background-image;
                                 grab cursor; pulseGlow ring on selected element.
  ParameterChart.tsx         Pure hand-rolled SVG line chart (no external library) — cubic bezier
                             smooth paths, area fills, auto-scaled Y axis via niceMax(), X-axis date
                             decimation (max 7 labels). Reads WaterLog[]; calls analyzeCycleStatus()
                             to drive the nitrogen cycle status banner (6 CyclePhase states).
  ParameterChart.module.css  Phase-specific border tints (amber/rose/green per CyclePhase data attr);
                             cycleStatusCycled triggers scaleIn burst + pulseGlow dot.
  WaterParameterLogger.tsx   IDB-backed water chemistry form — pH/NH3/NO2/NO3 sliders + number inputs
                             with per-parameter --fill colour; useLiveQuery drives log table + embeds
                             ParameterChart. Danger threshold colour-coding in log rows.
  WaterParameterLogger.module.css  Two-column form+chart layout; per-param slider track via --fill CSS var.
  views/
    CalendarView.tsx        Universal Calendar — week grid, 11:59 banner, agenda, feed manager
    CalendarView.module.css
    GpaView.tsx             Thin wrapper: ZenHeading + <GpaSimulator />
    GpaView.module.css
    HomeView.tsx            GreetingHero + Study Mode CTA + design showcase
    HomeView.module.css     Layout for showcase + studyModeCta card styles
    MajorHubView.tsx        Major Hub orchestrator — 5-state machine (mirrors UniHubView)
    MajorHubView.module.css
    PlaceholderView.tsx     Generic "Module Initializing" stub for unbuilt views
    PlaceholderView.module.css
    UniHubView.tsx          University Hub orchestrator — 5-state machine (loading/selector/no-data/hub)
    UniHubView.module.css
    AquascapingView.tsx     Three-tab Aquascaping Engine hub — tab bar persists state via display:none
                            (not unmount). Tabs: Ecosystem Validator | Supplier Cart | Hardscape & Water Log.
                            ZenHeading title + subtitle update reactively with activeTab state.
    AquascapingView.module.css  tabPane { display:none } / tabPaneActive { display:block; animation: fadeIn }
                                + .hardscapeTab column layout.
  ui/
    ZenHeading.tsx      Display heading primitive (sizes: sm / md / lg)
    ZenHeading.module.css
    ZenCard.tsx         Info card with top-edge accent glow (accent: purple | green)
    ZenCard.module.css

config/
  universities/
    index.ts            UniLink/UniCategory/UniversityConfig/UniversityEntry types + UNIVERSITY_REGISTRY
                        (22 schools) + getUniversityConfig(id) async lazy-loader
    cornell.ts          Cornell University — 3 categories, 14 links (loaded on-demand only)
  majors/
    index.ts            MajorLink/MajorCategory/MajorConfig/MajorEntry types + MAJOR_REGISTRY
                        (13 majors) + getMajorConfig(id) async lazy-loader
    engineering.ts      Engineering — 4 categories, 12 links (loaded on-demand only):
                        Computation & Math (WolframAlpha), Reference DBs (Engineering Toolbox,
                        eFunda), Typesetting & Coding (Overleaf, GitHub, SO),
                        Hardware & Electronics (DigiKey, AllAboutCircuits)
  aquascapingVendors.ts  VendorConfig schema + VENDOR_REGISTRY (6 vendors: Aquarium Co-Op, Flip
                         Aquatics, The Wet Spot, AquaSwap, Buceplant, Glass Aqua) + VENDOR_MAP
                         (O(1) lookup) + SHIPPING_TYPE_LABEL. Each vendor has shippingType
                         ('flat_rate'|'live_animal_express'|'tier_based'), baseShippingCost,
                         freeShippingThreshold (number|null).

lib/
  AuthContext.tsx      AuthProvider + useAuth() — localStorage session management
  NavContext.tsx       NavProvider + useNav() — active view + category routing state
  NavBadgeContext.tsx  NavBadgeProvider + useNavBadge() — per-view badge counts (setBadge in useCallback — stable ref)
  StudyModeContext.tsx StudyModeProvider + useStudyMode() — isStudyModeActive boolean,
                       sessionCount, enterStudyWorkspace(), exitStudyWorkspace(),
                       incrementSession(); global Escape key handler; body scroll lock
  SyncContext.tsx      SyncProvider + useSyncStatus() — bridges ZenithSyncEngine into React tree;
                       also calls initSyncBroker() on mount (Phase 6.4)
  ToastContext.tsx     ToastProvider + useToast() — ephemeral notification queue
  nav-config.ts        Navigation taxonomy — CategoryId, ViewId, NAV_CONFIG, tint/hover/accent maps
  db.ts                Dexie.js v4 engine — ZenithDatabase class, 19 tables (v13), SSR-safe singleton
  supabase.ts          SSR-safe Supabase client singleton — returns null when unconfigured
  weather.ts           Open-Meteo fetch, WMO code → description mapping
  hooks/
    useLiveAssignmentBadges.ts  useLiveQuery — active assignment count → NavBadge sync
    useCalendarData.ts          useLiveQuery feeds + events; addFeed / deleteFeed / refreshFeed
                                pipeline: fetch via /api/cal-proxy → parseIcal → bulkAdd to IDB
    useHabitProgress.ts         useLiveQuery — daily habit completion metrics + SVG ring data
    usePomodoroStateMachine.ts  FSM hook — 5 states (IDLE/WORK/SHORT_BREAK/LONG_BREAK/PAUSED),
                                epoch-based precision timing, IDB session logging on completion,
                                awardXp(25) on natural finish, distraction counter + toast
    useSandboxConfig.ts         localStorage widget visibility config (4 slots)

types/
  syncQueue.ts         OutboxMutation interface (id, tableName, action, payload, timestamp,
                       updatedAt) + OutboxTable / OutboxAction unions + OUTBOX_CLOUD_TABLE
                       routing map (assignments→supabase_urgent_tasks, habits→supabase_habits,
                       userProfile→supabase_user_profiles, workouts→supabase_workouts)
  aquascaping.ts       AquaSpecies, TankInhabitant, TankConfig, CompatibilityConflict,
                       BioloadResult, CompatibilityReport — consumed by AquascapingValidator +
                       aquascapingMath. SpeciesType: 'fish'|'shrimp'|'snail'|'plant'.
                       AggressionLevel: 'peaceful'|'semi-aggressive'|'aggressive'.

utils/
  calendarParser.ts    Pure-TS iCal parser (zero dependencies):
  gpaMath.ts           Cornell 4.3-scale GPA engine — calcGpa(), roundGpa(), grade↔slider
                       converters, gpaTier(), fmtGpa(); zero React/Dexie imports
                       RFC 5545 line-unfolding, property parser, two-pass Intl TZ conversion,
                       11:59 PM detector, keyword-based category classifier
  aquascapingMath.ts   34-species SPECIES_LIBRARY + analyzeCompatibility(config, inhabitants)
                       → CompatibilityReport. Six checks: temp overlap, pH overlap, current-param
                       vs species range, predator/prey matrix, tank size per species, bioload %.
                       BIOLOAD_PER_GALLON = 1.5; plants carry negative bioloadRating.
  pricingMath.ts       CartItem / VendorBucket / PricingReport types + calculatePricing(items,
                       vendorMap) → PricingReport. Groups by assignedVendorId, evaluates
                       freeShippingThreshold, sorts buckets (free-first then alpha), tracks
                       savingsFromFreeShipping. round2() prevents float drift.
  waterChemistry.ts    WaterLog interface + CyclePhase union + CycleStatus interface +
                       analyzeCycleStatus(logs) → CycleStatus. Six phases: no_data → initial →
                       ammonia_spike → nitrite_spike → stabilizing → cycled.
                       ZERO_THRESHOLD = 0.25 ppm. Cycle confirmed only when hadSpike=true AND
                       latest NH3 ≤ 0.25, NO2 ≤ 0.25, NO3 > 0.

services/
  syncEngine.ts        ZenithSyncEngine — Dexie hooks + debounced drain + Supabase reconciliation;
                       reportStatus(status) public bridge consumed by syncBroker (Phase 6.4)
  syncBroker.ts        Phase 6.4 outbox broker — initSyncBroker() + processOutboxQueue();
                       registers Dexie creating/updating/deleting hooks on all 4 tables;
                       supabaseId injected on habits + workouts creating hooks; 2 s debounce;
                       per-table batch flush: one SELECT IN for LWW check, one bulk upsert,
                       one bulk delete; MAX_RETRIES=3 retirement; shares SyncStatus stream
                       via getSyncEngine().reportStatus()

components/
  BadgeSyncEffect.tsx  Zero-render — seeds userProfile on auth + calls useLiveAssignmentBadges
  WidgetSandbox.tsx    Configurable widget grid + AnimatedWidget wrapper + ManagePanel
  WidgetSandbox.module.css  sandboxEnter/Exit keyframes, toggle pill, mobile bottom-sheet
  widgets/
    Widget.module.css         Shared base card styles for all four widgets
    UrgentTasksWidget.tsx     useLiveQuery — priority-ranked active assignments (top 6)
    HabitSummaryWidget.tsx    SVG ring progress (r=38) + habit list
    PomodoroWidget.tsx        Working 25/5 focus-break timer with phase auto-switch
    WeatherWidget.tsx         Geolocation + Open-Meteo + Nominatim city reverse-geocode

supabase/
  migrations/
    20260529000001_phase2_cloud_schema.sql  3 tables (user_profiles, urgent_tasks, calendar_feeds),
                                            trigger, RLS policies, indices
    20260601000001_phase64_extended_sync_schema.sql  supabase_habits + supabase_workouts;
                                            updated_at triggers (reuses handle_profile_updated_at),
                                            RLS (4 policies each), 4 performance indices

tailwind.config.ts     Reference doc only — token → class mapping table, font upgrade notes
.env.local.example     Supabase env var template
vercel.json            Edge cache manifest — s-maxage=31536000 immutable on /_next/static/;
                       1-year cache on fonts/media; no-store on /api/; s-maxage=0+swr=60 on
                       HTML shell; SPA rewrite for deep-link refresh safety
.github/
  workflows/
    deploy.yml         5-stage CI/CD: checkout+npm-cache → npm ci → next build typecheck →
                       Playwright E2E (Chromium, browser-binary cache) → Vercel CLI prod deploy
                       (gated on success() + push to main); artifacts uploaded 14 days
```

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
z-index: 600  Toast                     — notification stack, above everything
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
                           ├─ ThemeBackground   (fixed, z-index: 0)
                           ├─ CosmosCanvas      (fixed, z-index: 1)
                           ├─ AppContent        (auth gate ↔ workspace orchestrator)
                           │    ├─ AuthGate     (fixed, z-index: 50, when !authed)
                           │    └─ AppShell     (z-index: 2, when authed)
                           │         └─ StudyLayoutContainer  (fixed, z-index: 200, when study mode)
                           └─ Toast             (fixed, z-index: 600)
```

`StudyModeProvider` sits inside `ToastProvider` (so cockpit can show toasts) and above `AppContent` (so both AppShell and HomeView can access it).

---

## Navigation System

### Taxonomy (`lib/nav-config.ts`)

```
ZENITH ESSENTIALS (category: 'essentials', tint: #0d1020)
  SCHOLASTIC
    · Study Shield      (view: 'study-shield')
    · GPA Calculator    (view: 'gpa-calc')
    · University Hub    (view: 'uni-hub')
    · Major Hub         (view: 'major-hub')       ← Phase 2.4
  LIFE
    · Universal Calendar (view: 'calendar')
    · Workouts           (view: 'workouts')
    · BRB Burn Rate      (view: 'burn-rate')

CREATOR'S CHOICE (category: 'creator', tint: #090f0b)
    · Aquascaping Engine (view: 'aquascaping')
    · Trail Hunter       (view: 'trail-hunter')
    · Botanist Guide     (view: 'botanist')

PERSONALIZED VAULT (category: 'vault', tint: #101010)
    · Custom Link Manager (view: 'custom-links')
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
  eyebrow="Phase 0 · Step 1.1"   // optional — small caps label above title
  title="Design\nFoundations."   // newlines create visual line breaks
  subtitle="Supporting body copy." // optional — muted paragraph below
  size="lg"                        // sm | md | lg
/>
```

### ZenCard

```tsx
<ZenCard
  eyebrow="Academic · Priority"
  title="Thesis Draft Due"
  body="Chapter 3 revision…"
  accent="purple"    // purple | green — controls top-edge glow
/>
```

---

## Database (`lib/db.ts`)

Dexie.js v4 wraps IndexedDB. Database name: **`ZenithOS`**, current schema version **13**.

### Tables & Indices

| Table | PK | Indexed fields | Added |
|---|---|---|---|
| `assignments` | `++id` | `title, dueDate, courseId, status, priority, supabaseId` | v1+v2 |
| `habits` | `++id` | `name, frequency, streakCount, lastCompletedDate, category` | v1 |
| `workouts` | `++id` | `exerciseName, sets, reps, weight, logDate, type` | v1 |
| `quickNotes` | `++id` | `title, updatedAt, category` | v1 |
| `customBookmarks` | `++id` | `label, url, folderName` | v1 |
| `userProfile` | `id` (explicit, always 1) | `userName, universityName, majorIdentifier, expPoints, currentLevel, healthPoints` | v1 |
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
| `rpgEventLog` | `++id?` | `&eventKey` (unique), `processedAt` | v11 |
| `mentalHealthLogs` | `++id?` | `logDate, createdAt` | v12 |
| `outboxMutations` | `id` (string UUID) | `tableName, action, timestamp` | v13 |

**`CalendarFeed`** — iCal subscription: `label, url, color (hex), isActive (0|1), lastFetchedAt, createdAt`

**`CalendarEvent`** — normalised VEVENT: `feedId (FK), uid, title, startMs/endMs (UTC ms), allDay (0|1), is1159 (0|1), category, location?, description?`

**`is1159` flag** — set by `detect1159()` in `utils/calendarParser.ts` when the event's local `getHours()===23 && getMinutes()===59`. Routes the event to the deadline banner in CalendarView instead of the hourly grid.

### Key Types

```ts
type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'overdue'
type Priority         = 'low' | 'medium' | 'high' | 'critical'
type HabitFrequency   = 'daily' | 'weekly' | 'custom'
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

// Phase 6.4 (Sync Broker) — defined in types/syncQueue.ts
// Habit and Workout interfaces gained supabaseId?: string (injected by broker on creating hook)
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
await seedUserProfile('Will')           // creates id=1 singleton if not exists
await awardXp(50)                       // adds XP, recalculates level = floor(√(xp/100))+1
await awardGold(10)                     // adds Zenith Gold to goldPoints balance (Phase 5.4)
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

**Currently live:** Cornell University — 3 categories, 14 links. Registry: 22 schools, 1 with `hasData: true`.

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

**Currently live:** Engineering — 4 categories, 12 links. Registry: 13 majors, 1 with `hasData: true`.

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

**11:59 PM banner row:** Extracted above the scrollable grid. Renders only when `is1159 === 1` events exist for the week. Periwinkle border + `pulseGlow` dot.

**Agenda view:** Groups next 60 days by ISO date, staggered `slideIn` per group.

**Keyboard:** `←` / `→` arrow keys navigate weeks (ignored when an input is focused).

---

## Pomodoro FSM (`lib/hooks/usePomodoroStateMachine.ts`)

```ts
type TimerState = 'IDLE' | 'WORK' | 'SHORT_BREAK' | 'LONG_BREAK' | 'PAUSED'
const machine = usePomodoroStateMachine()
// machine: { timerState, remaining, totalSecs, sessionCount, cyclePosition,
//            distractionCount, start, pause, resume, skip, reset, logDistraction }
```

**Timing precision:** `epochRef = Date.now()` at start/resume; each 250ms tick computes `remaining = max(0, remainAtStart − floor((now − epoch) / 1000))`. Immune to `setInterval` drift in background tabs.

**Phase transitions:** WORK → SHORT_BREAK (sessions 1–3) or LONG_BREAK (every 4th) auto-starts. Break → IDLE (user manually starts next block). Skip increments session count but does not log to IDB. Natural WORK completion → writes `PomodoroSession` to IDB + `awardXp(25)`.

**Exports:** `WORK_SECS = 1500`, `SHORT_BREAK_SECS = 300`, `LONG_BREAK_SECS = 900`, `SESSIONS_PER_LONG_BREAK = 4`

---

## GPA Calculator (`components/GpaSimulator.tsx`)

### Grade scale (`utils/gpaMath.ts`)

Cornell decimal scale — `A+ = 4.3`, `A = 4.0` … `F = 0.0`. Slider indices 0–10 map worst→best via `GRADES` array. `calcGpa(courses)` returns `{ totalCredits, qualityPoints, gpa }`. `roundGpa(v, digits)` uses multiply-round-divide to avoid `toFixed` float drift.

```ts
import { calcGpa, fmtGpa, gpaTier, gradeFromIndex, indexFromGrade } from '@/utils/gpaMath'
const summary = calcGpa([{ credits: 4, grade: 'A-' }, { credits: 3, grade: 'B+' }])
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

Three-tab hub under Creator's Choice. All panes stay **always mounted** (display:none/block pattern) so state survives tab switches. The active pane fades in via `fadeIn` keyframe; the inactive panes are hidden with `display:none`.

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

---

## Phase Completion Status

| Phase | Step | Description | Status |
|---|---|---|---|
| 0 | 0.1 | Design foundations (tokens, typography, ZenCard, ZenHeading) | ✅ |
| 0 | 0.2 | Ambient cosmos canvas + dynamic greeting engine | ✅ |
| 0 | 0.3 | Navigation taxonomy + background morphing matrix | ✅ |
| 0 | 0.4 | Theme-hover micro-interaction engine | ✅ |
| 0 | 0.5 | OAuth mock gateway + session management | ✅ |
| 1 | 1.1 | Design token port — `@theme` registry, font migration | ✅ |
| 1 | 1.2 | Core interface layout — Topbar, badge system, responsive sidebar | ✅ |
| 1 | 1.3 | Browser database engine — Dexie.js v4, 6 tables, SSR-safe singleton | ✅ |
| 1 | 1.4 | State hydration & widget sandbox — live hooks, animated grid, Manage panel | ✅ |
| 2 | 2.1 | Cloud database provisioning — Supabase PostgreSQL DDL, RLS, trigger | ✅ |
| 2 | 2.2 | Cloud sync pipeline — Dexie hooks, pendingSyncQueue, SyncIndicator | ✅ |
| 2 | 2.3 | Polymorphic university hub — UniSelector, UniversityHub, Cornell data | ✅ |
| 2 | 2.4 | Major-specific link matrix — MajorSelector, MajorHub, Engineering data (12 links) | ✅ |
| 2 | 2.5 | iCal/Canvas feed aggregate — CORS proxy, pure-TS parser, week grid, 11:59 banners | ✅ |
| 3 | 3.1 | Custom study mode layout — StudyModeContext, cockpit overlay, SVG Pomodoro arena, side dock | ✅ |
| 3 | 3.2 | Pomodoro FSM engine — epoch-based precision timing, 5-state machine, IDB session log, distraction counter | ✅ |
| 3 | 3.3 | Predictive GPA simulator — Cornell 4.3 scale, What-If sliders, target bar, collapsible semester cards | ✅ |
| 3 | 3.4 | Course Load Matrix & Cognitive Load Map — intensity sliders, stress matrix algorithm, 7-day forecast | ✅ |
| 3 | 3.5 | AI Lecture Summarizer & Flashcard Generator — Anthropic API gateway, 3D flip deck, ingestion dock | ✅ |
| 4 | 4.1 | Aquascaping Biological Compatibility Validator — 34-species library, 6-check engine, bioload bar, conflict feed | ✅ |
| 4 | 4.2 | Supplier Cart Pricing Simulator — 6-vendor registry, shipping threshold evaluator, free-shipping unlock, grand total | ✅ |
| 4 | 4.3 | Hardscape Simulator & Water Parameter Logger — 20×10 grid canvas, drag-and-drop, pure SVG chart, Nitrogen Cycle auditor | ✅ |
| 4 | 4.4 | Trail Hunter Map Hub & GPX Exporter — Leaflet map (CartoDB Dark Matter), multi-parametric filter sidebar, 8-trail dataset, GPX 1.1 blob download | ✅ |
| 4 | 4.5 | Hiker's Pack Checklist & Emergency Check-In — gear weight aggregator (usePackWeight), 21-item inventory, emergency FSM (INACTIVE/ACTIVE_HIKING/OVERDUE), countdown + urgency-adaptive timer card, emergency dispatch payload, TrailHunterView two-tab layout | ✅ |
| 4 | 4.6 | Botanist Node — Cornell flora register (15 species, 3 types), seasonal calendar matrix, Spring/Autumn/Default tint system, houseplant dryness equation, yellow-slate overdue indicator, IDB watering log (ZenithOS v9) | ✅ |
| 4 | 4.7 | Big Red Bucks Burn Rate Tracker & Deliveries Logger — burn rate math engine (availableFunds/daysRemaining), caution/critical adaptive card tints, localStorage-persisted BRB inputs, IDB deliveries table (ZenithOS v10), status FSM (in_transit → arrived → collected) | ✅ |
| 5 | 5.1 | Grit-Style RPG Lifecycle Engine — quadratic EXP curve (100×Level^1.5), atomic applyXpGain/applyHpDamage handlers, Dexie updating hooks on habits+assignments, 30-min overdue HP scan, unique rpgEventLog dedup table (ZenithOS v11), RpgStatusWidget banner, RpgSyncEffect toast bridge | ✅ |
| 5 | 5.3 | Dynamic Grit-Score Analytics Engine — parametric formula (Wd×Cc×(1+Bs)×Pa), 30-day synthetic streak reconstruction, pure-SVG Bézier chart (periwinkle line + gradient fill, 7-label decimated X-axis), three-stat summary row, 3-day slope trend callout (green GAINING / yellow-slate RECOVERY CRITICAL), GritView + GritAnalyticsChart, grit-analytics nav | ✅ |
| 5 | 5.2 | Interactive Character Canvas & Avatar Customizer — geometric SVG avatar (procedural scholar-warrior figure, HP-reactive drop-shadow glow + feColorMatrix desaturate pulse), 4-slot equipment matrix (Head/Torso/Hands/Accessory), 16-item registry with level/streak gates, equipProfileItem level-constraint handler, tabbed AvatarCustomizer panel (scaleIn on equip), CharacterView two-column layout, Character Sheet nav link | ✅ |
| 5 | 5.4 | Daily Quest Matrix & Reward Ledger Vault — FNV-1a seeded daily quest generation (Routine Anchor + Scholar's Sprint), Epic Boss Battles from live high/critical assignments, Zenith Gold economy (`goldPoints` on userProfile), atomic IDB transaction purchase guard, two-pane QuestMarketplace UI (gold `#ccaf52` + ember `#e0723a` accents), 8-item reward catalogue, `questEngine.ts` pure engine + `useQuestBoard` + `useRewardLedger` hooks | ✅ |
| 5 | 5.5 | Multiplayer Pomodoro Focus Rooms — serverless WebRTC P2P mesh via PeerJS, `services/p2pNetwork.ts` singleton (createFocusRoom/joinFocusRoom/broadcast/teardown), host-authority sync (5 s `HOST_HEARTBEAT` + immediate `SYNC_TIME` on FSM transitions), peer force-alignment, `SyncMessage` typed protocol (SYNC_TIME/HOST_HEARTBEAT/PEER_PRESENCE/CHAT_MESSAGE), `useFocusRoom` hook (lobby state machine, chat, peer presence map), two-panel `MultiplayerLobby` (lobby cards + room screen: peer sidebar + shared PomodoroCanvas + focus chat), FNV room IDs (ZEN-MATH-932 pattern), SSR-safe dynamic PeerJS import | ✅ |
| 5 | 5.6 | Fatigued Visual Filters & Positive Recovery Cycles — `useFatigueMonitor` (IDB live streams: continuousWorkMinutes from Pomodoro sessions, currentHealth from userProfile; thresholds: ≥90 min work OR <40 HP), `FatigueContext` + `FatigueProvider` + `useFatigue()` + exported `FatigueCtx` (SSR-safe useContext fallback), `FatigueLayer` ambient rendering layer (backdrop-filter: saturate(0.75) desaturation overlay z:589, warm amber soft-light tint z:590, floating fatigue alert bar z:591 + onset toast), `RecoveryCockpit` (z:595, epoch-based un-pausable 10-min countdown, dual concentric SVG breathing rings via CSS transform-box: fill-box scale animation, progress arc, lockout early-exit prompt, atomic Dexie reward +25 HP capped 100 + +15 Gold + success toast), `awardHp()` DB helper, CosmosCanvas speed halved when fatigued (speedRef pattern: 0.5× drift + lerp, reads FatigueCtx directly to avoid RAF restart) | ✅ |
| 5 | 5.7 | Mental Health Mapping & Slope Day Hype Tracker — `utils/mentalHealthLog.ts` (MentalHealthLog IDB schema, 8-item MOOD_VECTORS with hue-coded presets, `evaluateMentalState` rolling 3-day burnout evaluator: stress≥8 && energy≤3 threshold, critical=2+ days, `shouldSuggestRecovery`), `utils/slopeDay.ts` (first-Thursday-of-May algorithm, `computeHypeMetrics` + 5-tier `HypePhase`: standard 1.0× / season 1.25× / countdown 1.35× / peak 1.5× / live 2.0×, `applyHypeMultiplier`, `fmtMultiplier`), IDB v12 (`mentalHealthLogs: '++id, logDate, createdAt'`), `useMentalHealthLog` hook (upsert-per-day pattern, reactive evaluation), `useSlopeDay` hook (30s tick), `useQuestBoard` modified (hypeMultiplier applied to `awardXp`/`awardGold` in `completeQuest`, hype-boost toast when multiplier >1×), `MentalHealthBurnoutBanner` (sticky notification below topbar, `position:sticky; top:0; z-index:50`, 24h localStorage dismiss, "Start Recovery" CTA via FatigueContext), `SlopeDayHypeTracker` two-pane dashboard (left: 4×2 emoji mood grid + notes textarea + 3-day stat bars; right: bold countdown DD:HH:MM + confetti canvas RAF loop using `ResizeObserver` activates for countdown/peak/live phases, periwinkle hsla particles 0.06–0.20 opacity, hype phase badge + multiplier strips + gradient progress track), nav: `slope-day` added to Life subcategory | ✅ |
| 6 | 6.3 | Continuous Deployment Infrastructure & Vercel Edge Cache Tuning — `.github/workflows/deploy.yml` (5-stage pipeline: checkout+npm-cache, npm ci, next build typecheck, Playwright E2E with Chromium binary cache + 14-day artifact upload, Vercel CLI prod deploy gated on `success() && push to main`; concurrency cancel-in-progress), `vercel.json` (s-maxage=31536000 immutable on `/_next/static/`; 1-year cache on fonts/media; 60s+SWR on `/_next/image`; no-store on `/api/`; s-maxage=0+swr=60 on HTML shell; SPA rewrite for extension-less deep-link paths), `@vercel/analytics` + `@vercel/speed-insights` mounted in `app/layout.tsx` outside ErrorBoundary (crash-safe LCP/INP/CLS, render null outside Vercel env) | ✅ |
| 6 | 6.4 | Database Synchronisation Broker Optimisation — `types/syncQueue.ts` (OutboxMutation schema + OUTBOX_CLOUD_TABLE map), `lib/db.ts` v13 (`outboxMutations` table; `supabaseId?` on Habit + Workout), `services/syncEngine.ts` (`reportStatus()` public bridge), `services/syncBroker.ts` (initSyncBroker + processOutboxQueue: Dexie hooks on 4 tables with supabaseId injection, 2s debounce, per-table bulk SELECT IN LWW check + single upsert call, MAX_RETRIES=3), `lib/SyncContext.tsx` (initSyncBroker wired alongside engine.init()), `components/SyncStatusIndicator.tsx` + `.module.css` (full-panel 26px widget, key={status} slide-in, bracketed label, 4-state colour system), `supabase/migrations/20260601000001_phase64_extended_sync_schema.sql` (supabase_habits + supabase_workouts, updated_at triggers, RLS, 4 indices); **build fix**: WaterParameterLogger.tsx — removed illegal third arg from `useLiveQuery` (dexie-react-hooks v4 signature is 2-arg max) | ✅ |
| 6 | 6.2 | Automated E2E Test Suite Construction — Playwright 1.60 (`@playwright/test`), `playwright.config.ts` (workers:1, isolated context per test, `NEXT_PUBLIC_E2E=1` via webServer.env, chromium project, HTML+JUnit reporters), `components/TestBridge.tsx` (zero-UI client component mounts `window.__zenith = { db, awardXp, awardGold, seedUserProfile }` via useEffect + dispatches `zenith:bridge-ready` CustomEvent, only rendered when `NEXT_PUBLIC_E2E=1`), `types/testBridge.d.ts` (global Window augmentation), `tests/helpers/bridge.ts` (typed Playwright helpers: `injectAuth/waitForBridge/seedProfile/addAssignment/countTable/readSyncQueue/navigateTo`, expRequired formula constant), `tests/zenithCore.spec.ts` (3 suites, 7 tests): Suite 1 — auth gate bypass + workspace boot (sidebar + RpgStatusWidget ARIA); Suite 2 — S2-T1 IDB write via Dexie + `useLiveQuery` DOM assertion + `data-priority` attr; S2-T2 pendingSyncQueue schema (tableName/operation/supabaseId UUID regex/timestamp/retryCount/payload JSON fields); S2-T3 Supabase route mock + online event stability; Suite 3 — S3-T1 boss defeat → ≥75 XP delta + `currentLevel ≥ 2` + RpgStatusWidget DOM; S3-T2 exact formula contract `awardXp(75)` from 99 XP → level 2, 74 XP remainder; S3-T3 multi-level cascade +1200 XP → level 4, 297 XP | ✅ |
| 6 | 6.1 | Production Optimization & Strict Build Hardening — `components/ErrorBoundary.tsx` (React class component, `getDerivedStateFromError` + `componentDidCatch`, two-stage recovery ladder: soft reinit → IDB flush+navigate, Slate-Indigo card with `pulseGlow` dot, dev-only stack trace panel, z-index:950 overlay), `components/ErrorBoundary.module.css` (design-token-only styles), `next.config.ts` (SWC `compiler.removeConsole` strips log/debug in prod; 8-directive CSP baseline covering Google Fonts/Open-Meteo/Supabase/PeerJS/OSM; X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, HSTS; deterministic moduleIds; async splitChunks for leaflet/peerjs/anthropic/dexie vendor bundles), `lib/logger.ts` (typed log/debug/warn/error — dev-only guards + runtime fallback), `lib/hooks/useWindowEvent.ts` (stable-ref `handlerRef` pattern guaranteeing add/remove symmetry in React 18 StrictMode), ErrorBoundary mounted in `app/layout.tsx` wrapping `AppContent` | ✅ |
