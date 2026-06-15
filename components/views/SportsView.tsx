'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Sports Tracker
 *
 * Soccer-first multi-league tracker:
 *   • League selector (Premier League / La Liga / Champions League /
 *     International) → live standings table with points, form, GD
 *   • "Your Teams" dashboard — search & follow any team, see each
 *     followed team's recent results as W/D/L form
 *
 * Data via /api/sports (TheSportsDB proxy). Every section degrades
 * gracefully when the free tier returns no data.
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import ZenHeading from '@/components/ui/ZenHeading'
import { useFollowedTeams } from '@/lib/hooks/useFollowedTeams'
import {
  SOCCER_LEAGUES,
  type SoccerLeagueId,
  type SoccerLeague,
  type StandingRow,
  type TeamResult,
  type TeamSearchHit,
  type FollowedTeam,
} from '@/types/sports'
import styles from './SportsView.module.css'

/* ── Badge with letter fallback ────────────────────────────────── */

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

/* ── Form pill (W/D/L) ─────────────────────────────────────────── */

function FormPill({ outcome }: { outcome: TeamResult['outcome'] }) {
  const cls =
    outcome === 'W' ? styles.formWin
    : outcome === 'L' ? styles.formLoss
    : outcome === 'D' ? styles.formDraw
    : styles.formUnknown
  return <span className={`${styles.formPill} ${cls}`}>{outcome ?? '–'}</span>
}

/* ── Standings table ───────────────────────────────────────────── */

function StandingsTable({
  league, rows, loading, onFollow, isFollowed,
}: {
  league:     SoccerLeague
  rows:       StandingRow[] | null
  loading:    boolean
  onFollow:   (row: StandingRow) => void
  isFollowed: (id: string) => boolean
}) {
  if (loading) {
    return <div className={styles.tableState}>Loading {league.label} standings…</div>
  }
  if (!rows || rows.length === 0) {
    return (
      <div className={styles.tableState}>
        Live standings aren&apos;t available for {league.label} right now.
        {!league.hasTable && ' Follow national teams below to track their recent results.'}
      </div>
    )
  }
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thRank}>#</th>
            <th className={styles.thTeam}>Club</th>
            <th>P</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th className={styles.thGd}>GD</th>
            <th className={styles.thPts}>Pts</th>
            <th className={styles.thFollow} aria-label="Follow" />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.teamId || r.teamName} className={styles.row}>
              <td className={styles.tdRank} style={{ '--league-accent': league.accent } as React.CSSProperties}>
                {r.rank}
              </td>
              <td className={styles.tdTeam}>
                <Badge src={r.badge} name={r.teamName} />
                <span className={styles.teamName}>{r.teamName}</span>
              </td>
              <td>{r.played}</td>
              <td>{r.win}</td>
              <td>{r.draw}</td>
              <td>{r.loss}</td>
              <td className={styles.tdGd}>{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
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
        </tbody>
      </table>
    </div>
  )
}

/* ── Followed-team card ────────────────────────────────────────── */

function FollowedCard({
  team, results, onUnfollow,
}: {
  team:       FollowedTeam
  results:    TeamResult[] | undefined
  onUnfollow: (id: string) => void
}) {
  const last = results?.[0]
  return (
    <div className={`${styles.followCard} anim-slide-in`}>
      <div className={styles.followHead}>
        <Badge src={team.badge} name={team.name} size={30} />
        <div className={styles.followInfo}>
          <span className={styles.followName}>{team.name}</span>
          {team.leagueLabel && <span className={styles.followLeague}>{team.leagueLabel}</span>}
        </div>
        <button
          type="button"
          className={styles.unfollowBtn}
          onClick={() => onUnfollow(team.id)}
          aria-label={`Unfollow ${team.name}`}
          title="Unfollow"
        >
          ✕
        </button>
      </div>

      {results === undefined ? (
        <p className={styles.followMeta}>Loading recent form…</p>
      ) : results.length === 0 ? (
        <p className={styles.followMeta}>No recent results found.</p>
      ) : (
        <>
          <div className={styles.formRow} aria-label="Recent form">
            {results.slice(0, 5).map(r => (
              <FormPill key={r.eventId} outcome={r.outcome} />
            ))}
          </div>
          {last && (
            <p className={styles.lastResult}>
              <span className={styles.lastDate}>{last.date}</span>{' '}
              {last.homeTeam} <strong>{last.homeScore ?? '–'}–{last.awayScore ?? '–'}</strong> {last.awayTeam}
            </p>
          )}
        </>
      )}
    </div>
  )
}

/* ── Main view ─────────────────────────────────────────────────── */

