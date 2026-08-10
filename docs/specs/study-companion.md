# Study Companion — Module Spec

**Status:** draft for review · **Platform step:** 5 (first module end-to-end)
**Surface:** extends `study-shield` · **Data:** IndexedDB, namespaced

---

## 1. Decisions already taken

From the platform spec review:

- **Absorb, don't duplicate.** Study Companion extends the existing
  `study-shield` module rather than becoming a fifth Scholastic entry.
  Zenith's value is being one command center; a second place to look for
  "what's due" undercuts that.
- **Extend `assignments`, don't fork it.** Problem sets become a *kind of*
  assignment rather than a parallel entity, so there is one task list, one
  notification stream and one badge count.
- **IndexedDB, namespaced.** New tables take a `study_` prefix. No server
  dependency; the existing backup/restore and cloud-snapshot paths keep
  working for free.

---

## 2. Two findings that shape the design

### 2.1 The `assignments` table is orphaned

It is fully modelled and wired:

```ts
interface Assignment {
  id, title, dueDate, courseId, status, priority,
  category?, notes?, createdAt, updatedAt, supabaseId?
}
type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'overdue'
type Priority         = 'low' | 'medium' | 'high' | 'critical'
```

It surfaces in `UrgentTasksWidget`, `useNotifications`, `useLiveAssignmentBadges`,
and the Co-Pilot's `add_assignment` tool — and in **zero views**.

> Today you can create a task by asking the AI, receive a nav badge for it,
> get a notification about it, and have nowhere in the app to open it.

Giving assignments a real view is therefore not scope creep on this module —
it is the module's foundation, and it closes a hole that exists right now.

### 2.2 There is no SM-2 engine to reuse

`VocabCard` declares `easeFactor`, `reviewIntervalDays`,
`consecutiveSuccesses` and `nextReviewTimestamp`, which reads as a working
SM-2 implementation. It is not one.

- `nextReviewTimestamp` is written **only at card creation** (`now`, or `0`
  meaning "immediately due").
- The grading path (`VocabStudySession`, ~line 285) updates only
  `consecutiveSuccesses`, `easeFactor` and `stabilityFactor`. It never
  recomputes an interval or a next-review date.
- Yet `nextReviewTimestamp` is **read as "due"** in four places:
  `VocabBuilderView` (due count + per-card label), `StatsView` (`vocabDue`),
  and `VocabWidget` (dashboard badge).

**Consequence: every vocab card is permanently due.** Those counts never fall
after studying. What exists is a bespoke mastery heuristic, not scheduling.

So "reuse the existing SM-2 engine" is not available. Real interval
scheduling has to be written — and writing it as a shared engine fixes the
vocab bug as a side effect. That is the single strongest argument for
building it properly rather than inlining it again.

---

## 3. Data model

### 3.1 Extend `Assignment` (no new task entity)

Additive, non-indexed fields — no migration risk, existing rows stay valid:

```ts
interface Assignment {
  // ── existing ──────────────────────────────────────────
  id, title, dueDate, courseId, status, priority,
  category?, notes?, createdAt, updatedAt, supabaseId?

  // ── Study Companion additions ─────────────────────────
  /** Marks this as a problem set rather than a plain task. */
  kind?:          'task' | 'problem_set'
  /** Markdown + LaTeX body. Rendered with KaTeX when kind='problem_set'. */
  body?:          string
  /** Per-problem breakdown, so partial progress is real progress. */
  problems?:      ProblemItem[]
  /** Links this set into the review schedule (see §5). */
  reviewCardId?:  string
}

interface ProblemItem {
  id:        string
  label:     string        // "1(a)", "Q3"
  done:      boolean
  /** Optional per-problem note / worked answer, Markdown + LaTeX. */
  note?:     string
  /** Self-rated difficulty, feeds the review scheduler. */
  difficulty?: 1 | 2 | 3 | 4 | 5
}
```

`kind` defaults to `'task'` when absent, so every existing assignment — and
everything the Co-Pilot creates today — keeps working unchanged.

**Indexing:** `kind` should be indexed (one `.version()` bump) so the problem-set
view can filter without a full-table scan. `category` and `dueDate` are already
indexed and cover the rest.

### 3.2 New table: `study_review_cards`

Generalises the vocab card's scheduling fields away from vocabulary, so the
same engine serves both:

```ts
interface StudyReviewCard {
  id:                   string   // UUID PK
  /** What this card reviews. Keeps the engine domain-agnostic. */
  subjectType:          'problem_set' | 'vocab'
  subjectId:            string   // * indexed — Assignment.id or VocabCard.id
  easeFactor:           number   // SM-2 EF, default 2.5, floor 1.3
  reviewIntervalDays:   number
  consecutiveSuccesses: number
  nextReviewAt:         number   // * indexed — UTC ms
  lastReviewedAt?:      number
  reviewCount:          number
}
```

---

## 4. Surface

