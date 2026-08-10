/**
 * components/SavedArticles.tsx — the Saved and Archive tabs.
 *
 * Summarising is on demand, never automatic: it spends the user's own API
 * quota, the RSS excerpt is often enough on its own, and silently sending
 * every saved URL to a provider is the kind of thing that should be a
 * choice rather than a default.
 */

'use client'

import { useState, useCallback } from 'react'
import type { SavedArticle } from '@/lib/db'
import { buildSummaryPrompt } from '@/lib/hooks/useSavedArticles'
import { useAiConfig } from '@/lib/hooks/useAiConfig'
import { useToast } from '@/lib/ToastContext'
import styles from './SavedArticles.module.css'

/** Only http(s) — a compromised feed could supply a javascript: URL. */
function safeHref(url: string): string {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : '#'
  } catch { return '#' }
}

function fmtSaved(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days < 1)  return 'saved today'
  if (days === 1) return 'saved yesterday'
  if (days < 30) return `saved ${days}d ago`
  return `saved ${new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

interface Props {
  articles:    SavedArticle[]
  isArchive:   boolean
  onArchive:   (id: string, archived: boolean) => Promise<void>
  onSummarise: (id: string, summary: string) => Promise<void>
  onRemove:    (url: string) => Promise<void>
}

export default function SavedArticles({
  articles, isArchive, onArchive, onSummarise, onRemove,
}: Props) {
  const { toast } = useToast()
  const { authHeaders, config, mounted } = useAiConfig()

  const [query,   setQuery]   = useState('')
  const [busyId,  setBusyId]  = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const visible = q
    ? articles.filter(a =>
        a.title.toLowerCase().includes(q)
        || a.source.toLowerCase().includes(q)
        || a.tags.some(t => t.includes(q))
        || (a.summary ?? '').toLowerCase().includes(q))
    : articles

  const summarise = useCallback(async (a: SavedArticle) => {
    if (!config.userApiKey) {
      toast('Add an AI key in Settings → AI Provider to summarise.', 'error')
      return
    }
    setBusyId(a.id)
    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify({ messages: [{ role: 'user', content: buildSummaryPrompt(a) }] }),
      })
      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const dec    = new TextDecoder()
      let full = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        full += dec.decode(value, { stream: true })
      }
      // The chat route appends tool JSON after a marker; trim defensively.
      const text = full.split('ZENITH_ACTIONS')[0].trim()
      if (!text) throw new Error('Empty response')

      await onSummarise(a.id, text)
    } catch {
      toast('Could not summarise that article.', 'error')
    } finally {
      setBusyId(null)
    }
  }, [config.userApiKey, authHeaders, onSummarise, toast])

  const noKey = mounted && !config.userApiKey

  if (articles.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyGlyph} aria-hidden="true">{isArchive ? '⌦' : '◫'}</span>
        <p className={styles.emptyLabel}>
          {isArchive ? 'Nothing archived' : 'Nothing saved yet'}
        </p>
        <p className={styles.emptyHint}>
          {isArchive
            ? 'Articles you set aside from Saved end up here.'
            : 'Press Save on any story in the Feed and it will be waiting here.'}
        </p>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <input
          className={styles.search}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search saved…"
          aria-label="Search saved articles"
        />
        <span className={styles.count}>{visible.length} of {articles.length}</span>
      </div>

      {noKey && (
        <p className={styles.notice}>
          Summaries need an AI key — add one in Settings → AI Provider.
        </p>
      )}

      <ul className={styles.list}>
        {visible.map(a => (
          <li key={a.id} className={styles.item}>
            <div className={styles.itemTop}>
              <span className={styles.source}>{a.source}</span>
              <span className={styles.savedAt}>{fmtSaved(a.savedAt)}</span>
            </div>

            <a
              className={styles.title}
              href={safeHref(a.url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {a.title}
            </a>

            {a.description && <p className={styles.excerpt}>{a.description}</p>}

            {a.summary && (
              <div className={styles.summary}>
                <span className={styles.summaryLabel}>Summary</span>
                <p>{a.summary}</p>
                {/* Said plainly: the model saw a headline and an excerpt,
                    not the article. Implying otherwise would be a lie the
                    user has no way to check. */}
                <span className={styles.summaryCaveat}>
                  Generated from the headline and excerpt only.
                </span>
              </div>
            )}

            <div className={styles.actions}>
              {!a.summary && (
                <button
                  type="button" className={styles.action}
                  onClick={() => summarise(a)}
                  disabled={busyId === a.id || noKey}
                >
                  {busyId === a.id ? 'Summarising…' : '✦ Summarise'}
                </button>
              )}
              <button
                type="button" className={styles.action}
                onClick={() => void onArchive(a.id, !isArchive)}
              >
                {isArchive ? '↩ Restore' : '⌦ Archive'}
              </button>
              <button
                type="button" className={styles.actionQuiet}
                onClick={() => void onRemove(a.url)}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
