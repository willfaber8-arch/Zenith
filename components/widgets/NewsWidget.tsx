'use client'

import { useState, useEffect } from 'react'
import { useNav }              from '@/lib/NavContext'
import wStyles from './Widget.module.css'

interface NewsArticle {
  title:       string
  description: string
  link:        string
  pubDate:     string
  source:      string
}

export default function NewsWidget() {
  const { navigate } = useNav()
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/world-news')
      .then(r => r.json())
      .then((data: NewsArticle[]) => {
        if (!cancelled) setArticles(data.slice(0, 3))
      })
      .catch(() => { /* silent fail */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div
      className={`${wStyles.card} ${wStyles.clickable}`}
      onClick={() => navigate('world-events', 'essentials')}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('world-events', 'essentials') }}
    >
      <div className={wStyles.cardHeader}>
        <div>
          <div className={wStyles.eyebrow}>Life</div>
          <div className={wStyles.title}>World News</div>
        </div>
        <span className={wStyles.navArrow} aria-hidden="true">→</span>
      </div>

      {loading ? (
        <div className={wStyles.empty} style={{ fontStyle: 'italic' }}>Loading headlines…</div>
      ) : articles.length === 0 ? (
        <div className={wStyles.empty}>No headlines available right now.</div>
      ) : (
        <div>
          {articles.map((a, i) => (
            <div key={i} className={wStyles.newsRow}>
              <div className={wStyles.newsRowSource}>{a.source}</div>
              <div className={wStyles.newsRowTitle}>{a.title}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
