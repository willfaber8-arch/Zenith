'use client'

import { useEffect, useState } from 'react'
import { useAuth }         from '@/lib/AuthContext'
import { useNav }          from '@/lib/NavContext'
import { useCopilot }      from '@/lib/CopilotContext'
import { fetchWeather, type WeatherData } from '@/lib/weather'
import { NAV_CONFIG, CATEGORY_ACCENT, type CategoryId } from '@/lib/nav-config'
import SyncIndicator from './SyncIndicator'
import CosmeticPointsIndicator from './navigation/CosmeticPointsIndicator'
import styles from './Topbar.module.css'

const WMO_ICONS: Record<string, string> = {
  'Clear sky':                  '☀',
  'Mainly clear':               '🌤',
  'Partly cloudy':              '⛅',
  'Overcast':                   '☁',
  'Foggy':                      '🌫',
  'Icy fog':                    '🌫',
  'Light drizzle':              '🌦',
  'Drizzle':                    '🌦',
  'Heavy drizzle':              '🌧',
  'Light rain':                 '🌦',
  'Rain':                       '🌧',
  'Heavy rain':                 '🌧',
  'Light snow':                 '🌨',
  'Snow':                       '❄',
  'Heavy snow':                 '❄',
  'Snow grains':                '🌨',
  'Rain showers':               '🌦',
  'Showers':                    '🌧',
  'Heavy showers':              '🌧',
  'Snow showers':               '🌨',
  'Heavy snow showers':         '❄',
  'Thunderstorm':               '⛈',
  'Thunderstorm w/ hail':       '⛈',
  'Thunderstorm w/ heavy hail': '⛈',
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

interface TopbarProps {
  sidebarOpen:     boolean
  onToggleSidebar: () => void
}

export default function Topbar({ sidebarOpen, onToggleSidebar }: TopbarProps) {
  const { session }                       = useAuth()
  const { activeView, activeCategory }    = useNav()
  const { isOpen: copilotOpen, toggle: toggleCopilot } = useCopilot()

  const [now,     setNow]     = useState<Date | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [wStatus, setWStatus] = useState<'idle' | 'loading' | 'done' | 'denied'>('idle')

  /* ── Live clock ─────────────────────────────────────────── */
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  /* ── Weather (one-shot on mount, geolocation-gated) ─────── */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setWStatus('denied')
      return
    }
    setWStatus('loading')
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const data = await fetchWeather(coords.latitude, coords.longitude)
        setWeather(data)
        setWStatus('done')
      },
      () => setWStatus('denied'),
      { timeout: 6000 },
    )
  }, [])

  /* ── Breadcrumb ─────────────────────────────────────────── */
  const catConfig = activeCategory
    ? NAV_CONFIG.find(c => c.id === activeCategory)
    : null

  let viewLabel: string = 'Zenith OS'
  if (activeView === 'home') {
    viewLabel = 'Home'
  } else if (catConfig) {
    const allLinks = [
      ...(catConfig.subcategories?.flatMap(s => s.links) ?? []),
      ...(catConfig.links ?? []),
    ]
    viewLabel = allLinks.find(l => l.id === activeView)?.label ?? 'Zenith OS'
  }

  const accentColor = activeCategory
    ? CATEGORY_ACCENT[activeCategory as CategoryId]
    : 'var(--accent-purple)'

  /* ── Weather display string ─────────────────────────────── */
  let weatherStr = '— °'
  if (wStatus === 'loading') weatherStr = '·· °'
  if (wStatus === 'done' && weather) {
    const icon = WMO_ICONS[weather.condition] ?? '·'
    weatherStr = `${icon} ${weather.tempF}°F`
  }

  /* ── User display ───────────────────────────────────────── */
  const handle   = session?.userHandle ?? '—'
  const initials = handle !== '—' ? handle.slice(0, 2).toUpperCase() : '?'

  return (
    <header className={styles.topbar}>

      {/* ── Mobile sidebar toggle (hidden on desktop via CSS) ─ */}
      <button
        type="button"
        className={`${styles.menuToggle} ${sidebarOpen ? styles.menuToggleActive : ''}`}
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={sidebarOpen}
        aria-controls="sidebar"
      >
        <span className={styles.bar} />
        <span className={styles.bar} />
        <span className={styles.bar} />
      </button>

      {/* ── Active view breadcrumb ───────────────────────────── */}
      <div className={styles.breadcrumb} aria-label="Active view">
        <span
          className={styles.breadView}
          style={{ color: accentColor }}
        >
          {viewLabel}
        </span>
      </div>

      {/* ── Right status cluster ─────────────────────────────── */}
      <div className={styles.cluster} role="status" aria-label="System status">

        {/* Weather — hidden when geolocation is denied */}
        {wStatus !== 'denied' && (
          <>
            <span
              className={styles.weatherChip}
              aria-label="Current weather"
              suppressHydrationWarning
            >
              {weatherStr}
            </span>
            <span className={styles.divider} aria-hidden="true" />
          </>
        )}

        {/* Sync status micro-indicator */}
        <SyncIndicator />

        <span className={styles.divider} aria-hidden="true" />

        {/* AI Co-Pilot toggle — only shown when a session is active */}
        {session && (
          <>
            <button
              type="button"
              className={`${styles.copilotBtn} ${copilotOpen ? styles.copilotBtnActive : ''}`}
              onClick={toggleCopilot}
              aria-label={copilotOpen ? 'Close Co-Pilot' : 'Open AI Co-Pilot'}
              aria-expanded={copilotOpen}
              title="AI Co-Pilot (⌘ K)"
            >
              <span className={styles.copilotIcon} aria-hidden="true">◎</span>
              <span className={styles.copilotLabel}>AI</span>
            </button>
            <span className={styles.divider} aria-hidden="true" />
          </>
        )}

        {/* Live clock */}
        <time
          className={styles.clock}
          aria-label="System time"
          suppressHydrationWarning
        >
          {now ? fmtTime(now) : '--:--'}
        </time>

        <span className={styles.divider} aria-hidden="true" />

        {/* Cosmetic Points balance — only visible when authenticated */}
        {session && (
          <>
            <CosmeticPointsIndicator />
            <span className={styles.divider} aria-hidden="true" />
          </>
        )}

        {/* User profile chip */}
        <div
          className={styles.userChip}
          aria-label={`Signed in as ${handle}`}
        >
          <div className={styles.avatar} aria-hidden="true">{initials}</div>
          <span className={styles.handle}>{handle}</span>
        </div>

      </div>
    </header>
  )
}
