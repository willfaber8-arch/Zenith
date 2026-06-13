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
    chat/
      route.ts         AI Co-Pilot streaming endpoint — POST /api/chat; reads LLM_API_KEY
                       server-side; injects compiled contextPayload as Anthropic system prompt;
                       streams UTF-8 text chunks via ReadableStream (Transfer-Encoding: chunked)
    world-news/
      route.ts         RSS news aggregator — fetches BBC World, NPR, The Guardian in parallel;
                       pure-regex XML parser (no library); returns NewsArticle[] sorted newest-first;
                       revalidate: 600 (10-min Next.js edge cache)

components/
  ThemeApplicator.tsx  Zero-render client component — reads activeTheme from ZenithGamesOS IDB via
                       useLiveQuery; removes all previously-applied CSS vars then calls
                       document.documentElement.style.setProperty() for each entry in
                       THEME_DEFINITIONS[activeTheme].vars; mounted inside CopilotProvider in
                       layout.tsx so it is always present for authenticated + unauthenticated states.
  AppContent.tsx       Auth-aware wrapper — orchestrates auth gate ↔ workspace transitions
  AppShell.tsx         Sidebar + topbar shell; consumes StudyModeContext for slide-out transitions;
                       renders <StudyLayoutContainer /> as fixed overlay. Right-click on any nav item
                       dispatches `zenith:nav-ctx` CustomEvent → context menu → "Hide from sidebar".
                       Hidden items stored in localStorage via `useHiddenNavItems`. "Show Hidden (N)"
                       button in sidebar footer opens `hiddenMgrPanel` to restore items individually
                       or all at once. Reads `activeCategory` from `useNav()` and stamps
                       `data-category={activeCategory ?? 'essentials'}` on `.viewport` so child views
                       inherit `--cat-*` CSS tokens automatically.
                       **Collapsible categories (R8):** `useCollapsedCategories()` hook (defined at
                       top of AppShell.tsx) reads/writes `zenith_nav_collapsed_v1` localStorage key
                       (JSON array of collapsed CategoryId strings). Each category label is now a
                       `<button class="categoryLabelBtn">` with `aria-expanded` + animated `▾`
                       chevron (220ms transform transition). `.categoryContent` wrapper uses
                       `display:none` when collapsed. Toggle is idempotent and persists across reloads.
  AppShell.module.css  Sidebar styles, nav item interactions, responsive drawer + `.ctxMenu` /
                       `.ctxMenuItem` right-click menu + `.hiddenMgrPanel` restore panel.
                       `.viewport` defines three `--cat-*` token blocks keyed by `data-category`:
                       essentials (purple), creator (green), vault (slate). Tokens: `--cat-accent`,
                       `--cat-accent-dim`, `--cat-border`, `--cat-surface`, `--cat-card`.
                       R8 additions: `.categoryLabelBtn` (full-width button, replaces `<p>` label),
                       `.categoryLabelText`, `.collapseChevron` (220ms transform transition),
                       `.categoryContent` (overflow:hidden; display:none when collapsed).
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
                            + PomodoroCanvas), StudySideDock (3 real tabs: Notes / Cards / Audio).
                            Entrance uses setTimeout(20) instead of double-rAF (React 18 StrictMode).
                            Notes tab: Markdown scratchpad, Edit/Preview toggle, word count,
                              localStorage auto-save (zenith_cockpit_notes_v1), ◎ dictation button
                              (Web Speech API → appends final transcript), ⏺ voice memo recorder
                              (MediaRecorder → blob URL playback clips).
                            Cards tab: useLiveQuery pulls last ai-study QuickNote, renders
                              FlashcardDeck; empty state shows ◇ icon.
                            Audio tab: 5 ambient presets via Web Audio API. All noise presets use
                              stereo createBuffer(2, len, sr) for headphone width:
                              Brown Noise (12s buffer, IIR-filtered, normalized to 0.70 peak, LP
                              at 1200 Hz — prevents clipping); White Noise (4s buffer, LP at 6 kHz
                              — removes harsh hiss above speech range); Ocean Waves (dual LFO at
                              0.11 Hz + 0.07 Hz for irregular surge pattern, LP at 380 Hz + foam
                              fizz layer HP at 3 kHz amplitude-modulated by primary LFO); Rainfall
                              (3-layer: body BP at 900 Hz, drop impacts HP at 2800 Hz, distant rumble
                              LP at 180 Hz); Focus Tone (40 Hz binaural beat stereo-panned oscillators).
                              Volume slider syncs gain node. Music Player section: MUSIC_STREAMS uses
                              embedUrl (full URL string, not ytId) — Lofi Hip Hop (5qap5aO4i9A),
                              Chillhop (5yx6BWlEVcY), Jazz Focus (Dx5qFachd3A) + custom URL input
                              via toEmbedUrl(); youtube-nocookie.com iframe.
  StudyLayoutContainer.module.css  Full dock styles: notesPanel/notesPanelBar/notesMicBtn/
                            notesMemoBtn/notesInterim/memoList; cardsEmpty/cardsPanel; audioPanel/
                            audioPreset/audioVolSlider; audioSectionLabel/audioSectionDivider;
                            musicStreamRow/musicStreamBtn; customUrlWrap/customUrlInput/customUrlBtn;
                            musicFrame/musicIframe
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
  UniversityHub.tsx    Resource link grid with 4 sub-tabs (Academics & Registration / Career
                       Development / Campus Life / Essentials). Filters `config.categories` by
                       `category.tab` field. Tab bar in `.resourceTabBar` + `.resourceTab` /
                       `.resourceTabActive`. Card anatomy: tag pill, title, description, "Open →".
  UniversityHub.module.css  Card hover lift, tag pill, linkAction accent, auto-fill grid +
                             `.resourceTabBar` / `.resourceTab` / `.resourceTabActive` sub-tab bar
  GpaSimulator.tsx     Predictive GPA module — accepts `gpaScale?: GpaScale` prop ('4.3' | '4.0').
                       Uses `calcGpa(courses, scale)` — Cornell 4.3 (A+=4.3) or standard 4.0 (no A+).
                       Slider overrides in Map<courseId, string> for instant recalculation;
                       IDB writes debounced 150ms on pointer-up. SemesterCard uses
                       grid-template-rows: 0fr→1fr for smooth collapsible animation.
                       GpaMetricPanel: large GPA + tier badge + 4px target bar + margin bubble.
  GpaSimulator.module.css  data-tier CSS attributes for grade colour-coding; range input
                            styled via --fill-pct custom property
  AiCopilotSidebar.tsx   AI Co-Pilot slide-over panel (position:fixed, z:300, right:0). Compiles
                         14-day IDB context via compileUserContextPayload() on first open; streams
                         Anthropic responses via fetch('/api/chat') ReadableStream; inline Markdown
                         renderer (bold/italic/code/fenced-blocks/lists) — zero external libraries.
                         Auth-gated; Escape to close; full-width on mobile.
                         Voice input: ◎ mic button beside the textarea uses Web Speech API
                         (SpeechRecognitionAPI / webkitSpeechRecognition); interimResults=true;
                         interim transcript shown as ghost text above input; final transcript
                         appended to input string; pulsing red ring animation while listening;
                         graceful fallback toast when API unavailable.
  AiCopilotSidebar.module.css  Panel slide transition 360ms ease-expo; 4 node states; cursorBlink
                               keyframe for streaming token cursor; statusPulse on context compile;
                               .micBtn (32px, hover purple, .micBtnActive red pulseGlow);
                               .textareaRow flex row (textarea + micBtn); .interimSpeech ghost text.
  GameFinderDashboard.tsx  Dual-pane multiplayer game directory (Phase 8.5). Left: sticky filter
                       shelf with Cost / Platform / Genre chip toggles (role="checkbox", active dot,
                       purple tint), Reset All button, "Showing N of 12" stat. Right: search bar
                       (⊕ glyph, react onChange, ✕ clear), results count, auto-fill card grid.
                       GameCard sub-component: staggered entrance (index × 40ms), CostBadge
                       (green/amber/purple), PlatformPill (4 color identities), genreTag, player
                       count `[ 2 — 8 PLAYERS ]`, chevron expand; grid-template-rows description
                       reveal with "Visit Game Site →" link. useGameFinder hook drives all state.
                       12-entry DEFAULT_PEER_GAMES dataset in types/gameFinder.ts.
  GameFinderDashboard.module.css  Sticky filter panel, chip group (99px radius pills),
                       @keyframes cardIn (translateY+scale entrance), descWrapper/descWrapperOpen
                       (grid-template-rows 0fr→1fr), platPill color set (Web=sky/Steam=purple/
                       Epic=slate/Console=green), emptyState dashed border.
  SocialLeaderboard.tsx  P2P Friend Ledger + multi-temporal leaderboard (Phase 9.1).
                       Left panel: Your Peer ID + Copy button; animated status dot (4 states:
                       init=amber pulse / ready=green / error=red / unavailable=slate); Add Friend
                       input + connect button; friends list with hover-reveal remove; Privacy
                       Settings collapsible (5 PrivacyToggle switches + disclaimer). Right panel:
                       [WEEKLY] [MONTHLY] [ALL-TIME] horizon tabs; 5 metric chips (Study Mins /
                       Streak / Cardio / Books / ✦ Credits); leaderboard card with standings stack
                       (gold #1 / silver #2 / bronze #3 / slate others); self row purple tint +
                       YOU badge; STALE badge if snapshot > 48h; P2P info strip. Calls
                       useFriendsNetwork() + useLiveQuery(db.userProfile.get(1)).
  SocialLeaderboard.module.css  statusDot 4-variant classes + dotPulse keyframe; horizonTabs pill
                       container; metricChip active dot; rankBadge gold/silver/bronze/other tier
                       CSS; rankRowSelf purple tint; @keyframes rowIn staggered slide-in;
                       privacyPanel grid-template-rows expand; toggle switch (toggleTrack/Thumb/On);
                       responsive ≤820px single-column.
  GritAnalyticsChart.tsx  Pure-SVG 30-day rolling trend chart (repurposed for Habits analytics) —
                          cubic-bezier smooth path, gradient fill, 7-label X-axis decimation,
                          three-stat summary row (Current / 7-Day Avg / 30-Day High), 3-day slope
                          trend callout (GAINING / RECOVERY CRITICAL).
  GritAnalyticsChart.module.css
  ViewRouter.tsx       Two-phase fade/scale content switcher (exit 200ms → swap → enter 300ms);
                       live views: home, uni-hub, calendar, habits, aquascaping,
                       trail-hunter, botanist, wellness, meal-planning, custom-links, games,
                       stats, settings, workouts, world-events, personal-brand,
                       vocab-builder, subscriptions, game-finder, friends-network
                       (slope-day removed → renamed wellness; major-hub merged into uni-hub;
                        world-events + personal-brand + workouts added R8;
                        vocab-builder, subscriptions, game-finder, friends-network added Phase 8–9)
  TutorialSpotlight.tsx  First-time user walkthrough — shown on first 3 page loads, tracked
                       in `zenith_tutorial_v1` localStorage (`{ sessionsShown: number }`).
                       6 steps: Welcome / Sidebar navigation / Dashboard widgets / Study Shield /
                       Vitality Points / AI Co-Pilot. Dot progress indicator with direct step
                       jump. Next/Back/Skip tour buttons. Escape key closes. Backdrop blur
                       overlay (z:700) + card (z:701) with `cardIn` spring animation. Mounted
                       in app/layout.tsx inside CopilotProvider.
  TutorialSpotlight.module.css  backdropIn/cardIn keyframes, dot progress (8px → 24px active
                       pill), icon box (64px, accent-purple bg), step content fade transition,
                       prev/next/skip button styles.
  views/
    SettingsView.tsx     Full settings page — 5 sections: Appearance & Themes (all 10 cosmetics with
                         purchase/apply/active states, live ✦ balance); Dashboard Widgets (toggle
                         switches via useSandboxConfig); Account (display name → db.userProfile);
                         Privacy & Data (JSON export of habits/events/notes/assignments); Keyboard
                         Shortcuts table; About (version, stack). Accessible from sidebar footer
                         Settings button (navigate('settings')).
    SettingsView.module.css  Section cards, theme picker grid (.themeCard / .themeCardOwned /
                         .themeCardActive), toggle rows (.toggle / .toggleOn / .toggleThumb),
                         text inputs, data export button, shortcuts table, about grid.
    StatsView.tsx        Analytics dashboard (Personalized Vault) — Overview row (8 StatChip metrics:
                         habits, completion today, best streak, focus hours, sessions, GPA, ✦ balance,
                         total harvested); 2×2 content grid (Habits progress bars, Study Session
                         4-stat grid, Upcoming Events 7-day list, Arcade Economy per-resource).
                         World Events section removed in R8 — now lives in WorldEventsView.
                         Eyebrow: "Personalized Vault · Analytics".
    StatsView.module.css Chip, card, habit row, study stat grid, event list; slide/scale entrance.
    WorldEventsView.tsx  Standalone world news view (Life category) — source filter tabs
                         (All / BBC World / NPR World / The Guardian); Refresh button; news card
                         grid with source badge, ISO date, headline, description; links open new tab.
                         Fetches /api/world-news on mount. Uses `--cat-accent` for source badges.
    WorldEventsView.module.css  Card grid (auto-fill minmax 320px), source/refresh controls,
                         pulseDot loading animation, error/retry states; anim-slide-in per card.
    SubscriptionPackagesView.tsx  Recurring expense packager (Life · Finance). Burn-rate panel:
                         horizontal gauge (--fill-pct CSS var, green → crimson at CRITICAL_BURN);
                         monthly outflow display; inline budget ceiling editor (zenith_sub_budget_v1
                         localStorage); bundle cards sorted heaviest-first; add-subscription form
                         (name/cost/cycle toggle MONTHLY|ANNUAL/renewal date/bundle datalist);
                         annual cost preview (≈ $X/mo); annual projection card (over/under budget).
                         IDB v21: subscription_items table. Hook: useSubscriptionAnalytics.
    SubscriptionPackagesView.module.css  burnPanel/burnTrack/burnFill (--fill-pct + --bar-color CSS vars,
                         hardware-accelerated 700ms width + 400ms background transitions);
                         contentGrid two-column (1fr 300px); bundleCard/itemRow with hover-reveal
                         deleteBtn; cycleToggle binary selector; projectionCard.
    GameFinderView.tsx   Multiplayer game directory wrapper (Life · Social) — ZenHeading +
                         GameFinderDashboard component.
    PersonalBrandView.tsx  Career hub (Life category) — 12-item career resource grid with tag
                         filter (All/Networking/Jobs/Research/Startups/Design/Portfolio/Resume).
                         Links: LinkedIn, Handshake, Indeed, Glassdoor, Wellfound, Canva, Notion,
                         GitHub, Resume.io, Levels.fyi, Y Combinator Jobs, Loom.
                         LinkedIn Post Generator: writing style sample textarea (optional), topic
                         textarea (required), 4-tone selector (Professional/Casual/Storytelling/
                         Motivational), Generate button → streams from /api/chat via ReadableStream;
                         cursor blink while streaming; ⎘ Copy button on completion. Two-column
                         layout: inputs left, generated post right.
    PersonalBrandView.module.css  Tag filter chips, link card grid (auto-fill minmax 260px),
                         two-column generator layout, tone selector buttons, streaming cursor
                         blink animation, copy button, output box.
    FriendsNetworkView.tsx  WebRTC Friend Ledger wrapper (Life · Social) — ZenHeading +
                         SocialLeaderboard component.
    WorkoutsView.tsx     Cardio logging + Cozy Biome builder (Life category). Two tabs:
                         Cardio Log: 9-activity picker grid (Run/Walk/Bike/Swim/Row/Hike/Yoga/
                         Elliptical/Other); duration + optional distance (mi/km toggle) + notes;
                         VP preview chip before submit; `calcVP(mins)` = mins + 5 bonus ≥30 min;
                         logs to IDB cardioSessions (v18); VP balance + stats in amber chip header.
                         Cozy Biome: BiomeDisplay animated scene (CSS keyframe fish swim / animal
                         wander / decor bob, `--i` CSS var drives stagger offset); Shop with 18
                         items across Aquarium (5 fish + 4 decor) and Zoo (6 animals + 3 decor);
                         purchase with Vitality Points; Aquarium/Zoo switcher; all state in
                         localStorage (zenith_vitality_v1 + zenith_cozy_biome_v1).
    WorkoutsView.module.css  VP amber chip (--vp-amber: #f59e0b), activity picker 3-col grid,
                         biome scene (sceneAqua/sceneZoo gradient backgrounds), fishSwim /
                         animalWander / decorBob keyframes with --i CSS variable stagger,
                         shop item rows with owned/locked states, buyBtn amber scheme.
  SlopeDayHypeTracker.tsx  Renamed WellnessTracker internally — two-pane: Left: mood emoji grid
                           (8 MOOD_VECTORS in 2-col layout), notes textarea, Log Entry button, 3-day
                           trend. Mood buttons: 28px emoji, --mood-hue CSS var drives hue-tinted
                           box-shadow glow per emotion; hover/selected states use same hue.
                           Right: monthly mood calendar.
  SlopeDayHypeTracker.module.css  2-col moodGrid; .moodBtn uses --mood-hue for ambient glow;
                                  .moodBtnSelected boosts glow. Calendar grid styles unchanged.
  views/
    SlopeDayView.tsx    WellnessView — ZenHeading + WellnessTracker (file kept at SlopeDayView.tsx
                        path for router compatibility)
    SlopeDayView.module.css
    MealPlanningView.tsx  4-tab meal planner: Weekly Planner (7-day B/L/D grid, ⟳ Generate Week Plan
                          button auto-fills empty slots from saved recipes + college meals filtered by
                          equipment/prefs; slot modal with ingredient search + calorie auto-calc),
                          Recipes & Resources (URL import via POST /api/recipe-import + macro fields
                          protein/carbs/fat/calories/servings; college dorm quick-fill + saved recipe
                          cards with macro chips), Budget, Kitchen Setup.
                          SavedMealRecipe extended: protein?, carbs?, fat?, calories?, servings?.
                          IDB v17: mealPlanSlots + savedMealRecipes. localStorage: zenith_meal_budget_v1,
                          zenith_kitchen_setup_v1, zenith_preferred_store_v1, zenith_food_prefs_v1.
    MealPlanningView.module.css  + generateStrip/generateBtn; urlImportRow/importBtn/importHint;
                                 macroRow/macroField/macroChipLabel; recipeMacroRow + macroPChip/
                                 macroCChip/macroFChip/macroCalChip chips
    CustomLinksView.tsx  Category-tabbed link dashboard — Add Link modal (name, URL, description,
                         category), auto-fetched favicons via Google's favicon service
                         (`/s2/favicons?domain=DOMAIN&sz=32`), letter-fallback on error. Category
                         tabs derived from folderName values + "All" pseudo-tab. Edit + delete per
                         card. IDB: existing customBookmarks table (description? field added).
    CustomLinksView.module.css  Card grid (auto-fill minmax 280px), favicon/fallback, tab bar,
                                add/edit modal with category dropdown + new-category input
  Topbar.tsx           Sticky 52px bar — breadcrumb, SyncIndicator, ◎ AI Co-Pilot toggle,
                       weather chip, clock, user chip. Consumes useCopilot() for toggle state.
  Topbar.module.css    Glass backdrop, responsive hamburger toggle; .copilotBtn + .copilotBtnActive
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
    CalendarView.tsx        Universal Calendar — three view modes: week grid, month grid, agenda.
                            ViewMode = 'week' | 'month' | 'agenda'. Month view: `MonthGrid`
                            component renders 42-cell (6×7) grid via `getMonthGridDays()` (Monday-
                            start), colored event pills (up to 3 per day + "+N more"), today circle
                            badge, out-of-month cells at 28% opacity. Clicking a day in month view
                            navigates to week view for that week. ← / → keyboard also navigates
                            months when view='month'. `monthStart` state (first of displayed month)
                            is separate from `weekStart`. 11:59 deadline banners only shown in week
                            view. Feed manager panel only shown on iCal Feeds tab.
    CalendarView.module.css Month grid styles: `.monthGrid`, `.monthColHeaders`, `.monthCells`,
                            `.monthCell` (min-height 100px), `.monthCellOut` (28% opacity),
                            `.monthCellToday`, `.monthCellNum` / `.monthCellNumToday` (26px circle),
                            `.monthEvtList`, `.monthEvt` (color via borderLeft + bg), `.monthEvtMore`
    HomeView.tsx            GreetingHero + WidgetSandbox (clean, no design-token showcase)
    HomeView.module.css
    HabitsView.tsx          Full habit tracker — weekly 7-day grid, circle progress per habit
                            (ring color = habit's chosen color via --habit-color CSS var), colored
                            left border per habit, daily % badge, 🔥 streak counter. Edit mode
                            (✎ Edit Habits button): only in edit mode are Delete + Edit buttons
                            shown; Edit opens pre-filled modal. Categories: habits group into
                            collapsible sections when multiple categories exist. Create/Edit modal
                            has: name, category picker (6 presets + custom), **colour picker**
                            (10 swatches + native <input type="color"> wheel), frequency, steps.
                            All-time high streak (🏆) shown per habit in edit mode. No restore-
                            streak feature. Confetti burst on full daily completion.
    HabitsView.module.css   + toolbar, categorySection/categoryHeader/categoryCollapse,
                              colorPickerRow/colorSwatch/colorSwatchCustom/colorWheelInput,
                              editActions/editBtn/deleteBtn, habitNameRow/habitCategoryBadge,
                              --habit-color CSS custom property drives border-left and ring stroke
    MajorHubView.tsx        Major Hub orchestrator (kept for direct MajorHub renders inside UniHubView)
    MajorHubView.module.css
    PlaceholderView.tsx     Generic "Module Initializing" stub for unbuilt views
    PlaceholderView.module.css
    StudyShieldView.tsx     3-tab view: AI Study | Focus Protocol | Focus Rooms. AI Study tab
                            uses AiIngestionDock with two input modes (Paste Notes / Describe Topic)
                            and three generate options (Study Notes, Flashcards, Practice Test).
                            PracticeTestPanel: MCQ with A–D choices, reveal-all scoring, retry.
    StudyShieldView.module.css  + practiceSection, practiceQuestion, choiceBtn/choiceSelected/
                                  choiceCorrect/choiceWrong, practiceFooter, revealBtn, retryBtn
    UniHubView.tsx          University Hub orchestrator — combined onboarding (step 1: pick uni,
                            step 2: pick major with skip option). Full hub has: identity strip
                            (initials badge, uni name, major, location, Change buttons), 5 top-
                            level tabs: University Resources | Major Resources | GPA Calculator |
                            Cognitive Load | Finances. GPA tab shows gpaScaleNote and passes
                            `gpaScale` prop to GpaSimulator. Major Resources tab renders MajorHub
                            or no-data pane. Finances tab: BrbBurnRate (currencyName from
                            uniConfig.currencyName) + DeliveriesLogger. GPA/Cognitive Load tabs
                            wrapped in .tabPadded for consistent horizontal padding.
    UniHubView.module.css   + setupWrap, identityStrip, uniInitials, changeSmallBtn, gpaHeader,
                              gpaScaleNote, noDataPane, skipRow, majorSetupBack
    AquascapingView.tsx     Two-tab Aquascaping Engine hub — tab bar persists state via display:none
                            (not unmount). Tabs: Ecosystem Validator | Supplier Cart | Water Log.
                            Hardscape Simulator removed; third tab now shows only WaterParameterLogger.
                            ZenHeading title + subtitle update reactively with activeTab state.
    AquascapingView.module.css  tabPane { display:none } / tabPaneActive { display:block; animation: fadeIn }
                                + .hardscapeTab column layout.
  games/
    GamesTabShell.tsx    Asymmetric split-screen shell for the Arcade Hub view (view: 'games').
                         Left BiospherePane (40 %): header + live status badge, 3-station selector
                         (Terminal / Aquarium / Zoo) with biosphereContent slot, biosphereViewport
                         (placeholder or injected component), ResourceTicker sub-component (iterates
                         RESOURCE_IDS, reads useZenithEconomy, --fill-pct capacity bars, rose tint
                         when isAtCapacity, ∞ for cosmetic_points). Right ArcadePane (60 %): header,
                         6-tab paneTabBar (Arcade ⬡ / Crucible ◈ / Storage ↑ / Codex ◫ / Skills ⟡ /
                         Shop ✦), processing-job count badge on Crucible tab, arcadeViewport (scrollable).
                         Initial tab set via consumeRequestedTab() in useState initialiser — allows
                         CosmeticPointsIndicator to deep-link to Shop tab on navigation.
                         Typed slot props (GamesTabShellSlots): biosphereContent, arcadeContent,
                         crucibleContent, upgradesContent, codexContent — each replaces its built-in
                         panel when passed. Built-in panels (rendered when slot is absent):
                         CruciblePanel — 5 recipe cards (Queue button per recipe, live balance vs.
                         cost indicator, error messages with 3.5s timeout, active job countdown +
                         Claim button); UpgradesPanel (Storage tab) — per-resource upgrade cards
                         loaded via getUpgradeMatrix() in useEffect([resources]), shows current
                         cap → next cap, cost breakdown with green/grey affordability tint, Upgrade
                         button, Max badge at tier 3; CodexPanel — ✦ summary strip + per-resource
                         ledger table; SkillsPanel — renders SkillTreeCanvas + useSkillTreeActions;
                         click any node to see description, resource costs (green=met), Unlock button;
                         ShopPanel — browse/purchase cosmetics from SHOP_CATALOG_STATIC using
                         purchaseTheme()/setActiveTheme(); category filter (All/Themes/Packs); live
                         ✦ balance chip; owned items show Equip, unowned show cost or dimmed if
                         insufficient. SHOP_CATALOG sourced from lib/shopCatalog.ts (shared with
                         SettingsView).
                         UPGRADEABLE_IDS module-level const drives both UpgradesPanel and tests.
                         BiosphereStation = 'terminal'|'aquarium'|'zoo'. Height: calc(100vh - 52px);
                         overflow: hidden — non-scrolling. Mobile (≤640px): column layout, biosphere
                         collapses to max-height 0 with biosaToggle button in arcade header.
    GamesTabShell.module.css  Shell / pane layout (calc height, flex row/col, transition 500ms
                         cubic-bezier(0.25,1,0.5,1) on all layout shifts); paneHeader + paneTitle
                         (mono, 0.6rem, cat-accent); liveBadge + pulseDot animation; stationSelector
                         chip buttons; biosphereViewport flex-fill; resourceSection + resourceGrid
                         + resourceRow + resourceBarTrack/resourceBarFill (--fill-pct CSS prop);
                         resourceDotRaw/Refined/Currency; paneTabBar + paneTab/paneTabActive (::after
                         bottom underline); tabBadge; arcadeViewport (overflow-y auto, thin scrollbar);
                         tabPanel tabFadeIn keyframe (translateY 6px → 0); placeholder + placeholderGlyph
                         (glyphPulse); jobCard/jobStatusDot/jobClaimBtn (active job list); recipe card
                         styles (recipeGrid/recipeCard/recipeCardActive/recipeCardDimmed/recipeStatusDot*
                         /recipeName/recipeMeta*/recipeBalance/queueBtn/processingBadge); upgrade card
                         styles (upgradeGrid/upgradeCard/upgradeCardAffordable/upgradeCardMax/upgradeName
                         /upgradeCapRow/upgradeCapCurrent/upgradeCapArrow/upgradeCapNext/upgradeLevelBadge
                         /upgradeCosts/upgradeCostChip/upgradeCostChipMet/upgradeActions/upgradeBtn
                         /upgradeMaxBadge/upgradeErrorMsg); codex styles (codexSummary/codexSummaryStat
                         /codexSummaryLabel/codexSummaryValue/codexColHeader/codexColHeaderLabel
                         /codexTable/codexRow/codexRowLabel/codexRowCurrent/codexRowLifetime);
                         shared sectionHeading + panelSection; mobile media queries. All accents via
                         var(--cat-accent) — inherits Creator's green.
    UniversalGameWrapper.tsx  HOC session container for all Arcade Hub game plugins (Step 2.3).
                         Manages: capacity pre-flight gate (isAtCapacity on targetResourceId);
                         performance.now() session clock; onGameComplete interceptor pipeline
                         (payoutFormula(score) → addResources → result overlay). Phase machine:
                         idle → playing → result. sessionKey increments each new session to force
                         child game remount. isMountedRef prevents async state updates after unmount.
                         isCollecting latch prevents double-submit. Typed child slot: children:
                         ReactElement<{ onGameComplete: (result: GameSessionResult) => void }>.
                         Exports: GameSessionResult, UniversalGameWrapperProps.
    UniversalGameWrapper.module.css  .wrapper (surface-card card, p-6), .header, .canvas (16:9
                         aspect-ratio, overflow:hidden, position:relative), .launchScreen + .launchGlyph
                         (glyphPulse), .capacityWarning (filter:saturate(0.45)), .exitBtn (absolute
                         top-right, backdrop-blur), .gameContainer (absolute inset:0), .resultOverlay
                         (z:20, backdrop-blur, @keyframes overlayReveal), .resultCard (@keyframes
                         cardSlideIn), .resultStats + .resultRow + .resultValueGreen/.resultValuePurple,
                         .capNotice (purple tinted aside), .resultBtn/.resultBtnPrimary.
    harvest/
      ScriptingMatrix.tsx  Typing speed game — 60s countdown, 20-prompt pool, payout to raw_data_shards.
                           Character-level feedback (correct/error/pending/cursor), WPM + accuracy metrics,
                           per-prompt payout formula (words × speed_tier + accuracy_bonus). Compatible with
                           UniversalGameWrapper via optional onGameComplete prop; also usable standalone.
      ScriptingMatrix.module.css
      ShiftMatrix.tsx      15-puzzle (4×4 sliding tile) — guaranteed-solvable shuffle via inversion-count
                           parity; position:absolute tiles animated by transform:translate via key={value}
                           stable DOM + CSS transitions; click + ArrowKey slide; payout: 300 raw_data_shards
                           + 5 quantum_fuel on solve. boardKey remount resets animation state on new game.
      ShiftMatrix.module.css
      Core2048.tsx         Classic 2048 on a 4×4 grid. slideLine() primitive reused for all 4 directions
                           via pre/post reversal. executeMove() + spawnTile() (90/10 probability) +
                           isGameOver(). Stale-closure prevention via matrixRef/scoreRef/phaseRef/hasWonRef/
                           processMoveRef. Arrow key + touch swipe (30px threshold). Win overlay ("Keep Going"
                           / "New Game") + game-over overlay. Payout: addResources('raw_data_shards',
                           Math.floor(score/10)). Best score: localStorage zenith_2048_best_v1.
      Core2048.module.css  4×4 CSS grid (74px cells, 8px gap); tileAppear pop-in spring keyframe;
                           stats bar; colour ramp: green (2–64) → purple (128–512) → intense green glow (1024+).
      BioSynthesizer.tsx   Falling color-coded droplet balancer game (Step 4.4). 360×400 canvas, delta-time
                           physics, FALL_SPEED=88px/s, SPAWN_MS=1700ms, SESSION_S=60s. Player slides a
                           collector bin (ArrowLeft/Right, 44px step) and toggles color (ArrowUp/Space).
                           Canvas click: left half=slide left, right half=slide right. Match +1 score, green
                           flash; mismatch -1 (floor 0), red flash. processFrameRef pattern for stale-
                           closure-free RAF. sessionEndRef epoch-based timer; setScore/setTimeLeft updated
                           once-per-second via lastSecRef delta check. addResources('organic_spores',
                           Math.floor(fusionScore/2)) on session end. Best: zenith_biosynth_best_v1.
      BioSynthesizer.module.css  urgentPulse keyframe; canvasWrapper border; .canvas display:block cursor:pointer.
      ZenSnake.tsx         Classic grid-locked snake (Step 4.4). 15×15 grid, CELL=24px, TICK_MS=120ms.
                           tickRef (updated each render) holds game logic; frameRef drives RAF loop —
                           tick accumulator pattern prevents drift. dirQRef buffers up to 2 pending
                           direction changes; 180° reversal blocked. Self-collision excludes vacating
                           tail tip. Pellet spawns at random empty cell via Set-based occupied check.
                           Touch swipe (30px threshold, 4-direction). addResources('organic_spores',
                           score*5) on game over. Best: zenith_zensnake_best_v1.
      ZenSnake.module.css  Mirrors BioSynthesizer.module.css structure; purple resultHeading/resultCard border.
    base/
      BiosphereRenderer.tsx  Deterministic visual ecosystem canvas (Step 5.2). Reads `unlockedAssets: string[]`
                           and maps IDs onto pre-calculated absolute-positioned slots inside a shared container.
                           All slots always in DOM; `.assetSlotActive` triggers 700ms spring CSS transition
                           (cubic-bezier(0.34,1.56,0.64,1)) — zero layout shift. Conditional content inside
                           each slot prevents hook leakage (e.g. uptime counter only runs when unlocked).
                           Three environments: aquarium (substrate_rocks, kelp_forest, neon_fauna) · terminal
                           (ambient_pulse_lines, mainframe_node, uptime_registry) · zoo (enclosure_perimeter,
                           botanical_canopy, fauna_sprites). resolveActiveSlots(moduleId, activeSet) exported
                           as public API returning RenderingSlot[]. StageIndicator (5 pips, top-left).
                           EmptyEnvironment prompt when no assets unlocked. data-stage + data-module attributes
                           drive CSS compound selectors for stage-based animation tuning (no JS needed).
                           All 9 leaf sub-components are React.memo-wrapped.
      BiosphereRenderer.module.css  assetSlot (opacity:0; scale:0.88; will-change) + assetSlotActive (opacity:1;
                           scale:1; spring 700ms). transform-origin overrides for bottom-anchored (substrate,
                           kelp → bottom center) and top-right-anchored (canopy, uptime → top right) slots.
                           Keyframes: kelpSway (rotate±3deg+skewX±1deg, bottom anchor), neonDrift (translateX
                           -20px→460px, opacity fade at edges), codeScrollLoop (translateY 0→-50% seamless loop),
                           svgLinePulse (opacity 4%→12%), uptimeBlink (binary step LED), botanicalSway
                           (rotate±2deg, top-right anchor), faunaStep (translateX -24px→440px, steps(28,end)).
                           .container[data-stage='3/4/5'] .kelpStalk: animation-duration 3.2s→2.2s.
                           .container[data-stage='5'] .stageIndicator: green box-shadow glow.
    refine/
      MinesweeperCore.tsx  Active Refining Game — Steps 3.1 + 3.2 + 3.3. 10×10 Minesweeper on
                         pure React state, no game engine. Phase machine: waiting→active→won|lost.
                         MinesweeperCell: x, y, isMine, isRevealed, isFlagged, isRefineLocked,
                         neighborMines. Pure math helpers (§4): getNeighbourCoords, createBlankGrid,
                         placeMines (partial Fisher-Yates, 9-cell safe-zone), computeNeighbourCounts,
                         floodReveal (BFS), revealAllMines, flagRemainingMines, checkWin, countRevealedSafe.
                         Step 3.2: onContextMenu hijack (e.preventDefault()), flag-capacity gate inside
                         functional setGrid updater (race-safe on rapid right-clicks), isRefineLocked=c.isMine
                         on placement, efficiencyPenalty derived from grid (isFlagged && !isRefineLocked).
                         cellFlagEligible compound class (.cellHidden.cellFlagEligible) drives --accent-purple
                         hover border via 2-class specificity. @keyframes flagPlant cubic-bezier(0.34,1.56,0.64,1).
                         Step 3.3: sessionStartRef (performance.now() on first click → active), buildRefineResult()
                         calls RefineScoreEvaluator, setRefineResult() shows overlay before onGameComplete.
                         handleCollectYield: isCollecting one-way latch; reads useZenithEconomy for overflow
                         pre-estimate (read-only). payoutFormula=identity in ViewRouter (engine computes exact yield).
      MinesweeperCore.module.css  .gameRoot (position:relative — overlay anchor), .statusBar,
                         .boardContainer (flex:1; min-height:0 centering), .board (height:100%;
                         aspect-ratio:1/1; grid repeat(10,1fr)×2; gap:2px); .cell base, .cellHidden,
                         .cellFlagged (--accent-purple border + flagPlant animation), .cellHidden.cellFlagEligible
                         hover (purple border 50% — 2-class specificity override), .cellRevealed/:disabled
                         opacity:1, .cellMine, .cellExploded (@keyframes explodeFlash), .statValueCapReached
                         (--accent-purple tint at flag cap); Step 3.3 overlay: .refineOverlay (z:15,
                         @keyframes overlaySlideIn 500ms expo), .refineCard (@keyframes cardRise),
                         .refineHeader + .refineHeaderWon (--accent-green) + .refineHeaderLost (--accent-purple),
                         .refineStats + .refineRow + .refineLabel + .refineValue, .refineValueGreen /
                         .refineValuePurple, .refineDivider, .refineCapNotice (purple tinted aside),
                         .collectBtn + .collectBtnWon + .collectBtnLost.
    skills/
      SkillTreeCanvas.tsx  Interactive SVG progression tree renderer (Step 6.1). viewBox="0 0 800 600",
                           overflow="visible". 13 nodes across 4 branches — node IDs match
                           SkillTreeFirewall.SKILL_TREE_REGISTRY exactly so useLiveQuery data flows
                           directly: nexus_core_01 (400,90) root + Branch A aesthetic (140,240)→
                           (110,390)→(80,540) + Branch B efficiency (300,240)→(300,390)→(300,540) +
                           Branch C cultivation (500,240)→(500,390)→(500,540) + Branch D synergy
                           (660,240)→(690,390)→(720,540). 12 cubic bezier connectors. Branch type
                           extended to include 'synergy'; popupBranchTag[data-branch="synergy"] gold.
                           NodeState: 'locked'|'available'|'unlocked' derived from unlockedNodeIds prop.
                           ConnectorState: 'inactive'|'partial'|'active' derived from parent node state.
                           TREE_NODES + TREE_CONNECTORS + NODE_GLYPHS static constants. BRANCH_HEADERS at
                           y=178. Selection ring: rotating dashed stroke-dashoffset animation. Burst ring:
                           one-shot scale+fade on newly unlocked nodes (useRef previous-unlock diff). Popup
                           card: wrapText(desc, 27) word-wrap, computePopupPosition() clamps to viewBox,
                           popupBranchTag[data-branch] drives per-branch fill colour. SkillTreeNode +
                           SkillTreeCanvasProps exported. Keyboard accessible: tabIndex + onKeyDown on
                           interactive node groups. Background decorative grid via <pattern> + <rect>.
      SkillTreeCanvas.module.css  CSS Module: .canvasWrap (aspect-ratio 4/3), .svg, .connector +
                           [data-state] variants, .nodeGroup (transform-box:fill-box), .nodeCircle +
                           .nodeGlyph + .nodeLabel + [data-state] trios, .branchHeader, .selectionRing
                           (rotateDash keyframe), .burstRing (nodeUnlockBurst scale+fade), .popupGroup
                           (popupReveal slide-in), .popupBg/.popupTitle/.popupDesc/.popupBranchTag[data-branch]
                           /.popupDivider/.popupClose. Keyframes: nodeCirclePulse (stroke-width breath),
                           rotateDash, nodeUnlockBurst, popupReveal.
  dashboard/
    BiosphereWidgetHost.tsx  Cross-pillar context-adaptive biosphere renderer host (Step 5.3).
                           LayoutContextType = 'games_tab'|'study_shield'|'dashboard_home'.
                           CONTEXT_CONFIGS map drives ContextDisplayConfig (dimensions, interactivity,
                           opacityAlpha, blurStrength) per context. resolveActiveRecord(): games_tab →
                           isActiveHomeDisplay env or terminal fallback; study_shield → isActiveStudyDisplay
                           env; dashboard_home → isActiveHomeDisplay env. Three render phases: loading
                           skeleton → unpinned empty state (study_shield/dashboard_home) → active record.
                           study_shield: rendererLayer opacity=0.4, inert={true} disables all
                           interaction/a11y, studyShieldOverlay backdrop-filter:blur(12px) frosted glass.
                           dashboard_home: stageBadge "Stage: 0N" in bottom-right corner. Exports
                           LayoutContextType + BiosphereWidgetHostProps + ContextDisplayConfig + CONTEXT_CONFIGS.
    BiosphereWidgetHost.module.css  .hostBase (isolation:isolate), .hostGamesTab (100%×100%, min-h 400px),
                           .hostStudyShield (w-full h-128px, top border), .hostDashboardHome (max-w 24rem,
                           aspect-ratio 1/1, border-radius lg). .rendererLayer (absolute inset:0, opacity
                           transition). .studyShieldOverlay (z:1, rgba(11,13,19,0.40) bg, backdrop-filter
                           blur 12px, muted border-bottom). .stageBadge (absolute bottom-right, mono 10px,
                           semi-transparent bg, z:2). .skeletonState (skeletonPulse keyframe).
                           .unpinnedState/.unpinnedGlyph/.unpinnedLabel/.unpinnedHint empty-pin prompt.
  navigation/
    CosmeticPointsIndicator.tsx   Pill-shaped ✦ Credits balance badge in the Topbar cluster,
                                  immediately left of the user profile chip. Uses useZenithEconomy()
                                  to read cosmetic_points reactively (0ms lag). Calls seedGamesDatabase()
                                  on mount (idempotent — safe as global seeder). Skeleton state via
                                  @keyframes skeletonPulse while IDB boot frame resolves
                                  (resources['cosmetic_points'] === undefined). Clickable: role="button",
                                  tabIndex={0}, onClick + onKeyDown (Enter/Space) → calls
                                  requestGamesTab('shop') from lib/gamesNavState then navigate('games',
                                  'creator') — deep-links to the Shop tab. aria-label includes
                                  "open Arcade Hub". Label is "✦" (not "CP"). Hidden ≤767px.
    CosmeticPointsIndicator.module.css  --surface-card bg, --border-subtle border, --r-xl radius;
                                  cursor: pointer; hover tints border + background toward accent-purple;
                                  :active deepens background; .skeleton (52×22px pill, skeletonPulse
                                  keyframe); --accent-green for balance value, --text-muted for ✦ label,
                                  --font-mono.
  GoogleSearchHUD.tsx  Centered web-search console on HomeView (Phase 10.1). Auto-focuses input
                       via requestAnimationFrame on mount. Enter → window.open Google search in
                       new tab (noopener,noreferrer). Escape → clear. Hardware-accelerated focus
                       glow (will-change: box-shadow, border-color). Clear ✕ button visible only
                       when text present. Submit ↗ button disabled when empty. max-width 680px.
  GoogleSearchHUD.module.css  Periwinkle focus ring (rgba(124,149,255,0.07) + 28px spread),
                       .barFocused modifier via focused state, .submitBtnActive only when text
                       present. Monospaced label + hint strip at 0.45rem/0.4rem.
  BiomeWidget.tsx      Standalone home-screen biome viewport (Phase 10.2). Reads useActiveBiomeLayout
                       hook; renders 212px animated scene (aquarium or zoo gradient) above the
                       WidgetSandbox showcase. Header strip: sage-green [ COZY BIOME // STREAM ACTIVE ]
                       chip with dotPulse dot. Fish use fishSwimBiome keyframe (translateX + scaleX
                       flip, --swim-dist CSS var per creature). Animals use animalWanderBiome.
                       Decor uses decorBobBiome. All will-change:transform. contain:layout style paint
                       on scene isolates repaints. Skeleton card prevents layout shift on SSR.
                       Empty state: [ ECOSYSTEM CALM // ACQUIRE COSMETIC ASSETS IN ARCADE TO POPULATE BIOME ].
  BiomeWidget.module.css  swimDist-based fish bounds; sceneAqua/sceneZoo dark gradients; substrate
                       strip 30px; dotPulse + skeletonShimmer keyframes.
  UniversityScheduleReplicator.tsx  Academic schedule panel embedded in CalendarView "Course Schedule"
                       tab (Phase 10.3). Form: course name text input; M/T/W/Th/F pill toggles
                       (aria-pressed, role=group); <input type="time"> for start/end; university
                       <select> (5 options). Live semester preview strip updates on university change.
                       Running state: [ CALIBRATING CAMPUS TIMELINES... ] with pulsing dot + aria-busy.
                       Success state: university-color check icon, event count, delete instructions,
                       "View Calendar →" / "Schedule Another". onDone() switches CalendarView back
                       to personal tab.
  UniversityScheduleReplicator.module.css  panelIn slide entrance; day picker pills (.dayBtnOn
                       periwinkle glow); timeInput color-scheme:dark; semesterBound chips with
                       per-university color via inline style; submitBtnRunning cursor:wait.
  ui/
    ZenHeading.tsx      Display heading primitive (sizes: sm / md / lg)
    ZenHeading.module.css
    ZenCard.tsx         Info card with top-edge accent glow (accent: purple | green)
    ZenCard.module.css

config/
  universities/
    index.ts            UniLink/UniCategory (+ `tab: UniTab` field) / UniversityConfig (+ `gpaScale:
                        GpaScale`) / UniversityEntry types; UniTab = 'academics'|'career'|'campus'|
                        'essentials'; GpaScale = '4.3'|'4.0'; UNIVERSITY_REGISTRY (24 schools, 3 with
                        hasData:true) + getUniversityConfig(id) async lazy-loader
    cornell.ts          Cornell University — 4 tabs, 27 links, gpaScale:'4.3' (loaded on-demand)
                        Tabs: Academics (8), Career (5), Campus (5), Essentials (6: Health/IT/Transit/
                        Housing/Financial Aid + CU Directory)
    texas-am.ts         Texas A&M University — 4 tabs, 22 links, gpaScale:'4.0' (loaded on-demand)
                        Tabs: Academics (7), Career (5), Campus (5), Essentials (5: Health/IT/Finance/
                        Housing/Emergency Preparedness)
    ut-austin.ts        UT Austin — 4 tabs, 22 links, gpaScale:'4.0' (loaded on-demand)
                        Tabs: Academics (7), Career (5), Campus (5), Essentials (5: Health/IT/Finance/
                        Housing/Parking)
  majors/
    index.ts            MajorLink/MajorCategory/MajorConfig/MajorEntry types + MAJOR_REGISTRY
                        (13 majors, 3 with hasData:true) + getMajorConfig(id) async lazy-loader
    engineering.ts      Engineering — 6 categories, 25+ links: Computation & Mathematics (WolframAlpha),
                        Reference Databases (Engineering Toolbox, eFunda), Technical Typesetting
                        (Overleaf, GitHub, Stack Overflow), Hardware & Electronics (DigiKey, Falstad,
                        Arduino), CAD & Simulation Tools (Tinkercad, FreeCAD, Fusion 360, MATLAB,
                        Simulink, Ansys, Onshape), Academic Research (IEEE Xplore, ASME, NIST)
    business.ts         Business Administration — 6 categories, 18+ links: Finance/Accounting (SEC,
                        Investopedia, Macrotrends, AccountingCoach), Strategy (HBR, MIT Sloan, BCG),
                        Analytics (Tableau, Google Analytics, Statista), Entrepreneurship (YC,
                        Crunchbase, First Round Review, Wellfound), Markets & Research (Bloomberg,
                        Yahoo Finance, McKinsey, Deloitte)
    architecture.ts     Architecture — 4 categories, 12 links: CAD/BIM (AutoCAD, Revit, Rhino, SketchUp),
                        Rendering (Lumion, V-Ray, Adobe CC), Research (ArchDaily, Dezeen, JSTOR),
                        Structures (Engineering Toolbox, ASHRAE)
  aquascapingVendors.ts  VendorConfig schema + VENDOR_REGISTRY (6 vendors: Aquarium Co-Op, Flip
                         Aquatics, The Wet Spot, AquaSwap, Buceplant, Glass Aqua) + VENDOR_MAP
                         (O(1) lookup) + SHIPPING_TYPE_LABEL. Each vendor has shippingType
                         ('flat_rate'|'live_animal_express'|'tier_based'), baseShippingCost,
                         freeShippingThreshold (number|null).

lib/
  themeDefinitions.ts  ThemeDefinition interface + THEME_DEFINITIONS record (10 entries: 6 themes +
                       4 packs) mapping cosmetic IDs → { label, swatch hex, vars: CSS override map }.
                       ALL_THEMEABLE_VARS readonly array drives ThemeApplicator clean-up pass.
                       Override targets: --accent-purple, --accent-purple-dim, --border-subtle,
                       --bg-hover, --bg-active, --bg-main, --surface-card, --text-primary,
                       --text-muted, --text-dark, --shadow-card. zenith_default has empty vars (no
                       overrides = globals.css baseline).
  shopCatalog.ts       ShopCatalogItem interface + SHOP_CATALOG_STATIC readonly array — single
                       source of truth for 10 cosmetic items (id, name, tagline, category, cost,
                       icon, tag). Imported by GamesTabShell ShopPanel and SettingsView.
  gamesNavState.ts     Ephemeral module-level tab request state for GamesTabShell deep-linking.
                       requestGamesTab(tab: string): void — called by CosmeticPointsIndicator before
                       navigate(). consumeRequestedTab(): string | null — read + clear on
                       GamesTabShell mount; returns null when no request pending (→ 'arcade' default).
  AuthContext.tsx      AuthProvider + useAuth() — localStorage session management
  NavContext.tsx       NavProvider + useNav() — active view + category routing state
  NavBadgeContext.tsx  NavBadgeProvider + useNavBadge() — per-view badge counts (setBadge in useCallback — stable ref)
  StudyModeContext.tsx StudyModeProvider + useStudyMode() — isStudyModeActive boolean,
                       sessionCount, enterStudyWorkspace(), exitStudyWorkspace(),
                       incrementSession(); global Escape key handler; body scroll lock
  SyncContext.tsx      SyncProvider + useSyncStatus() — bridges ZenithSyncEngine into React tree;
                       also calls initSyncBroker() on mount (Phase 6.4)
  ToastContext.tsx     ToastProvider + useToast() — ephemeral notification queue
  CopilotContext.tsx   CopilotProvider + useCopilot() — isOpen / open / close / toggle for the
                       AI Co-Pilot slide-over panel (Phase 7.1). Lightweight — no IDB access.
  nav-config.ts        Navigation taxonomy — CategoryId, ViewId, NAV_CONFIG, tint/hover/accent maps.
                       Scholastic: uni-hub (first), study-shield (second). Life: habits, calendar,
                       workouts, meal-planning, wellness. Creator's Choice: aquascaping, trail-hunter,
                       botanist, games (Arcade Hub — 4th Creator item). Vault: custom-links.
  db.ts                Dexie.js v4 engine — ZenithDatabase class, 24 tables (v17), SSR-safe singleton
  gamesDb.ts           Standalone Dexie.js v4 database for the Games Tab (db: 'ZenithGamesOS').
                       Schema v1: resource_inventory (6 rows keyed by ResourceId — raw_data_shards,
                       organic_spores, cosmic_dust, quantum_fuel, stardust_glass, cosmetic_points),
                       user_profile_config (singleton: activeTheme, purchasedThemes,
                       cosmeticPointsBalance). Schema v2: crucibleJobs (id, recipeId, status,
                       targetTime indexed). Schema v3: biosphere_states (environmentId PK, 3 rows —
                       'terminal'|'aquarium'|'zoo'). Schema v4: skill_tree (nodeId PK string, isUnlocked
                       boolean indexed — absence of a row = locked; only unlocked nodes stored).
                       Exports: ResourceId union, ResourceNode, UserProfileConfig, CrucibleRecipeId,
                       CrucibleJob interfaces; BiosphereType ('terminal'|'aquarium'|'zoo'),
                       EnvironmentalAsset (id, name, category, purchasedTimestamp, currentEvolutionStage),
                       BiosphereStateRecord (environmentId, currentStage 1–5, isActiveHomeDisplay,
                       isActiveStudyDisplay, unlockedAssets[], lastInteractionTimestamp,
                       metadata: Record<string,unknown>); SkillTreeRecord (nodeId, isUnlocked, dateUnlocked);
                       RESOURCE_META (display + capacity + category per resource), RESOURCE_IDS (canonical
                       render order); seedGamesDatabase() (idempotent — bulkPut 6 resources + put profile);
                       addToInventory() / consumeFromInventory() (atomic rw, cap-clamped,
                       totalEarnedLifetime tracking); canAdd() / canConsume() (read-only pre-flight);
                       purchaseTheme() (cross-table atomic deduction + purchasedThemes append);
                       setActiveTheme(). SSR-safe singleton pattern mirrors lib/db.ts; getGamesDb()
                       throws on server.
  engines/
    RefineScoreEvaluator.ts  Pure scoring engine for MinesweeperCore (Step 3.3). No React, no Dexie.
                       Exports RefineSessionOutcome (gameId:'gal_mines', totalMines, correctFlags,
                       incorrectFlags, elapsedSeconds, terminationStatus) and RefineScoreSummary
                       (rawSpent, refinedYield, efficiencyPermille 0–1000, isStorageCapped,
                       discardedOverflow). GridCellSnapshot internal interface (structural typing —
                       MinesweeperCell satisfies it without import). computeRefineOutcome(cells,
                       totalMines, elapsedSeconds, status): victory→correctFlags=totalMines (all
                       mines validated by winning); detonation→player-placed correct flags only.
                       computeRefineSummary(outcome): rawSpent=correctFlags×10, penalty=incorrectFlags×2,
                       refinedYield=max(0,rawSpent−penalty), efficiencyPermille=floor(yield×1000/rawSpent)
                       — all integer arithmetic, no float accumulation. isStorageCapped/discardedOverflow
                       default false/0 (pre-collection placeholders; populated by caller after addResources).
                       fmtEfficiency(permille)→"95.0%" (integer div/mod); fmtElapsed(secs)→"MM:SS".
    BiosphereStateManager.ts  Pure engine (Step 5.1 + 5.3) — no React imports. BiosphereType re-export +
                       BiosphereMutationResult discriminated union (ok:true→{environmentId,updatedRecord}
                       / ok:false→{reason}). STAGE_ADVANCE_THRESHOLDS[4] (readonly): index N = requirements
                       to advance from stage N+1 → N+2; each threshold has minTotalAssets + minMaxEvolution.
                       MAX_STAGE=5. seedBiosphereStates(): count-guard, bulkPut 3 skeleton rows on first run.
                       unlockAssetNode(environmentId, asset): dedup guard via Array.some(a=>a.id===asset.id)
                       inside rw transaction (TOCTOU-safe). advanceEnvironmentStage(environmentId): resolves
                       threshold via resolveNextThreshold(), evaluates totalAssets + computeMaxEvolution(),
                       increments currentStage atomically. updateBiosphereMetadata(environmentId, patch):
                       shallow-merge {...record.metadata,...patch}. setPinnedDisplay(environmentId, field,
                       value): explicit if/else update objects (avoids Dexie UpdateSpec computed-key
                       incompatibility). setExclusivePinnedDisplay(environmentId, field, value): §11b —
                       atomic exclusive-pin enforcer; scans all 3 environment rows inside a single rw
                       transaction and clears the field on all non-target rows before writing the target;
                       only triggers the sweep when value=true (un-pinning skips it). ALL_BIOSPHERE_ENVS
                       readonly tuple drives the sweep loop. touchInteractionTimestamp(environmentId):
                       single-field write, no transaction. evaluateStageThreshold(record): pure synchronous
                       boolean used by hook. getBiosphereState() / getAllBiosphereStates(): read-only lookups.
    SkillTreeFirewall.ts  Pure validation and transaction engine (Step 6.2) — no React imports.
                       Exports NodeCostElement, NodeDefinition, SkillFirewallResult, FirewallExecutionResult
                       interfaces. NEXUS_NODE_ID = 'nexus_core_01'. SKILL_TREE_REGISTRY: 13 nodes —
                       nexus_core_01 (root, tier 1, costs 5k shards+5k spores+5k dust); Branch A aesthetic
                       (a1_preview 1.5k shards → a2_particles 5k q_fuel → a3_typography 8k q_fuel+7k glass);
                       Branch B efficiency (b1_refinery 1.5k spores → b2_shield 5k q_fuel → b3_harvest
                       10k q_fuel+5k glass); Branch C cultivation (c1_aquarium 1.5k dust → c2_zoo 5k glass
                       → c3_projection 5k q_fuel+10k glass); Branch D synergy (d1_synthesis 1.5k shards →
                       d2_resonance 5k glass → d3_convergence 7.5k q_fuel+7.5k glass). SKILL_TREE_MAP:
                       ReadonlyMap for O(1) node lookup. resolveNodeDefinition(nodeId). runPrerequisiteScan(def):
                       async — Promise.all over all prerequisites, checks isUnlocked===true in skill_tree.
                       runPreFlightInventoryCheck(costs): async — sequential early-exit loop over cost
                       dimensions. executeAtomicUnlock(nodeId): full 3-phase pipeline — idempotency guard →
                       phase 1 prereq scan → phase 2 balance check → db.transaction('rw', [skill_tree,
                       resource_inventory]) with TOCTOU re-validation of both prereqs and balances inside
                       the write lock → per-cost update deductions → skill_tree.put → FirewallExecutionResult.
    CosmicCrucibleEngine.ts  Pure engine (no React imports). CRUCIBLE_RECIPES registry: shards_to_cp
                       (500 raw_data_shards → 10 CP, 3600s), spores_to_cp (500 organic_spores → 10 CP,
                       3600s), dust_to_cp (500 cosmic_dust → 10 CP, 3600s), fuel_to_cp (50 quantum_fuel
                       → 25 CP, 14400s), glass_to_cp (50 stardust_glass → 25 CP, 14400s).
                       startTransmutation(recipeId): pre-flight duplicate + balance check, then atomic
                       rw transaction (TOCTOU-safe re-read, deduct input, add CrucibleJob record).
                       runCatchUpPhase(): boot-time Time-Delta Interceptor — queries all 'processing'
                       jobs with targetTime ≤ now, batch-credits CP (single resource_inventory update),
                       bulk-deletes expired jobs; in-transaction re-verify guards concurrent tabs.
                       claimCompletedJob(jobId): atomic CP credit + job delete for status:'completed'
                       jobs (live completions requiring player interaction). _markJobCompleted(jobId):
                       processing → completed transition, called by hook interval when timer expires.
                       computeRemainingSeconds(job) / computeProgressPercent(job): pure utilities.
  supabase.ts          SSR-safe Supabase client singleton — returns null when unconfigured
  weather.ts           Open-Meteo fetch — WeatherData now includes tempC, condition, highC, lowC,
                       and forecast: DayForecast[] (7 days with date/condition/highC/lowC).
                       Fetches daily weather_code + temperature_2m_max/min + timezone=auto.
                       conditionToLabel(code) exported for widget reuse.
  hooks/
    useActiveBiomeLayout.ts     Phase 10.2 — reads zenith_cozy_biome_v1 localStorage on mount
                                (SSR-safe mounted guard). Returns { activeBiome, creatures, decor,
                                isEmpty, mounted }. creatures = fish + animals filtered to active env;
                                decor = decor items filtered to active env. window.addEventListener
                                ('storage') cross-tab sync: updates instantly when user purchases
                                from WorkoutsView in another tab without any polling.
    useLiveAssignmentBadges.ts  useLiveQuery — active assignment count → NavBadge sync
    useCalendarData.ts          useLiveQuery feeds + events; addFeed / deleteFeed / refreshFeed
                                pipeline: fetch via /api/cal-proxy → parseIcal → bulkAdd to IDB
    useHabits.ts                Advanced habit hook — useLiveQuery on habits + habitCompletions;
                                builds HabitWithCompletion[] (todayCount, todayDone, weekData[7]);
                                dailyPct; increment() (updates HabitCompletion + updates streak +
                                allTimeHighStreak on first full completion); createHabit() (accepts
                                color?, category); deleteHabit(); updateHabit() for edit modal saves.
                                No restore-streak logic. NewHabitInput includes color?: string field.
    useHiddenNavItems.ts        localStorage hook (key: zenith_hidden_nav_items_v1) — Set<string>
                                of hidden viewIds; hideItem(id) / showItem(id) / showAll(). Used by
                                AppShell to filter nav links and show the "Show Hidden" footer button.
    usePomodoroStateMachine.ts  FSM hook — 5 states (IDLE/WORK/SHORT_BREAK/LONG_BREAK/PAUSED),
                                epoch-based precision timing, IDB session logging on completion,
                                distraction counter + toast
    useSandboxConfig.ts         localStorage widget visibility config (v4 key: zenith_sandbox_config_v4).
                                Keys: habitSummary, pomodoroPreview, calendarToday, localWeather,
                                studyStreak, uniHub, cardioSummary, cozyBiome.
                                WIDGET_SIZE: 'normal' | 'wide' (localWeather + cozyBiome = wide
                                → column-span:all in masonry). WIDGET_VIEWS map: each key → ViewId.
                                Defaults: cardioSummary=true, cozyBiome=true (visible by default).
    useSubscriptionAnalytics.ts  Phase 8.4 — recurring expense state engine. useLiveQuery on
                                subscription_items.toArray(); grossMonthlyOutflow via useMemo summing
                                calculateTrueMonthlyCost(cost, cycle) (ANNUAL ÷ 12, MONTHLY pass-thru);
                                bundleGroups: BundleGroup[] sorted heaviest-first; budgetThreshold
                                read/write via zenith_sub_budget_v1 localStorage (default $50);
                                criticalBurn boolean (outflow ≥ threshold); burnPercent 0–999+;
                                addItem/removeItem/updateItem IDB mutations (stable useCallback([])).
    useGameFinder.ts             Phase 8.5 — client-side filter state engine. Set<T> toggle state for
                                Cost/Platform/Genre dimensions; filteredGames via useMemo O(n) pipeline
                                (search query → cost exact → platform intersection → genre intersection);
                                activeFilterCount derived; clearAll() resets all 4 dimensions.
                                No IDB — all data from DEFAULT_PEER_GAMES static array.
    useFriendsNetwork.ts         Phase 9.1 — WebRTC friend ledger hook. Dynamically imports PeerJS
                                (SSR-safe); privacyRef + myPeerIdRef stay in sync via useEffect;
                                handleConnection() stable useCallback([]) — reads refs for fresh state;
                                compileLocalSnapshot() reads pomodoroSessions/habits/quickNotes/
                                cardioSessions/gamesDb.user_profile_config('active_user') across 4
                                IDB tables; evaluateTemporalSnapshot() zeroes weekly/monthly fields
                                when snapshot age exceeds 7/30 days; peer_friends + peer_leaderboard_
                                snapshots via useLiveQuery + useMemo filter (peerIdString !== 'self');
                                SELF_ID='self' reserved PK; zenith_friend_privacy_v1 localStorage;
                                cancelledRef prevents setState after unmount; 15s connect timeout.

hooks/   (root — Games Tab hooks; distinct from lib/hooks/)
  useZenithEconomy.ts          Single-source economy interface for all arcade games. useLiveQuery on
                               resource_inventory.toArray() → O(1) Record<string, ResourceNode> dict
                               via useMemo. addResources(id, amount) → { added, capped, overflowDiscarded }:
                               atomic rw transaction over both tables, hard cap enforcement, credits
                               totalEarnedLifetime by actual credited amount, syncs cosmeticPointsBalance
                               on user_profile_config for cosmetic_points changes. deductResources(id,
                               amount) → boolean: clean refusal when balance < amount (never negative).
                               isAtCapacity(id) → synchronous boolean from live dict (useCallback
                               [resources] dep). ZERO_ADD_RESULT stable fallback during boot frame.
  useZenithStorageUpgrades.ts  Storage upgrade engine hook. Internal UpgradeTier extends UpgradeMatrixNode
                               with fromCapacity for O(2) resolveNextUpgrade() lookup. UPGRADE_MATRIX:
                               5 resources × 2 tiers. L1→L2 per spec; L2→L3 = Math.round(base × 3.5).
                               Raw (raw_data_shards, organic_spores, cosmic_dust): 200 → 1,000 → 5,000.
                               Refined (quantum_fuel, stardust_glass): 50 → 250 → 1,250.
                               getUpgradeMatrix(id) → Promise<UpgradeMatrixNode|null>: fresh DB read.
                               purchaseStorageUpgrade(id): pre-flight + atomic rw transaction (TOCTOU
                               re-validate inside tx, deduct all costs, write newCapacity, return delta[]).
                               isUpgradable(id): synchronous, reads live dict, checks all cost elements.
  useBiosphereState.ts         React controller for BiosphereStateManager (Step 5.1). useLiveQuery
                               on biosphere_states.toArray() → BiosphereStateMap | null. isLoading:
                               true during boot frame (rawRecords===undefined). seederFired useState
                               flag prevents re-trigger loop after seed write causes rawRecords update.
                               states built via explicit let terminal/aquarium/zoo variables (avoids
                               readonly-mapped-type Partial<> TypeScript issue). All 6 mutation callbacks
                               wrapped in useCallback(fn,[]) for stable references. checkStageThreshold(env):
                               synchronous from live states dict, useCallback([states]) dep. SSR guard
                               (if(!gamesDb) return BOOT_FRAME_RESULT) at top of each callback.
                               BiosphereStateMap: {readonly [K in BiosphereType]: BiosphereStateRecord}.
  useCosmicCrucible.ts         React interface for CosmicCrucibleEngine. useLiveQuery on
                               crucibleJobs.toArray() → activeJobs: CrucibleJob[]. jobsRef syncs
                               live jobs each render (avoids stale closure in interval). Single stable
                               setInterval (empty deps): reads jobsRef, calls _markJobCompleted() for
                               expired processing jobs (live completion path), increments tick state
                               only when processing jobs exist (zero re-render cost when idle).
                               getRemainingTime(jobId): useCallback [activeJobs, tick] dep — returns
                               fresh computeRemainingSeconds() each second. runCatchUpPhase() runs
                               once on mount via useEffect (auto-credits offline-completed jobs).
  useBiospherePinning.ts       React pin-management hook (Step 5.3). Composes useBiosphereState()
                               internally — no second useLiveQuery subscription. Derives activeHomeEnv
                               and activeStudyEnv via useMemo scanning isActiveHomeDisplay /
                               isActiveStudyDisplay on the live states map. pinForHome(env) /
                               pinForStudy(env): useCallback([]) wrappers over setExclusivePinnedDisplay
                               — atomically clears all others before setting the target. unpinHome() /
                               unpinStudy(): read activeHomeEnv/activeStudyEnv from closure, call
                               setExclusivePinnedDisplay with value=false. BiospherePinState interface:
                               activeHomeEnv, activeStudyEnv, isLoading, pinForHome, pinForStudy,
                               unpinHome, unpinStudy.
  useSkillTreeActions.ts       React controller for SkillTreeFirewall (Step 6.2). SkillTreeActionsResult
                               extends SkillFirewallResult with unlockedNodeIds, unlockHistory, isLoading.
                               Two useLiveQuery subscriptions: skill_tree.toArray() → rawSkillTreeRecords;
                               resource_inventory.toArray() → rawInventoryRecords. isLoading = either
                               undefined. unlockedSet: Set<string> from filtered isUnlocked records.
                               resourceMap: Map<ResourceId, ResourceNode> for O(1) balance reads.
                               getNodeLockReason(nodeId): synchronous — ALREADY_UNLOCKED → unknown →
                               PREREQUISITE_LOCKED → INSUFFICIENT_FUNDS → READY; useCallback([unlockedSet,
                               resourceMap]). isNodeUnlockable(nodeId): async using same cached live data,
                               returns false for already-unlocked. executeNodeUnlock(nodeId): thin
                               useCallback([]) wrapper over engine's executeAtomicUnlock (no business
                               logic in hook). unlockHistory: SkillTreeRecord[] sorted by dateUnlocked asc.

types/
  syncQueue.ts         OutboxMutation interface (id, tableName, action, payload, timestamp,
                       updatedAt) + OutboxTable / OutboxAction unions + OUTBOX_CLOUD_TABLE
                       routing map (assignments→supabase_urgent_tasks, habits→supabase_habits,
                       userProfile→supabase_user_profiles, workouts→supabase_workouts)
  gameFinder.ts        PeerGame entity type (id/title/description/costCategory/platforms/genres/
                       minPlayers/maxPlayers/externalLink?); CostCategory='FREE'|'UNDER_15'|'PREMIUM';
                       Platform='WEB_BROWSER'|'STEAM'|'EPIC_GAMES'|'CONSOLE'; Genre='COZY'|'TACTICAL'|
                       'TRIVIA'|'BRACKET_BASED'|'PARTY'; COST_LABELS/PLATFORM_LABELS/GENRE_LABELS
                       display maps; ALL_COST_CATEGORIES/ALL_PLATFORMS/ALL_GENRES ordered arrays for
                       sidebar render; DEFAULT_PEER_GAMES: 12-entry readonly dataset covering
                       Jackbox/Among Us/Gartic Phone/Codenames/Overcooked!/Terraria/Fall Guys/
                       Skribbl.io/Pummel Party/It Takes Two/Golf With Your Friends/Rocket League.
  friendsNetwork.ts    PeerFriend IDB row (id UUID PK, peerIdString, friendDisplayName, avatarAssetId,
                       connectedAt); PeerLeaderboardSnapshot IDB row (peerIdString PK, weeklyStudy
                       Minutes/monthlyStudyMinutes/allTimeStudyMinutes/activeHabitStreak/totalBooks
                       Completed/totalCardioMiles/totalCosmeticPoints/snapshotTimestamp);
                       TimeHorizon='WEEKLY'|'MONTHLY'|'ALL_TIME'; ScoringMetric union (5 values);
                       PrivacySettings (5 share flags); SyncPayload WebRTC protocol discriminator
                       ('ZENITH_FRIEND_SYNC'); evaluateTemporalSnapshot() — zeros weekly/monthly
                       fields when snapshot age exceeds 7/30 days respectively; extractScore() /
                       fmtScore() / isSnapshotStale() pure utilities; STALE_MS=48h constant.
  aquascaping.ts       AquaSpecies, TankInhabitant, TankConfig, CompatibilityConflict,
                       BioloadResult, CompatibilityReport — consumed by AquascapingValidator +
                       aquascapingMath. SpeciesType: 'fish'|'shrimp'|'snail'|'plant'.
                       AggressionLevel: 'peaceful'|'semi-aggressive'|'aggressive'.

utils/
  universityCalendars.ts  Phase 10.3 university calendar dictionary. UniversityId union (5 values:
                       CORNELL/ARKANSAS/TEXAS_TECH/UNC_CHAPEL_HILL/RICE). BreakRange { label, from,
                       to } (ISO dates, lexicographically comparable). UniversityCalendar { label,
                       semesterStart, semesterEnd, color, breaks[] }. UNIVERSITY_CALENDARS record +
                       UNIVERSITY_ID_LIST ordered array. All dates are Fall 2026 actuals. Colors
                       are institutional brand hex values.
  scheduleGenerator.ts Phase 10.3 generation engine. CourseInput { courseName, selectedDays{mon..fri},
                       startTime "HH:MM", endTime "HH:MM", universityId }. GenerateResult { count,
                       feedId, feedColor }. toLocalDateStr(d): uses local-time components (not
                       .toISOString()) — prevents UTC day-shift for UTC+ users. buildSlotMs(dateStr,
                       "HH:MM"): new Date(y,m-1,d,h,min) local constructor → correct wall-clock
                       time in CalendarView. isInBreak(dateStr, breaks): ISO lexicographic range
                       check (safe for zero-padded YYYY-MM-DD). generateUniversitySchedule(input):
                       single db.transaction('rw', [calendarFeeds, calendarEvents]) — creates feed
                       then bulkAdd all events atomically; rollback leaves no orphan feed row.
  aiContextBridge.ts   Async context compiler (Phase 7.1) — compileUserContextPayload() reads
                       assignments + habits + mentalHealthLogs from IDB over a 14-day window;
                       truncates free-text notes at 110 chars; formats a structured plain-text
                       block (≈600–900 tokens) for injection as an Anthropic system prompt extension.
                       Returns { compiledAt, systemPrompt, stats: ContextStats }.
                       SSR-safe: uses dynamic import('@/lib/db') inside the async function body.
  calendarParser.ts    Pure-TS iCal parser (zero dependencies):
  gpaMath.ts           Multi-scale GPA engine — GRADE_POINTS_4_3 (Cornell, A+=4.3) + GRADE_POINTS_4_0
                       (standard, no A+). ScaleType = '4.3'|'4.0'. calcGpa(courses, scale?) accepts
                       scale param (default '4.3'). getGradePoints(scale), getGpaMax(scale),
                       getGradeList(scale), gradeFromIndexScale(idx, scale), indexFromGradeScale(grade,
                       scale). Original gradeFromIndex/indexFromGrade kept for backward compat (Cornell).
                       gpaTier(), fmtGpa(), gradeTier(), tierLabel(); zero React/Dexie imports
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
  mealData.ts          Meal planning data layer — EquipmentTier (4 tiers: no_kitchen/microwave/
                       mini_fridge/hot_plate), EQUIPMENT_NODES[], DIETARY_TAGS (7: vegetarian/
                       vegan/gluten-free/dairy-free/nut-free/high-protein/low-cal), INGREDIENT_PRICES
                       (~52 items with price + servingCalories), INGREDIENT_PRICE_MAP (O(1) lookup),
                       COLLEGE_MEALS (17 dorm meals with calories + dietaryTags),
                       filterIngredients(ingredients, disliked) → filtered list,
                       filterCollegeMeals(meals, disliked, dietary) → filtered list,
                       getWeekStart/getWeekDays/formatWeekLabel utilities,
                       DAILY_CALORIE_TARGET = 2000, MEAL_TYPES, PLAN_TYPE_LABELS, DAY_LABELS_SHORT.

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
  WidgetSandbox.tsx    Configurable widget grid (6 widgets) + AnimatedWidget wrapper (wide prop →
                       column-span:all) + ManagePanel (position:fixed). Layout is CSS columns
                       masonry (2 col desktop) — items auto-pack upward with no JS needed.
  WidgetSandbox.module.css  `.masonryGrid` (columns:2, column-gap) + `.widgetWide` (column-span:all);
                             sandboxEnter/Exit keyframes; panelBackdrop z:349, managePanel z:350
  widgets/
    Widget.module.css         Shared base card + .card/.clickable/.navArrow/.cardHeader pattern;
                              all navigable widgets use .card + .clickable, navigate on click via useNav()
    HabitSummaryWidget.tsx    SVG ring (r=38) + habit list via useHabits(); navigates → 'habits'
    CalendarTodayWidget.tsx   Today's calendar events from db.calendarEvents; navigates → 'calendar'
    PomodoroWidget.tsx        Working 25/5 focus-break timer with phase auto-switch
    WeatherWidget.tsx         Full redesign — large current temp + condition icon, H/L today, location
                              in header top-right, 7-day ForecastStrip (icon + high + low per day).
                              Uses dedicated WeatherWidget.module.css (not Widget.module.css).
    WeatherWidget.module.css  .widget, .currentRow, .tempMain, .forecastStrip, .forecastDay, hi/lo labels
    StudyStreakWidget.tsx      Study streak stats — sessions today + weekly minutes from db.pomodoroSessions.
                              Navigates → 'study-shield'.
    UniHubWidget.tsx          University + major display from db.userProfile. Navigates → 'uni-hub'.
    CardioWidget.tsx          Weekly cardio summary — mins this week, session count, Vitality Point
                              balance (from zenith_vitality_v1 localStorage); last session preview
                              with activity emoji + duration + VP earned. Navigates → 'workouts'.
    CardioWidget.module.css
    CozyBiomeWidget.tsx       Live animated mini-biome scene (wide widget, column-span:all). Reads
                              zenith_cozy_biome_v1 + zenith_vitality_v1 localStorage. Shows fish /
                              animal / decor with fishSwimWidget / animalWanderWidget / decorBobWidget
                              CSS keyframe animations using --ci / --di CSS vars for stagger. Footer
                              shows item count + VP balance. Empty state when nothing purchased.
                              Navigates → 'workouts'. Biome scene uses same aqua/zoo gradient
                              backgrounds as WorkoutsView.
    CozyBiomeWidget.module.css  Inline mini-scene (min-height 140px), creatureLayer / decorLayer /
                              surface, animated keyframes, footer with vpBadge amber chip.

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

83. **WebRTC sync is ephemeral + temporal-evaluated** — `useFriendsNetwork` uses PeerJS for one-shot data exchange on connection open; the connection may close after the exchange. Snapshots are stored persistently in IDB (`peer_leaderboard_snapshots`) but are evaluated at receive time via `evaluateTemporalSnapshot()` which zeros `weeklyStudyMinutes` if the snapshot is > 7 days old and `monthlyStudyMinutes` if > 30 days old. `SELF_ID = 'self'` is the reserved PK for the user's own snapshot row — never use a real PeerJS ID as the self key. The gamesDb profile is always keyed `'active_user'` (not `1`); use `gdb.user_profile_config.get('active_user')` to read cosmetic points.

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
| 6 | 6.2 | Automated E2E Test Suite Construction — Playwright 1.60 (`@playwright/test`), `playwright.config.ts` (workers:1, isolated context per test, `NEXT_PUBLIC_E2E=1` via webServer.env, chromium project, HTML+JUnit reporters), `components/TestBridge.tsx` (zero-UI client component mounts `window.__zenith = { db, seedUserProfile }` via useEffect + dispatches `zenith:bridge-ready` CustomEvent, only rendered when `NEXT_PUBLIC_E2E=1`), `types/testBridge.d.ts` (global Window augmentation), `tests/helpers/bridge.ts` (typed Playwright helpers: `injectAuth/waitForBridge/seedProfile/addAssignment/countTable/readSyncQueue/navigateTo`), `tests/zenithCore.spec.ts` (2 suites, 4 tests): Suite 1 — auth gate bypass + workspace boot (sidebar ARIA); Suite 2 — S2-T1 IDB write via Dexie + `useLiveQuery` DOM assertion + `data-priority` attr; S2-T2 pendingSyncQueue schema (tableName/operation/supabaseId UUID regex/timestamp/retryCount/payload JSON fields); S2-T3 Supabase route mock + online event stability | ✅ |
| 6 | 6.1 | Production Optimization & Strict Build Hardening — `components/ErrorBoundary.tsx` (React class component, `getDerivedStateFromError` + `componentDidCatch`, two-stage recovery ladder: soft reinit → IDB flush+navigate, Slate-Indigo card with `pulseGlow` dot, dev-only stack trace panel, z-index:950 overlay), `components/ErrorBoundary.module.css` (design-token-only styles), `next.config.ts` (SWC `compiler.removeConsole` strips log/debug in prod; 8-directive CSP baseline covering Google Fonts/Open-Meteo/Supabase/PeerJS/OSM; X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, HSTS; deterministic moduleIds; async splitChunks for leaflet/peerjs/anthropic/dexie vendor bundles), `lib/logger.ts` (typed log/debug/warn/error — dev-only guards + runtime fallback), `lib/hooks/useWindowEvent.ts` (stable-ref `handlerRef` pattern guaranteeing add/remove symmetry in React 18 StrictMode), ErrorBoundary mounted in `app/layout.tsx` wrapping `AppContent` | ✅ |
| 6 | 6.5 | Comprehensive Architecture Validation & System Handshake — `utils/systemDiagnostics.ts` (4-check sequential engine: storage layer probe counts 7 Dexie tables, Supabase endpoint HEAD ping, native RTCPeerConnection instantiation, userProfile scalar validation; `CheckResult`/`DiagnosticReport` types; `ProgressHandler` callback drives real-time UI; `skipped` status for misconfigured-but-non-fatal checks), `components/SystemHandshake.tsx` (full-screen terminal overlay z:500; 4-phase state machine: booting 900ms → scanning → success → fatal; per-check `CheckRow` sub-component animates line-by-line; 1.5s success dwell then `fadeOut` → `onUnlock()`; fatal path shows retry + force-override buttons; stable-ref `onUnlock` pattern), `components/SystemHandshake.module.css` (CRT scanline texture via `repeating-linear-gradient`; mono font; `cursorBlink` keyframe; PASSED=#52cca3, FAILED=#ff5c5c, OFFLINE=text-dark; z:500 overlay; `500ms ease-smooth` exit transition), `components/AppContent.tsx` updated (3-state `HandshakeState` machine: checking→needed→done; `sessionStorage` key `zenith_handshake_v1` persists per-session completion; `useCallback`-stabilised `handleUnlock`; workspace opacity gated on `hsState==='done'`; AppShell remains mounted during handshake so BadgeSyncEffect seeds profile in background) | ✅ |
| 7 | 7.1 | AI-Powered Academic Co-Pilot & Vector Context Bridge — `utils/aiContextBridge.ts` (async `compileUserContextPayload()`: 14-day IDB pull from assignments + habits + mentalHealthLogs, 110-char note truncation, structured plain-text system prompt block ~600–900 tokens), `app/api/chat/route.ts` (secure streaming endpoint: LLM_API_KEY server-only, 20-msg sliding window, 4k char per-turn cap, Anthropic SDK `messages.stream()` → `ReadableStream` UTF-8 chunks, `X-Accel-Buffering: no` header), `lib/CopilotContext.tsx` (CopilotProvider + `useCopilot()` — isOpen/open/close/toggle), `components/AiCopilotSidebar.tsx` (position:fixed z:300, slide-over 380px → 100vw mobile; compiles context once on first open; streams into message thread via `ReadableStream.getReader()`; inline MarkdownBlock renderer handles ` ``` `, `##`, `**`, `\`code\``, lists, blockquotes, HR — zero external libs; `nodeUnlockBurst` → green cursor while streaming; Ctrl/Cmd+Enter submit; Escape closes), `app/layout.tsx` + `Topbar.tsx` wired (◎ AI toggle in topbar cluster, `AiCopilotSidebar` rendered at root level outside AppShell) | ✅ |
| 7 | 7.3 | Interactive Hardscape Simulator & Drag-and-Drop Layout Canvas — `types/hardscape.ts` (HardscapeElement with xPercent/yPercent centre coords, rotationAngle, scaleFactor; AquascapeLayout IDB schema; PALETTE_ENTRIES 6 items; ELEMENT_BASE_DIMS % canvas per type; ELEMENT_SHAPES SVG path data for STONE/DRIFTWOOD/SUBSTRATE_LINE), `hooks/useHardscapeInteraction.ts` (document-level drag via dragRef + rotateRef; pxToPercent coordinate translation; boundary clamping per ELEMENT_BASE_DIMS; atan2 rotation delta from ring drag; stable useCallback factories for element + ring mousedown; loadLayout for IDB restore), `lib/db.ts` v14 (`aquascapeLayouts: '++id, name, savedAt'`; AquascapeLayout import), `components/HardscapeSimulator.tsx` (left shelf with 6 SVG mini-previews; blueprint canvas with dotted radial grid; placing-mode crosshair; RotationHud SVG ring at element centre — 46px radius, dashed track, wide transparent hit stroke, periwinkle handle at rotationAngle, inline °readout; ElementShape component reused in shelf + canvas; CSS transform rotate+scale on element divs; bottom controls bar: rotation badge + --fill-pct scale range + Remove; IDB auto-save debounced 600ms id=1 + auto-load on mount), `components/HardscapeSimulator.module.css` (blueprint dark `#080d0b` + radial-gradient dot grid; `.hudRing` pointer-events:none container; scale range with gradient fill via --fill-pct; drop-shadow filter on selected element) | ✅ |
| 7 | 7.2 | Branching Skill Trees & Focus Perks — `types/skillTree.ts` (SkillNode spec type + SkillNodeRuntime + SkillBranch + NodeState + SkillModifiers + SkillTreeConnection; 18-node SKILL_TREE_DATA across 3 branches / 4 tiers; 18 SKILL_TREE_CONNECTIONS; SKILL_TREE_MAP O(1) lookup; `computeNodeStates()` + `resolveNodeState()` + `computeModifiers()` + DEFAULT_MODIFIERS; CANVAS_W=960, CANVAS_H=560, NODE_RADIUS=36), `hooks/useSkillTree.ts` (useLiveQuery on userProfile; retroactive token init max(0,level−1) on first visit; `purchaseSkillNode()` 3-gate validation + atomic IDB update; standalone `awardSkillToken()` export), `lib/SkillModifierContext.tsx` (SkillModifierProvider + `useSkillModifiers()` — reactive live modifier broadcast to entire tree), `components/SkillTreeCanvas.tsx` (960×560 SVG + abs-positioned canvas; 18 cubic-bezier wire paths in 3 states active/partial/locked; 72px circular nodes in 4 state classes; branch CSS vars via local `.branchScholastic/.branchErgonomic/.branchHabit` classes; in-canvas popup; `nodeUnlockBurst` keyframe sweep), `components/views/SkillTreeView.tsx` (token bar + active modifier chip row + canvas card + purchase toast feedback); `lib/db.ts` UserProfile extended with `unlockedSkillNodeIds?: string[]` + `availableSkillTokens?: number` (no schema version bump); `lib/nav-config.ts` + `ViewRouter.tsx` wired; `app/layout.tsx` SkillModifierProvider added | ✅ |
| R | —   | **Major Scholastic Restructure** — Full RPG system stripped (CharacterSheet, QuestMatrix, SkillTree, FatigueLayer, RecoveryCockpit, FatigueContext, SkillModifierContext, rpgEngine, useQuestBoard, useRewardLedger, useRpgStats, useFatigueMonitor, rpgEngineService, equipHandler all deleted; UserProfile reduced to name/university/major); Nav simplified to 8 views (3 Scholastic, 5 Life); StudyShield → 3-tab (AI Study / Focus Protocol / Focus Rooms); UniHub → 3-sub-tab when loaded (Resources / GPA Calculator / Cognitive Load); Texas A&M + UT Austin university data added; Business + Architecture major data added; **Habits view** built (IDB v15 habitCompletions table, daily multi-step circle progress, 7-day weekly grid, streak+grace-period system, create modal, confetti burst); Dashboard overhauled (Done button fix: ManagePanel now position:fixed; UrgentTasks → HabitsWidget; CalendarTodayWidget added; all widgets navigate on click; unlimited grid; config key v2); HomeView cleaned (greeting + widgets only) | ✅ |
| R3 | —  | **Phase 8 Feature Expansion** — **Nav restructure** (burn-rate removed from Life; meal-planning placeholder added to Life; burn-rate + deliveries moved into UniHub "Finances" tab with university-specific currency: Cornell=Big Red Bucks, A&M=Dining Dollars, UT Austin=Dine In Dollars; `UniversityConfig.currencyName` field added; `BrbBurnRate` accepts `currencyName` prop); **GPA/Cognitive Load layout fix** (`tabPadded` wrapper adds `padding: var(--sp-5) var(--sp-8)` inside tab panes that lacked internal padding); **Habits overhaul v3** (removed "Completions per day"; replaced with numeric Step Amount + Unit label + numeric Daily Goal; `Habit` interface gains `stepAmount?`, `color?`, `allTimeHighStreak?` as typed fields (no DB migration); `increment()` adds `stepAmount` per tap capped at goal; form requires goal > 0 before save; Habit Trend Chart moved to right-side always-visible panel via `bodyRow` two-column CSS layout — no more collapse toggle); **University & Major resources expanded** (Cornell +8 links, Texas A&M +7, UT Austin +7; Engineering major +13 new links across 2 new categories: CAD & Simulation Tools (Tinkercad, FreeCAD, Fusion 360, MATLAB, Simulink, Ansys, Onshape) + Academic Research (IEEE Xplore, ASME, NIST); Business major +6 links (Markets & Research category); Architecture major +6 links (Portfolio & Presentation category)); **Botanist Guide overhaul** (foraging log removed; plant care tracker replaces everything; 30-plant PLANT_CATALOG with scientific names; add-from-catalog or custom entry; care badges: light requirement, indoor/outdoor position, humidity; watering progress bar; health picker (1–5 emoji); edit/delete per plant; IDB `houseplants` table reused; `types/botany.ts` extended with LightRequirement/LightPosition/HumidityLevel/PlantCatalogEntry); **Trail Hunter expanded** (8 → 70 trails across all US regions: Northeast, Mid-Atlantic, Southeast, Midwest, Great Plains, Rocky Mountains, Utah, Arizona/NM, Pacific Northwest, California, Southwest, Hawaii, Alaska; max distance slider 25 → 50 mi; search placeholder updated to "State, region, or trail name"); **Personal Calendar** (IDB v16 `personalEvents` table; `PersonalEvent` interface: title/startMs/endMs/allDay/color/category/description/createdAt; CalendarView gains `calTab` state (personal|feeds); tab bar: Personal chip + iCal Feeds chip; `+ New Event` button when Personal active; `NewEventModal`: title, date, start/end time, all-day toggle, category select, 8-color picker + custom wheel, description; personal events rendered in WeekGrid via synthetic feed (PERSONAL_FEED_ID=-1) with per-event color via `_color` field; `EmptyPersonal` vs `EmptyCalendar` based on active tab; Apple Calendar compatible via existing iCal feed import) | ✅ |
| R2 | —  | **UX Polish & Feature Expansion** — **SystemHandshake fix** (split scanning/unlock effects so cancelled flag can't block unlock timer); **`inert` attribute fix** (AiCopilotSidebar: `''` → boolean); **Study Shield title** fixed (`"Study\nShield."` → `"Study Shield."`); **AI Study overhaul** (AiIngestionDock: Paste Notes / Describe Topic mode toggle; Study Notes / Flashcards / Practice Test generate options; not-configured amber inline banner; `app/api/study-ai/route.ts` supports `mode` + `generate` params; `PracticeTestPanel` MCQ component with A–D choices, reveal-all, score, retry; `types/studyAi.ts` extended with PracticeQuestion + GenerateOptions); **Habits v2** (edit mode via ✎ button — delete/edit only visible in edit mode; categories with collapsible sections + category picker in modal; habit colour picker — 10 presets + native color wheel, --habit-color CSS var drives border-left + ring stroke; allTimeHighStreak tracked + displayed; restore-streak removed; updateHabit() hook method); **Weather widget redesign** (7-day ForecastStrip, current temp large display, H/L, location, dedicated WeatherWidget.module.css); **Dashboard masonry** (CSS columns layout, 6 widgets: + StudyStreakWidget + UniHubWidget; wide weather widget column-spans all; v3 config key); **Sidebar hide/show** (right-click nav items → context menu → Hide; useHiddenNavItems localStorage hook; "Show Hidden" footer button + hiddenMgrPanel); **University Hub overhaul** (major-hub nav item removed; UniHubView: 2-step onboarding — pick uni then pick major/skip; identity strip; 4 top-level tabs: University Resources / Major Resources / GPA Calculator / Cognitive Load; University Resources has 4 resource sub-tabs via UniversityHub component; GPA scale per university — Cornell 4.3, A&M + UT 4.0; GpaSimulator accepts gpaScale prop; Cornell 27 links, Texas A&M 22 links, UT Austin 22 links across 4 tabs each; gpaMath.ts extended with GRADE_POINTS_4_0 / ScaleType / scale-aware helpers) | ✅ |
| R5 | —  | **Calendar Month View + Category Theming + UI Cleanup** — **Month calendar**: `CalendarView` gains `ViewMode = 'week' \| 'month' \| 'agenda'`; `MonthGrid` component (42-cell 6×7 grid, Monday-start, `getMonthGridDays()`, colored event pills up to 3/day, "+N more" overflow, today circle badge, 28% opacity out-of-month days); `monthStart` state + `goToPrevMonth/goToNextMonth/goToCurrentMonth`; shared nav bar adapts label and handlers per view mode; keyboard ← / → navigates months when in month view; clicking a day drills to week view. **Category theming system**: `AppShell.tsx` reads `activeCategory` and stamps `data-category` on `.viewport`; `AppShell.module.css` defines `--cat-accent / --cat-accent-dim / --cat-border / --cat-surface / --cat-card` per category (essentials=purple, creator=green, vault=slate); `ZenHeading.module.css` eyebrow uses `var(--cat-accent, var(--accent-purple))`; `ZenCard.module.css` top-glow + hover border use `--cat-accent` — all views get correct accent colour with zero per-view changes. **Phase label cleanup**: `CourseMatrixView` eyebrow `"Scholastic · Phase 3.4"` → `"Scholastic · Cognitive Load"`; `FocusRoomView` eyebrow `"Scholastic · Phase 5.5"` → `"Scholastic · Focus Rooms"`; `StudyLayoutContainer` side-dock `DropZone` phase badges `"Phase 3.2/3.3/3.4"` → `"Coming Soon"` (removed `phase` field from `DropZoneProps`). **Creator's Choice fix**: `BotanistView.module.css` `.editBtn` and `.healthBtn:hover` converted from purple to green (`rgba(82,204,163,…)` + `var(--accent-green)`). | ✅ |
| R6 | —  | **Focus Mode, Wellness, Meal Planning & Aquascaping Polish** — **StudyLayoutContainer dock fully implemented**: Notes tab (Markdown scratchpad, Edit/Preview, localStorage persist, ◎ Web Speech API dictation appends transcript, ⏺ MediaRecorder voice memos with playback); Cards tab (live useLiveQuery → last ai-study session flashcards, ◇ icon); Audio tab (5 Web Audio API presets: Brown Noise, White Noise, Ocean Waves [LFO-modulated brown noise], Rainfall [parallel HP+BP filters], 40Hz Focus Tone; Music Player section with 3 YouTube preset streams + custom URL input that runs `toEmbedUrl()` — converts YouTube/Spotify/SoundCloud browse URLs to embed format, loads in youtube-nocookie.com iframe). **CSP updated**: `frame-src` allows `youtube-nocookie.com`, `open.spotify.com`, `w.soundcloud.com`. **Mental Wellness mood grid redesign**: 2-column grid (was 4-col), 28px emojis, `--mood-hue` CSS custom property drives hue-tinted `box-shadow` glow on every button; hover + selected states use same hue. **Aquascaping Engine**: HardscapeSimulator removed from third tab (now "Water Log", shows only WaterParameterLogger). **Meal Planning additions**: `⟳ Generate Week Plan` button fills empty slots from filtered college meals + saved recipes; `AddRecipeModal` gains URL import (POST `/api/recipe-import` server-side fetches page, extracts OG title/description) + macro fields (protein/carbs/fat/calories/servings); `SavedMealRecipe` extended with those macro fields; recipe cards display colored macro chips. **`app/api/recipe-import/route.ts`** (new): server-side URL fetcher, extracts `<title>` + OG tags, returns `{title, description, domain, url}`. | ✅ |
| Games | 1.1 | **Games Tab · Dexie Schema** — `lib/gamesDb.ts`: ZenithGamesDatabase ('ZenithGamesOS'), ResourceId union (6 values), ResourceNode + UserProfileConfig + CrucibleJob interfaces; RESOURCE_META + RESOURCE_IDS constants; v1 schema (resource_inventory + user_profile_config) + v2 schema (crucibleJobs: id, recipeId, status, targetTime indexed); seedGamesDatabase() idempotent bootstrap; addToInventory() / consumeFromInventory() (atomic rw, cap-clamped, totalEarnedLifetime); canAdd() / canConsume() pre-flight; purchaseTheme() cross-table atomic; setActiveTheme() | ✅ |
| Games | 1.2 | **Games Tab · Global Economy Hook** — `hooks/useZenithEconomy.ts`: useLiveQuery → O(1) `Record<string, ResourceNode>` dict via useMemo; `addResources(id, amount)` → `{ added, capped, overflowDiscarded }` — rw transaction, hard cap enforcement, syncs cosmeticPointsBalance mirror; `deductResources(id, amount)` → boolean; `isAtCapacity(id)` synchronous from live dict (useCallback [resources]); ZERO_ADD_RESULT stable boot-frame fallback | ✅ |
| Games | 1.3 | **Games Tab · Storage Upgrade Engine** — `hooks/useZenithStorageUpgrades.ts`: internal UpgradeTier extends UpgradeMatrixNode with fromCapacity; UPGRADE_MATRIX 5 resources × 2 tiers; L1→L2 per spec; L2→L3 = base × 3.5 (raw: 200→1,000→5,000; refined: 50→250→1,250); `scaleToTier3()` derives L2→L3 cost vectors from named L1 constants; `getUpgradeMatrix(id)` fresh DB read; `purchaseStorageUpgrade(id)` two-phase commit (pre-flight + TOCTOU-safe rw tx with delta[]); `isUpgradable(id)` synchronous | ✅ |
| Games | 1.4 | **Games Tab · Cosmic Crucible** — `lib/engines/CosmicCrucibleEngine.ts` (pure, no React): CRUCIBLE_RECIPES (5 recipes: raw 500→10 CP/1h, refined 50→25 CP/4h); `startTransmutation()` two-phase commit; `runCatchUpPhase()` boot-time Time-Delta Interceptor (batch-credit + bulk-delete expired jobs, in-tx re-verify); `claimCompletedJob()` player-initiated claim; `_markJobCompleted()` live interval helper; `computeRemainingSeconds()` / `computeProgressPercent()` pure utils. `hooks/useCosmicCrucible.ts`: stable setInterval + jobsRef (no stale closure) + tick state (countdown re-renders, zero cost when idle) + mount catch-up | ✅ |
| Games | 2.1 | **Games Tab · Split-Screen Shell** — `components/games/GamesTabShell.tsx`: 40/60 asymmetric split, `height: calc(100vh-52px); overflow: hidden`; BiospherePane (Terminal/Aquarium/Zoo selector, biosphereContent slot, ResourceTicker from useZenithEconomy with --fill-pct bars); ArcadePane (6-tab: Arcade ⬡ / Crucible ◈ / Storage ↑ / Codex ◫ / Skills ⟡ / Shop ✦, crucible badge from useCosmicCrucible, full built-in panels); GamesTabShellSlots typed props replace built-in panels when passed; key={rightTab} drives tabFadeIn; initial tab via consumeRequestedTab(); mobile column collapse; cubic-bezier(0.25,1,0.5,1) 500ms. `'games'` added to ViewId + Creator's Choice nav; ViewRouter wired | ✅ |
| Games | 2.2 | **Games Tab · Profile Header Balance Extension** — `components/navigation/CosmeticPointsIndicator.tsx`: clickable pill badge; onClick calls `requestGamesTab('shop')` from `lib/gamesNavState` then `navigate('games','creator')` → deep-links to Shop tab on fresh mount; label "✦"; reactive via `useZenithEconomy().cosmeticPoints`; `seedGamesDatabase()` on mount (global seeder — idempotent); boot-frame skeleton state (skeletonPulse); hidden ≤767px | ✅ |
| Games | UI  | **Games Tab · Functional Arcade Panels** — Replaced all three stub placeholder components with real implementations: **CruciblePanel**: 5 recipe cards with Queue buttons (calls `startTransmutation`), live balance/cost indicator, 3.5s inline error messages, active-job countdown + Claim section; **UpgradesPanel**: per-resource upgrade cards, `getUpgradeMatrix()` loaded in `useEffect([resources])`, capacity level display (Lv1/2/3/MAX), affordability tint, Upgrade button; loose `!= null` guard prevents crash on undefined pre-load state; **CodexPanel**: ✦ summary strip (balance, lifetime earned, total harvested) + 6-row inventory ledger (balance + totalEarnedLifetime). UPGRADEABLE_IDS const shared with test suite. All panels wired into `resolveRightContent()` as defaults when no slot prop is provided. | ✅ |
| Games | 2.3 | **Games Tab · Universal Game Wrapper Layout Core** — `components/games/UniversalGameWrapper.tsx`: HOC session container; capacity pre-flight gate; performance.now() clock with 1s ticker; onGameComplete interceptor (payoutFormula → addResources → { added, capped, overflowDiscarded }); phase machine idle→playing→result; sessionKey child remount; isMountedRef async guard; isCollecting latch; exports GameSessionResult + UniversalGameWrapperProps; ViewRouter uses `payoutFormula={score => score}` (identity) for refine games | ✅ |
| Games | 3.1 | **Games Tab · Minesweeper Board Matrix Core** — `components/games/refine/MinesweeperCore.tsx`: 10×10 grid, MinesweeperCell (x,y,isMine,isRevealed,isFlagged,isRefineLocked,neighborMines); partial Fisher-Yates mine placement with 9-cell safe zone; BFS flood-reveal; checkWin O(n); phase machine waiting→active→won\|lost; all pure math helpers in §4 outside rendering lifecycle | ✅ |
| Games | 3.2 | **Games Tab · Flag Node State Interceptor** — `onContextMenu` hijack (e.preventDefault()); hard flag-capacity gate inside functional setGrid updater (race-safe); isRefineLocked=c.isMine on placement, cleared on removal; efficiencyPenalty derived from grid (never stale); cellFlagEligible compound CSS class (.cellHidden.cellFlagEligible) → purple border hover via 2-class specificity; @keyframes flagPlant cubic-bezier(0.34,1.56,0.64,1) 200ms spring snap; statValueCapReached purple tint at flag cap | ✅ |
| Games | 3.3 | **Games Tab · Row-Clear Asset Upgrades / Score Evaluator** — `lib/engines/RefineScoreEvaluator.ts` (pure engine): computeRefineOutcome (victory→correctFlags=totalMines; detonation→player-placed only), computeRefineSummary (rawSpent=correctFlags×10, penalty=incorrectFlags×2, refinedYield=max(0,raw−pen), efficiencyPermille 0–1000 — all integer math), fmtEfficiency/fmtElapsed utilities. Collect-gate pattern in MinesweeperCore: game ends→setRefineResult()→refineOverlay→"Collect"→handleCollectYield()→onGameComplete(refinedYield). Overlay shows: Mines Refined, Efficiency, Anchor Penalty, Refined Assets, Est. Overflow (from live useZenithEconomy read), Duration. @keyframes overlaySlideIn 500ms expo + cardRise | ✅ |
| Games | 4.3 | **Games Tab · 2048 Core** — `components/games/harvest/Core2048.tsx`: 4×4 flat matrix, slideLine() primitive (pack→merge→re-pack) reused for all 4 directions via reversal; executeMove() + spawnTile() (90/10 probability) + isGameOver(); processMoveRef pattern; Arrow keys + touch swipe (30px); win overlay + game-over overlay with payout breakdown; addResources('raw_data_shards', Math.floor(score/10)); best score localStorage zenith_2048_best_v1. Colour ramp: green (2–64) → purple (128–512) → intense green glow (1024+). `Core2048` wired in `GamesArcade` via display:none mounting in ViewRouter | ✅ |
| Games | 4.4 | **Games Tab · Bio-Synthesizer & Zen Snake** — `components/games/harvest/BioSynthesizer.tsx`: 360×400 canvas, delta-time physics (FALL_SPEED=88px/s), processFrameRef RAF pattern, 60s epoch-based session timer, match/mismatch flash with 340ms FLASH_MS, addResources('organic_spores', Math.floor(score/2)); canvas click support (left/right half → slide bin); best score zenith_biosynth_best_v1. `components/games/harvest/ZenSnake.tsx`: 15×15 grid CELL=24px, TICK_MS=120ms timestamp-accumulator RAF, direction queue DIR_Q_MAX=2, reversal guard, Set-based spawnPellet(), touch swipe (30px), addResources('organic_spores', score*5); best score zenith_zensnake_best_v1. Both wired in ViewRouter GamesArcade ('biosynth' + 'zensnake' chips). useRef<T>(initialDummyFn) pattern for frameRef/tickRef (React 19 requires 1 arg to useRef) | ✅ |
| Games | 5.1 | **Games Tab · Ecosystem Viewport State Matrix** — `lib/gamesDb.ts` v3: biosphere_states table (environmentId PK); BiosphereType, EnvironmentalAsset, BiosphereStateRecord types added to §2b. `lib/engines/BiosphereStateManager.ts` (pure, no React): STAGE_ADVANCE_THRESHOLDS[4] (minTotalAssets + minMaxEvolution per tier); seedBiosphereStates() count-guard; unlockAssetNode() TOCTOU-safe dedup inside rw tx; advanceEnvironmentStage() evaluates breadth+depth simultaneously; updateBiosphereMetadata() shallow-merge; setPinnedDisplay() explicit if/else (avoids Dexie UpdateSpec computed-key incompatibility); touchInteractionTimestamp(); evaluateStageThreshold() pure sync boolean. `hooks/useBiosphereState.ts`: seederFired useState prevents re-seed loop; explicit let bindings for BiosphereStateMap (avoids readonly Partial<> TypeScript issue); all 6 mutations in useCallback([]) for stable refs; checkStageThreshold sync from live states; SSR guard on all callbacks | ✅ |
| Games | 5.3 | **Games Tab · Cross-Pillar Component Pinning** — `lib/engines/BiosphereStateManager.ts` §11b: `setExclusivePinnedDisplay(env, field, value)` — atomic exclusive-pin operation; single rw transaction scans all 3 environment rows and clears the target field on non-target rows before writing the target; ALL_BIOSPHERE_ENVS readonly tuple drives the sweep; un-pin skips sweep. `hooks/useBiospherePinning.ts`: BiospherePinState interface; composes useBiosphereState() (no second subscription); derives activeHomeEnv + activeStudyEnv via useMemo; pinForHome / pinForStudy (useCallback([]) wrappers); unpinHome / unpinStudy read active env from closure. `components/dashboard/BiosphereWidgetHost.tsx`: LayoutContextType 'games_tab'|'study_shield'|'dashboard_home'; CONTEXT_CONFIGS map (dimensions, interactivity, opacityAlpha, blurStrength); resolveActiveRecord() per context — study_shield reads isActiveStudyDisplay, dashboard_home reads isActiveHomeDisplay, games_tab prefers home pin → terminal fallback; study_shield applies opacity:0.4 + inert={true} on rendererLayer + backdrop-filter:blur(12px) frosted-glass overlay; dashboard_home adds "Stage: 0N" monospaced stageBadge; loading skeleton + unpinnedState empty prompt when no env pinned. `components/dashboard/BiosphereWidgetHost.module.css`: 3 context layout classes, rendererLayer, studyShieldOverlay, stageBadge, skeletonPulse, unpinnedState. | ✅ |
| Games | 5.2 | **Games Tab · Automated Visual Evolution Script** — `components/games/base/BiosphereRenderer.tsx`: deterministic slot grid — all 9 slots always in DOM, `.assetSlotActive` CSS transition triggers appearance (zero layout shift). processFrameRef/tickRef pattern for RAF loops in canvas sub-elements. 9 memo-wrapped leaf components: SubstrateRocksElement, KelpForestElement, NeonFaunaElement (aquarium); AmbientPulseLinesElement (SVG 9×9 grid + geometric accents), MainframeNodeElement (doubled CODE_LINES seamless codeScrollLoop), UptimeRegistryElement (live setInterval uptime, only runs when asset unlocked); EnclosurePerimeterElement, BotanicalCanopyElement, FaunaSpritesElement (zoo). resolveActiveSlots(moduleId, activeSet) public export returns RenderingSlot[]. StageIndicator (5 pips, T1–T5 label). data-stage CSS compound rules tune animation speed at tiers 3/4/5 without JS. transform-origin overrides for bottom-anchored (kelp, substrate) and top-right-anchored (canopy, uptime) slots | ✅ |
| Games | 6.1 | **Games Tab · Interactive SVG Canvas Skill Tree Renderer** — `components/games/skills/SkillTreeCanvas.tsx`: pure inline JSX SVG (viewBox="0 0 800 600", overflow="visible"), zero external libraries. TREE_NODES: 13 nodes matching SkillTreeFirewall IDs — nexus_core_01 (400,90) root + 4 branches: A aesthetic (140,240)→(110,390)→(80,540), B efficiency (300,240)→(300,390)→(300,540), C cultivation (500,240)→(500,390)→(500,540), D synergy (660,240)→(690,390)→(720,540). TREE_CONNECTORS: 12 cubic bezier paths. Branch type extended with 'synergy'. NODE_GLYPHS includes d1_synthesis ⊕, d2_resonance ⊗, d3_convergence ✦. BRANCH_HEADERS: 4 headers at y=175. NODE_GLYPHS: Unicode geometric symbols per node. NodeState: 'locked'|'available'|'unlocked' from unlockedNodeIds prop. ConnectorState: 'inactive'|'partial'|'active' from parent node state. computeNodeState() + computeConnectorState() pure functions. computePopupPosition() clamps popup card within viewBox. wrapText(desc, 27) word-wrap (max 2 lines). Selection dashed ring (rotateDash keyframe) + burst ring (nodeUnlockBurst scale+fade, useRef previous-unlock diff + 700ms timeout). In-canvas popup: rect + title + desc + popupBranchTag[data-branch] per-branch fill. Background decorative grid via SVG `<pattern>`. BRANCH_HEADERS at y=178. Keyboard accessible (tabIndex, onKeyDown, role=button, aria-pressed). SkillTreeNode + SkillTreeCanvasProps exported. `components/games/skills/SkillTreeCanvas.module.css`: .canvasWrap (aspect-ratio 4/3), 3 connector data-state variants, .nodeGroup (transform-box:fill-box + transform-origin:center + hover scale 1.15 + drop-shadow), .nodeCircle/.nodeGlyph/.nodeLabel [data-state] trios, .selectionRing, .burstRing, .popupGroup/.popupBg/.popupTitle/.popupDesc/.popupBranchTag[data-branch]/.popupDivider/.popupClose. Keyframes: nodeCirclePulse (stroke-width breath 2.5→3.5), rotateDash, nodeUnlockBurst, popupReveal. | ✅ |
| Games | 6.2 | **Games Tab · Nexus Gateway Access Firewall** — `lib/gamesDb.ts` v4: `skill_tree` table (nodeId PK string, isUnlocked bool indexed — absence=locked). `SkillTreeRecord` interface (nodeId, isUnlocked, dateUnlocked). `lib/engines/SkillTreeFirewall.ts` (pure engine, no React): NodeCostElement + NodeDefinition + SkillFirewallResult + FirewallExecutionResult interfaces. NEXUS_NODE_ID='nexus_core_01'. SKILL_TREE_REGISTRY: 13 nodes across 4 branches — nexus root (5k shards+5k spores+5k dust); Branch A aesthetic (1.5k shards→5k q_fuel→8k q_fuel+7k glass); Branch B efficiency (1.5k spores→5k q_fuel→10k q_fuel+5k glass); Branch C cultivation (1.5k dust→5k glass→5k q_fuel+10k glass); Branch D synergy (1.5k shards→5k glass→7.5k q_fuel+7.5k glass). Tier 3 costs sum to exactly 15,000 per node. SKILL_TREE_MAP: ReadonlyMap for O(1) lookup. runPrerequisiteScan(def): async Promise.all over prerequisites, checks isUnlocked===true. runPreFlightInventoryCheck(costs): async sequential early-exit per cost dimension. executeAtomicUnlock(nodeId): full 3-phase pipeline — idempotency guard → phase 1 prereq scan → phase 2 balance check → db.transaction('rw',[skill_tree,resource_inventory]) with TOCTOU re-validation of both prereqs and balances inside write lock → per-cost update deductions → skill_tree.put → FirewallExecutionResult. Central Nexus Firewall is structural: all tier-1 nodes carry prerequisites:[NEXUS_NODE_ID], enforcing the lock via the prerequisite graph. `hooks/useSkillTreeActions.ts`: SkillTreeActionsResult extends SkillFirewallResult + unlockedNodeIds + unlockHistory + isLoading. Two useLiveQuery subscriptions (skill_tree + resource_inventory). unlockedSet Set<string> + resourceMap Map<ResourceId,ResourceNode> from live data. getNodeLockReason(id): synchronous — ALREADY_UNLOCKED→PREREQUISITE_LOCKED→INSUFFICIENT_FUNDS→READY; useCallback([unlockedSet,resourceMap]). isNodeUnlockable(id): async using cached live data. executeNodeUnlock(id): useCallback([]) thin wrapper over executeAtomicUnlock. unlockHistory sorted by dateUnlocked asc. | ✅ |
| Games | 8.1 | **Games Tab · Comprehensive Mock-Data E2E Test Suite** — `__tests__/games/EconomyIntegration.test.ts`: 33 assertions across 4 suites using Jest + fake-indexeddb + @testing-library/react. `jest.config.ts`: `import nextJest from 'next/jest.js'` (ESM-safe; Next.js 15 ships next/jest as ESM-only — `require()` fails). `jest.setup.ts`: `structuredClone` polyfill via Node `v8.serialize/deserialize` before `fake-indexeddb/auto` (jsdom does not forward Node's built-in into its window scope; fake-indexeddb v6 requires it). Suite 1 — 8 tests: 6-row seed count, balance=0, totalEarnedLifetime=0, raw cap=200, refined cap=50, CP cap=null, profile singleton, idempotency. Suite 2 — 6 tests: DB clamped at 200, addToInventory result shape, hook addResources → `{added:200,capped:true,overflowDiscarded:50}`, two-step partial fills, full-cap zero-add. Suite 3 — 8 tests: pre-condition balances, base cap=200, upgrade returns success+newCapacity=1000, DB write, 150 spores deducted, 50 dust deducted, delta array contents, insufficient-balance rejection. Suite 4 — 9 tests: empty tree post-seed, PREREQUISITE_LOCKED with no nexus, no DB write on gate failure, INSUFFICIENT_FUNDS with nexus but no balance, clean success, isUnlocked=true row written, cost deduction, ALREADY_UNLOCKED on retry. `QAValidationRunner` + `MockProfileConfigType` exported interfaces; `SuiteRunner` instrumentation class; `resetDb()` + `applyMockProfile()` test helpers. | ✅ |
| Games | UI2 | **Games Tab · Skills + Shop Tabs** — GamesTabShell expanded from 4 to 6 tabs. **SkillsPanel**: inline component using `useSkillTreeActions` + `SkillTreeCanvas`; click a node to see description + resource costs (cost chips green when met); Unlock button calls `executeNodeUnlock`; lock reason displayed when prerequisites/funds missing. **ShopPanel**: inline component using `useLiveQuery(gamesDb.user_profile_config)` + `useZenithEconomy`; `SHOP_CATALOG_STATIC` (from `lib/shopCatalog.ts`) drives 10 item cards (6 themes + 4 packs); category filter (All/Themes/Packs); owned items show Equip button (calls `setActiveTheme`), unowned show ✦ cost (calls `purchaseTheme`), insufficient balance dimmed; active theme shows "✓ Equipped". `lib/gamesNavState.ts` module-level singleton enables `requestGamesTab(tab)` → `consumeRequestedTab()` deep-link pattern. | ✅ |
| R7 | —  | **Cosmetic Themes, Voice AI Input, Settings & Stats** — **Theme system**: `lib/themeDefinitions.ts` (ThemeDefinition interface + THEME_DEFINITIONS: 10 entries mapping cosmetic IDs → CSS var override maps; ALL_THEMEABLE_VARS for clean slate on switch); `components/ThemeApplicator.tsx` (zero-render client component in layout.tsx — useLiveQuery on gamesDb.user_profile_config, calls document.documentElement.style.setProperty/removeProperty to apply active theme globally; 9 themeable vars including --accent-purple, --bg-main, --surface-card, --text-*). Theme coverage: zenith_default (no overrides), zenith_crimson (rose), zenith_amber (amber), zenith_void (near-black monochrome + muted text), zenith_neon (cyan on dark navy), zenith_cosmos (deep purple + dark bg), pack_study (scholar blue), pack_midnight (terminal green on black), pack_flora (botanical sage), pack_elite (prestige gold). **Shared catalog**: `lib/shopCatalog.ts` — ShopCatalogItem + SHOP_CATALOG_STATIC readonly array; imported by both GamesTabShell ShopPanel and SettingsView. **Voice input in AI Co-Pilot**: `AiCopilotSidebar.tsx` gains ◎ mic button (Web Speech API, interimResults=true, continuous=false); interim transcript rendered as ghost text above textarea (.interimSpeech); final transcript appended to input with smart spacing; pulsing red .micBtnActive ring while listening; graceful toast when API unavailable. **Settings view** (`components/views/SettingsView.tsx` + module.css): navigate('settings', null) from sidebar footer Settings button; 5 sections — (1) Appearance & Themes: SHOP_CATALOG_STATIC grid with color swatches, purchaseTheme/setActiveTheme, live ✦ balance; (2) Dashboard Widgets: toggle rows via useSandboxConfig; (3) Account: display name → db.userProfile.update(1,{userName}); (4) Privacy & Data: JSON export (habits+events+notes+assignments via blob URL download); (5) Keyboard Shortcuts table + About grid (version, stack). **Stats & Events view** (`components/views/StatsView.tsx` + module.css): new 'stats' ViewId added to Life subcategory nav; 8-chip overview row (habits/completion/streak/focus/sessions/GPA/credits/harvested); 2×2 grid (habits progress bars with live color, study session 4-stat grid, upcoming events 7-day list, arcade economy per-resource); **World Events** section — `app/api/world-news/route.ts` RSS proxy (BBC World + NPR World + The Guardian; pure-regex XML parser; parallel fetch with Promise.allSettled; NewsArticle[] sorted newest-first; revalidate:600); client-side source filter tabs + Refresh; news cards link to articles (open new tab). Center / center-left editorial perspective (BBC/NPR/Guardian). | ✅ |
| R8 | —  | **Dashboard Expansion, Cardio Game, Personal Brand Hub, Nav Restructure & Tutorial** — **Nav restructure**: `world-events` + `personal-brand` added to Life subcategory; `stats` moved to Personalized Vault as "Stats & Analytics"; Workouts now fully implemented (was placeholder). **Collapsible sidebar categories**: `useCollapsedCategories` hook (localStorage key `zenith_nav_collapsed_v1`) stores Set<string> of collapsed category IDs; each category label is now a `<button>` (`categoryLabelBtn`) with `aria-expanded` + animated `collapseChevron` chevron (`▾`, 220ms transition); `categoryContent` wrapper uses `display:none` when collapsed. **WorldEventsView** (`components/views/WorldEventsView.tsx` + `.module.css`): standalone world news view extracted from StatsView; source filter tabs (All/BBC World/NPR World/The Guardian); Refresh button; news card grid linking to articles; uses `--cat-accent` for source badge colour. **StatsView** updated: world events section removed; eyebrow → "Personalized Vault · Analytics"; unused news state/imports cleaned. **PersonalBrandView** (`components/views/PersonalBrandView.tsx` + `.module.css`): 12-item career resource grid (LinkedIn, Handshake, Indeed, Glassdoor, Wellfound, Canva, Notion, GitHub, Resume.io, Levels.fyi, Y Combinator Jobs, Loom); tag filter (All/Networking/Jobs/Research/Startups/Design/Portfolio/Resume); **LinkedIn Post Generator** — writing style sample textarea (optional), topic textarea (required), 4-tone selector (Professional/Casual/Storytelling/Motivational), Generate button → streams from `/api/chat` via `ReadableStream`; cursor blink while streaming; ⎘ Copy button on completion. **WorkoutsView** (`components/views/WorkoutsView.tsx` + `.module.css`): Cardio Log tab — 9-activity picker grid (Run/Walk/Bike/Swim/Row/Hike/Yoga/Elliptical/Other); duration + optional distance (mi/km toggle) + notes form; VP preview chip shows earned VP before submission; `calcVP(minutes)` = minutes + 5 bonus for ≥30 min; logs to IDB `cardioSessions` (v18); VP + biome state in localStorage (`zenith_vitality_v1`, `zenith_cozy_biome_v1`). Cozy Biome tab — `BiomeDisplay` animated scene (CSS keyframe fish swim / animal wander / decor bob); Shop with 18 items across Aquarium (5 fish + 4 decor) and Zoo (6 animals + 3 decor) catalogs; purchase with Vitality Points; Aquarium/Zoo switcher persists to localStorage. **IDB v18**: `cardioSessions` table (`++id, activityType, durationMinutes, logDate, completedAt`). **CardioWidget** (`components/widgets/CardioWidget.tsx` + `.module.css`): shows weekly mins, sessions, VP balance; last session preview; navigates → workouts. **CozyBiomeWidget** (`components/widgets/CozyBiomeWidget.tsx` + `.module.css`): live animated mini-scene (fish swim / animal wander / decor bob CSS animations); wide widget (column-span:all); shows item count + VP balance; navigates → workouts. **useSandboxConfig v4**: adds `cardioSummary` (normal) + `cozyBiome` (wide) keys; storage key bumped to `zenith_sandbox_config_v4`. **TutorialSpotlight** (`components/TutorialSpotlight.tsx` + `.module.css`): shown on first 3 page loads (tracked in `zenith_tutorial_v1` localStorage); 6-step spotlight walkthrough (Welcome / Sidebar / Dashboard / Study Shield / Vitality Points / AI Co-Pilot); dot progress indicator with direct step jump; Next/Back/Skip tour navigation; Escape key closes; backdrop blur overlay z:700; card z:701 with `cardIn` spring animation. Mounted in `app/layout.tsx` inside `CopilotProvider`. | ✅ |
| 8 | 8.4 | **Subscriptions Packager & Financial Burn-Rate Analytics** — `types/finance.ts` extended: `BillingCycle='MONTHLY'|'ANNUAL'`, `SubscriptionItem` (id UUID PK, name, monthlyCost, renewalDateString, categoryBundle, billingCycle), `calculateTrueMonthlyCost(cost, cycle)` helper (ANNUAL÷12). **IDB v21**: `subscription_items` (id PK, categoryBundle/billingCycle/renewalDateString indexed). `lib/hooks/useSubscriptionAnalytics.ts`: useLiveQuery, grossMonthlyOutflow via useMemo, bundleGroups sorted heaviest-first, criticalBurn boolean, burnPercent 0–999+, zenith_sub_budget_v1 localStorage (default $50). `components/views/SubscriptionPackagesView.tsx` + `.module.css`: burn panel with `--fill-pct` CSS var gauge (green→crimson hardware-accelerated 700ms/400ms transition), inline budget ceiling editor, bundle cards, add form (cycle toggle + annual cost preview ≈$/mo), annual projection card (over/under indicator). | ✅ |
| 8 | 8.5 | **Interactive Peer Game Finder & Filter Matrix** — `types/gameFinder.ts`: `PeerGame` entity, `CostCategory`/`Platform`/`Genre` unions, display label maps, `DEFAULT_PEER_GAMES` 12-entry dataset (Jackbox/Among Us/Gartic Phone/Codenames/Overcooked!/Terraria/Fall Guys/Skribbl.io/Pummel Party/It Takes Two/Golf With Friends/Rocket League). `lib/hooks/useGameFinder.ts`: `Set<T>` toggle state, O(n) filter pipeline (search→cost exact→platform intersection→genre intersection), stable `useCallback([])` mutators. `components/GameFinderDashboard.tsx` + `.module.css`: sticky filter shelf (3 filter groups, `role="checkbox"` chips, active dot, filter count badge, Reset All); search bar (⊕ glyph, ✕ clear); card grid (auto-fill minmax 280px, staggered 40ms entrance); `GameCard` expand via `grid-template-rows: 0fr→1fr`; chevron rotate 180°; "Visit Game Site →" link; empty state ◈. | ✅ |
| 9 | 9.4 | **Privacy-Preserving Geolocation Distance Tracker Widget** — `types/distanceTracker.ts`: `PeerLocation` interface (`peerIdString` string PK, `latitude`/`longitude` private calc-only fields, `lastUpdatedTimestamp`); `SELF_LOCATION_ID='self'`; `LOCATION_STALE_MS=24h`; `isLocationStale()`. **Privacy constraint**: latitude/longitude MUST NOT be rendered to screen, written to Supabase, or logged — internal Haversine calculation use only; travel over WebRTC DTLS only. `utils/geoMath.ts`: `calculateHaversineDistanceMiles(lat1,lon1,lat2,lon2)` — exact Haversine formula (R=3958.8 mi, dLat/dLon → sin²/cos → atan2 → Math.round×10/10 to 1 decimal); `formatDistanceMiles(miles)` locale-aware formatter; `compassBearing(lat1,lon1,lat2,lon2)` → 8-point compass string. `types/friendsNetwork.ts` extended: `SyncPayload` gains optional `locationLat?` + `locationLon?` (backward-compatible — zero breaking change; fields travel over DTLS-encrypted WebRTC only). **IDB v25**: `peer_locations` table (`peerIdString` string PK, `lastUpdatedTimestamp` indexed — mirrors `peer_leaderboard_snapshots` PK convention; `latitude`/`longitude` non-indexed private fields). `lib/db.ts`: `storeSelfLocation(lat,lon)` + `storePeerLocation(peerId,lat,lon)` helpers (IDB-only write paths; never touch Supabase). `lib/hooks/useDistanceTracker.ts`: `useEffect` Permissions API probe → `navigator.permissions.query('geolocation')`; `performSync()` calls `getCurrentPosition` (`enableHighAccuracy:false`, `timeout:10000`, `maximumAge:0`) → `storeSelfLocation` → IDB write; 12h passive `setInterval` via `syncRef` pattern (no stale closures); `useLiveQuery` on `peer_locations.toArray()` → `useMemo` Haversine over all non-self rows → returns nearest peer; raw coordinates consumed inside `useMemo` closure only — `NearestPeerResult` exposes `distanceMiles`, `distanceLabel`, `bearing`, `isStale` but never lat/lon; `GeoPermission` union type; `LOCATION_STALE_MS` staleness check. `components/widgets/DistanceTrackerWidget.tsx`: 6 render states (unavailable/denied/syncing/no_peer/ready/error); friend display name from `db.peer_friends`; `key={nearestPeer.peerIdString}` re-triggers `distanceReveal` animation on peer change; bracketed readout `[ DISTANCE TO PARTNER: 243.5 MILES ]` in `#52cca3`; `⟳ Sync Location On-Demand` button (disabled + spinning while in-flight); bearing compass glyph (↗, ↓, etc.). `components/widgets/DistanceTrackerWidget.module.css`: dark moss `#080d09` card + radial sage glow; `@keyframes distanceReveal/spinCycle/dotBounce`; stale amber badge; three-dot syncing animation. `useSandboxConfig` gains `distanceTracker: true` (normal, friends-network). `WidgetSandbox.tsx` wired. | ✅ |
| 9 | 9.3 | **Relationship Live Note Dashboard Widget** — `types/relationshipNotes.ts`: `RelationshipNote` interface (id UUID PK, senderDisplayName, messageText, timestamp, isRead boolean, source? tag). **IDB v24**: `relationship_notes` table (`id, senderDisplayName, timestamp, isRead` — explicit string UUID PK, distinct from `peer_messages`). `lib/db.ts`: `getLatestRelationshipNote()` helper (`orderBy('timestamp').reverse().first()`); `addRelationshipNote(note)` helper (fills id + timestamp if omitted). `services/letterboxBroker.ts` updated: `drainCloudMailbox` now writes a display-ready row to `relationship_notes` (via `addRelationshipNote`) in addition to the full audit row in `peer_messages` — this is the reactive bridge that triggers the widget. `components/widgets/RelationshipNotesWidget.tsx`: `useLiveQuery` on `relationship_notes.orderBy('timestamp').reverse().first()` (zero-polling reactive stream); empty state `[ THE LETTERBOX IS CALM // SEND A NOTE TO CONNECT CHANNELS ]` with `◈` glyph; active state — message text (5-line clamp, `var(--font-display)`), warm left-border quote indicator (parchment gradient), footer with sender + relative time; `key={note.id}` on `.messageCard` remounts the element on new message arrival, replaying `@keyframes letterReveal` (opacity+translateY+scale entrance). Relative-time formatter updates every 60s via `setInterval`. `components/widgets/RelationshipNotesWidget.module.css`: mineral dark `#0d0f12` card + warm parchment accent color (`rgba(194,169,128,*)`) throughout — intentionally distinct from periwinkle/green; `@keyframes letterReveal` (420ms expo); `@keyframes newDotPulse` (unread badge breathing). `lib/hooks/useSandboxConfig.ts`: `letterbox` key added (default `true`, size `normal`, view `friends-network`); STORAGE_KEY unchanged (`zenith_sandbox_config_v4`) so existing installs get the widget on next load. `components/WidgetSandbox.tsx`: `RelationshipNotesWidget` imported + rendered via `AnimatedWidget`. | ✅ |
| 9 | 9.2 | **Encrypted Async Cloud Letterbox Relay** — `supabase/migrations/20260608000001_phase92_cloud_letterbox.sql`: `cloud_letterbox` table (id uuid PK, recipient_peer_id text indexed, sender_display_name text, encrypted_payload text, created_at timestamptz); RLS: INSERT allowed (anon/authenticated), no SELECT/DELETE policies (blocks REST enumeration); SECURITY DEFINER `claim_letterbox_messages(p_peer_id text)` RPC atomically locks matching rows (`FOR UPDATE SKIP LOCKED`), returns them to the caller, then hard-deletes them in the same transaction — zero-retention guarantee. `utils/cryptoLetterbox.ts`: hybrid RSA-OAEP 2048/SHA-256 + AES-GCM 256 scheme; `generateLetterboxKeypair()` → `LetterboxKeyPair` (both keys exported as JWK for IDB persistence); `encryptLetterboxMessage(text, recipientPublicKey)` → base64 bundle `{ wrappedKey, iv, ciphertext }`; `decryptLetterboxMessage(cipher, ownPrivateKey)` → plaintext (throws on wrong key or tampered ciphertext via GCM auth tag); `serialisePublicKey()` / `parsePublicKey()` for WebRTC sharing; `fromBase64` returns `ArrayBuffer` (not `Uint8Array<ArrayBufferLike>`) to satisfy TS 5 `BufferSource` strictness. **IDB v23**: `peer_messages` table (`++id, senderDisplayName, receivedAt, isRead`); `UserProfile` extended with non-indexed `letterboxPublicKeyJwk?` + `letterboxPrivateKeyJwk?` (no schema bump needed). `services/letterboxBroker.ts`: `ensureLetterboxKeypair()` idempotent bootstrap; `drainCloudMailbox(localPeerId)` → `DrainResult { consumed, skipped, errors }` — calls RPC, decrypts each row, writes to `db.peer_messages`, cloud deletion is atomic with retrieval; `initLetterboxBroker(localPeerId)` sets 12h `setInterval` + immediate initial drain, returns cleanup; `terminateLetterboxBroker()` for signOut flows; `sendLetterboxMessage(opts)` encrypts + inserts to `cloud_letterbox`; `markMessageRead()` / `deleteLocalMessage()` / `getUnreadCount()` local IDB helpers. `lib/hooks/useLetterbox.ts`: `useLiveQuery` on `peer_messages` (newest-first) + `isRead=0` count; `isDraining` spinner state; `drain()` stable callback for `[ Check Cloud Mailbox ]` button; `send()` / `markRead()` / `deleteMessage()` stable callbacks; `publicKeyString` (local RSA public key JSON for WebRTC broadcast); `isKeypairReady` boolean. | ✅ |
| 9 | 9.1 | **Serverless WebRTC Friend Ledger & Multi-Temporal Leaderboard** — `types/friendsNetwork.ts`: `PeerFriend` + `PeerLeaderboardSnapshot` IDB row types, `SyncPayload` discriminator protocol, `evaluateTemporalSnapshot()` (zeros weekly/monthly fields when age > 7/30 days), `extractScore()` / `fmtScore()` / `isSnapshotStale()` utilities. **IDB v22**: `peer_friends` (id UUID PK, peerIdString indexed) + `peer_leaderboard_snapshots` (peerIdString string PK). `lib/hooks/useFriendsNetwork.ts`: SSR-safe dynamic `import('peerjs')`, privacyRef/myPeerIdRef/cancelledRef pattern, `handleConnection()` stable `useCallback([])`, `compileLocalSnapshot()` reads 4 IDB tables + gamesDb.user_profile_config('active_user'), temporal evaluation on receive, 15s connect timeout, SELF_ID='self' reserved PK, zenith_friend_privacy_v1 localStorage (5 share flags, Credits off by default). `components/SocialLeaderboard.tsx` + `.module.css`: 4-state status dot (init=amber dotPulse/ready=green/error=red/unavailable=slate); 3 horizon tabs; 5 metric chips with active dot; leaderboard card (gold #1/silver #2/bronze #3/slate others rank badges, YOU + STALE chips, staggered `rowIn` animation); Privacy Settings collapsible (grid-template-rows expand, toggle switch sub-component); P2P info strip. | ✅ |
| 10 | 10.1 | **Google Search HUD Overlay** — `components/GoogleSearchHUD.tsx` + `.module.css`: centered search console on HomeView between GreetingHero and BiomeWidget; auto-focuses input via `requestAnimationFrame` on mount; `handleSearchSubmission` trims query → `https://www.google.com/search?q=${encodeURIComponent(q)}` → `window.open(url, '_blank', 'noopener,noreferrer')`; Enter=submit, Escape=clear (0ms); hardware-accelerated focus glow (`will-change: box-shadow, border-color`, `--ease-smooth` curve); clear ✕ button (visible only when text present); submit ↗ button disabled when empty; full ARIA (`role="search"`, labelled textbox + buttons); max-width 680px matching HomeView column. | ✅ |
| 10 | 10.2 | **Cozy Biome Dashboard Viewport** — `lib/hooks/useActiveBiomeLayout.ts`: reads `zenith_cozy_biome_v1` localStorage on mount (SSR-safe `mounted` guard); returns `{ activeBiome, creatures, decor, isEmpty, mounted }`; `window.addEventListener('storage')` cross-tab sync — live update when user buys from WorkoutsView in another tab. `components/BiomeWidget.tsx` + `.module.css`: 251px standalone home-screen card (212px scene + 39px header); `[ COZY BIOME // STREAM ACTIVE ]` sage-green header chip with `dotPulse` animation; aquarium/zoo gradient scene (`contain: layout style paint` — browser skips repaints outside the element); `fishSwimBiome` keyframe (translateX + scaleX flip, seamless loop 0%/100% match, `--swim-dist` CSS var set per-creature from React); `animalWanderBiome` (translateX only); `decorBobBiome` (translateY only); all `will-change: transform` GPU-promoted; `swimDist(i) = max(100, 340 - i*40)px` keeps every fish inside scene boundary regardless of viewport; empty state `[ ECOSYSTEM CALM // ACQUIRE COSMETIC ASSETS IN ARCADE TO POPULATE BIOME ]`; skeleton card at exact final height prevents layout shift; inserted into HomeView between GoogleSearchHUD and WidgetSandbox showcase. | ✅ |
| 10 | 10.3 | **Multi-University Schedule Replicator** — `utils/universityCalendars.ts`: `UniversityId` union (5 values); `BreakRange { label, from, to }` interface; `UniversityCalendar { label, semesterStart, semesterEnd, color, breaks[] }` interface; `UNIVERSITY_CALENDARS` record + `UNIVERSITY_ID_LIST` for dropdown rendering. Fall 2026 dates: Cornell (Aug 25–Dec 13, Cornell Red #b31b1b, Fall Break + Thanksgiving); Arkansas (Aug 17–Dec 11, Cardinal #9d2235, Labor Day + Thanksgiving); Texas Tech (Aug 24–Dec 12, Raider Red #cc0000, Labor Day + Thanksgiving); UNC Chapel Hill (Aug 20–Dec 8, Carolina Blue #4b9cd3, Fall Break + Thanksgiving); Rice (Aug 24–Dec 6, Rice Blue #003c71, Mid-Term Break + Thanksgiving). `utils/scheduleGenerator.ts`: `CourseInput { courseName, selectedDays{mon..fri}, startTime "HH:MM", endTime "HH:MM", universityId }`; `toLocalDateStr(d)` uses local-time components not `.toISOString()` (prevents UTC day-shift in UTC+ timezones); `buildSlotMs(dateStr, "HH:MM")` uses `new Date(y,m-1,d,h,min)` local constructor; `isInBreak(dateStr, breaks)` lexicographic ISO comparison (safe because zero-padded); `generateUniversitySchedule(input)` single atomic `db.transaction('rw', [calendarFeeds, calendarEvents])` — creates CalendarFeed row then `bulkAdd` all events; rollback on failure leaves no orphan feed. `components/UniversityScheduleReplicator.tsx` + `.module.css`: Course Name textbox; M/T/W/Th/F day-picker pills (`aria-pressed`, `role="group"`); `<input type="time">` for start/end; university `<select>` with all 5 options; semester preview strip (dates + break count + break names) that live-updates on university change; submit button → `[ CALIBRATING CAMPUS TIMELINES... ]` running state with pulsing dot + `aria-busy`; success panel with university-color check icon, event count, instructions for removing via iCal Feeds tab, "View Calendar →" / "Schedule Another" actions. CalendarView extended: `calTab` type gains `'schedule'` value; third tab button with amber `#f59e0b` dot; `<UniversityScheduleReplicator onDone={() => setCalTab('personal')} />` renders above week nav (same FeedPanel slot pattern); `useLiveQuery` in `useCalendarData` picks up generated events with 0ms manual refresh. | ✅ |
| 15 | 15.1 | **The "Eject Button" JSON Backup & Restore System** — `utils/dbExporter.ts`: `exportLocalDatabaseToJson()` iterates `db.tables` (schema-agnostic Dexie enumeration), serialises every table via `toArray()` into a `MasterBackupPayload { version, exportedAt, schemaVersion, tables }`, JSON-stringifies, creates a Blob, and triggers download via `URL.createObjectURL` anchor click (revoked after 2s). `utils/dbImporter.ts`: `isValidPayload()` type guard validates payload shape; `importJsonToLocalDatabase()` runs a single `db.transaction('rw', db.tables, ...)` that calls `clear()` then `bulkPut(rows)` per table; `SKIP_RESTORE` set (`pendingSyncQueue`, `outboxMutations`) prevents stale sync-engine mutations from re-entering the outbox; dispatches `zenith:db-restored` CustomEvent post-commit for non-Dexie state; returns `ImportResult { restoredTables, clearedTables, totalRowsWritten }`. `components/BackupRestoreManager.tsx` + `.module.css`: mineral-dark `#0d0f12` panel, parchment `rgba(194,169,128,*)` accents; two-column grid (`.actions { grid-template-columns: 1fr 1fr }`, stacks single-col ≤640px); `[ EJECT LOCAL BACKUP DATA ]` outline button + `[ RESTORE ARCHIVE FROM FILE ]` filled button; hidden `<input type="file" accept=".json">` triggered via `fileInputRef.click()`; shared status strip with 4 dot states: idle (dim parchment) / working (`restorePulse` scale+opacity keyframe, `textBreathe` label animation) / success (accent-green) / error (red); `aria-busy` + `aria-live="polite"` on status region. Integrated into SettingsView "Privacy & Data" section — replaces the old partial 4-table export. | ✅ |
| 15 | 15.3 | **Fontaine Self-Hosting & Dexie Index Freeze** — **Font self-hosting**: `app/layout.tsx` switched from `next/font/google` to `next/font/local`; both Plus Jakarta Sans and Space Grotesk are served as variable `.woff2` files from `/public/fonts/` (no Google CDN dependency at runtime or build time); `adjustFontFallback: 'Arial'` instructs Next.js to auto-compute `size-adjust` / `ascent-override` / `descent-override` fallback metrics for zero CLS; `display: 'swap'` ensures text is visible during font load; weight ranges declared as `'300 800'` / `'300 700'` (single variable font covers full axis). Download script: `scripts/download-fonts.ps1` — fetches both variable `.woff2` files from `fonts.gstatic.com` via `System.Net.WebClient` (avoids PowerShell wildcard issues), validates presence post-download. **Dexie index freeze (v28)**: `lib/db.ts` v28 adds `category` secondary index on `assignments` (enables `.where('category')` partitioning without full-table scan) + `easeFactor` secondary index on `vocab_cards` (enables SM-2 analytics queries for remedial card scheduling); `Assignment` interface gains optional `category?: string` field. `library_books` (v26) already had `readingStatus` + `author` indexed — no change. **Performance validation**: `AppContent.tsx` fires two `console.info` lines once per authenticated session when `hsState === 'done'`: `[ ZENITH PERFORMANCE MONITOR ] LOCAL FONTS LOADED COMPLETE // CDNS CLEARED` + `[ ZENITH PERFORMANCE MONITOR ] INDEX STRUCTURES FROZEN // QUERY TARGET VELOCITY: SUB-1MS` (formatted with `#52cca3` accent via `%c` CSS). | ✅ |
| 15 | 15.2 | **Analytical Time-Capsule / Ecosystem Wrapped** — `utils/analyticsAggregator.ts`: `PersonaId` union (5 values) + `EcosystemMetrics` type (16 fields across 4 slide domains + generatedAt); `PERSONA_DATA` record (title/tagline/glyph per archetype); `yield$()` event-loop release helper (`setTimeout(r,0)` — keeps main thread responsive between IDB chunks); `generateEcosystemMetrics()` 5-chunk async pipeline: (1) assignments → completed count, academic/life split via `courseId` heuristic, most-productive day via `dayMap` frequency scan; (2) habits → `peakHabitStreak` preferring `allTimeHighStreak`, `habitCompletions.count()` via IDB; (3) pomodoroSessions → work sessions filtered, `focusHoursLogged = Math.round(totalMins/60)`; (4) vocab_cards → SM-2 retention threshold `reviewIntervalDays >= 21`; (5) library_books → COMPLETED filter + `totalPages` sum. Persona: normalised dominance scores per archetype (ARCHITECT=tasks/20, LINGUIST=vocab/15, DISCIPLINE=streak/21, CURATOR=books/5); winner > 0.20 threshold, else ZENITH_OPERATIVE. `components/EcosystemWrapped.tsx` + `.module.css`: `createPortal(content, document.body)` — rendered outside AppShell stacking context (same pattern as AiCopilotSidebar); SSR guard `const [mounted, setMounted] = useState(false)` + `useEffect(() => setMounted(true), [])` returns null before hydration. 4 slide sub-components: `SlideOperational` (SCHOLASTIC/LIFE OPS breakdown cards + most-productive day), `SlideMemory` (vocab retention + books/pages), `SlideHabits` (peak streak pip visualiser capped at MAX_PIPS=30 + total completions/focus hours cards), `SlidePersona` (archetype glyph 7rem + `[ PRIMARY DESIGNATION ]` bracket + callout box + `generatedAt` provenance line). Navigation: ← / → buttons + dot navigator (active pill `.dotActive { width:20px }` vs 8px inactive) + `01 / 04` counter; `key={slideKey}` incremented on navigation to remount slide and replay CSS entrance; `direction` state drives `.slideForward` / `.slideBackward` CSS classes (translateX ±48px + scale 0.97 entrance). Keyboard: ArrowLeft/ArrowRight/Escape. Backdrop click-to-close via `overlayRef` identity check. Triggered from SettingsView "Ecosystem Analytics" section `◈ Wake Annual Ecosystem Wrapped` button (`{showWrapped && <EcosystemWrapped onClose={...} />}`). z-index: 850 (above all panels, below Toast at 600 — wait: above Toast). | ✅ |
| R4 | —  | **Navigation & View Overhaul** — **Nav reorder**: University Hub now FIRST in Scholastic (above Study Shield). **Slope Day → Mental Wellness** (`view: 'wellness'`): SlopeDayHypeTracker completely rebuilt — right pane replaced with monthly mood calendar; green→red color-coded cells (wellbeing = energyLevel − stressLevel / 18 × 120 hue); month navigator; click-to-view day detail panel; `useLiveQuery` fetches all-time logs for calendar (`.catch(() => [])` + `deps: []` pattern to survive HMR); **CalendarView fix**: moved `EmptyPersonal` + `EmptyCalendar` function declarations above `CalendarView` export to prevent HMR reference errors. **Habits tab polish**: `+ New Habit` button now first in toolbar (before ✎ Edit Habits); modal overflow fixed (`max-height: calc(100vh - 64px)` + `overflow: hidden` + scrollable form); daily % badge larger (2rem, 72px circle); analytics right panel gains 3-stat summary row (Today% / Habits / Best Streak) above the 30-day chart; `.dailyStreak` line added. **Custom Link Manager** built: `CustomLinksView.tsx` — category tab bar (derived from folderName; "All" pseudo-tab), link cards with auto-fetched Google favicons, Add/Edit modal (name/URL/description/category + new-category input), delete per card; IDB: existing `customBookmarks` table + `description?` field added (non-indexed, no migration); `useLiveQuery(fn, []).catch(() => [])` pattern. **Meal Planning** built (`MealPlanningView.tsx`, IDB v17): 4 tabs — (1) Weekly Planner: 7-day Mon–Sun grid × 3 meal rows (B/L/D), slot modal with ingredient search from 52-item price DB, college quick-fill filtered by equipment + preferences, calorie auto-calc from `servingCalories`; (2) Recipes & Resources: college dorm meals panel (17 meals, filtered by equipment/preferences), saved recipe cards (URL/category/cook time/cost/equipment); (3) Budget: weekly budget input, cost breakdown by type + day; (4) Kitchen Setup: 4 equipment nodes (saved to `zenith_kitchen_setup_v1`), preferred grocery store + OpenStreetMap Overpass nearby-store lookup, dietary tag toggles (7 tags), disliked ingredients list (all saved to `zenith_food_prefs_v1`). **Calorie tracking**: `estimatedCalories: number` on `MealPlanSlot`; daily calorie summary row below grid (green < 2000, amber >85%, red >2000); `DAILY_CALORIE_TARGET = 2000`; college meals include `calories` + `dietaryTags`; `utils/mealData.ts` has `filterIngredients` + `filterCollegeMeals` preference-filtering helpers. | ✅ |
