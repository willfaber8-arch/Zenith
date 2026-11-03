# Zenith: briefing for another agent

You are being handed **Zenith**, a personal life dashboard. This file tells you what it is, how it is built, what you can rely on, and how to plug it into a larger system without breaking it.

- **Repo:** `willfaber8-arch/zenith` (GitHub), default branch `master`
- **Owner:** Will (a university student; the app is built around his life)
- **Full rulebook:** `CLAUDE.md` in the repo root, about 1,000 lines and 123 numbered rules. This briefing is the summary; CLAUDE.md is the authority when they disagree.
- **Session notes:** `docs/HANDOFF.md` covers working habits, CI and environment pitfalls.

---

## 1. What Zenith is

A **local-first, offline-capable personal operating system** in the browser. It brings school, habits, calendar, tasks, notes, health and hobbies into one dark, minimalist workspace.

The key design decision: **the user's data lives in the browser (IndexedDB), not on a server.** The cloud is optional and stores a backup copy of the whole workspace for syncing between devices.

### Feature map

| Area | Views (`ViewId`) | What they do |
|---|---|---|
| **Scholastic** | `uni-hub`, `study-shield`, `vocab-builder` | University and major resource links, GPA calculator, cognitive load, campus-currency burn rate; Pomodoro focus cockpit, AI study, focus rooms; SM-2 spaced-repetition vocab |
| **Life** | `habits`, `calendar`, `workouts`, `meal-planning`, `wellness`, `personal-brand`, `world-events`, `subscriptions`, `game-finder`, `friends-network` | Habit tracker with streaks; calendar (iCal feeds, repeating events, priorities) plus the **one** task list; cardio log; meal planner; mood check-in; LinkedIn post generator; news; subscription cost tracker; multiplayer game finder; peer-to-peer friend leaderboard |
| **Creator's Choice** | `aquascaping`, `trail-hunter`, `botanist`, `games` | Aquarium planner, 70 US trails, plant care, Arcade Hub (minigames and an idle economy in a **separate** database) |
| **Vault** | `custom-links`, `stats` | Bookmark dashboard, analytics |
| **Also present** | Notes, Cube Timer, Book Tracker, Sports, Outlook, Toolkit, Help, Settings | Notes with checklist-to-task sync; speedcubing timer with splits and stats; and others |

On a **phone** (below 767px) the app is a different composition: five tabs (Home, Today, Habits, Tasks, Notes) plus Settings. It is not a narrower desktop (rule 107).

---

## 2. Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 App Router, React 19, TypeScript |
| Styling | CSS Modules plus Tailwind v4. Design tokens live in `app/globals.css` (`@theme` and `:root` aliases). No Framer Motion; CSS transitions only. |
| Local data | IndexedDB via **Dexie 4**. `lib/db.ts` → database `ZenithOS`, schema **v48**, about 45 tables. The games use a separate database, `lib/gamesDb.ts` → `ZenithGamesOS`. |
| Cloud | Supabase: auth plus **one** table, `zenith_snapshots` (one JSON row per user holding the whole workspace) |
| AI | `POST /api/chat` uses the Anthropic SDK and streams. The key is server-side (`LLM_API_KEY`); the model comes from `LLM_MODEL`. |
| Other server routes (`app/api/`) | `cal-proxy` (iCal CORS proxy), `world-news` (RSS), `recipe-import`, `book-cover`, `sports`, `strava`, `study-ai`, `roadmap`. All outbound fetches go through `lib/server/ssrfGuard.ts`. |
| P2P | PeerJS (friend leaderboard) |
| Tests | Jest (about 1,400 unit tests in `__tests__/`), Playwright (`tests/*.spec.ts`) |
| Deploy | Vercel, through a GitHub Actions pipeline (typecheck, then Playwright, then deploy) |

---

## 3. Architecture in one picture