export default function SportsView() {
  const { teams, follow, unfollow, isFollowed } = useFollowedTeams()

  const [activeLeague, setActiveLeague] = useState<SoccerLeagueId>('premier-league')
  const [standings,    setStandings]    = useState<StandingRow[] | null>(null)
  const [loadingTable, setLoadingTable] = useState(true)

  const [searchQ,      setSearchQ]      = useState('')
  const [searchHits,   setSearchHits]   = useState<TeamSearchHit[]>([])
  const [searching,    setSearching]    = useState(false)

  const [resultsByTeam, setResultsByTeam] = useState<Record<string, TeamResult[]>>({})
  const fetchingRef = useRef<Set<string>>(new Set())

  const league = useMemo(
    () => SOCCER_LEAGUES.find(l => l.id === activeLeague)!,
    [activeLeague],
  )

  /* ── Standings fetch on league change ─────────────────────── */
  useEffect(() => {
    let cancelled = false
    setStandings(null)
    setLoadingTable(true)
    fetch(`/api/sports?action=table&league=${league.sportsDbId}`)
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
  }, [league.sportsDbId])

  /* ── Debounced team search ────────────────────────────────── */
  useEffect(() => {
    const q = searchQ.trim()
    if (q.length < 2) { setSearchHits([]); setSearching(false); return }
    const ctrl = new AbortController()
    setSearching(true)
    const t = setTimeout(() => {
      fetch(`/api/sports?action=search&q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then((d: { teams?: TeamSearchHit[] }) => {
          setSearchHits(Array.isArray(d.teams) ? d.teams : [])
          setSearching(false)
        })
        .catch(() => { /* aborted or failed */ })
    }, 350)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [searchQ])

  /* ── Lazy-load recent results for each followed team ──────── */
  useEffect(() => {
    teams.forEach(team => {
      if (resultsByTeam[team.id] || fetchingRef.current.has(team.id)) return
      fetchingRef.current.add(team.id)
      fetch(`/api/sports?action=results&team=${encodeURIComponent(team.id)}`)
        .then(r => r.json())
        .then((d: { results?: TeamResult[] }) =>
          setResultsByTeam(prev => ({ ...prev, [team.id]: Array.isArray(d.results) ? d.results : [] })),
        )
        .catch(() =>
          setResultsByTeam(prev => ({ ...prev, [team.id]: [] })),
        )
        .finally(() => { fetchingRef.current.delete(team.id) })
    })
  }, [teams, resultsByTeam])

  const followFromStanding = (row: StandingRow) => {
    if (isFollowed(row.teamId)) { unfollow(row.teamId); return }
    follow({ id: row.teamId, name: row.teamName, badge: row.badge, leagueLabel: league.label })
  }

  const followFromSearch = (hit: TeamSearchHit) => {
    if (isFollowed(hit.id)) { unfollow(hit.id); return }
    follow({ id: hit.id, name: hit.name, badge: hit.badge, leagueLabel: hit.league })
  }

  return (
    <div className={styles.root}>
      <ZenHeading
        eyebrow="Life · Sports Tracker"
        title="Sports."
        subtitle="Follow your clubs and national sides, and track league standings in real time."
        size="md"
      />

      {/* ── League selector ──────────────────────────────────── */}
      <div className={styles.leagueTabs} role="tablist" aria-label="League selector">
        {SOCCER_LEAGUES.map(l => (
          <button
            key={l.id}
            role="tab"
            aria-selected={activeLeague === l.id}
            className={`${styles.leagueTab} ${activeLeague === l.id ? styles.leagueTabActive : ''}`}
            style={{ '--league-accent': l.accent } as React.CSSProperties}
            onClick={() => setActiveLeague(l.id)}
          >
            <span className={styles.leagueDot} aria-hidden="true" />
            {l.label}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {/* ── Standings ──────────────────────────────────────── */}
        <section className={styles.standingsCol}>
          <p className={styles.sectionLabel}>[ {league.shortLabel} STANDINGS ]</p>
          <StandingsTable
            league={league}
            rows={standings}
            loading={loadingTable}
            onFollow={followFromStanding}
            isFollowed={isFollowed}
          />
        </section>

        {/* ── Your teams ─────────────────────────────────────── */}
        <aside className={styles.teamsCol}>
          <p className={styles.sectionLabel}>[ YOUR TEAMS ]</p>

          <div className={styles.searchWrap}>
            <span className={styles.searchGlyph} aria-hidden="true">⊕</span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search any team to follow…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              aria-label="Search teams"
            />
            {searchQ && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setSearchQ('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {searchQ.trim().length >= 2 && (
            <div className={styles.searchResults}>
              {searching && <p className={styles.searchHint}>Searching…</p>}
              {!searching && searchHits.length === 0 && (
                <p className={styles.searchHint}>No teams found for “{searchQ.trim()}”.</p>
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
                    {hit.league && <span className={styles.searchHitLeague}>{hit.league}</span>}
                  </span>
                  <span className={styles.searchHitAction}>
                    {isFollowed(hit.id) ? '★ Following' : '+ Follow'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {teams.length === 0 ? (
            <div className={styles.emptyTeams}>
              <span className={styles.emptyGlyph}>◎</span>
              <p>Follow teams from the standings or the search above to build your dashboard.</p>
            </div>
          ) : (
            <div className={styles.followGrid}>
              {teams.map(team => (
                <FollowedCard
                  key={team.id}
                  team={team}
                  results={resultsByTeam[team.id]}
                  onUnfollow={unfollow}
                />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
