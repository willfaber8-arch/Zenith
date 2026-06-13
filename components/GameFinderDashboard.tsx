'use client'

import { useState } from 'react'
import { useGameFinder } from '@/lib/hooks/useGameFinder'
import {
  ALL_COST_CATEGORIES,
  ALL_PLATFORMS,
  ALL_GENRES,
  PLATFORM_LABELS,
  GENRE_LABELS,
} from '@/types/gameFinder'
import type { CostCategory, Platform, Genre, PeerGame } from '@/types/gameFinder'
import styles from './GameFinderDashboard.module.css'

/* ── FilterChip ───────────────────────────────────────────── */

interface FilterChipProps {
  label:   string
  active:  boolean
  onClick: () => void
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      onClick={onClick}
      className={`${styles.chip} ${active ? styles.chipActive : ''}`}
    >
      {active && <span className={styles.chipActiveDot} aria-hidden />}
      {label}
    </button>
  )
}

/* ── Cost badge (inside game card) ────────────────────────── */

function CostBadge({ cost }: { cost: CostCategory }) {
  const label = cost === 'FREE' ? 'Free' : cost === 'UNDER_15' ? 'Under $15' : '$15+'
  const cls   = cost === 'FREE' ? styles.costFree
              : cost === 'UNDER_15' ? styles.costUnder15
              : styles.costPremium
  return <span className={`${styles.costBadge} ${cls}`}>{label}</span>
}

/* ── Platform pill (inside game card) ─────────────────────── */

function PlatformPill({ platform }: { platform: Platform }) {
  const cls = platform === 'WEB_BROWSER' ? styles.platWeb
            : platform === 'STEAM'       ? styles.platSteam
            : platform === 'EPIC_GAMES'  ? styles.platEpic
            : styles.platConsole
  return (
    <span className={`${styles.platPill} ${cls}`}>
      {PLATFORM_LABELS[platform]}
    </span>
  )
}

/* ── GameCard ─────────────────────────────────────────────── */

interface GameCardProps {
  game:       PeerGame
  index:      number
  isExpanded: boolean
  onToggle:   () => void
}