```
Browser
 ├─ IndexedDB "ZenithOS" (Dexie)      ← source of truth for all user data
 ├─ IndexedDB "ZenithGamesOS"         ← arcade economy, fully isolated
 ├─ localStorage "zenith_*" keys      ← preferences and small state (versioned keys)
 └─ React app (single page, view router, no URL routes per view)
      Providers: Nav → NavBadge → Auth → Toast → StudyMode → Copilot
      AppShell → ViewRouter → components/views/*View.tsx
      CloudSyncProvider: whole-workspace sync on a timer and on change

Next.js server (stateless)
 └─ app/api/*  proxies and AI only; stores nothing

Supabase
 └─ zenith_snapshots(user_id PK, payload jsonb, updated_at, schema_version)
```

Navigation is **state, not URLs**: `useNav().navigate('calendar', 'essentials')`. Adding a view means a `ViewId` in `lib/nav-config.ts` plus a case in `ViewRouter.tsx`.

---

## 4. Integration surfaces for a larger build

These are the stable seams. Prefer them over reaching into components.

### A. Data export and import (the best seam)
- `utils/dbExporter.ts` → `buildBackupPayload(): MasterBackupPayload`
- `utils/dbImporter.ts` → `importJsonToLocalDatabase(payload, opts)`
- The envelope:
  ```ts
  type MasterBackupPayload = {
    version: number
    exportedAt: number            // unix ms
    schemaVersion: number         // ZenithOS Dexie version
    tables: { [table: string]: unknown[] }
    gamesSchemaVersion?: number
    gamesTables?: { [table: string]: unknown[] }
    settings?: { [key: string]: string }   // zenith_* localStorage keys
    secretsStripped?: true
    summary?: {...}               // counts of notes/tasks/habits/events
  }
  ```
- The same envelope is what the cloud stores, so a larger system can **read a user's whole Zenith workspace from `zenith_snapshots.payload`**, given that user's Supabase auth. Row Level Security limits access to `auth.uid() = user_id`.
- Secrets (AI key, crypto keys, device ids) are stripped from every export (`utils/deviceSecrets.ts`). Don't expect them, and don't add them back.

### B. The cloud snapshot table
- Migration: `supabase/migrations/20260803000001_cloud_snapshot.sql`
- Writes use **compare-and-swap on `updated_at`**. If an outside system writes this row, it must follow the same rule or it will either be rejected as a conflict or overwrite the user's work. **Treat it as read-only from outside** unless you implement `decideSync()`'s rules (`services/cloudSnapshot.ts`, CLAUDE.md rules 111–115).

### C. The AI endpoint
- `POST /api/chat` with `{ messages, contextPayload: { systemPrompt } }` returns a streamed text response.
- `contextPayload.systemPrompt` is the extension point: any new AI feature passes its own system prompt (rule 78).
- Limits: 4,000 characters per user turn, a 20-message window, 1,024 output tokens.
- `lib/aiContextBridge` builds the Co-Pilot's view of the user's data. Journals and per-question wellness answers are deliberately excluded.

### D. Domain logic that is pure and reusable
These modules have no React or Dexie imports and are covered by tests, so they can be lifted into another codebase:
- `utils/calendarParser.ts` (`parseIcal`), `utils/recurrence.ts` (RRULE expansion), `utils/eventOverlap.ts`, `utils/seriesEdit.ts`
- `utils/gpaMath.ts` (4.0 and 4.3 scales)
- `utils/dayBoundary.ts`, `utils/habitSchedule.ts`, `utils/habitAmount.ts` (habit day cutoff, schedules, fractional amounts)
- `utils/cubeStats.ts`, `utils/cubeAnalytics.ts`, `utils/cubePhases.ts`
- `utils/emotionCheckin.ts` (wellness scoring and correlations)
- `utils/noteChecklistSync.ts` (three-way merge)
- `services/cloudSnapshot.ts` → `decideSync()` (sync decision table)
- `lib/server/ssrfGuard.ts` (SSRF protection)

### E. Write paths (use these; never write the tables directly from new UI)
| Domain | Single write path |
|---|---|
| Tasks (`assignments`) | `lib/taskMutations.ts` |
| Calendar edits and deletes | `lib/calendarMutations.ts` (`targetIds()` decides series scope) |
| Habit progress | `lib/habitSync.ts` → `addHabitProgress`. Trackers call `syncHabitSource(id, amount)`. |
| Note ↔ task link | `lib/noteTaskSync.ts` |
| Notifications | `useToast()` |

