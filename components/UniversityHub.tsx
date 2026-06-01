'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — UniversityHub
 * Phase 2 · Step 2.3 — Polymorphic University Search & Content Node
 *
 * Receives a fully-loaded UniversityConfig (Cornell or future schools)
 * and renders a responsive grid of resource link cards, grouped
 * into the university's functional categories.
 *
 * Card anatomy:
 *   • Tag pill      — category hint, monospace, top-left
 *   • Title         — prominent heading, display font
 *   • Description   — two-line guiding summary, muted
 *   • Link action   — "Open portal →" micro-text, accent on hover
 *
 * The entire card surface is an <a> link so the click target is
 * maximised on touch screens, with a keyboard-reachable focus ring.
 * ════════════════════════════════════════════════════════════════
 */

import type { UniversityConfig, UniversityEntry } from '@/config/universities'
import styles from './UniversityHub.module.css'

interface UniversityHubProps {
  config:  UniversityConfig
  entry:   UniversityEntry
  onReset: () => void
}

export default function UniversityHub({
  config,
  entry,
  onReset,
}: UniversityHubProps) {

  /* Total link count across all categories */
  const totalLinks = config.categories.reduce(
    (acc, cat) => acc + cat.links.length, 0,
  )

  return (
    <div className={`${styles.wrap} anim-scale-in`}>

      {/* ── Hub header ────────────────────────────────────── */}
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

      {/* ── Category sections ─────────────────────────────── */}
      <div className={styles.categories}>
        {config.categories.map((cat, catIdx) => (
          <section
            key={cat.id}
            className={`${styles.category} anim-slide-in`}
            style={{ animationDelay: `${catIdx * 80}ms` }}
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
                  {/* Tag pill */}
                  {link.tag && (
                    <span className={styles.tag} aria-hidden="true">
                      {link.tag}
                    </span>
                  )}

                  {/* Title */}
                  <h3 className={styles.cardTitle}>{link.title}</h3>

                  {/* Description */}
                  <p className={styles.cardDesc}>{link.description}</p>

                  {/* Link action — accent on card hover via CSS */}
                  <span className={styles.linkAction} aria-hidden="true">
                    Open portal →
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
