'use client'

import { useEffect, useState } from 'react'
import { useAuth }         from '@/lib/AuthContext'
import { useNav }          from '@/lib/NavContext'
import { useCopilot }      from '@/lib/CopilotContext'
import { useWeather }      from '@/lib/hooks/useWeather'
import { NAV_CONFIG, CATEGORY_ACCENT, type CategoryId } from '@/lib/nav-config'
import SyncIndicator from './SyncIndicator'
import CosmeticPointsIndicator from './navigation/CosmeticPointsIndicator'
import NotificationBell from './NotificationBell'
import ModuleSearch from './ModuleSearch'
import Icon from '@/components/ui/Icon'
import { weatherIcon } from '@/lib/weatherIcons'
import styles from './Topbar.module.css'

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
  const { status: wStatus, weather } = useWeather()

  /* ── Live clock ─────────────────────────────────────────── */
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  /* ── Breadcrumb ─────────────────────────────────────────── */
  const catConfig = activeCategory
    ? NAV_CONFIG.find(c => c.id === activeCategory)
    : null

  /* Views reached from the sidebar footer carry no category, so they fell
     through to the generic 'Zenith OS' label. On a phone the breadcrumb is
     the only "you are here" signal, so name them explicitly. */
  const SYSTEM_VIEW_LABELS: Record<string, string> = {
    settings: 'Settings',
    help:     'Help & Feedback',
  }

  let viewLabel: string = SYSTEM_VIEW_LABELS[activeView] ?? 'Zenith OS'
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
  /* The chip is an icon beside a number now, so the two parts are kept
     separate rather than concatenated into one string. */
  let weatherStr = '— °'
  let weatherCondition: string | null = null
  if (wStatus === 'idle' || wStatus === 'loading') weatherStr = '·· °'
  if (wStatus === 'ok' && weather) {
    weatherCondition = weather.condition
    weatherStr = `${weather.tempF}°F`
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

        {/*
          Each cluster member is wrapped in a priority slot so the mobile
          media queries can drop the low-value ones without leaving an
          orphan divider behind. Priority order (last to survive first):
            essential → avatar, notifications, AI
            medium    → module search
            low       → sync chip, clock, credits, weather
        */}

        {/* Module finder — jump to any Zenith view by name or keyword */}
        {session && (
          <span className={`${styles.slot} ${styles.slotMedium}`}>
            <ModuleSearch />
            <span className={styles.divider} aria-hidden="true" />
          </span>
        )}

        {/* Weather — hidden when geolocation is denied */}
        {wStatus !== 'denied' && (
          <span className={`${styles.slot} ${styles.slotLow}`}>
            <span
              className={styles.weatherChip}
              aria-label="Current weather"
              suppressHydrationWarning
            >
              {weatherCondition && <Icon name={weatherIcon(weatherCondition)} size={14} />}
              {weatherStr}
            </span>
            <span className={styles.divider} aria-hidden="true" />
          </span>
        )}

        {/* Sync status micro-indicator */}
        <span className={`${styles.slot} ${styles.slotLow}`}>
          <SyncIndicator />
          <span className={styles.divider} aria-hidden="true" />
        </span>

        {/* In-app notification bell — only shown when a session is active */}
        {session && (
          <span className={styles.slot}>
            <NotificationBell />
            <span className={styles.divider} aria-hidden="true" />
          </span>
        )}

        {/* AI Co-Pilot toggle — only shown when a session is active */}
        {session && (
          <span className={styles.slot}>
            <button
              type="button"
              className={`${styles.copilotBtn} ${copilotOpen ? styles.copilotBtnActive : ''}`}
              onClick={toggleCopilot}
              aria-label={copilotOpen ? 'Close Co-Pilot' : 'Open AI Co-Pilot'}
              data-tour="copilot"
              aria-expanded={copilotOpen}
              title="AI Co-Pilot"
            >
              <span className={styles.copilotIcon} aria-hidden="true">◎</span>
              <span className={styles.copilotLabel}>AI</span>
            </button>
            <span className={styles.divider} aria-hidden="true" />
          </span>
        )}

        {/* Live clock */}
        <span className={`${styles.slot} ${styles.slotLow}`}>
          <time
            className={styles.clock}
            aria-label="System time"
            suppressHydrationWarning
          >
            {now ? fmtTime(now) : '--:--'}
          </time>
          <span className={styles.divider} aria-hidden="true" />
        </span>

        {/* Cosmetic Points balance — only visible when authenticated */}
        {session && (
          <span className={`${styles.slot} ${styles.slotLow}`}>
            <CosmeticPointsIndicator />
            <span className={styles.divider} aria-hidden="true" />
          </span>
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
