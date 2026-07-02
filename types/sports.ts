/**
 * Zenith OS — Sports Tracker types
 *
 * Multi-sport tracker: Soccer, NFL, NBA, NCAAB, NCAAF.
 * Standings + recent results sourced from TheSportsDB via /api/sports proxy.
 */

export type SportId =
  | 'soccer'
  | 'football'
  | 'basketball'
  | 'college-basketball'
  | 'college-football'

export interface League {
  id:         string
  sportId:    SportId
  label:      string
  shortLabel: string
  /** TheSportsDB numeric league id */
  sportsDbId: string
  accent:     string
  hasTable:   boolean
  /** 'cross-year' → "2025-2026"  |  'single' → "2025" */
  seasonFmt:  'cross-year' | 'single'
}

export interface SportCategory {
  id:         SportId
  label:      string
  shortLabel: string
  leagues:    readonly League[]
}

export const SPORT_CATEGORIES: readonly SportCategory[] = [
  {
    id: 'soccer', label: 'Soccer', shortLabel: 'Soccer',
    leagues: [
      { id: 'premier-league',   sportId: 'soccer', label: 'Premier League',   shortLabel: 'EPL',    sportsDbId: '4328', accent: '#7c95ff', hasTable: true,  seasonFmt: 'cross-year' },
      { id: 'la-liga',          sportId: 'soccer', label: 'La Liga',          shortLabel: 'LaLiga', sportsDbId: '4335', accent: '#ee8707', hasTable: true,  seasonFmt: 'cross-year' },
      { id: 'champions-league', sportId: 'soccer', label: 'Champions League', shortLabel: 'UCL',    sportsDbId: '4480', accent: '#52cca3', hasTable: true,  seasonFmt: 'cross-year' },
      { id: 'international',    sportId: 'soccer', label: 'International',    shortLabel: 'INTL',   sportsDbId: '4429', accent: '#f59e0b', hasTable: false, seasonFmt: 'cross-year' },
    ],
  },
  {
    id: 'football', label: 'NFL', shortLabel: 'NFL',
    leagues: [
      { id: 'nfl', sportId: 'football', label: 'NFL', shortLabel: 'NFL', sportsDbId: '4391', accent: '#f87171', hasTable: true, seasonFmt: 'single' },
    ],
  },
  {
    id: 'basketball', label: 'NBA', shortLabel: 'NBA',
    leagues: [
      { id: 'nba', sportId: 'basketball', label: 'NBA', shortLabel: 'NBA', sportsDbId: '4387', accent: '#fb923c', hasTable: true, seasonFmt: 'cross-year' },
    ],
  },
  {
    id: 'college-basketball', label: 'College Basketball', shortLabel: 'NCAAB',
    leagues: [
      { id: 'ncaab', sportId: 'college-basketball', label: 'College Basketball', shortLabel: 'NCAAB', sportsDbId: '4479', accent: '#a78bfa', hasTable: true, seasonFmt: 'cross-year' },
    ],
  },
  {
    id: 'college-football', label: 'College Football', shortLabel: 'NCAAF',
    leagues: [
      { id: 'ncaaf', sportId: 'college-football', label: 'College Football', shortLabel: 'NCAAF', sportsDbId: '4417', accent: '#34d399', hasTable: true, seasonFmt: 'single' },
    ],
  },
] as const

export function getAllLeagues(): League[] {
  return SPORT_CATEGORIES.flatMap(s => [...s.leagues])
}

export function findLeague(leagueId: string): League | undefined {
  return getAllLeagues().find(l => l.id === leagueId)
}

export function findLeagueBySportsDbId(sportsDbId: string): League | undefined {
  return getAllLeagues().find(l => l.sportsDbId === sportsDbId)
}

/** One row in a league/division standings table. */
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
  /** Division name for NFL/NBA conference standings (e.g. "AFC East") */
  division?:    string
}

/** A team the user follows — persisted in localStorage. */
export interface FollowedTeam {
  id:           string
  name:         string
  badge:        string | null
  leagueLabel:  string | null
  /** TheSportsDB numeric league id — used for standings rank lookup */
  leagueDbId:   string | null
  sportId:      SportId | null
  /** Official team website (scheme-normalised to https://), or null. */
  website?:     string | null
}

/** A single recent fixture for a followed team. */
export interface TeamResult {
  eventId:   string
  date:      string          // YYYY-MM-DD
  homeTeam:  string
  awayTeam:  string
  homeScore: number | null
  awayScore: number | null
  league:    string
  outcome:   'W' | 'L' | 'D' | null
}

/** Result of a team search hit. */
export interface TeamSearchHit {
  id:      string
  name:    string
  badge:   string | null
  league:  string | null
  country: string | null
  sport:   string | null
  /** Official team website (scheme-normalised to https://), or null. */
  website: string | null
}

/** A single upcoming fixture for a team (schedule month view). */
export interface TeamFixture {
  eventId:  string
  date:     string          // YYYY-MM-DD
  time:     string | null   // HH:MM (local wall-clock from strTime), or null if unknown
  homeTeam: string
  awayTeam: string
  league:   string
  isHome:   boolean
}
