# Zenith Platform — Action Plan

Sequencing for the module build. Written after the codebase audit, so the
ordering reflects what is actually there rather than what the platform
spec assumed.

---

## Decisions locked

| Question | Decision |
|---|---|
| Routing | Keep `ViewRouter` + registry. No `/app/<module>/page.tsx` migration. |
| Data layer | IndexedDB, namespaced per module. Supabase stays sync-only. |
| Overlapping modules | Absorb into existing surfaces, don't build parallel ones. |
| Plain task list | Study Shield, behind a Tasks / Problem Sets filter. |
| Note privacy | Per-note `privateFromAi` toggle. |
| Campus data | Local-only — links, manual hours, iCal feeds. No scraping, no cron. |
| Vocab backfill | Spread by mastery (`consecutiveSuccesses` → interval). |

---

## Ordering principle

Bug fixes and shared engines first, then modules by
(value ÷ risk), then the ones with the most new surface area.

Two things jump the queue because they are **live defects**, not features:
the vocab scheduler never schedules, and `assignments` has no view.

---

## Phases

### Phase 0 — Foundations *(prerequisite for everything)*

Already on branch, awaiting merge:

- **#40** Module registry — one entry drives nav, router and dashboard
- **#41** Wellness-journal privacy fix + guard test

Everything below stacks on these.

---

### Phase 1 — Review scheduler *(fixes a live bug)*

`lib/engines/ReviewScheduler.ts` — real SM-2, pure, unit-tested.
Then migrate vocab onto it and backfill due dates by mastery.

**Why first:** `nextReviewTimestamp` is written only at card creation and
never updated on review, while being read as "due" in three places. Every
vocab card is permanently due and the counts never fall. This is worth
shipping alone.

**Ships:** working spaced repetition in Vocab Builder; a shared engine the
Study Companion review queue can use without inventing a second one.

---

### Phase 2 — Notes *(highest value per unit of risk)*

New `notes` module on the existing `quickNotes` table.

1. Registry entry, list, editor, autosave, search
2. Checklist rendering with write-back
3. `NoteTaskDetector` — local, deterministic, no AI call
4. Consent ladder (approve / deny / don't-ask-again / always)
5. Task creation into `assignments` with `sourceNoteId`
6. Dashboard widget
7. Co-Pilot context inclusion + `privateFromAi`

**Why second:** self-contained, no dependency on Phase 1, and steps 1–2
are a complete useful module on their own.

---

### Phase 3 — Study Companion

1. `Assignment` gains `kind`, `body`, `problems[]`, `reviewCardId`
   (+ one index bump on `kind`)
2. **Work tab** in Study Shield — the missing assignments view, with the
   Tasks / Problem Sets filter
3. KaTeX, lazy-loaded
4. Review tab backed by Phase 1's engine + `study_review_cards`
5. Dashboard widget

**Depends on:** Phase 1 (review engine), Phase 2 (`sourceNoteId` linking
is nicer if notes already exist, though not strictly required).

---

### Phase 4 — Engineering Toolkit

Genuinely new module, no existing overlap, no data layer at all — unit
conversion plus a searchable formula reference, both static data and pure
functions.

**Why here:** it is the cheapest possible exercise of the registry
pattern, and a good sanity check that adding a module really is one entry
plus one view by this point.

---

### Phase 5 — Knowledge Consumer

Extends `world-events`, which already fetches BBC/NPR/Guardian and saves
nothing.

1. `knowledge_saved_articles` table
2. Save / archive / tag from the existing feed
3. LLM summarize via the existing `/api/chat`
4. Dashboard widget

---

### Phase 6 — Campus Companion

Fifth tab in `uni-hub`. Local-only per the decision above: curated campus
links, manually-entered dining hours with an open/closed indicator, and
event feeds subscribed as iCal (the calendar already parses iCal, so this
reuses a working pipeline rather than building a scraper).

**Why last:** most new surface, least certain requirements, and the one
most likely to want rescoping once the rest is in use.

---

## What "done" looks like per phase

Every phase ends with: `tsc --noEmit` clean, `npm run build` green, tests
passing, and the feature exercised in a real browser — not just compiled.

New modules must not need edits outside their own files plus one registry
entry and one `MODULE_VIEWS` line. If a phase needs more than that, the
registry is wrong and gets fixed rather than worked around.

---

## Explicitly not in this plan

- Multi-user / auth changes
- Migrating the primary datastore to Postgres
- File-based routing
- Any change to Focus Protocol, Focus Rooms, Arcade, Trail Hunter,
  Botanist, Sports or Cube Timer
