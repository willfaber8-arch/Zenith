'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — MajorHub
 * Phase 2 · Step 2.4 — Major-Specific Link Matrix & Resource Hub
 *
 * Receives a fully-loaded MajorConfig and renders a responsive
 * grid of resource link cards grouped into functional categories.
 * Structurally mirrors UniversityHub — same card anatomy, same
 * hover/focus model, same entry animation pattern.
 *
 * Mounted with key={majorIdentifier} by MajorHubView so that
 * switching majors replays the anim-scale-in entrance animation.
 * ════════════════════════════════════════════════════════════════
 */

import { useState } from 'react'
import type { MajorConfig, MajorEntry } from '@/config/majors'
import styles from './MajorHub.module.css'

interface MajorHubProps {
  config:  MajorConfig
  entry:   MajorEntry
  onReset: () => void
}

export default function MajorHub({ config, onReset }: MajorHubProps) {
  const [activeCategory, setActiveCategory] = useState<string>(
    config.categories[0]?.id ?? '',
  )

  const totalLinks = config.categories.reduce(
    (acc, cat) => acc + cat.links.length, 0,
  )

  const visibleCat = config.categories.find(c => c.id === activeCategory)
    ?? config.categories[0]

  return (
    <div className={`${styles.wrap} anim-scale-in`}>

      {/* ── Hub header ────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerMeta}>
          <p className={styles.eyebrow}>Scholastic · Major Hub</p>
          <h1 className={styles.majorName}>{config.name}</h1>
          <p className={styles.subline}>
            <span className={styles.sublineChip}>{config.department}</span>
            <span className={styles.sublineDot} aria-hidden="true">·</span>
            <span className={styles.sublineChip}>{totalLinks} resources</span>
          </p>
        </div>

        <button
          type="button"
          className={styles.resetBtn}
          onClick={onReset}
          aria-label="Change declared major"
        >
          Change ↗
        </button>
      </header>

      <div className={styles.divider} aria-hidden="true" />

      {/* ── Category tab bar ──────────────────────────────── */}
      <div className={styles.categoryTabBar} role="tablist" aria-label="Major resource categories">
        {config.categories.map(cat => (
          <button
            key={cat.id}
            role="tab"
            aria-selected={activeCategory === cat.id}
            className={`${styles.categoryTab} ${activeCategory === cat.id ? styles.categoryTabActive : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Active category links ──────────────────────────── */}
      {visibleCat && (
        <section
          key={visibleCat.id}
          className={`${styles.category} anim-fade-in`}
          aria-labelledby={`major-cat-${visibleCat.id}`}
        >
          <div className={styles.grid} role="list">
            {visibleCat.links.map(link => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.card}
                role="listitem"
                aria-label={`${link.title} — opens in a new tab`}
              >
                {link.tag && (
                  <span className={styles.tag} aria-hidden="true">
                    {link.tag}
                  </span>
                )}

                <h3 className={styles.cardTitle}>{link.title}</h3>

                <p className={styles.cardDesc}>{link.description}</p>

                <span className={styles.linkAction} aria-hidden="true">
                  Open resource →
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
