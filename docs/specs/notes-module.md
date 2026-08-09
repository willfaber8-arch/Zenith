# Notes — Module Spec

**Status:** draft for review · **Surface:** new module `notes`
**Data:** IndexedDB, extends the existing `quickNotes` table

---

## 1. What this is

A place to jot things down without deciding what they are first — the
iPhone Notes model. Open, type, close. No required title, no category
picker, no "which module does this belong to" decision at the moment you
have the thought.

The value is that capture is frictionless. Everything else in Zenith asks
you to classify before you write: a habit needs a goal, an assignment
needs a due date, a meal needs a slot. Notes asks for nothing.

---

## 2. There is already a table

`quickNotes` exists (IDB v1) and is only used as a side-panel scratchpad
inside Study Shield and the study cockpit:

```ts
interface QuickNote {
  id:        number   // * PK
  title:     string   // * indexed
  updatedAt: number   // * indexed
  category:  string   // * indexed — "lecture" | "idea" | "ref"
  body:      string
  pinned?:   boolean
  createdAt: number
}
```

It is already the right shape. This module gives it a home rather than
introducing `notes_*` tables alongside it. Two additive fields:

```ts
  /** Freeform user tags. Distinct from `category`, which is a fixed set. */
  tags?:      string[]
  /** Soft archive — keeps a note out of the list without destroying it.
   *  Deletion stays an explicit act in the note's own UI. */
  archived?:  boolean
```

`title` stays required in the type but the UI derives it from the first
line when the user doesn't write one, matching Notes' behaviour.

---

## 3. Surface

New module `notes`, Personalized Vault, alongside Custom Link Manager and
Stats — it is a personal store, not a scholastic or life tool.

- **List** — newest first, pinned floating to top, search across title and
  body. Category as a filter, not a required field.
- **Editor** — plain Markdown, autosaving on a debounce. No modal; the
  editor is the page.
- **Checklists** — `- [ ]` / `- [x]` render as tappable checkboxes and
  write straight back to the body. This is what makes a note usable as a
  to-do list without being a task system.

Registry entry, one line, per `lib/modules.ts`. Dashboard widget:
most-recent note plus unchecked-item count.

---

## 4. To-do detection

> "Zenith detects to-do notes → add to dashboard or whatever → approve /
> deny / approve and don't ask again / always approve."

### 4.1 What detection means

A note becomes a **candidate** when it contains checklist syntax
(`- [ ]`) or lines opening with an imperative pattern. Detection is
**local and deterministic** — a small matcher in
`lib/engines/NoteTaskDetector.ts`, no AI call. Three reasons: it runs on
every save so it must be instant and free; it must work without an API
key; and a regex that misfires is debuggable in a way a model is not.

The AI can *optionally* be asked to extract tasks from a specific note on
demand, as an explicit action. That is different from ambient detection
and should not be conflated with it.

### 4.2 The consent ladder

Four responses, which map to three stored states:

| Response | Effect | Stored |
|---|---|---|
| **Approve** | Creates the assignment(s) from this note | nothing |
| **Deny** | Dismisses; this note is not asked about again | per-note |
| **Approve and don't ask again** | Creates, and stops prompting *for this note* | per-note |
| **Always approve** | Creates, and stops prompting *everywhere* — future notes convert silently | global |

Stored as:

```ts
// on the note
noteTaskPolicy?: 'ask' | 'never' | 'auto'      // default 'ask'
// global, localStorage: zenith_note_task_policy_v1
type GlobalPolicy = 'ask' | 'always' | 'never'
```

**Precedence:** global `never` wins over everything; global `always` wins
over a per-note `ask`; a per-note `never` always wins for that note. The
rule is that the more restrictive setting wins, except where the user has
explicitly said "always" at the global level.

### 4.3 Where tasks go

Into `assignments` with `kind: 'task'` — the same table the Study
Companion spec extends, and the same one the urgent-tasks widget,
notifications and nav badges already read. Not a new table. One task list.

Each created assignment records `sourceNoteId` so the note and the task
stay linked, and re-detection doesn't duplicate a task that already exists.

### 4.4 Where the prompt appears

Not a modal. A modal on save would punish the thing this module exists to
make frictionless. Instead: an inline strip at the foot of the note —
*"3 to-dos found — Add to tasks?"* with the four responses. It can be
ignored entirely and the note is unaffected.

### 4.5 Safety

`always approve` creates rows without further confirmation, which is the
one place this module can act unattended. It is additive only — it can
create assignments, never modify or remove them — and it is bounded to
what the detector found in a note the user just wrote. Even so it should
be revocable in one click from Settings, and the strip should say what it
did (*"Added 3 tasks"*) rather than acting invisibly.

---

## 5. AI Co-Pilot access

Notes **are** included in the Co-Pilot's context. That is the point of the
request — notes are where preferences show up in the user's own words, and
an assistant that can read them gives better answers than one working from
structured fields alone.

Included: title, tags, category, recency, and body truncated to the
existing `MAX_NOTE_CHARS`. Archived notes excluded.

### 5.1 The exception

**The Mental Wellness journal is not, and will not be, included.**

This was a live leak, now fixed and locked: `qualitativeNotes` from
`MentalHealthLog` was compiled into the system prompt on every Co-Pilot
open, truncated to 110 characters and labelled `journal: "…"`. Aggregate
stress / energy / burnout-risk scalars are still shared — enough for the
assistant to be considerate — but the sentences are not.

Guarded by `__tests__/privacy/AiContextPrivacy.test.ts`, which fails if
`qualitativeNotes` reappears in the bridge's executable code or in the
compiled payload.

**Open question:** should Notes get a per-note *"hide from AI"* toggle?
Notes are a general-purpose surface, and someone will eventually write
something there they would not want sent to a provider. The wellness
journal is protected by category; a note is not protected by anything.
Recommendation: yes, with a `privateFromAi?: boolean` field — cheap now,
awkward to retrofit once people have written things.

---

## 6. Build order

1. `notes` module — registry entry, list, editor, autosave, search
2. Checklist rendering + write-back
3. `NoteTaskDetector` engine + tests (pure, no AI)
4. Consent ladder + the four responses
5. Assignment creation with `sourceNoteId` linking
6. Dashboard widget
7. Co-Pilot context inclusion (+ `privateFromAi` if agreed)

Steps 1–2 are a complete, useful module on their own. Everything after is
additive.

---

## 7. Out of scope

- Rich text, images, attachments, drawing
- Folders or nested notebooks — tags and search instead
- Sharing or collaboration
- Reminders on notes (a note that needs a reminder should become a task)

---

## 8. Open questions

1. **Per-note "hide from AI"?** Recommended above; worth confirming before
   the schema settles.
2. **Should `always approve` be reachable in one step**, or only after a
   user has approved a few times individually? Offering it immediately is
   honest about the option; gating it makes accidental blanket consent
   less likely.
3. **Does detection run on every save, or on close?** Every save is more
   responsive but means the strip can appear mid-sentence, which is
   exactly the interruption this module is trying to avoid.
