'use client'

/**
 * Zenith OS — Sports Tracker
 *
 * Dashboard-first multi-sport tracker. On load, if the user follows any
 * teams, a "My Teams" dashboard is shown at the top with recent form +
 * current standing. Below that, the League Browser lets users explore
 * standings and follow new teams across Soccer, NFL, NBA, NCAAB, NCAAF.
 *
 * Data: /api/sports proxy → TheSportsDB (CORS-safe, edge-cached 10 min).
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useFollowedTeams } from '@/lib/hooks/useFollowedTeams'
import {
  SPORT_CATEGORIES,
  findLeagueBySportsDbId,
  type SportId,
  type League,
  type StandingRow,
  type TeamResult,
  type TeamSearchHit,
  type FollowedTeam,
} from '@/types/sports'
import styles from './SportsView.module.css'

/* ════════════════════════════════════════════
   Shared sub-components
   ════════════════════════════════════════════ */

/** Team badge with letter fallback. */
function Badge({ src, name, size = 24 }: { src: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <span
        className={styles.badgeFallback}
        style={{ width: size, height: size, fontSize: size * 0.42 }}
        aria-hidden="true"
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={styles.badgeImg}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  )
}

/** W / D / L form pill. */
function FormPill({ outcome }: { outcome: TeamResult['outcome'] }) {
  const cls =
    outcome === 'W' ? styles.formWin
    : outcome === 'L' ? styles.formLoss
    : outcome === 'D' ? styles.formDraw
    : styles.formUnknown
  return <span className={`${styles.formPill} ${cls}`}>{outcome ?? '–'}</span>
}

/** SVG magnifying glass — reliable cross-platform search icon. */
function SearchIcon() {
  return (
    <svg
      width="13" height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="5.5" cy="5.5" r="4" />
      <line x1="8.7" y1="8.7" x2="12" y2="12" />
    </svg>
  )
}

/* ════════════════════════════════════════════
   My Teams dashboard card
   ════════════════════════════════════════════ */

