/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Sports Tracker types
 *
 * Soccer-first multi-league tracker. Standings + recent results are
 * sourced from TheSportsDB (free public API) via the /api/sports
 * server proxy (CORS-safe + edge-cached).
 * ════════════════════════════════════════════════════════════════
 */

export type SoccerLeagueId =
  | 'premier-league'
  | 'la-liga'
  | 'champions-league'
  | 'international'

export interface SoccerLeague {
  id:         SoccerLeagueId
  label:      string
  shortLabel: string
  /** TheSportsDB numeric league id (as string) */
  sportsDbId: string
  /** Hex accent used for the league's active tab + badges */
  accent:     string
  /**
   * Whether to attempt a live standings table. Knockout / international
   * competitions often have no league table on the free tier, so the
   * view degrades to "follow teams + recent results" for those.
   */
  hasTable:   boolean
}

/** Ordered league selector. */
export const SOCCER_LEAGUES: readonly SoccerLeague[] = [
  { id: 'premier-league',   label: 'Premier League',   shortLabel: 'EPL',    sportsDbId: '4328', accent: '#7c95ff', hasTable: true  },
  { id: 'la-liga',          label: 'La Liga',          shortLabel: 'LaLiga', sportsDbId: '4335', accent: '#ee8707', hasTable: true  },
  { id: 'champions-league', label: 'Champions League', shortLabel: 'UCL',    sportsDbId: '4480', accent: '#52cca3', hasTable: true  },
  { id: 'international',     label: 'International',     shortLabel: 'INTL',   sportsDbId: '4429', accent: '#f59e0b', hasTable: false },
] as const

/** One row of a league standings table. */
export interface StandingRow {
  rank:         number
  teamId:       string
  teamName:     string
  badge:        string | null
  played:       number
  win:          number
  draw:         number
  loss:         number
  goalsFor:     number
  goalsAgainst: number
  goalDiff:     number
  points:       number
}

/** A team the user follows (persisted in localStorage). */
export interface FollowedTeam {
  id:          string
  name:        string
  badge:       string | null
  leagueLabel: string | null
}

/** A single recent fixture for a followed team. */
export interface TeamResult {
  eventId:   string
  date:      string                  // YYYY-MM-DD
  homeTeam:  string
  awayTeam:  string
  homeScore: number | null
  awayScore: number | null
  league:    string
  /** Outcome relative to the followed team (null if score unavailable). */
  outcome:   'W' | 'L' | 'D' | null
}

/** Result of a team search. */
export interface TeamSearchHit {
  id:     string
  name:   string
  badge:  string | null
  league: string | null
  country: string | null
}
