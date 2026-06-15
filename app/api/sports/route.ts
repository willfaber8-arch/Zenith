/**
 * Zenith OS — Sports data proxy
 *
 * GET /api/sports?action=table&league=4328[&season=2025-2026]
 * GET /api/sports?action=search&q=Arsenal
 * GET /api/sports?action=results&team=133604
 *
 * Server-side proxy to TheSportsDB (free public API). Keeps the
 * upstream key server-side, dodges browser CORS, and lets us normalise
 * the (inconsistent) upstream field names into the shapes in
 * types/sports.ts before they reach the client.
 *
 * The free tier can rate-limit or gate standings; every action degrades
 * gracefully — an empty array + ok:false rather than an error throw — so
 * the UI can show a friendly "unavailable" state instead of crashing.
 */

import { NextRequest, NextResponse } from 'next/server'
import type { StandingRow, TeamResult, TeamSearchHit } from '@/types/sports'

export const revalidate = 600   // 10-minute edge cache

const KEY  = process.env.SPORTSDB_KEY ?? '3'   // '3' is the public test key
const BASE = `https://www.thesportsdb.com/api/v1/json/${KEY}`

/* ── Field pickers (upstream field names vary by endpoint/version) ── */

function str(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v
    if (typeof v === 'number') return String(v)
  }
  return null
}

function num(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  }
  return 0
}

function numOrNull(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  }
  return null
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      signal:  AbortSignal.timeout(12_000),
      headers: { Accept: 'application/json' },
      next:    { revalidate },
    })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

/* ── Current European season string, e.g. "2025-2026" ──────────── */

function currentSeason(): string {
  const now   = new Date()
  const year  = now.getFullYear()
  // Seasons run Aug→May. Before August, the "current" season started last year.
  return now.getMonth() >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

/* ── Action handlers ───────────────────────────────────────────── */

async function getTable(league: string, season: string): Promise<StandingRow[]> {
  const data = await fetchJson(`${BASE}/lookuptable.php?l=${league}&s=${encodeURIComponent(season)}`)
  const rows = (data?.table ?? data?.['table']) as Array<Record<string, unknown>> | null | undefined
  if (!Array.isArray(rows)) return []
  return rows.map((r, i): StandingRow => ({
    rank:         num(r, 'intRank') || i + 1,
    teamId:       str(r, 'idTeam', 'teamid') ?? '',
    teamName:     str(r, 'strTeam', 'name') ?? 'Unknown',
    badge:        str(r, 'strBadge', 'strTeamBadge'),
    played:       num(r, 'intPlayed', 'played'),
    win:          num(r, 'intWin', 'win'),
    draw:         num(r, 'intDraw', 'draw'),
    loss:         num(r, 'intLoss', 'loss'),
    goalsFor:     num(r, 'intGoalsFor', 'goalsfor'),
    goalsAgainst: num(r, 'intGoalsAgainst', 'goalsagainst'),
    goalDiff:     num(r, 'intGoalDifference', 'goalsdifference'),
    points:       num(r, 'intPoints', 'points'),
  }))
}

async function searchTeams(q: string): Promise<TeamSearchHit[]> {
  const data  = await fetchJson(`${BASE}/searchteams.php?t=${encodeURIComponent(q)}`)
  const teams = data?.teams as Array<Record<string, unknown>> | null | undefined
  if (!Array.isArray(teams)) return []
  return teams
    .filter(t => (str(t, 'strSport') ?? '').toLowerCase() === 'soccer')
    .slice(0, 12)
    .map((t): TeamSearchHit => ({
      id:      str(t, 'idTeam') ?? '',
      name:    str(t, 'strTeam') ?? 'Unknown',
      badge:   str(t, 'strBadge', 'strTeamBadge'),
      league:  str(t, 'strLeague'),
      country: str(t, 'strCountry'),
    }))
    .filter(t => t.id)
}

async function getResults(teamId: string): Promise<TeamResult[]> {
  const data    = await fetchJson(`${BASE}/eventslast.php?id=${encodeURIComponent(teamId)}`)
  const results = data?.results as Array<Record<string, unknown>> | null | undefined
  if (!Array.isArray(results)) return []
  return results.slice(0, 8).map((e): TeamResult => {
    const homeId    = str(e, 'idHomeTeam')
    const homeScore = numOrNull(e, 'intHomeScore')
    const awayScore = numOrNull(e, 'intAwayScore')
    const isHome    = homeId === teamId

    let outcome: TeamResult['outcome'] = null
    if (homeScore != null && awayScore != null) {
      const mine  = isHome ? homeScore : awayScore
      const other = isHome ? awayScore : homeScore
      outcome = mine > other ? 'W' : mine < other ? 'L' : 'D'
    }

    return {
      eventId:   str(e, 'idEvent') ?? '',
      date:      str(e, 'dateEvent') ?? '',
      homeTeam:  str(e, 'strHomeTeam') ?? '',
      awayTeam:  str(e, 'strAwayTeam') ?? '',
      homeScore,
      awayScore,
      league:    str(e, 'strLeague') ?? '',
      outcome,
    }
  })
}

/* ── GET handler ───────────────────────────────────────────────── */

export async function GET(req: NextRequest): Promise<Response> {
  const params = req.nextUrl.searchParams
  const action = params.get('action')

  try {
    if (action === 'table') {
      const league = params.get('league')
      if (!league) return NextResponse.json({ error: 'league required' }, { status: 400 })
      const season = params.get('season') || currentSeason()
      const table  = await getTable(league, season)
      return NextResponse.json({ ok: table.length > 0, season, table })
    }

    if (action === 'search') {
      const q = (params.get('q') ?? '').trim()
      if (q.length < 2) return NextResponse.json({ ok: true, teams: [] })
      const teams = await searchTeams(q)
      return NextResponse.json({ ok: true, teams })
    }

    if (action === 'results') {
      const team = params.get('team')
      if (!team) return NextResponse.json({ error: 'team required' }, { status: 400 })
      const results = await getResults(team)
      return NextResponse.json({ ok: results.length > 0, results })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Sports data temporarily unavailable.' }, { status: 502 })
  }
}
