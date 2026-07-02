'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  DEFAULT_PEER_GAMES,
} from '@/types/gameFinder'
import type { CostCategory, Platform, Genre, PeerGame } from '@/types/gameFinder'

/* ── Match modes ──────────────────────────────────────────────
   ANY = union ("include": a game matches if it has at least one
   of the selected values). ALL = intersection ("exclusive": a game
   must have every selected value). */
export type MatchMode = 'ANY' | 'ALL'
export type FilterDimension = 'cost' | 'platform' | 'genre'

/* ── Public interface ─────────────────────────────────────── */

export interface GameFinderState {
  /* ── Query state ──────────────────────────── */
  searchQuery:     string
  activeCosts:     Set<CostCategory>
  activePlatforms: Set<Platform>
  activeGenres:    Set<Genre>
  matchMode:       Record<FilterDimension, MatchMode>

  /* ── Derived metrics ──────────────────────── */
  filteredGames:    PeerGame[]
  hasActiveFilters: boolean
  totalGames:       number
  activeFilterCount: number

  /* ── Mutation actions ─────────────────────── */
  setSearchQuery:  (q: string)         => void
  toggleCost:      (c: CostCategory)   => void
  togglePlatform:  (p: Platform)       => void
  toggleGenre:     (g: Genre)          => void
  setMatchMode:    (d: FilterDimension, m: MatchMode) => void
  clearAll:        ()                  => void
}

/* ── Hook ─────────────────────────────────────────────────── */

export function useGameFinder(): GameFinderState {
  const [searchQuery,     setSearchQueryState]  = useState('')
  const [activeCosts,     setActiveCosts]       = useState<Set<CostCategory>>(() => new Set())
  const [activePlatforms, setActivePlatforms]   = useState<Set<Platform>>(() => new Set())
  const [activeGenres,    setActiveGenres]      = useState<Set<Genre>>(() => new Set())
  const [matchMode,       setMatchModeState]    = useState<Record<FilterDimension, MatchMode>>(
    () => ({ cost: 'ANY', platform: 'ANY', genre: 'ANY' }),
  )

  /* ── Stable setters via useCallback([]) ─────────────────── */

  const setSearchQuery = useCallback((q: string) => setSearchQueryState(q), [])

  const setMatchMode = useCallback((d: FilterDimension, m: MatchMode) => {
    setMatchModeState(prev => ({ ...prev, [d]: m }))
  }, [])

  const toggleCost = useCallback((c: CostCategory) => {
    setActiveCosts(prev => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c); else next.add(c)
      return next
    })
  }, [])

  const togglePlatform = useCallback((p: Platform) => {
    setActivePlatforms(prev => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p); else next.add(p)
      return next
    })
  }, [])

  const toggleGenre = useCallback((g: Genre) => {
    setActiveGenres(prev => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g); else next.add(g)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setSearchQueryState('')
    setActiveCosts(new Set())
    setActivePlatforms(new Set())
    setActiveGenres(new Set())
    setMatchModeState({ cost: 'ANY', platform: 'ANY', genre: 'ANY' })
  }, [])

  /* ── Derived state ────────────────────────────────────────── */

  const activeFilterCount = useMemo(
    () => activeCosts.size + activePlatforms.size + activeGenres.size,
    [activeCosts, activePlatforms, activeGenres]
  )

  const hasActiveFilters = useMemo(
    () => searchQuery !== '' || activeFilterCount > 0,
    [searchQuery, activeFilterCount]
  )

  /**
   * Core filter pipeline — O(n) over the static dataset.
   *
   * Rules:
   *   search query  → game.title OR game.description must contain q (case-insensitive)
   *   activeCosts   → game.costCategory must be in the active set
   *   activePlatforms → game.platforms must share ≥1 entry with the active set
   *   activeGenres  → game.genres must share ≥1 entry with the active set
   *
   * An empty filter set for a dimension means "show all" (no restriction applied).
   */
  const filteredGames = useMemo<PeerGame[]>(() => {
    const q = searchQuery.trim().toLowerCase()

    return DEFAULT_PEER_GAMES.filter(game => {
      // ── Search ────────────────────────────────────────────
      if (
        q &&
        !game.title.toLowerCase().includes(q) &&
        !game.description.toLowerCase().includes(q)
      ) return false

      // ── Cost (single field per game) ──────────────────────
      // ANY = cost is in the selected set. ALL with >1 selected can't be
      // satisfied by one value → yields none (consistent with the mode).
      if (activeCosts.size > 0) {
        const inSet = activeCosts.has(game.costCategory)
        if (matchMode.cost === 'ALL' ? (activeCosts.size > 1 || !inSet) : !inSet) return false
      }

      // ── Platform (ANY = share ≥1; ALL = game has every selected) ──
      if (activePlatforms.size > 0) {
        const ok = matchMode.platform === 'ALL'
          ? [...activePlatforms].every(p => game.platforms.includes(p))
          : game.platforms.some(p => activePlatforms.has(p))
        if (!ok) return false
      }

      // ── Genre (ANY = share ≥1; ALL = game has every selected) ──
      if (activeGenres.size > 0) {
        const ok = matchMode.genre === 'ALL'
          ? [...activeGenres].every(g => game.genres.includes(g))
          : game.genres.some(g => activeGenres.has(g))
        if (!ok) return false
      }

      return true
    })
  }, [searchQuery, activeCosts, activePlatforms, activeGenres, matchMode])

  return {
    searchQuery,
    activeCosts,
    activePlatforms,
    activeGenres,
    matchMode,
    filteredGames,
    hasActiveFilters,
    totalGames: DEFAULT_PEER_GAMES.length,
    activeFilterCount,
    setSearchQuery,
    toggleCost,
    togglePlatform,
    toggleGenre,
    setMatchMode,
    clearAll,
  }
}