### F. Design system
To make a larger build look like Zenith, reuse `app/globals.css`:
- Tokens: `--bg-main #0b0d13`, `--surface-card #141923`, `--accent-purple #7c95ff`, `--accent-green #52cca3`, `--text-primary #e8eaf6`
- Fonts: Plus Jakarta Sans for body, Space Grotesk for display
- 4px spacing scale (`--sp-*`) and motion tokens (`--ease-expo`, `--dur-*`)
- Category theming: `--cat-accent` and related variables are set per section by AppShell.

---

## 5. Invariants: do not break these

1. **User data comes first.** Never migrate, rewrite or delete user rows destructively. Prefer optional, non-indexed fields, which need no schema bump. A schema bump only ever adds.
2. **Database access only in the browser**, inside `useEffect`, event handlers or `useLiveQuery`. `db` is null on the server.
3. **One task list** (the Calendar's Tasks tab). Don't build a second one (rule 92).
4. **Readers agree with writers.** Habit "today" rolls over at a configurable cutoff, not midnight. Use `currentDayISO()`, never `new Date()` (rules 90–91).
5. **Repeats are concrete rows grouped by `seriesUid`.** Don't add a second recurrence mechanism (rules 87–88, 99–100).
6. **Sync never decides for the user.** Every automatic path goes through `decideSync()`. Never compare one machine's clock with another's (rules 111–115, 122).
7. **Nothing device-specific leaves the device** (rule 112).
8. **IP addresses are checked as bytes**, not strings, in the SSRF guard (rule 103).
9. **Peer payloads are untrusted** and go through `utils/peerPayload.ts` (rule 104).
10. **Games stay in `ZenithGamesOS`.** Never import `lib/db.ts` from games code (rule 52).
11. **Phone layout is gated by `usePhoneLayout()`.** Never put phone behaviour in a shared desktop rule (rule 107).
12. **No hardcoded hex values or font names** in component CSS. Use tokens.

---

## 6. Ways to use Zenith in a larger build

Ranked from least to most invasive:

1. **Read-only consumer.** Read `zenith_snapshots.payload` for the signed-in user, or accept an exported JSON backup. Good for analytics, an assistant that knows the user's schedule, or a cross-app dashboard. Nothing in Zenith has to change.
2. **Shared AI backend.** Point other features at `/api/chat` with their own `systemPrompt`, or lift `compileUserContextPayload` to give another agent Zenith context.
3. **Library extraction.** Copy the pure `utils/` modules listed in 4D into a shared package.
4. **New module inside Zenith.** Add a view (`lib/nav-config.ts`, then `ViewRouter.tsx`, then `components/views/XView.tsx` with a CSS Module), store data in a new Dexie table (new version, additive only), and it syncs automatically. No sync wiring is needed (rule 15).
5. **Two-way integration through the cloud row.** Possible, but you must implement compare-and-swap plus the mass-deletion and version guards. Talk to the owner first.

**Not a good fit as-is:** multi-user or shared data (one row per user, whole-workspace last-write-wins), server-side queries over individual records (the cloud holds a JSON blob, not normalised tables), or URL-addressable views (navigation is in-app state).

---

## 7. Working in the repo

```bash
npm ci
npm run dev                 # http://localhost:3000
npx tsc --noEmit -p .       # typecheck
npx jest                    # unit tests, about 20s
npx playwright test tests/<spec>.ts --reporter=line
```

- Env: copy `.env.local.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `LLM_API_KEY`. Without Supabase the app runs local-only.
- There is no ESLint config.
- Playwright needs first-run overlays dismissed. Seed `zenith_onboarding_completed_v1`, `zenith_tutorial_v1` (`{sessionsShown: 9}`) and `zenith_tour_v2`.
- Owner's conventions: open PRs as drafts, merge only when told to, add a numbered CLAUDE.md rule per feature explaining *why*, and keep model names out of commits.

> **Note:** CLAUDE.md's database section still says schema version 16. The real version is **48** (see `lib/db.ts`). Trust the code.
