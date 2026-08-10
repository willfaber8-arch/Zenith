/**
 * lib/hooks/useSavedArticles.ts — the reading half of the news feed.
 *
 * world-events already fetched BBC/NPR/Guardian and saved nothing, so
 * closing the tab lost everything. This adds keeping, archiving and
 * summarising on top of the feed that already works.
 */

'use client'

import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type SavedArticle } from '@/lib/db'

export interface SaveInput {
  title:       string
  url:         string
  source:      string
  description: string
  publishedAt: number
}

export interface UseSavedArticlesResult {
  saved:      SavedArticle[]
  archived:   SavedArticle[]
  /** Fast membership test for the feed's save buttons. */
  savedUrls:  ReadonlySet<string>
  isLoading:  boolean
  save:       (a: SaveInput) => Promise<void>
  unsave:     (url: string) => Promise<void>
  setArchived:(id: string, archived: boolean) => Promise<void>
  setSummary: (id: string, summary: string) => Promise<void>
  addTag:     (id: string, tag: string) => Promise<void>
  removeTag:  (id: string, tag: string) => Promise<void>
}

export function useSavedArticles(): UseSavedArticlesResult {
  const rows = useLiveQuery(
    async () => (db ? db.knowledge_saved_articles.orderBy('savedAt').reverse().toArray() : []),
    [],
  )

  const all = useMemo(() => rows ?? [], [rows])

  const saved    = useMemo(() => all.filter(a => a.archived !== 1), [all])
  const archived = useMemo(() => all.filter(a => a.archived === 1), [all])

  /* Includes archived rows on purpose: an archived article is still
     "saved" as far as the feed is concerned, and offering to save it
     again would create a duplicate the unique index then rejects. */
  const savedUrls = useMemo(() => new Set(all.map(a => a.url)), [all])

  const save = useCallback(async (a: SaveInput) => {
    if (!db) return
    const existing = await db.knowledge_saved_articles.where('url').equals(a.url).first()
    if (existing) return   // dedup by URL — saving twice is a no-op
    await db.knowledge_saved_articles.add({
      id:          crypto.randomUUID(),
      title:       a.title,
      url:         a.url,
      source:      a.source,
      publishedAt: a.publishedAt,
      savedAt:     Date.now(),
      description: a.description,
      tags:        [],
      archived:    0,
    })
  }, [])

  const unsave = useCallback(async (url: string) => {
    if (!db) return
    const row = await db.knowledge_saved_articles.where('url').equals(url).first()
    if (row) await db.knowledge_saved_articles.delete(row.id)
  }, [])

  const setArchived = useCallback(async (id: string, archived: boolean) => {
    if (!db) return
    await db.knowledge_saved_articles.update(id, { archived: archived ? 1 : 0 })
  }, [])

  const setSummary = useCallback(async (id: string, summary: string) => {
    if (!db) return
    await db.knowledge_saved_articles.update(id, { summary, summarisedAt: Date.now() })
  }, [])

  const addTag = useCallback(async (id: string, tag: string) => {
    if (!db) return
    const row = await db.knowledge_saved_articles.get(id)
    if (!row) return
    const clean = tag.trim().toLowerCase()
    if (!clean || row.tags.includes(clean)) return
    await db.knowledge_saved_articles.update(id, { tags: [...row.tags, clean] })
  }, [])

  const removeTag = useCallback(async (id: string, tag: string) => {
    if (!db) return
    const row = await db.knowledge_saved_articles.get(id)
    if (!row) return
    await db.knowledge_saved_articles.update(id, { tags: row.tags.filter(t => t !== tag) })
  }, [])

  return {
    saved, archived, savedUrls,
    isLoading: rows === undefined,
    save, unsave, setArchived, setSummary, addTag, removeTag,
  }
}

/**
 * Prompt for summarising a saved article.
 *
 * Sends title, source and the RSS excerpt only — we do not have the full
 * text and must not pretend to. The prompt says so explicitly, so the
 * model frames its answer as what the piece appears to cover rather than
 * inventing detail it cannot have read.
 */
export function buildSummaryPrompt(a: SavedArticle): string {
  return [
    'Summarise this news item in 2–3 sentences for someone deciding whether to read it.',
    '',
    `Title:  ${a.title}`,
    `Source: ${a.source}`,
    `Excerpt: ${a.description || '(none provided)'}`,
    '',
    'Important: you have ONLY the headline and excerpt above — not the full article.',
    'Summarise what the piece appears to cover and why it might matter.',
    'Do not invent specifics (numbers, quotes, outcomes) that are not in the excerpt.',
    'Reply with the summary only, no preamble.',
  ].join('\n')
}
