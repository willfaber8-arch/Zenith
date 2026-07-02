'use client'

/**
 * Zenith OS — Sports Tracker
 *
 * Dashboard-first multi-sport tracker. On load, if the user follows any
 * teams, a "My Teams" dashboard is shown at the top with recent form +
 * current standing. Below that, the League Browser lets users explore
 * standings, and a curated Team Directory lets users browse & follow teams
 * across Soccer, NFL, NBA, NCAAB, NCAAF without hammering the API.
 *
 * Clicking any team (dashboard, standings row, directory) opens a Team
 * Detail panel: recent form, standing, official site, follow toggle, and an
 * upcoming-fixtures month calendar. A toggle bridges followed games into the
 * Universal Calendar and enables 24h game reminders.
 *
 * Data: /api/sports proxy → TheSportsDB (CORS-safe, edge-cached 10 min).
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useFollowedTeams } from '@/lib/hooks/useFollowedTeams'
import { useGameNotifications } from '@/lib/hooks/useGameNotifications'
import { syncFollowedGamesToCalendar, type FixturesByTeam } from '@/utils/sportsCalendarSync'
import {
  SPORT_CATEGORIES,
  findLeagueBySportsDbId,
  type SportId,
  type League,
  type StandingRow,
  type TeamResult,
  type TeamSearchHit,
  type TeamFixture,
  type FollowedTeam,
} from '@/types/sports'
import {
  TEAM_DIRECTORY_BY_GROUP,
  type DirectoryTeam,
} from '@/config/sports/teamDirectory'
import styles from './SportsView.module.css'

/* ════════════════════════════════════════════
   Constants
   ════════════════════════════════════════════ */

const CAL_TOGGLE_KEY = 'zenith_sports_cal_sync_v1'
const DEFAULT_ACCENT = 'var(--accent-green)'

const SPORT_LABEL: Record<SportId, string> = {
  soccer:               'Soccer',
  football:             'NFL',
  basketball:           'NBA',
  'college-basketball': 'College Basketball',
  'college-football':   'College Football',
}

const DIRECTORY_SPORT_ORDER: SportId[] = [
  'basketball', 'football', 'college-football', 'college-basketball',
]

/** Accent for a followed team's league (for calendar colour). */
function accentForLeagueDbId(dbId: string | null | undefined): string {
  const l = dbId ? findLeagueBySportsDbId(dbId) : undefined
  return l?.accent ?? '#52cca3'
}

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