function DashboardCard({
  team,
  results,
  standingRow,
  onUnfollow,
}: {
  team:        FollowedTeam
  results:     TeamResult[] | undefined
  standingRow: StandingRow | undefined
  onUnfollow:  (id: string) => void
}) {
  const last    = results?.[0]
  const loading = results === undefined

  return (
    <div className={`${styles.dashCard} anim-slide-in`}>
      {/* Header */}
      <div className={styles.dashHead}>
        <Badge src={team.badge} name={team.name} size={32} />
        <div className={styles.dashInfo}>
          <span className={styles.dashName}>{team.name}</span>
          {team.leagueLabel && (
            <span className={styles.dashLeague}>{team.leagueLabel}</span>
          )}
        </div>
        <button
          type="button"
          className={styles.unfollowBtn}
          onClick={() => onUnfollow(team.id)}
          aria-label={`Unfollow ${team.name}`}
          title="Unfollow"
        >✕</button>
      </div>

      {/* Standing rank chip */}
      {standingRow && (
        <div className={styles.rankChip}>
          <span className={styles.rankNum}>#{standingRow.rank}</span>
          {standingRow.division
            ? <span className={styles.rankLabel}>{standingRow.division}</span>
            : team.leagueLabel && <span className={styles.rankLabel}>{team.leagueLabel}</span>
          }
          <span className={styles.rankStat}>{standingRow.win}W–{standingRow.loss}L</span>
        </div>
      )}

      {/* Recent form */}
      {loading ? (
        <p className={styles.dashMeta}>Loading…</p>
      ) : results.length === 0 ? (
        <p className={styles.dashMeta}>No recent results.</p>
      ) : (
        <>
          <div className={styles.formRow} aria-label="Recent form (last 5)">
            {results.slice(0, 5).map(r => (
              <FormPill key={r.eventId} outcome={r.outcome} />
            ))}
          </div>
          {last && (
            <p className={styles.lastResult}>
              <span className={styles.lastDate}>{last.date}</span>{' '}
              {last.homeTeam}{' '}
              <strong>{last.homeScore ?? '–'}–{last.awayScore ?? '–'}</strong>{' '}
              {last.awayTeam}
            </p>
          )}
        </>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════
   Standings table
   ════════════════════════════════════════════ */

function StandingsTable({
  league,
  rows,
  loading,
  onFollow,
  isFollowed,
}: {
  league:     League
  rows:       StandingRow[] | null
  loading:    boolean
  onFollow:   (row: StandingRow) => void
  isFollowed: (id: string) => boolean
}) {
  const isSoccer = league.sportId === 'soccer'

  if (loading) {
    return <div className={styles.tableState}>Loading {league.label} standings…</div>
  }
  if (!rows || rows.length === 0) {
    return (
      <div className={styles.tableState}>
        Live standings aren&apos;t available for {league.label} right now.
        {!league.hasTable && ' Follow teams below to track their recent results.'}
      </div>
    )
  }

  /* Group by division for NFL / NBA conference standings */
  const hasDivisions = rows.some(r => r.division)
  type DivGroup = { division: string | null; rows: StandingRow[] }
  const groups: DivGroup[] = hasDivisions
    ? Object.entries(
        rows.reduce<Record<string, StandingRow[]>>((acc, r) => {
          const div = r.division ?? 'Other'
          ;(acc[div] ??= []).push(r)
          return acc
        }, {}),
      ).map(([division, rs]) => ({ division, rows: rs }))
    : [{ division: null, rows }]

  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thRank}>#</th>
            <th className={styles.thTeam}>Team</th>
            <th>W</th>
            <th>L</th>
            <th>{isSoccer ? 'D' : 'T'}</th>
            {isSoccer && <th className={styles.thGd}>GD</th>}
            <th className={styles.thPts}>{isSoccer ? 'Pts' : 'Pts'}</th>
            <th className={styles.thFollow} aria-label="Follow" />
          </tr>
        </thead>
        <tbody>
          {groups.map(({ division, rows: groupRows }) => (
            <>
              {division && (
                <tr key={`div-${division}`} className={styles.divisionRow}>
                  <td
                    colSpan={isSoccer ? 9 : 8}
                    className={styles.divisionCell}
                    style={{ '--league-accent': league.accent } as React.CSSProperties}
                  >
                    {division}
                  </td>
                </tr>
              )}
              {groupRows.map(r => (
                <tr key={r.teamId || r.teamName} className={styles.row}>
                  <td
                    className={styles.tdRank}
                    style={{ '--league-accent': league.accent } as React.CSSProperties}
                  >
                    {r.rank}
                  </td>
                  <td className={styles.tdTeam}>
                    <Badge src={r.badge} name={r.teamName} />
                    <span className={styles.teamName}>{r.teamName}</span>
                  </td>
                  <td>{r.win}</td>
                  <td>{r.loss}</td>
                  <td>{r.draw}</td>
                  {isSoccer && (
                    <td className={styles.tdGd}>
                      {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                    </td>
                  )}
                  <td className={styles.tdPts}>{r.points}</td>
                  <td className={styles.tdFollow}>
                    <button
                      type="button"
                      className={`${styles.starBtn} ${isFollowed(r.teamId) ? styles.starBtnOn : ''}`}
                      onClick={() => onFollow(r)}
                      disabled={!r.teamId}
                      aria-label={isFollowed(r.teamId) ? `Unfollow ${r.teamName}` : `Follow ${r.teamName}`}
                      title={isFollowed(r.teamId) ? 'Following' : 'Follow team'}
                    >
                      {isFollowed(r.teamId) ? '★' : '☆'}
                    </button>
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ════════════════════════════════════════════
   Main view
   ════════════════════════════════════════════ */

export default function SportsView() {
  const { teams, follow, unfollow, isFollowed } = useFollowedTeams()

  /* ── Sport / league browser state ─────────────────────────────── */
  const [activeSport,    setActiveSport]    = useState<SportId>('soccer')
  const [activeLeagueId, setActiveLeagueId] = useState<string>('premier-league')
  const [standings,      setStandings]      = useState<StandingRow[] | null>(null)
  const [loadingTable,   setLoadingTable]   = useState(true)

  /* ── Search state ──────────────────────────────────────────────── */
  const [searchQ,    setSearchQ]    = useState('')
  const [searchHits, setSearchHits] = useState<TeamSearchHit[]>([])
  const [searching,  setSearching]  = useState(false)

  /* ── Dashboard data ────────────────────────────────────────────── */
  const [resultsByTeam,    setResultsByTeam]    = useState<Record<string, TeamResult[]>>({})
  const [standingsByLeague, setStandingsByLeague] = useState<Record<string, StandingRow[]>>({})
  const fetchingResultsRef  = useRef<Set<string>>(new Set())
  const fetchingLeagueRef   = useRef<Set<string>>(new Set())

  /* ── Derived state ─────────────────────────────────────────────── */
  const sport = useMemo(
    () => SPORT_CATEGORIES.find(s => s.id === activeSport)!,
    [activeSport],
  )

  const league = useMemo(
    () => sport.leagues.find(l => l.id === activeLeagueId) ?? sport.leagues[0],
    [sport, activeLeagueId],
  )

  /* ── Switch sport → reset to first league ──────────────────────── */
  const selectSport = useCallback((id: SportId) => {
    const s = SPORT_CATEGORIES.find(c => c.id === id)!
    setActiveSport(id)
    setActiveLeagueId(s.leagues[0].id)
    setSearchQ('')
    setSearchHits([])
  }, [])

  /* ── Fetch standings for the active league ─────────────────────── */
  useEffect(() => {
    let cancelled = false
    setStandings(null)
    setLoadingTable(true)
    fetch(`/api/sports?action=table&league=${league.sportsDbId}&seasonFmt=${league.seasonFmt}`)
      .then(r => r.json())
      .then((d: { table?: StandingRow[] }) => {
        if (cancelled) return
        setStandings(Array.isArray(d.table) ? d.table : [])
        setLoadingTable(false)
      })
      .catch(() => {
        if (cancelled) return
        setStandings([])
        setLoadingTable(false)
      })
    return () => { cancelled = true }
  }, [league.sportsDbId, league.seasonFmt])

  /* ── Debounced team search ─────────────────────────────────────── */
  useEffect(() => {
    const q = searchQ.trim()
    if (q.length < 2) { setSearchHits([]); setSearching(false); return }
    const ctrl = new AbortController()
    setSearching(true)
    const t = setTimeout(() => {
      fetch(
        `/api/sports?action=search&q=${encodeURIComponent(q)}&sport=${activeSport}`,
        { signal: ctrl.signal },
      )
        .then(r => r.json())
        .then((d: { teams?: TeamSearchHit[] }) => {
          setSearchHits(Array.isArray(d.teams) ? d.teams : [])
          setSearching(false)
        })
        .catch(() => { /* aborted */ })
    }, 350)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [searchQ, activeSport])

  /* ── Lazy-load results for each followed team ──────────────────── */
  useEffect(() => {
    teams.forEach(team => {
      if (resultsByTeam[team.id] !== undefined || fetchingResultsRef.current.has(team.id)) return
      fetchingResultsRef.current.add(team.id)
      fetch(`/api/sports?action=results&team=${encodeURIComponent(team.id)}`)
        .then(r => r.json())
        .then((d: { results?: TeamResult[] }) =>
          setResultsByTeam(prev => ({ ...prev, [team.id]: d.results ?? [] })),
        )
        .catch(() => setResultsByTeam(prev => ({ ...prev, [team.id]: [] })))
        .finally(() => fetchingResultsRef.current.delete(team.id))
    })
  }, [teams, resultsByTeam])

  /* ── Fetch standings for dashboard rank lookup ─────────────────── */
  useEffect(() => {
    const uniqueLeagueDbIds = [...new Set(
      teams.map(t => t.leagueDbId).filter(Boolean) as string[],
    )]
    uniqueLeagueDbIds.forEach(dbId => {
      if (standingsByLeague[dbId] !== undefined || fetchingLeagueRef.current.has(dbId)) return
      const l = findLeagueBySportsDbId(dbId)
      const fmt = l?.seasonFmt ?? 'cross-year'
      fetchingLeagueRef.current.add(dbId)
      fetch(`/api/sports?action=table&league=${dbId}&seasonFmt=${fmt}`)
        .then(r => r.json())
        .then((d: { table?: StandingRow[] }) =>
          setStandingsByLeague(prev => ({ ...prev, [dbId]: d.table ?? [] })),
        )
        .catch(() => setStandingsByLeague(prev => ({ ...prev, [dbId]: [] })))
        .finally(() => fetchingLeagueRef.current.delete(dbId))
    })
  }, [teams, standingsByLeague])

  /* ── Follow handlers ───────────────────────────────────────────── */
  const followFromStanding = useCallback((row: StandingRow) => {
    if (isFollowed(row.teamId)) { unfollow(row.teamId); return }
    follow({
      id:          row.teamId,
      name:        row.teamName,
      badge:       row.badge,
      leagueLabel: league.label,
      leagueDbId:  league.sportsDbId,
      sportId:     league.sportId,
    })
  }, [isFollowed, unfollow, follow, league])

  const followFromSearch = useCallback((hit: TeamSearchHit) => {
    if (isFollowed(hit.id)) { unfollow(hit.id); return }
    follow({
      id:          hit.id,
      name:        hit.name,
      badge:       hit.badge,
      leagueLabel: hit.league,
      leagueDbId:  null,
      sportId:     activeSport,
    })
  }, [isFollowed, unfollow, follow, activeSport])

  /* ── Look up a followed team's standing row ────────────────────── */
  const getStandingRow = useCallback((team: FollowedTeam): StandingRow | undefined => {
    if (!team.leagueDbId) return undefined
    const rows = standingsByLeague[team.leagueDbId]
    return rows?.find(r => r.teamId === team.id)
  }, [standingsByLeague])

  /* ════════════════════════════════════════════
     Render
     ════════════════════════════════════════════ */
  return (
    <div className={styles.root}>
      {/* ── My Teams Dashboard ───────────────────────────────────── */}
      {teams.length > 0 && (
        <section className={styles.dashSection}>
          <p className={styles.sectionLabel}>[ MY TEAMS ]</p>
          <div className={styles.dashGrid}>
            {teams.map(team => (
              <DashboardCard
                key={team.id}
                team={team}
                results={resultsByTeam[team.id]}
                standingRow={getStandingRow(team)}
                onUnfollow={unfollow}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── League Browser ───────────────────────────────────────── */}
      <section className={styles.browserSection}>
        <p className={styles.sectionLabel}>[ LEAGUE BROWSER ]</p>

        {/* Sport category tabs */}
        <div className={styles.sportTabs} role="tablist" aria-label="Sport category">
          {SPORT_CATEGORIES.map(s => (
            <button
              key={s.id}
              role="tab"
              aria-selected={activeSport === s.id}
              className={`${styles.sportTab} ${activeSport === s.id ? styles.sportTabActive : ''}`}
              onClick={() => selectSport(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* League tabs within the active sport */}
        {sport.leagues.length > 1 && (
          <div className={styles.leagueTabs} role="tablist" aria-label="League selector">
            {sport.leagues.map(l => (
              <button
                key={l.id}
                role="tab"
                aria-selected={activeLeagueId === l.id}
                className={`${styles.leagueTab} ${activeLeagueId === l.id ? styles.leagueTabActive : ''}`}
                style={{ '--league-accent': l.accent } as React.CSSProperties}
                onClick={() => setActiveLeagueId(l.id)}
              >
                <span className={styles.leagueDot} aria-hidden="true" />
                {l.label}
              </button>
            ))}
          </div>
        )}

        {/* Main browser grid: standings + search */}
        <div className={styles.grid}>
          {/* Standings */}
          <section className={styles.standingsCol}>
            <p className={styles.sectionLabel} style={{ '--league-accent': league.accent } as React.CSSProperties}>
              [ {league.shortLabel} STANDINGS ]
            </p>
            <StandingsTable
              league={league}
              rows={standings}
              loading={loadingTable}
              onFollow={followFromStanding}
              isFollowed={isFollowed}
            />
          </section>

          {/* Search to follow */}
          <aside className={styles.teamsCol}>
            <p className={styles.sectionLabel}>[ FOLLOW TEAMS ]</p>

            <div className={styles.searchWrap}>
              <span className={styles.searchGlyph}>
                <SearchIcon />
              </span>
              <input
                type="search"
                className={styles.searchInput}
                placeholder={`Search ${sport.label} teams…`}
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                aria-label="Search teams to follow"
              />
              {searchQ && (
                <button
                  type="button"
                  className={styles.searchClear}
                  onClick={() => { setSearchQ(''); setSearchHits([]) }}
                  aria-label="Clear search"
                >✕</button>
              )}
            </div>

            {searchQ.trim().length >= 2 && (
              <div className={styles.searchResults}>
                {searching && <p className={styles.searchHint}>Searching…</p>}
                {!searching && searchHits.length === 0 && (
                  <p className={styles.searchHint}>No {sport.label} teams found for &ldquo;{searchQ.trim()}&rdquo;.</p>
                )}
                {searchHits.map(hit => (
                  <button
                    key={hit.id}
                    type="button"
                    className={styles.searchHit}
                    onClick={() => followFromSearch(hit)}
                  >
                    <Badge src={hit.badge} name={hit.name} size={22} />
                    <span className={styles.searchHitName}>
                      {hit.name}
                      {hit.league && (
                        <span className={styles.searchHitLeague}>{hit.league}</span>
                      )}
                    </span>
                    <span className={styles.searchHitAction}>
                      {isFollowed(hit.id) ? '★ Following' : '+ Follow'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {teams.length === 0 && searchQ.trim().length < 2 && (
              <div className={styles.emptyTeams}>
                <span className={styles.emptyGlyph}>◎</span>
                <p>Follow teams from the standings or search above to build your dashboard.</p>
              </div>
            )}

            {teams.length > 0 && searchQ.trim().length < 2 && (
              <div className={styles.followedCount}>
                <span className={styles.followedCountNum}>{teams.length}</span>
                {' '}team{teams.length !== 1 ? 's' : ''} followed · manage in the dashboard above
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}
