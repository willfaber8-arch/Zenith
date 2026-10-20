# Session handoff

Notes for the next Claude Code session. **CLAUDE.md is the main reference.** Rules 111–120 there describe the most recent work in detail. This file only covers what CLAUDE.md doesn't: what's already shipped, what's on hold, how to work, and pitfalls in the environment.

## Recently shipped (all merged to master, CI green)

| PR | What it did | CLAUDE.md rule |
|---|---|---|
| #78 | Cloud sync runs by itself. It has safeguards against losing or leaking data, and the sync banner says what each choice replaces and what it keeps. | 111–115 |
| #79 | Cube Timer: hovering the chart shows each solve, plus a personal scoreboard of fastest singles / best aoN | 116 |
| #80 | Removed the dead per-item uploader (the "queue" chip in the top bar) | 117 |
| #81 | Cube Timer: multi-phase splits (CFOP/Roux/ZZ/custom), typed-in times, solve notes, and Advanced Stats with Phases, Distribution, Records and Progress tabs | 118 |
| #82 | Right-click acts as a left click, except where a right-click already does something (Shift for the browser menu, Settings → Mouse to turn it off) | 119 |
| #83 | A note's checklist becomes ONE undated task with a step per line, kept in sync both ways | 120 |

## On hold
- **Offline / PWA support.** Zenith doesn't load while offline. The user said "ignore the offline request for now", so don't start it unless they ask.

## How the user likes to work
- **Data:** preserve user data above all. The user relies heavily on the Cube Timer, so never rewrite or migrate solves destructively. Prefer optional fields with no schema version bump.
- **Questions:** for feature requests the user often says "ask me any questions". In that case, ask a few focused multiple-choice questions with AskUserQuestion, then build.
- **Merging:** only merge when the user says "merge". Squash-merge, and mark the PR ready for review first (a draft can't be merged).
- **Commits and PR bodies:**
  - Explain the *why*, in the same style as the CLAUDE.md rules.
  - Add a new numbered CLAUDE.md rule for each feature.
  - Don't put model names in commits or PRs.

## Workflow
- **Branch:** work on `claude/focused-euler-j4aun4`. After a PR merges, restart it:
  `git fetch origin master && git checkout -B claude/focused-euler-j4aun4 origin/master`
  Then push with `--force-with-lease`. That's safe when the old branch only holds already-merged history.
- **GitHub:** go through the MCP tools (`mcp__github__*`) for repo `willfaber8-arch/zenith`. Open PRs as drafts.
- **Checks to run before pushing:**
  - `npx tsc --noEmit -p .`
  - `npx jest`: the full suite is about 1390 tests and takes about 20s.
  - The relevant Playwright specs: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test tests/<spec>.ts --reporter=line`
- **CI:** the "Validate → Test → Deploy" check runs typecheck and Playwright, in about 8 minutes. Vercel also posts a preview.

## Environment pitfalls
- **Missing dependencies:** a fresh container may not have `node_modules`. Run `npm ci` first, otherwise `npx jest` fails to read `jest.config.ts`.
- **ESLint:** there's no ESLint config in the repo, so don't run eslint.
- **Stale dev server:**
  - Playwright reuses any server already on :3000 (`reuseExistingServer: true`), and a stale `next dev` causes confusing failures.
  - Kill it with `pkill -f "next dev"` as its own command. It exits with a non-zero code, which breaks a chained `&&`.
- **First-run overlays in Playwright:** seed `zenith_onboarding_completed_v1`, `zenith_tutorial_v1` (`{sessionsShown: 9}`) and `zenith_tour_v2` in an init script, or the overlays block clicks.
- **Grep before edit:** don't chain a file edit after a `grep … &&` that might match nothing. The grep exits 1 and the edit silently never runs.
- **Clicks that move the row:** in the Tasks tab, ticking a task's last step finishes it and moves it out of the open list. Assert against the database rather than the checkbox state.

## Code map for recent features
- **Notes ↔ task sync:**
  - `utils/noteChecklistSync.ts`: pure three-way merge.
  - `lib/noteTaskSync.ts`: database reads and writes.
  - `NotesView`: `persist`, `lastSavedRef`, and the consent/link strip.
  - `lib/taskMutations.ts` calls `syncTaskNote`.
- **Cube Timer:** `utils/cubeStats.ts`, `utils/cubeAnalytics.ts`, `utils/cubePhases.ts`, `components/CubeAdvancedStats.tsx`, `components/CubeScoreboard.tsx`
- **Right-click:** `lib/rightClickAsLeft.ts`, `components/RightClickAsLeft.tsx`
- **Cloud sync:**
  - `lib/CloudSyncContext.tsx` and `components/CloudSyncBanner.tsx`
  - `services/cloudSnapshot.ts` (`decideSync`)
  - `utils/deviceSecrets.ts` and `utils/dbSnapshots.ts`
