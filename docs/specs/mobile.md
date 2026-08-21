# Zenith on a phone — plan

Not built. This is the argument for what mobile Zenith should be, so the
build is a series of small decisions rather than one big one.

---

## The problem

Zenith is a laptop application that happens to reflow. The sidebar has
**24 destinations** across four categories; the Library toolbar alone has
seven buttons; several views are two-column layouts that stack into a very
long scroll. None of that is wrong on a 27" monitor. All of it is wrong in
a gym, on a bus, or in a queue.

The mistake to avoid is treating this as a CSS problem. Shrinking 24
destinations into a hamburger menu produces a phone app with 24
destinations behind one more tap. The question is not how to fit Zenith on
a phone; it is **which parts of Zenith are phone-shaped at all.**

---

## The test

A feature belongs on the phone if it is used **away from the desk**, in
**under a minute**, and **one-handed**.

That is a deliberately harsh filter, and it is meant to be. Everything
that fails it still exists — you open it on a laptop, where it was already
better.

Applying it:

| Belongs on the phone | Why |
|---|---|
| **Weightroom logger** | The defining case. In a gym, between sets, one thumb. |
| **Cardio log** | Thirty seconds after a run. |
| **Habits** | Tap to increment. Already the right shape. |
| **Daily Outlook** | Read-only glance: what is today. |
| **Notes capture** | The whole point is capturing before you forget. |
| **Calendar (agenda)** | "What's next" — not the week grid. |

| Stays on the laptop | Why |
|---|---|
| Library shelf, Arcade, Trail Hunter, Botanist | Browsing surfaces. Long sessions, big screens. |
| GPA calculator, Cognitive Load, Subscriptions | Sit-down planning with lots of inputs. |
| Settings, Backup/Restore, Shelves management | Configuration. Rare, fiddly, better with a keyboard. |
| Meal planner's weekly grid | A 7×3 grid is not a phone layout at any size. |

---

## The shape

**A five-item bottom bar. Nothing else at the top level.**

```
   Today        Log         +         Habits      Notes
  (outlook)   (workouts)  (capture)              (capture)
```

- **Today** — the glance. Outlook, condensed.
- **Log** — Weightroom and cardio. The reason to open Zenith in a gym.
- **+** — the centre action. One tap to capture: a note, a set, a habit
  tick, a cardio session. Not a menu of 24 things.
- **Habits** — a tap-to-increment list.
- **Notes** — list and editor.

Everything else lives behind **"More"**, reached by pulling down on Today,
and it is an honest list — not a second navigation system pretending to be
first-class. Tapping a laptop-only view opens it as-is, with a one-line
note that it is better on a bigger screen. Hiding it entirely would be
worse: people know their data is in there.

**Why a bottom bar rather than the existing drawer:** thumbs reach the
bottom of a phone and not the top-left. The current sidebar toggle is in
the hardest corner to reach on a large phone.

---

## The Weightroom logger is the design driver

If exactly one screen is right, it should be this one, because it is used
in the worst conditions Zenith will ever face: standing up, sweating, one
hand, possibly with a timer running.

- One set on screen at a time. Exercise, target, and the set you are on.
- Reps and weight adjusted with **large steppers**, not typed. A number
  keyboard between sets is a failure.
- The primary action is a **full-width "Done" button in the bottom third**
  of the screen. Nothing else competes with it.
- Rest timer starts on its own when a set is logged, and is visible
  without going anywhere.
- Weight defaults to the previous set. Most sets do not change weight, and
  the ones that do are a two-tap adjustment.
- **Nothing destructive within reach.** No delete, no "end session" beside
  the thing you tap forty times.

---

## Three things that are technical, not visual

**1. Touch targets.** The current icon buttons are 24–27px. The floor is
44px, and it is the single change that will make the most difference to
how the app feels.

**2. The 100vh problem.** Mobile browsers change viewport height as the
address bar hides, so `100vh` jumps mid-scroll. `GamesTabShell` uses
`calc(100vh - 52px)` and the study cockpit is `position: fixed` — both
need `dvh`.

**3. Keyboard-safe layout.** The virtual keyboard covers the bottom third,
which is exactly where the bottom bar and the "Done" button live. Anything
anchored to the bottom needs to move with it.

---

## What NOT to do

- **Do not build a second app.** One codebase, one data layer. A mobile
  view is a different composition of the same modules, not a fork.
- **Do not hide things behind a hamburger and call it done.** That is the
  current design with an extra tap.
- **Do not add a mobile-only feature.** Anything worth having on a phone
  is worth having everywhere, and the reverse creates two products.
- **Do not detect "mobile" by user agent.** Width and pointer type —
  `@media (pointer: coarse)` — describe what actually matters. A touch
  laptop should get big targets.

---

## Order

1. ~~**Touch targets and `dvh`.**~~ **Done.** 21 controls were under the
   floor; most got a transparent 44px pad under `pointer: coarse` rather
   than growing, so no toolbar reflowed. 33 layout heights across 18
   files gained a `dvh` declaration behind the `vh` one.
2. ~~**Bottom bar.**~~ **Done.** Five destinations, portalled to `<body>`
   — an ancestor's identity transform was otherwise capturing its fixed
   positioning. The "+" opens a capture sheet.
3. **Weightroom logger** in its phone form, since it is the driver.
   Partly there already: `SetLogger` was built to this shape — one set on
   screen, 56px steppers, a 58px primary action, `dvh` sizing. What is
   left is the route into it from the bottom bar without passing through
   the desktop Workouts layout first.
4. **Today, Habits, Notes** condensed. All three open and work; none is
   yet *composed* for a phone.
5. ~~**"More"**~~ **Done, differently.** Rather than a new list, the
   existing drawer became the overflow and laptop-only views carry a
   one-line note saying they are better on a bigger screen.

Steps 1 and 2 are independently shippable and worth having on their own.

---

## The open question

**Does the phone need to work offline-offline?**

Zenith is already local-first — IndexedDB, no server round-trip to read
anything — so a gym with no signal mostly works today. What does not work
is the first load: a cold visit needs the network to fetch the app itself.
A service worker would fix that and make Zenith installable, which for a
gym logger is arguably the difference between using it and not.

That is a real decision with real cost (cache invalidation, update
prompts, a whole class of "why am I seeing the old version" bugs), so it
should be made deliberately rather than absorbed into a UI pass.
