'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { useState }     from 'react'
import { db }           from '@/lib/db'
import { useNav }       from '@/lib/NavContext'
import wStyles from './Widget.module.css'

function Favicon({ url, label }: { url: string; label: string }) {
  const [errored, setErrored] = useState(false)
  let domain = ''
  try { domain = new URL(url).hostname } catch { /* noop */ }
  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : ''

  if (!domain || errored) {
    return (
      <div className={wStyles.qlFaviconFallback} aria-hidden="true">
        {label.charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <img
      src={faviconUrl}
      alt=""
      className={wStyles.qlFavicon}
      onError={() => setErrored(true)}
    />
  )
}

export default function QuickLinksWidget() {
  const { navigate } = useNav()

  const bookmarks = useLiveQuery(
    () => db.customBookmarks.toArray().then(all =>
      all.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0)).slice(0, 6)
    ),
    [],
  ) ?? []

  return (
    <div className={wStyles.card}>
      <div className={wStyles.cardHeader}>
        <div>
          <div className={wStyles.eyebrow}>Vault</div>
          <div className={wStyles.title}>Quick Links</div>
        </div>
        <button
          className={wStyles.navArrow}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => navigate('custom-links', 'vault')}
          aria-label="Open Custom Links"
        >
          →
        </button>
      </div>

      {bookmarks.length === 0 ? (
        <div className={wStyles.empty}>No links saved yet. Add some in Custom Links.</div>
      ) : (
        <div className={wStyles.qlGrid}>
          {bookmarks.map(b => (
            <a
              key={b.id}
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              className={wStyles.qlItem}
              title={b.label}
            >
              <Favicon url={b.url} label={b.label} />
              <span className={wStyles.qlLabel}>{b.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
