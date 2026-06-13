'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  DEFAULT_PEER_GAMES,
} from '@/types/gameFinder'
import type { CostCategory, Platform, Genre, PeerGame } from '@/types/gameFinder'

/* ── Public interface ─────────────────────────────────────── */

export interface GameFinderState {
  /* ── Query state ──────────────────────────── */
  searchQuery:     string
  activeCosts:     Set<CostCategory>
  activePlatforms: Set<Platform>
  activeGenres:    Set<Genre>

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
  clearAll:        ()                  => void
}

/* ── Hook ─────────────────────────────────────────────────── */

export function useGameFinder(): GameFinderState {
  const [searchQuery,     setSearchQueryState]  = useState('')
  const [activeCosts,     setActiveCosts]       = useState<Set<CostCategory>>(() => new Set())
  const [activePlatforms, setActivePlatforms]   = useState<Set<Platform>>(() => new Set())
  const [activeGenres,    setActiveGenres]      = useState<Set<Genre>>(() => new Set())

  /* ── Stable setters via useCallback([]) ─────────────────── */

  const setSearchQuery = useCallback((q: string) => setSearchQueryState(q), [])

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

      // ── Cost (exact match on single field) ────────────────
      if (activeCosts.size > 0 && !activeCosts.has(game.costCategory)) return false

      // ── Platform (intersection: at least one shared) ──────
      if (activePlatforms.size > 0 && !game.platforms.some(p => activePlatforms.has(p))) return false

      // ── Genre (intersection: at least one shared) ─────────
      if (activeGenres.size > 0 && !game.genres.some(g => activeGenres.has(g))) return false

      return true
    })
  }, [searchQuery, activeCosts, activePlatforms, activeGenres])

  return {
    searchQuery,
    activeCosts,
    activePlatforms,
    activeGenres,
    filteredGames,
    hasActiveFilters,
    totalGames: DEFAULT_PEER_GAMES.length,
    activeFilterCount,
    setSearchQuery,
    toggleCost,
    togglePlatform,
    toggleGenre,
    clearAll,
  }
}
