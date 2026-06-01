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

import type { MajorConfig, MajorEntry } from '@/config/majors'
import styles from './MajorHub.module.css'

interface MajorHubProps {
  config:  MajorConfig
  entry:   MajorEntry
  onReset: () => void
}

export default function MajorHub({ config, onReset }: MajorHubProps) {
  const totalLinks = config.categories.reduce(
    (acc, cat) => acc + cat.links.length, 0,
  )

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

      {/* ── Category sections ─────────────────────────────── */}
      <div className={styles.categories}>
        {config.categories.map((cat, catIdx) => (
          <section
            key={cat.id}
            className={`${styles.category} anim-slide-in`}
            style={{ animationDelay: `${catIdx * 80}ms` }}
            aria-labelledby={`major-cat-${cat.id}`}
          >

            <p id={`major-cat-${cat.id}`} className={styles.categoryLabel}>
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
        ))}
      </div>

    </div>
  )
}
