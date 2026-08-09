# Knowledge Consumer — Module Spec

**Status:** draft · **Surface:** extends `world-events` · **Data:** IndexedDB

---

## 1. What this is

The reading half of the news feed that already exists. `world-events`
fetches BBC World, NPR and The Guardian through `/api/world-news` and
renders them — and **saves nothing**. Close the tab and it is gone.

This module adds the part that makes it useful: save an article, read it
later, get a summary, keep what mattered.

---

## 2. What exists today

- `app/api/world-news/route.ts` — parallel fetch of three RSS feeds via
  `Promise.allSettled` (one dead source never blocks the others), a
  pure-regex XML parser, `revalidate: 600`
- `components/views/WorldEventsView.tsx` — source filter tabs, refresh,
  card grid linking out
- **No `saved_articles` table anywhere**

So this is "add persistence and summarisation to a working feed", not a
new module. That is why it extends rather than replaces.

---

## 3. Data

New table `knowledge_saved_articles`:

```ts
interface SavedArticle {
  id:          string    // UUID PK
  title:       string
  url:         string    // * indexed — dedup key
  source:      string    // 'BBC World'
  publishedAt: number
  savedAt:     number    // * indexed — list order
  description: string    // RSS excerpt, as fetched
  summary?:    string    // LLM-generated, only when asked for
  summarisedAt?: number
  tags:        string[]
  archived:    boolean   // * indexed
}
```

`url` is the dedup key — saving the same article twice is a no-op rather
than a duplicate row.

**Full article text is not stored.** The RSS excerpt is what the feed
gives us; fetching and storing whole articles is a copyright question and
a storage problem, and the summary covers the actual need.

---

## 4. Surface

`world-events` gains tabs, matching how `uni-hub` and Study Shield are
already structured:

- **Feed** — today's headlines (the current view, unchanged)
- **Saved** — what you kept, newest first, with tag filter and search
- **Archive** — read and set aside; not deleted

A save control on every feed card. Saved cards show source, date, the
excerpt, and the summary once generated.

---

## 5. Summarisation

Via the existing `/api/chat` — the shared AI endpoint, same path the
Co-Pilot and the LinkedIn generator use. No new route.

**On demand, never automatic.** A "Summarise" button per saved article.
Reasons: it costs the user's own API quota; the excerpt is often enough;
and silently sending every saved URL to a provider is the kind of thing
that should be a choice.

The prompt sends **title, source and the RSS excerpt only** — we do not
have the full text and should not pretend to. The summary is therefore
explicitly "what this article appears to cover", and the UI says so
rather than implying the model read the piece.

Cached in `summary` — a second press is free.

---

## 6. Co-Pilot access

Saved articles are included in the AI context: titles, sources, tags and
recency. This is squarely the "learn what the user cares about" case —
what someone saves says more about their interests than most structured
fields.

Summaries are included; the raw excerpt is not, to keep the payload small.

Standard exception applies: nothing here touches the wellness journal.

---

## 7. Registry

```ts
{
  id: 'world-events', label: 'World Events',
  widgets: ['newsHeadline', 'savedReading'],
}
```

New `SavedReadingWidget`: unread saved count and the most recent title.

---

## 8. Build order

1. `knowledge_saved_articles` table (one version bump)
2. Save / unsave from feed cards, with URL dedup
3. Saved tab — list, search, tags
4. Archive
5. Summarise via `/api/chat`, cached
6. Dashboard widget
7. Co-Pilot context inclusion

---

## 9. Out of scope

- Full-text article fetching or offline reading
- Custom RSS sources (worth doing later; the parser already supports it,
  but source management is its own UI)
- Recommendations or a "for you" ranking
- Highlighting or annotation inside an article

---

## 10. Open question

**Should saving be possible from outside the three built-in feeds?**
A "save this URL" field would make the module a general read-later tool
rather than a companion to the news feed. That is a larger product than
specced here — worth deciding before the Saved tab's empty state is
written, since it changes what that state should say.
