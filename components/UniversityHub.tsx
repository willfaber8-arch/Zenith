'use client'

import { useState } from 'react'
import type { UniversityConfig, UniversityEntry, UniTab } from '@/config/universities'
import styles from './UniversityHub.module.css'

interface UniversityHubProps {
  config:  UniversityConfig
  entry:   UniversityEntry
  onReset: () => void
}

const TAB_LABELS: Record<UniTab, string> = {
  academics:  'Academics & Registration',
  career:     'Career Development',
  campus:     'Campus Life',
  essentials: 'Essentials',
}

export default function UniversityHub({ config, entry, onReset }: UniversityHubProps) {
  const [activeTab, setActiveTab] = useState<UniTab>('academics')

  /* Categories for the active tab */
  const visibleCats = config.categories.filter(c => c.tab === activeTab)
  const totalLinks  = config.categories.reduce((acc, c) => acc + c.links.length, 0)

  /* Which tabs have data */
  const availableTabs = (Object.keys(TAB_LABELS) as UniTab[]).filter(
    tab => config.categories.some(c => c.tab === tab),
  )

  return (
    <div className={`${styles.wrap} anim-scale-in`}>

      {/* ── Hub header ──────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerMeta}>
          <p className={styles.eyebrow}>Scholastic · University Hub</p>
          <h1 className={styles.uniName}>{config.name}</h1>
          <p className={styles.subline}>
            <span className={styles.sublineChip}>{config.location}</span>
            <span className={styles.sublineDot} aria-hidden="true">·</span>
            <span className={styles.sublineChip}>{totalLinks} resources</span>
          </p>
        </div>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={onReset}
          aria-label="Change university"
        >
          Change ↗
        </button>
      </header>

      <div className={styles.divider} aria-hidden="true" />

      {/* ── Resource sub-tabs ────────────────────────────────── */}
      <div className={styles.resourceTabBar} role="tablist" aria-label="Resource sections">
        {availableTabs.map(tab => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`${styles.resourceTab} ${activeTab === tab ? styles.resourceTabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── Category sections for the active tab ────────────── */}
      <div className={styles.categories}>
        {visibleCats.length === 0 ? (
          <p className={styles.emptyTab}>No resources configured for this section.</p>
        ) : (
          visibleCats.map((cat, catIdx) => (
            <section
              key={cat.id}
              className={`${styles.category} anim-slide-in`}
              style={{ animationDelay: `${catIdx * 60}ms` }}
              aria-labelledby={`cat-${cat.id}`}
            >
              <p id={`cat-${cat.id}`} className={styles.categoryLabel}>
                {cat.label}
              </p>

              <div className={styles.grid} role="list">
                {cat.links.map(link => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.card}
                    role="listitem"
                    aria-label={`${link.title} — opens in a new tab`}
                  >
                    {link.tag && <span className={styles.tag} aria-hidden="true">{link.tag}</span>}
                    <h3 className={styles.cardTitle}>{link.title}</h3>
                    <p className={styles.cardDesc}>{link.description}</p>
                    <span className={styles.linkAction} aria-hidden="true">Open →</span>
                  </a>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

    </div>
  )
}