function GameCard({ game, index, isExpanded, onToggle }: GameCardProps) {
  return (
    <div
      className={`${styles.card} ${isExpanded ? styles.cardExpanded : ''}`}
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={onToggle}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={`${game.title} — click to ${isExpanded ? 'collapse' : 'expand'}`}
    >
      {/* ── Card header ─────────────────────────── */}
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardTitle}>{game.title}</span>
          <CostBadge cost={game.costCategory} />
        </div>

        <div className={styles.cardMeta}>
          <span className={styles.playerCount}>
            {'[ '}{game.minPlayers}
            {game.minPlayers !== game.maxPlayers ? ` — ${game.maxPlayers}` : ''}
            {' PLAYER'}{game.maxPlayers !== 1 ? 'S' : ''}{' ]'}
          </span>
          <span
            className={styles.expandChevron}
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            aria-hidden
          >
            ▾
          </span>
        </div>
      </div>

      {/* ── Platforms + genres badge row ─────────── */}
      <div className={styles.cardBadgeRow}>
        {game.platforms.map(p => <PlatformPill key={p} platform={p} />)}
        {game.genres.map(g => (
          <span key={g} className={styles.genreTag}>{GENRE_LABELS[g]}</span>
        ))}
      </div>

      {/* ── Expandable description (grid-template-rows trick) ── */}
      <div className={`${styles.descWrapper} ${isExpanded ? styles.descWrapperOpen : ''}`}>
        <div className={styles.descInner}>
          <p className={styles.descText}>{game.description}</p>
          {game.externalLink && (
            <a
              href={game.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.playLink}
              onClick={e => e.stopPropagation()}
            >
              Visit Game Site →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── GameFinderDashboard (main export) ────────────────────── */

export default function GameFinderDashboard() {
  const {
    searchQuery,
    activeCosts,
    activePlatforms,
    activeGenres,
    filteredGames,
    hasActiveFilters,
    totalGames,
    activeFilterCount,
    setSearchQuery,
    toggleCost,
    togglePlatform,
    toggleGenre,
    clearAll,
  } = useGameFinder()

  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggleExpanded(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  /* ── Readable cost chip labels ────────────────────────── */
  const costChipLabel = (c: CostCategory) =>
    c === 'FREE' ? 'Free' : c === 'UNDER_15' ? 'Under $15' : '$15+'

  return (
    <div className={styles.dashboard}>

      {/* ════════════════════════════════════════════════════
          LEFT — Filter Shelf
          ════════════════════════════════════════════════════ */}
      <aside className={styles.filterPanel}>

        {/* Panel header */}
        <div className={styles.filterPanelHeader}>
          <span className={styles.filterPanelTitle}>Filter Matrix</span>
          {activeFilterCount > 0 && (
            <span className={styles.filterCountBadge}>{activeFilterCount}</span>
          )}
        </div>

        {/* Cost */}
        <div className={styles.filterSection}>
          <span className={styles.filterSectionLabel}>Cost</span>
          <div className={styles.chipGroup}>
            {ALL_COST_CATEGORIES.map(c => (
              <FilterChip
                key={c}
                label={costChipLabel(c)}
                active={activeCosts.has(c)}
                onClick={() => toggleCost(c)}
              />
            ))}
          </div>
        </div>

        {/* Platform */}
        <div className={styles.filterSection}>
          <span className={styles.filterSectionLabel}>Platform</span>
          <div className={styles.chipGroup}>
            {ALL_PLATFORMS.map(p => (
              <FilterChip
                key={p}
                label={PLATFORM_LABELS[p]}
                active={activePlatforms.has(p)}
                onClick={() => togglePlatform(p)}
              />
            ))}
          </div>
        </div>

        {/* Genre */}
        <div className={styles.filterSection}>
          <span className={styles.filterSectionLabel}>Genre</span>
          <div className={styles.chipGroup}>
            {ALL_GENRES.map(g => (
              <FilterChip
                key={g}
                label={GENRE_LABELS[g]}
                active={activeGenres.has(g)}
                onClick={() => toggleGenre(g)}
              />
            ))}
          </div>
        </div>

        <div className={styles.filterDivider} />

        {/* Reset button */}
        <button
          type="button"
          onClick={clearAll}
          disabled={!hasActiveFilters}
          className={styles.resetBtn}
        >
          [ Reset All Filter Parameters ]
        </button>

        {/* Entry count */}
        <p className={styles.filterStat}>
          Showing{' '}
          <span className={styles.filterStatNum}>{filteredGames.length}</span>
          {' '}of{' '}
          <span className={styles.filterStatNum}>{totalGames}</span>
          {' '}entries
        </p>

      </aside>

      {/* ════════════════════════════════════════════════════
          RIGHT — Search Terminal + Card Grid
          ════════════════════════════════════════════════════ */}
      <div className={styles.resultsPanel}>

        {/* Search bar */}
        <div className={styles.searchBar}>
          <span className={styles.searchGlyph} aria-hidden>⊕</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search cooperative entries..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search games by title or description"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={styles.searchClear}
              aria-label="Clear search query"
            >
              ✕
            </button>
          )}
        </div>

        {/* Results meta row */}
        <div className={styles.resultsHeader}>
          <span className={styles.resultsCount}>
            {filteredGames.length === 0
              ? 'No entries match'
              : `${filteredGames.length} entr${filteredGames.length === 1 ? 'y' : 'ies'} found`}
          </span>
          {hasActiveFilters && (
            <button type="button" onClick={clearAll} className={styles.inlineClearBtn}>
              clear all filters
            </button>
          )}
        </div>

        {/* Card grid ↔ empty state */}
        {filteredGames.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyGlyph} aria-hidden>◈</span>
            <p className={styles.emptyLabel}>No games match your current filters</p>
            <p className={styles.emptyHint}>Try adjusting cost, platform, or genre constraints</p>
            <button type="button" onClick={clearAll} className={styles.emptyResetBtn}>
              Reset Filters
            </button>
          </div>
        ) : (
          <div className={styles.cardGrid}>
            {filteredGames.map((game, i) => (
              <GameCard
                key={game.id}
                game={game}
                index={i}
                isExpanded={expandedId === game.id}
                onToggle={() => toggleExpanded(game.id)}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