/** Official-site external link. */
function SiteLink({ href }: { href: string | null | undefined }) {
  if (!href) return null
  return (
    <a
      className={styles.siteLink}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
    >
      Official site ↗
    </a>
  )
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
  onOpen,
}: {
  team:        FollowedTeam
  results:     TeamResult[] | undefined
  standingRow: StandingRow | undefined
  onUnfollow:  (id: string) => void
  onOpen:      (team: FollowedTeam) => void
}) {
  const last    = results?.[0]
  const loading = results === undefined

  return (
    <div
      className={`${styles.dashCard} ${styles.clickable} anim-slide-in`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(team)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(team) } }}
    >
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
          onClick={e => { e.stopPropagation(); onUnfollow(team.id) }}
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

      {team.website && (
        <div className={styles.dashFooter}>
          <SiteLink href={team.website} />
        </div>
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
  onOpenRow,
  isFollowed,
}: {
  league:     League
  rows:       StandingRow[] | null
  loading:    boolean
  onFollow:   (row: StandingRow) => void
  onOpenRow:  (row: StandingRow) => void
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
            <th className={styles.thPts}>Pts</th>
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
                <tr
                  key={r.teamId || r.teamName}
                  className={`${styles.row} ${r.teamId ? styles.rowClickable : ''}`}
                  onClick={() => { if (r.teamId) onOpenRow(r) }}
                >
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
                      onClick={e => { e.stopPropagation(); onFollow(r) }}
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
   Schedule month grid (upcoming fixtures)
   ════════════════════════════════════════════ */

const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** 42-cell (6×7) Monday-start grid for a given month. */
function monthGridDays(year: number, month: number): Date[] {
  const first  = new Date(year, month, 1)
  const dow    = first.getDay()          // 0=Sun
  const offset = dow === 0 ? 6 : dow - 1
  const start  = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ScheduleMonth({
  fixtures,
  teamName,
  loading,
  accent,
}: {
  fixtures: TeamFixture[] | undefined
  teamName: string
  loading:  boolean
  accent:   string
}) {
  /* Anchor to the first fixture's month if available, else current month. */
  const anchor = useMemo(() => {
    const first = fixtures?.[0]
    if (first) {
      const [y, m] = first.date.split('-').map(Number)
      if (y && m) return { year: y, month: m - 1 }
    }
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  }, [fixtures])

  const [year, setYear]   = useState(anchor.year)
  const [month, setMonth] = useState(anchor.month)

  useEffect(() => { setYear(anchor.year); setMonth(anchor.month) }, [anchor.year, anchor.month])

  const byDate = useMemo(() => {
    const map: Record<string, TeamFixture[]> = {}
    for (const f of fixtures ?? []) {
      ;(map[f.date] ??= []).push(f)
    }
    return map
  }, [fixtures])

  const days = useMemo(() => monthGridDays(year, month), [year, month])
  const todayStr = localDateStr(new Date())

  const prev = () => {
    setMonth(m => { if (m === 0) { setYear(y => y - 1); return 11 } return m - 1 })
  }
  const next = () => {
    setMonth(m => { if (m === 11) { setYear(y => y + 1); return 0 } return m + 1 })
  }

  if (loading) {
    return <div className={styles.scheduleState}>Loading upcoming schedule…</div>
  }

  const fixtureCount = fixtures?.length ?? 0

  return (
    <div className={styles.schedule}>
      <div className={styles.scheduleNav}>
        <button type="button" className={styles.schedNavBtn} onClick={prev} aria-label="Previous month">‹</button>
        <span className={styles.schedMonthLabel}>{MONTH_FMT.format(new Date(year, month, 1))}</span>
        <button type="button" className={styles.schedNavBtn} onClick={next} aria-label="Next month">›</button>
      </div>

      {fixtureCount === 0 ? (
        <div className={styles.scheduleState}>
          No upcoming fixtures are published for {teamName} yet. The free data tier lists a limited
          window of scheduled games — check back closer to game week.
        </div>
      ) : (
        <>
          <div className={styles.monthColHeaders}>
            {DOW_LABELS.map(d => <span key={d} className={styles.monthColHead}>{d}</span>)}
          </div>
          <div className={styles.monthCells}>
            {days.map((d, i) => {
              const ds       = localDateStr(d)
              const inMonth  = d.getMonth() === month
              const isToday  = ds === todayStr
              const dayFix   = byDate[ds] ?? []
              return (
                <div
                  key={i}
                  className={`${styles.monthCell} ${inMonth ? '' : styles.monthCellOut} ${isToday ? styles.monthCellToday : ''}`}
                >
                  <span className={`${styles.monthCellNum} ${isToday ? styles.monthCellNumToday : ''}`}>
                    {d.getDate()}
                  </span>
                  {dayFix.map(f => (
                    <span
                      key={f.eventId}
                      className={styles.monthEvt}
                      style={{ '--league-accent': accent } as React.CSSProperties}
                      title={`${f.homeTeam} vs ${f.awayTeam}${f.time ? ` · ${f.time}` : ''}`}
                    >
                      {f.time ? `${f.time} ` : ''}
                      {f.isHome ? 'vs ' : '@ '}
                      {f.isHome ? f.awayTeam : f.homeTeam}
                    </span>
                  ))}
                </div>
              )
            })}
          </div>
          <p className={styles.scheduleNote}>
            {fixtureCount} upcoming fixture{fixtureCount !== 1 ? 's' : ''} listed.
          </p>
        </>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════
   Team detail modal
   ════════════════════════════════════════════ */

interface DetailTarget {
  id:          string
  name:        string
  badge:       string | null
  leagueLabel: string | null
  leagueDbId:  string | null
  sportId:     SportId | null
  website:     string | null
}

function TeamDetailModal({
  target,
  results,
  fixtures,
  fixturesLoading,
  standingRow,
  isFollowed,
  onToggleFollow,
  onClose,
}: {
  target:          DetailTarget
  results:         TeamResult[] | undefined
  fixtures:        TeamFixture[] | undefined
  fixturesLoading: boolean
  standingRow:     StandingRow | undefined
  isFollowed:      boolean
  onToggleFollow:  () => void
  onClose:         () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const accent = accentForLeagueDbId(target.leagueDbId)
  const loading = results === undefined

  return (
    <div className={styles.modalBackdrop} onClick={onClose} role="presentation">
      <div
        className={`${styles.modal} anim-scale-in`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${target.name} detail`}
      >
        <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">✕</button>

        {/* Header */}
        <div className={styles.modalHead}>
          <Badge src={target.badge} name={target.name} size={44} />
          <div className={styles.modalHeadInfo}>
            <span className={styles.modalName}>{target.name}</span>
            {target.leagueLabel && <span className={styles.modalLeague}>{target.leagueLabel}</span>}
          </div>
        </div>

        {/* Meta row: rank + follow + site */}
        <div className={styles.modalMetaRow}>
          {standingRow && (
            <span className={styles.rankChip}>
              <span className={styles.rankNum}>#{standingRow.rank}</span>
              {standingRow.division && <span className={styles.rankLabel}>{standingRow.division}</span>}
              <span className={styles.rankStat}>{standingRow.win}W–{standingRow.loss}L</span>
            </span>
          )}
          <button
            type="button"
            className={`${styles.followToggle} ${isFollowed ? styles.followToggleOn : ''}`}
            onClick={onToggleFollow}
          >
            {isFollowed ? '★ Following' : '+ Follow'}
          </button>
          <SiteLink href={target.website} />
        </div>

        {/* Recent form */}
        <div className={styles.modalSection}>
          <p className={styles.modalSectionLabel}>Recent form</p>
          {loading ? (
            <p className={styles.dashMeta}>Loading…</p>
          ) : results.length === 0 ? (
            <p className={styles.dashMeta}>No recent results published.</p>
          ) : (
            <>
              <div className={styles.formRow}>
                {results.slice(0, 6).map(r => <FormPill key={r.eventId} outcome={r.outcome} />)}
              </div>
              <ul className={styles.resultList}>
                {results.slice(0, 5).map(r => (
                  <li key={r.eventId} className={styles.resultItem}>
                    <span className={styles.lastDate}>{r.date}</span>
                    <span className={styles.resultTeams}>
                      {r.homeTeam} <strong>{r.homeScore ?? '–'}–{r.awayScore ?? '–'}</strong> {r.awayTeam}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Schedule */}
        <div className={styles.modalSection}>
          <p className={styles.modalSectionLabel}>Upcoming schedule</p>
          <ScheduleMonth
            fixtures={fixtures}
            teamName={target.name}
            loading={fixturesLoading}
            accent={accent}
          />
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   Team Directory browse section
   ════════════════════════════════════════════ */

function TeamDirectory({
  activeSport,
  filter,
  onFilter,
  isFollowedName,
  pending,
  onPick,
}: {
  activeSport:    SportId
  filter:         string
  onFilter:       (v: string) => void
  isFollowedName: (name: string) => boolean
  pending:        string | null
  onPick:         (team: DirectoryTeam) => void
}) {
  const groups = TEAM_DIRECTORY_BY_GROUP[activeSport] ?? []
  const q = filter.trim().toLowerCase()

  const filteredGroups = useMemo(() => {
    if (!q) return groups
    return groups
      .map(g => ({ ...g, teams: g.teams.filter(t => t.name.toLowerCase().includes(q)) }))
      .filter(g => g.teams.length > 0)
  }, [groups, q])

  if (groups.length === 0) {
    return (
      <p className={styles.searchHint}>
        No curated directory for {SPORT_LABEL[activeSport]} — use search above to follow teams.
      </p>
    )
  }

  return (
    <div className={styles.directory}>
      <div className={styles.searchWrap}>
        <span className={styles.searchGlyph}><SearchIcon /></span>
        <input
          type="search"
          className={styles.searchInput}
          placeholder={`Filter ${SPORT_LABEL[activeSport]} teams…`}
          value={filter}
          onChange={e => onFilter(e.target.value)}
          aria-label="Filter directory teams"
        />
        {filter && (
          <button
            type="button"
            className={styles.searchClear}
            onClick={() => onFilter('')}
            aria-label="Clear filter"
          >✕</button>
        )}
      </div>

      {filteredGroups.length === 0 ? (
        <p className={styles.searchHint}>No teams match &ldquo;{filter.trim()}&rdquo;.</p>
      ) : (
        <div className={styles.dirScroll}>
          {filteredGroups.map(g => (
            <div key={g.conference} className={styles.dirGroup}>
              <p className={styles.dirGroupLabel}>{g.conference}</p>
              <div className={styles.dirGrid}>
                {g.teams.map(t => {
                  const followed = isFollowedName(t.name)
                  const isPending = pending === t.name
                  return (
                    <button
                      key={t.name}
                      type="button"
                      className={`${styles.dirTeam} ${followed ? styles.dirTeamOn : ''}`}
                      onClick={() => onPick(t)}
                      disabled={isPending}
                    >
                      <span className={styles.dirTeamName}>{t.name}</span>
                      <span className={styles.dirTeamAction}>
                        {isPending ? '…' : followed ? '★' : '+'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════
   Main view
   ════════════════════════════════════════════ */

export default function SportsView() {
  const { teams, follow, unfollow, isFollowed } = useFollowedTeams()
  const notifications = useGameNotifications()

  /* ── Sport / league browser state ─────────────────────────────── */
  const [activeSport,    setActiveSport]    = useState<SportId>('soccer')
  const [activeLeagueId, setActiveLeagueId] = useState<string>('premier-league')
  const [standings,      setStandings]      = useState<StandingRow[] | null>(null)
  const [loadingTable,   setLoadingTable]   = useState(true)

  /* ── Search state ──────────────────────────────────────────────── */
  const [searchQ,    setSearchQ]    = useState('')
  const [searchHits, setSearchHits] = useState<TeamSearchHit[]>([])
  const [searching,  setSearching]  = useState(false)

  /* ── Directory state ───────────────────────────────────────────── */
  const [dirFilter,  setDirFilter]  = useState('')
  const [dirPending, setDirPending] = useState<string | null>(null)

  /* ── Dashboard / detail data ───────────────────────────────────── */
  const [resultsByTeam,     setResultsByTeam]     = useState<Record<string, TeamResult[]>>({})
  const [standingsByLeague, setStandingsByLeague] = useState<Record<string, StandingRow[]>>({})
  const [fixturesByTeam,    setFixturesByTeam]    = useState<Record<string, TeamFixture[]>>({})
  const fetchingResultsRef  = useRef<Set<string>>(new Set())
  const fetchingLeagueRef   = useRef<Set<string>>(new Set())
  const fetchingFixturesRef = useRef<Set<string>>(new Set())

  /* ── Team detail modal ─────────────────────────────────────────── */
  const [detail, setDetail] = useState<DetailTarget | null>(null)

  /* ── Calendar-sync toggle ──────────────────────────────────────── */
  const [calSync, setCalSync] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setCalSync(localStorage.getItem(CAL_TOGGLE_KEY) === '1')
  }, [])

  /* ── Derived state ─────────────────────────────────────────────── */
  const sport = useMemo(
    () => SPORT_CATEGORIES.find(s => s.id === activeSport)!,
    [activeSport],
  )

  const league = useMemo(
    () => sport.leagues.find(l => l.id === activeLeagueId) ?? sport.leagues[0],
    [sport, activeLeagueId],
  )

  const followedNames = useMemo(
    () => new Set(teams.map(t => t.name.toLowerCase())),
    [teams],
  )
  const isFollowedName = useCallback(
    (name: string) => followedNames.has(name.toLowerCase()),
    [followedNames],
  )

  /* ── Switch sport → reset to first league ──────────────────────── */
  const selectSport = useCallback((id: SportId) => {
    const s = SPORT_CATEGORIES.find(c => c.id === id)!
    setActiveSport(id)
    setActiveLeagueId(s.leagues[0].id)
    setSearchQ('')
    setSearchHits([])
    setDirFilter('')
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

  /* ── Lazy-load upcoming fixtures for each followed team ─────────── */
  useEffect(() => {
    teams.forEach(team => {
      if (fixturesByTeam[team.id] !== undefined || fetchingFixturesRef.current.has(team.id)) return
      fetchingFixturesRef.current.add(team.id)
      fetch(`/api/sports?action=schedule&team=${encodeURIComponent(team.id)}`)
        .then(r => r.json())
        .then((d: { fixtures?: TeamFixture[] }) =>
          setFixturesByTeam(prev => ({ ...prev, [team.id]: d.fixtures ?? [] })),
        )
        .catch(() => setFixturesByTeam(prev => ({ ...prev, [team.id]: [] })))
        .finally(() => fetchingFixturesRef.current.delete(team.id))
    })
  }, [teams, fixturesByTeam])

  /* ── Ensure the detail target has its fixtures loaded ──────────── */
  useEffect(() => {
    if (!detail) return
    const id = detail.id
    if (fixturesByTeam[id] !== undefined || fetchingFixturesRef.current.has(id)) return
    fetchingFixturesRef.current.add(id)
    fetch(`/api/sports?action=schedule&team=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then((d: { fixtures?: TeamFixture[] }) =>
        setFixturesByTeam(prev => ({ ...prev, [id]: d.fixtures ?? [] })),
      )
      .catch(() => setFixturesByTeam(prev => ({ ...prev, [id]: [] })))
      .finally(() => fetchingFixturesRef.current.delete(id))
  }, [detail, fixturesByTeam])

  /* Ensure the detail target has recent results loaded */
  useEffect(() => {
    if (!detail) return
    const id = detail.id
    if (resultsByTeam[id] !== undefined || fetchingResultsRef.current.has(id)) return
    fetchingResultsRef.current.add(id)
    fetch(`/api/sports?action=results&team=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then((d: { results?: TeamResult[] }) =>
        setResultsByTeam(prev => ({ ...prev, [id]: d.results ?? [] })),
      )
      .catch(() => setResultsByTeam(prev => ({ ...prev, [id]: [] })))
      .finally(() => fetchingResultsRef.current.delete(id))
  }, [detail, resultsByTeam])

  /* ── Calendar sync + notification scan when data / toggle change ── */
  useEffect(() => {
    if (!calSync) return
    const payload: FixturesByTeam = {}
    const accents: Record<string, string> = {}
    teams.forEach(t => {
      const fx = fixturesByTeam[t.id]
      if (fx && fx.length > 0) {
        payload[t.id] = fx
        accents[t.id] = accentForLeagueDbId(t.leagueDbId)
      }
    })
    if (Object.keys(payload).length === 0) return
    void syncFollowedGamesToCalendar(payload, accents)
    notifications.scan(payload)
  }, [calSync, teams, fixturesByTeam, notifications])

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
      website:     hit.website ?? null,
    })
  }, [isFollowed, unfollow, follow, activeSport])

  /* ── Follow a curated directory team (resolve via API first) ───── */
  const followFromDirectory = useCallback(async (t: DirectoryTeam) => {
    // If already followed by name, unfollow it.
    const existing = teams.find(f => f.name.toLowerCase() === t.name.toLowerCase())
    if (existing) { unfollow(existing.id); return }

    setDirPending(t.name)
    try {
      const res = await fetch(
        `/api/sports?action=search&q=${encodeURIComponent(t.name)}&sport=${t.sportId}`,
      )
      const data = (await res.json()) as { teams?: TeamSearchHit[] }
      const hits = Array.isArray(data.teams) ? data.teams : []
      // Prefer an exact name match, else the first hit.
      const hit =
        hits.find(h => h.name.toLowerCase() === t.name.toLowerCase()) ?? hits[0]
      if (!hit) return
      follow({
        id:          hit.id,
        name:        hit.name,
        badge:       hit.badge,
        leagueLabel: hit.league ?? t.conference,
        leagueDbId:  null,
        sportId:     t.sportId,
        website:     hit.website ?? t.website ?? null,
      })
    } catch {
      /* resolution failed — leave unfollowed */
    } finally {
      setDirPending(null)
    }
  }, [teams, unfollow, follow])

  /* ── Open detail panels ────────────────────────────────────────── */
  const openFollowed = useCallback((team: FollowedTeam) => {
    setDetail({
      id:          team.id,
      name:        team.name,
      badge:       team.badge,
      leagueLabel: team.leagueLabel,
      leagueDbId:  team.leagueDbId,
      sportId:     team.sportId,
      website:     team.website ?? null,
    })
  }, [])

  const openStandingRow = useCallback((row: StandingRow) => {
    setDetail({
      id:          row.teamId,
      name:        row.teamName,
      badge:       row.badge,
      leagueLabel: league.label,
      leagueDbId:  league.sportsDbId,
      sportId:     league.sportId,
      website:     null,
    })
  }, [league])

  const toggleDetailFollow = useCallback(() => {
    if (!detail) return
    if (isFollowed(detail.id)) { unfollow(detail.id); return }
    follow({
      id:          detail.id,
      name:        detail.name,
      badge:       detail.badge,
      leagueLabel: detail.leagueLabel,
      leagueDbId:  detail.leagueDbId,
      sportId:     detail.sportId,
      website:     detail.website,
    })
  }, [detail, isFollowed, unfollow, follow])

  /* ── Calendar-sync toggle handler ──────────────────────────────── */
  const toggleCalSync = useCallback(async () => {
    const next = !calSync
    setCalSync(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem(CAL_TOGGLE_KEY, next ? '1' : '0')
    }
    if (next) {
      // User gesture → request notification permission.
      await notifications.enable()
    }
  }, [calSync, notifications])

  /* ── Look up a standing row for a team / detail ────────────────── */
  const getStandingRow = useCallback((leagueDbId: string | null, teamId: string): StandingRow | undefined => {
    if (!leagueDbId) return undefined
    return standingsByLeague[leagueDbId]?.find(r => r.teamId === teamId)
  }, [standingsByLeague])

  /* ════════════════════════════════════════════
     Render
     ════════════════════════════════════════════ */
  return (
    <div className={styles.root}>
      {/* ── Calendar + reminders bridge ──────────────────────────── */}
      {teams.length > 0 && (
        <div className={styles.syncBar}>
          <button
            type="button"
            role="switch"
            aria-checked={calSync}
            className={`${styles.syncToggle} ${calSync ? styles.syncToggleOn : ''}`}
            onClick={toggleCalSync}
          >
            <span className={styles.syncToggleTrack}><span className={styles.syncToggleThumb} /></span>
            Add games to Calendar + remind me
          </button>
          {calSync && notifications.permission === 'denied' && (
            <span className={styles.syncNote}>Notifications blocked in browser settings — calendar sync still active.</span>
          )}
          {calSync && notifications.permission === 'unsupported' && (
            <span className={styles.syncNote}>Reminders unsupported here — calendar sync still active.</span>
          )}
        </div>
      )}

      {/* ── My Teams Dashboard ───────────────────────────────────── */}
      {teams.length > 0 && (
        <section className={styles.dashSection}>
          <p className={styles.sectionLabel}>My Teams</p>
          <div className={styles.dashGrid}>
            {teams.map(team => (
              <DashboardCard
                key={team.id}
                team={team}
                results={resultsByTeam[team.id]}
                standingRow={getStandingRow(team.leagueDbId, team.id)}
                onUnfollow={unfollow}
                onOpen={openFollowed}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── League Browser ───────────────────────────────────────── */}
      <section className={styles.browserSection}>
        <p className={styles.sectionLabel}>League Browser</p>

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

        {/* Main browser grid: standings + follow */}
        <div className={styles.grid}>
          {/* Standings */}
          <section className={styles.standingsCol}>
            <p className={styles.sectionLabel} style={{ '--league-accent': league.accent } as React.CSSProperties}>
              {league.shortLabel} Standings
            </p>
            <StandingsTable
              league={league}
              rows={standings}
              loading={loadingTable}
              onFollow={followFromStanding}
              onOpenRow={openStandingRow}
              isFollowed={isFollowed}
            />
          </section>

          {/* Follow: search + curated directory */}
          <aside className={styles.teamsCol}>
            <p className={styles.sectionLabel}>Follow Teams</p>

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

            {/* Curated directory (browse without the API) */}
            {searchQ.trim().length < 2 && DIRECTORY_SPORT_ORDER.includes(activeSport) && (
              <>
                <p className={styles.sectionLabel} style={{ marginTop: 'var(--sp-4)' }}>Browse Directory</p>
                <TeamDirectory
                  activeSport={activeSport}
                  filter={dirFilter}
                  onFilter={setDirFilter}
                  isFollowedName={isFollowedName}
                  pending={dirPending}
                  onPick={followFromDirectory}
                />
              </>
            )}

            {teams.length === 0 && searchQ.trim().length < 2 && !DIRECTORY_SPORT_ORDER.includes(activeSport) && (
              <div className={styles.emptyTeams}>
                <span className={styles.emptyGlyph}>◎</span>
                <p>Follow teams from the standings or search above to build your dashboard.</p>
              </div>
            )}

            {teams.length > 0 && searchQ.trim().length < 2 && (
              <div className={styles.followedCount}>
                <span className={styles.followedCountNum}>{teams.length}</span>
                {' '}team{teams.length !== 1 ? 's' : ''} followed
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* ── Team Detail modal ────────────────────────────────────── */}
      {detail && (
        <TeamDetailModal
          target={detail}
          results={resultsByTeam[detail.id]}
          fixtures={fixturesByTeam[detail.id]}
          fixturesLoading={fixturesByTeam[detail.id] === undefined}
          standingRow={getStandingRow(detail.leagueDbId, detail.id)}
          isFollowed={isFollowed(detail.id)}
          onToggleFollow={toggleDetailFollow}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}
