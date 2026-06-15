'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — useFollowedTeams
 *
 * Lightweight localStorage store for the teams a user follows in the
 * Sports tracker. No IDB / Supabase — this is a small, device-local
 * preference list (key: zenith_followed_teams_v1).
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react'
import type { FollowedTeam } from '@/types/sports'

const STORAGE_KEY = 'zenith_followed_teams_v1'

function read(): FollowedTeam[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as FollowedTeam[]) : []
  } catch {
    return []
  }
}

function write(teams: FollowedTeam[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teams))
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export interface UseFollowedTeamsReturn {
  teams:      FollowedTeam[]
  mounted:    boolean
  isFollowed: (id: string) => boolean
  follow:     (team: FollowedTeam) => void
  unfollow:   (id: string) => void
}

export function useFollowedTeams(): UseFollowedTeamsReturn {
  const [teams, setTeams]   = useState<FollowedTeam[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTeams(read())
    setMounted(true)

    // Cross-tab sync — reflect follows made in another tab.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setTeams(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const follow = useCallback((team: FollowedTeam) => {
    setTeams(prev => {
      if (prev.some(t => t.id === team.id)) return prev
      const next = [...prev, team]
      write(next)
      return next
    })
  }, [])

  const unfollow = useCallback((id: string) => {
    setTeams(prev => {
      const next = prev.filter(t => t.id !== id)
      write(next)
      return next
    })
  }, [])

  const isFollowed = useCallback(
    (id: string) => teams.some(t => t.id === id),
    [teams],
  )

  return { teams, mounted, isFollowed, follow, unfollow }
}
