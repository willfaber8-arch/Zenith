# Campus Companion — Module Spec

**Status:** draft · **Surface:** fifth tab in `uni-hub` · **Data:** IndexedDB

---

## 1. Scope decision: local-only

The original brief called for dining-hall tracking and event aggregation
via scraping plus a cron refresh. **That is not what this specs.**

Scraping was rejected for three reasons:

1. **It breaks local-first.** Every other module works offline against
   IndexedDB. A scraped module needs a server round trip to say anything,
   so it is the one part of Zenith that goes blank on a train.
2. **Scrapers rot.** Cornell's dining site changes and the module silently
   shows stale hours — and stale hours are worse than no hours, because
   you walk to a closed dining hall.
3. **It is single-institution.** `uni-hub` is deliberately multi-university
   (24 in the registry, 3 with data). A Cornell scraper does not
   generalise, and the module would be dead weight for every other school.

Instead: **curated links, user-entered hours, and iCal event feeds.** All
three work offline, none rot silently, and all generalise to any campus.

---

## 2. Dining hours

`campus_dining_halls`:

```ts
interface DiningHall {
  id:           string   // UUID PK
  universityId: string   // * indexed — scopes to the active school
  name:         string
  location?:    string
  /** Per-weekday opening windows. Empty array = closed that day. */
  hours:        { day: 0|1|2|3|4|5|6; open: string; close: string }[]  // "HH:MM"
  mealPlanOnly?: boolean
  notes?:       string
  updatedAt:    number
}
```

**Seeded, not scraped.** Ship a starter set for the three universities
that already have data, editable by the user. When hours change, the user
fixes them in ten seconds and it stays correct — rather than a scraper
breaking and nobody noticing.

### Open / closed indicator

Computed client-side from the device clock against today's window:

- `OPEN · closes 20:00`
- `CLOSED · opens 07:30 tomorrow`
- `CLOSED TODAY`

Uses `utils/localDate.ts` — **not** `toISOString()`. That is the bug that
made wellness log to the wrong day, and "what day is it" is exactly the
question this feature asks.

Sorted open-first, because that is the question being asked.

---

## 3. Campus events

**No aggregator. Reuse the calendar.**

Zenith already has a complete iCal pipeline: `/api/cal-proxy` handles
CORS, `utils/calendarParser.ts` parses VEVENTs with real timezone
handling, and `useCalendarData` stores and refreshes feeds. Most campus
event calendars publish iCal.

So this tab offers **curated feed subscriptions** — one click adds a
university's event calendar as a `CalendarFeed`, and the events appear in
the Universal Calendar alongside everything else.

That is strictly better than a separate aggregator: events land where the
user already looks, they get the existing week/month/agenda views, and
there is no second refresh mechanism to maintain.

```ts
// per university, in config/universities/<id>.ts
eventFeeds?: { label: string; url: string; color: string }[]
```

---

## 4. Campus links

A curated grid — transit, IT, health, library, emergency. This overlaps
what `uni-hub`'s existing resource tabs already do, so the rule is: **if a
link fits an existing tab, it goes there.** This tab is for things tied to
being physically on campus that the existing tabs do not cover.

If that leaves too little to justify a section, drop it — better a tab
with two strong features than three weak ones.

---

## 5. Surface

Fifth tab in `UniHubView`, after Finances:

- Dining — open/closed cards, editable hours
- Events — available feeds with a subscribe control, showing which are
  already added

Follows the existing `.tabPadded` pattern so it inherits the hub's layout.

---

## 6. Registry

No new registry entry — this extends `uni-hub`. Its widget list gains
`diningNow`:

```ts
{ id: 'uni-hub', widgets: ['uniHub', 'gpaWidget', 'diningNow'] }
```

`DiningNowWidget`: what is open right now and when it closes. This is the
one genuinely glanceable thing in the module and the strongest argument
for building it at all.

---

## 7. Build order

1. `campus_dining_halls` table + seed data for the three live universities
2. Open/closed engine (`lib/engines/DiningHours.ts`, pure, tested against
   midnight rollover and closed days)
3. Dining tab with inline hour editing
4. `eventFeeds` in university config + one-click subscribe
5. `DiningNowWidget`
6. Campus links, only if §4 leaves enough to justify it

---

## 8. Out of scope

- Scraping anything
- Menus, nutrition, or what is being served
- Meal-swipe balances (Finances already tracks campus currency)
- Real-time occupancy
- Building an event aggregator separate from the calendar

---

## 9. Open question

**Is user-maintained dining data actually worth it?**

The honest risk: if hours are tedious to enter, they get entered once,
drift, and the module becomes a confidently wrong source — the exact
failure scraping was rejected for, arriving by a different road.

Mitigation is to seed well and show a "last updated" date so staleness is
visible rather than invisible. But if the seeded data covers the halls you
actually use, this may be a five-minute setup you never touch again — or a
feature not worth having. Worth a look at the seed data before building
the editor.
