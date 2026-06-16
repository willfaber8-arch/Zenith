'use client'

import { useLiveQuery }  from 'dexie-react-hooks'
import { useState, useEffect } from 'react'
import { db }            from '@/lib/db'
import { useNav }        from '@/lib/NavContext'
import { hexToRgba }     from '@/lib/nav-config'
import styles from './Widget.module.css'

const UNI_BRAND_KEY = 'zenith_uni_brand_v1'

export default function UniHubWidget() {
  const { navigate } = useNav()

  const profile = useLiveQuery(
    () => db?.userProfile.get(1),
    [],
  )

  const [brandColor, setBrandColor] = useState<string | null>(null)
  useEffect(() => {
    const read = () => {
      try { setBrandColor(localStorage.getItem(UNI_BRAND_KEY)) } catch { /* noop */ }
    }
    read()
    window.addEventListener('storage', read)
    window.addEventListener('zenith:uni-brand-change', read)
    return () => {
      window.removeEventListener('storage', read)
      window.removeEventListener('zenith:uni-brand-change', read)
    }
  }, [])

  const uniName   = profile?.universityName || null
  const majorName = profile?.majorIdentifier || null

  const brandStyle = brandColor
    ? {
        '--widget-accent': brandColor,
        '--accent-purple': brandColor,
        '--accent-purple-dim': hexToRgba(brandColor, 0.35),
        '--border-subtle': hexToRgba(brandColor, 0.10),
      } as React.CSSProperties
    : { '--widget-accent': 'var(--accent-purple)' } as React.CSSProperties

  return (
    <div
      className={`${styles.card} ${styles.clickable}`}
      onClick={() => navigate('uni-hub', 'essentials')}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate('uni-hub', 'essentials')}
      aria-label="University Hub"
      style={brandStyle}
    >
      <div className={styles.cardHeader}>
        <p className={styles.eyebrow}>University Hub</p>
        <span className={styles.navArrow} aria-hidden="true">›</span>
      </div>

      <p className={styles.widgetTitle}>
        {uniName ?? 'Not configured'}
      </p>

      <div className={styles.widgetBody}>
        {uniName ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {majorName && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {majorName}
              </p>
            )}
            <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>
              Resources, GPA calculator &amp; more →
            </p>
          </div>
        ) : (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)' }}>
            Set up your university in University Hub
          </p>
        )}
      </div>
    </div>
  )
}
