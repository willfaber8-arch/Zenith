'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { NewsArticle } from '@/app/api/world-news/route'
import styles from './WorldEventsView.module.css'

/**
 * RSS feed content is untrusted. A malicious or compromised feed could supply a
 * `javascript:` (or other dangerous-scheme) link; only allow http(s) through,
 * otherwise fall back to a no-op anchor.
 */
function safeHref(url: string): string {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : '#'
  } catch {
    return '#'
  }
}

const BRIEFING_COUNT = 5

export default function WorldEventsView() {
  const [news,        setNews]        = useState<NewsArticle[]>([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError,   setNewsError]   = useState<string | null>(null)
  const [newsFilter,  setNewsFilter]  = useState<string>('All')

  const fetchNews = useCallback(async () => {
    setNewsLoading(true)
    setNewsError(null)
    try {
      const res = await fetch('/api/world-news')
      if (!res.ok) throw new Error('Feed unavailable')
      const data = await res.json() as { articles?: NewsArticle[]; error?: string }
      if (data.error) throw new Error(data.error)
      setNews(data.articles ?? [])
    } catch (err) {
      setNewsError(err instanceof Error ? err.message : 'Failed to load news')
    } finally {
      setNewsLoading(false)
    }
  }, [])

  useEffect(() => { void fetchNews() }, [fetchNews])

  const newsSources   = ['All', ...Array.from(new Set(news.map(a => a.source)))]
  const filteredNews  = newsFilter === 'All' ? news : news.filter(a => a.source === newsFilter)
  const sourceCount   = useMemo(() => new Set(news.map(a => a.source)).size, [news])

  /** Newest-first briefing digest — pure client-side derivation, no extra fetch. */
  const briefing = useMemo(
    () => [...news].sort((a, b) => b.pubMs - a.pubMs).slice(0, BRIEFING_COUNT),
    [news],
  )

  function fmtDate(iso: string): string {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  function fmtRelative(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return ''
    const diff = Date.now() - ms
    if (diff < 0) return 'just now'
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div className={styles.root}>
      <div className={styles.controls}>
        <div className={styles.sourceFilter}>
          {newsSources.map(src => (
            <button
              key={src}
              className={`${styles.sourceBtn} ${newsFilter === src ? styles.sourceBtnActive : ''}`}
              onClick={() => setNewsFilter(src)}
            >
              {src}
            </button>
          ))}
        </div>
        <button
          className={styles.refreshBtn}
          onClick={() => void fetchNews()}
          disabled={newsLoading}
          aria-label="Refresh news"
        >
          {newsLoading ? '···' : '↺ Refresh'}
        </button>
      </div>

      {newsLoading && (
        <div className={styles.loadingWrap}>
          <div className={styles.loading}>
            <div className={styles.loadingDot} />
            <span>Fetching headlines…</span>
          </div>
          <div className={styles.skelBriefing} />
          <div className={styles.skelFeed}>
            <div className={styles.skelCard} />
            <div className={styles.skelCard} />
            <div className={styles.skelCard} />
          </div>
        </div>
      )}

      {newsError && !newsLoading && (
        <div className={styles.error}>
          <span>⚠ {newsError}</span>
          <button className={styles.retryBtn} onClick={() => void fetchNews()}>Retry</button>
        </div>
      )}

      {!newsLoading && !newsError && filteredNews.length === 0 && (
        <p className={styles.empty}>No articles found.</p>
      )}

      {!newsLoading && !newsError && news.length > 0 && (
        <section className={styles.briefing} aria-label="Today's briefing">
          <p className={styles.briefingHeader}>
            [ TODAY&apos;S BRIEFING · {news.length} {news.length === 1 ? 'story' : 'stories'} across {sourceCount} {sourceCount === 1 ? 'source' : 'sources'} ]
          </p>
          <ol className={styles.briefingList}>
            {briefing.map((article, i) => (
              <li key={`brief-${i}`} className={styles.briefingItem}>
                <span className={styles.briefingNum}>{String(i + 1).padStart(2, '0')}</span>
                <a
                  href={safeHref(article.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.briefingLink}
                >
                  <span className={styles.briefingTitle}>{article.title}</span>
                  <span className={styles.briefingMeta}>
                    <span className={styles.briefingSource}>{article.source}</span>
                    <span className={styles.briefingDot}>·</span>
                    <span className={styles.briefingTime}>{fmtRelative(article.pubMs)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!newsLoading && !newsError && filteredNews.length > 0 && (
        <>
          <p className={styles.feedLabel}>
            [ ALL STORIES{newsFilter !== 'All' ? ` · ${newsFilter.toUpperCase()}` : ''} ]
          </p>
          <div className={styles.feed}>
            {filteredNews.map((article, i) => (
              <a
                key={i}
                href={safeHref(article.url)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.card}
              >
                <div className={styles.cardTop}>
                  <span className={styles.source}>{article.source}</span>
                  <span className={styles.date}>{fmtDate(article.pubDate)}</span>
                </div>
                <p className={styles.headline}>{article.title}</p>
                {article.description && (
                  <p className={styles.desc}>{article.description}</p>
                )}
                <span className={styles.readMore}>Read →</span>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
