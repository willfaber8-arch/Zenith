'use client'

import { useState, useEffect } from 'react'
import GreetingHero      from '@/components/GreetingHero'
import GoogleSearchHUD   from '@/components/GoogleSearchHUD'
import BiomeWidget       from '@/components/BiomeWidget'
import WidgetSandbox     from '@/components/WidgetSandbox'
import FreeWidgetCanvas  from '@/components/FreeWidgetCanvas'
import styles from './HomeView.module.css'

type LayoutMode = 'classic' | 'free'
const MODE_KEY = 'zenith_layout_mode_v1'

export default function HomeView() {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('classic')
  const [modeMounted, setModeMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY) as LayoutMode | null
      if (saved === 'classic' || saved === 'free') setLayoutMode(saved)
    } catch { /* noop */ }
    setModeMounted(true)
  }, [])

  const switchMode = (mode: LayoutMode) => {
    setLayoutMode(mode)
    try { localStorage.setItem(MODE_KEY, mode) } catch { /* noop */ }
  }

  return (
    <>
      {/* ── Floating mode switcher — top-right of home view ── */}
      {modeMounted && (
        <div className={styles.modeSwitcher} aria-label="Dashboard layout mode">
          <button
            type="button"
            className={`${styles.modeChip} ${layoutMode === 'classic' ? styles.modeChipActive : ''}`}
            onClick={() => switchMode('classic')}
            aria-pressed={layoutMode === 'classic'}
          >
            Classic
          </button>
          <button
            type="button"
            className={`${styles.modeChip} ${layoutMode === 'free' ? styles.modeChipActive : ''}`}
            onClick={() => switchMode('free')}
            aria-pressed={layoutMode === 'free'}
          >
            Free
          </button>
        </div>
      )}

      {/* ── Classic mode: greeting + search + biome + widgets ─ */}
      {layoutMode === 'classic' && (
        <>
          <GreetingHero />
          <GoogleSearchHUD />
          <div className={styles.biomeWrap}>
            <BiomeWidget />
          </div>
          <div className={styles.showcase} data-tour="widgets">
            <section className="anim-fade-in">
              <WidgetSandbox />
            </section>
          </div>
        </>
      )}

      {/* ── Free mode: single drag canvas handles everything ── */}
      {layoutMode === 'free' && <div data-tour="widgets"><FreeWidgetCanvas /></div>}
    </>
  )
}