Two new tabs in `StudyShieldView`, joining AI Study / Focus Protocol /
Focus Rooms / Task Roadmap:

**`problem-sets`** — the missing assignments view, scoped to
`kind === 'problem_set'`:
- list grouped by course, sorted by due date, with the existing priority colours
- per-set progress from `problems[]` (`4 / 7 done`), not a binary checkbox
- LaTeX-rendered body and per-problem notes
- create / edit, including a plain "add from an existing assignment" path so a
  task the Co-Pilot created can be promoted to a problem set

**`review`** — the due queue:
- cards due now across problem sets, drawn from `study_review_cards`
- grade after working a set; the engine schedules the next appearance
- empty state when nothing is due — which is only meaningful once §2.2 is fixed

A general **task list** for `kind === 'task'` also has to live somewhere, since
those are currently unviewable. Proposal: same `problem-sets` tab with a
Tasks / Problem Sets filter, rather than a third tab — one place for "what's due".

---

## 5. Spaced repetition

New pure engine, `lib/engines/ReviewScheduler.ts` — no React, no Dexie, mirroring
the existing `RefineScoreEvaluator` pattern:

```ts
export type RecallGrade = 0 | 1 | 2 | 3 | 4 | 5

export function scheduleNext(
  card: Pick<StudyReviewCard, 'easeFactor'|'reviewIntervalDays'|'consecutiveSuccesses'>,
  grade: RecallGrade,
  now: number,
): { easeFactor: number; reviewIntervalDays: number;
     consecutiveSuccesses: number; nextReviewAt: number }
```

Standard SM-2:
- `grade < 3` → reset streak, interval back to 1 day
- `grade ≥ 3` → interval `1 → 6 → round(prev × EF)`
- `EF' = EF + (0.1 − (5−g) × (0.08 + (5−g) × 0.02))`, floored at 1.3

Unit-tested against the published SM-2 worked examples.

**Vocab migration is in scope for this module**, because the engine only earns
its keep if both callers use it — and because leaving vocab on the broken path
means the dashboard keeps lying about due counts. Concretely: back
`VocabStudySession`'s grading with `scheduleNext`, and write
`nextReviewTimestamp` on review. Existing cards need a one-time backfill (set
`nextReviewAt` from `consecutiveSuccesses`) so nobody wakes up to 400 due cards.

---

## 6. LaTeX

No math dependency exists today. Add **KaTeX** (not MathJax — smaller, faster,
sufficient for problem sets).

- ~280 kB with fonts, which is more than any current chunk. It must be
  lazy-loaded via `lib/dynamicViews.tsx` so it only downloads when the
  problem-set tab is opened, never on initial load.
- Render `$…$` / `$$…$$` inside the existing Markdown renderer rather than
  replacing it.
- **CSP:** KaTeX fonts are self-hosted from `/public`, so `font-src 'self'`
  already covers it — no `next.config.ts` change. Worth verifying, since a
  missed CSP host is exactly what silently broke cover fetching.

---

## 7. Registry + dashboard integration

Per the module registry (`lib/modules.ts`), `study-shield` gains a widget:

```ts
{
  id: 'study-shield', …,
  widgets: ['pomodoroPreview', 'studyStreak', 'problemSetsDue'],
}
```

New `ProblemSetsWidget`: due-count and the next set, click-through to the tab.
`WIDGET_VIEWS` derives automatically — no second edit. This is the registry
pattern's first real exercise.

---

## 8. Build order

1. **`ReviewScheduler` engine + tests.** Pure, no UI, verifiable in isolation.
2. **Migrate vocab onto it + backfill.** Fixes the live due-count bug and
   proves the engine against a real caller before anything depends on it.
3. **Assignment fields + `kind` index** (one `.version()` bump).
4. **Problem-sets tab** — list, create/edit, per-problem progress. No LaTeX yet.
5. **KaTeX**, lazy-loaded.
6. **Review tab + `study_review_cards`.**
7. **Widget + registry entry.**

Steps 1–2 are worth landing on their own: they fix an existing bug and are
independently useful even if the rest slips.

---

## 9. Out of scope

- Multi-user / sharing problem sets
- OCR or PDF import of problem sets
- Auto-grading — self-rated difficulty only
- Changes to Focus Protocol, Focus Rooms, AI Study or Task Roadmap
- The other three modules (Toolkit, Campus, Knowledge)

---

## 10. Open questions

1. ~~Does the general task list belong here?~~ **Resolved:** yes — a single
   "Work" tab with a Tasks / Problem Sets filter. One place for what's due.
2. **Should the Co-Pilot get a `create_problem_set` tool**, or is
   `add_assignment` + a promote action enough? A new tool needs a
   `TOOL_MUTATION_KIND` entry and must stay additive.
3. ~~Vocab backfill policy.~~ **Resolved:** spread by mastery — derive the
   initial interval from `consecutiveSuccesses`, so well-known cards land
   further out and the due count immediately reflects what you know.
