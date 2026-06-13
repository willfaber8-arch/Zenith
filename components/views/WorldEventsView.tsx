'use client'

import { useState, useEffect, useCallback } from 'react'
import ZenHeading from '@/components/ui/ZenHeading'
import type { NewsArticle } from '@/app/api/world-news/route'
import styles from './WorldEventsView.module.css'

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

  function fmtDate(iso: string): string {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  return (
    <div className={styles.root}>
      <ZenHeading
        eyebrow="Life · World News"
        title="World Events"
        subtitle="Live headlines from BBC World, NPR, and The Guardian. Refreshes every 10 minutes."
        size="md"
      />

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
        <div className={styles.loading}>
          <div className={styles.loadingDot} />
          <span>Fetching headlines…</span>
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

      {!newsLoading && filteredNews.length > 0 && (
        <div className={styles.feed}>
          {filteredNews.map((article, i) => (
            <a
              key={i}
              href={article.url}
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
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
