'use client'

import { useState, useMemo, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useFriendsNetwork, SELF_ID } from '@/lib/hooks/useFriendsNetwork'
import {
  extractScore,
  fmtScore,
  isSnapshotStale,
  HORIZON_LABELS,
  METRIC_META,
} from '@/types/friendsNetwork'
import type {
  TimeHorizon,
  ScoringMetric,
  PeerLeaderboardSnapshot,
  PrivacySettings,
} from '@/types/friendsNetwork'
import styles from './SocialLeaderboard.module.css'

/* ── Ordered display lists ────────────────────────────────── */

const HORIZONS:   TimeHorizon[]   = ['WEEKLY', 'MONTHLY', 'ALL_TIME']
const METRICS:    ScoringMetric[] = [
  'STUDY_MINUTES', 'HABIT_STREAK', 'CARDIO_MILES', 'BOOKS_COMPLETED', 'COSMETIC_POINTS', 'VOCAB_MASTERED',
]

/* ── PrivacyToggle sub-component ──────────────────────────── */

interface PrivacyToggleProps {
  id:       string
  label:    string
  checked:  boolean
  onChange: (v: boolean) => void
}

function PrivacyToggle({ id, label, checked, onChange }: PrivacyToggleProps) {
  return (
    <div className={styles.privacyRow}>
      <label htmlFor={id} className={styles.privacyRowLabel}>{label}</label>
      <div className={styles.toggle}>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className={styles.toggleInput}
        />
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label
          htmlFor={id}
          className={`${styles.toggleTrack} ${checked ? styles.toggleTrackOn : ''}`}
          aria-hidden="true"
        >
          <span className={`${styles.toggleThumb} ${checked ? styles.toggleThumbOn : ''}`} />
        </label>
      </div>
    </div>
  )
}

/* ── Ranked leaderboard entry shape ──────────────────────── */

interface RankedEntry {
  peerIdString:  string
  displayName:   string
  snapshot:      PeerLeaderboardSnapshot
  isSelf:        boolean
  isStale:       boolean
  score:         number
  rank:          number
}

/* ── Rank badge class helper ──────────────────────────────── */

function rankBadgeCls(rank: number): string {
  if (rank === 1) return `${styles.rankBadge} ${styles.rankGold}`
  if (rank === 2) return `${styles.rankBadge} ${styles.rankSilver}`
  if (rank === 3) return `${styles.rankBadge} ${styles.rankBronze}`
  return `${styles.rankBadge} ${styles.rankOther}`
}

/* ════════════════════════════════════════════════════════════
   SocialLeaderboard — main export
   ════════════════════════════════════════════════════════════ */

export default function SocialLeaderboard() {
  const {
    myPeerId,
    peerStatus,
    peerError,
    connecting,
    lastSyncMsg,
    friends,
    peerSnapshots,
    localSnapshot,
    privacy,
    updatePrivacy,
    connectToPeer,
    removeFriend,
    refreshLocal,
  } = useFriendsNetwork()

  /* Local user display name from IDB */
  const userProfile = useLiveQuery(() => db.userProfile.get(1), [])

  /* ── Component-local controls ──────────────────────────── */
  const [horizon,      setHorizon]      = useState<TimeHorizon>('WEEKLY')
  const [metric,       setMetric]       = useState<ScoringMetric>('STUDY_MINUTES')
  const [connectInput, setConnectInput] = useState('')
  const [copied,       setCopied]       = useState(false)
  const [showPrivacy,  setShowPrivacy]  = useState(false)

  /* ── Copy peer ID ─────────────────────────────────────────── */
  const handleCopy = useCallback(() => {
    if (!myPeerId) return
    navigator.clipboard.writeText(myPeerId)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2_000) })
      .catch(() => {})
  }, [myPeerId])

  /* ── Connect to peer ─────────────────────────────────────── */
  const handleConnect = useCallback(async () => {
    const trimmed = connectInput.trim()
    if (!trimmed) return
    setConnectInput('')
    await connectToPeer(trimmed)
  }, [connectInput, connectToPeer])

  /* ── Build sorted leaderboard entries ────────────────────── */
  const leaderboardEntries = useMemo((): RankedEntry[] => {
    const entries: Omit<RankedEntry, 'rank'>[] = []

    // Add each peer's snapshot
    for (const snap of peerSnapshots) {
      const friend = friends.find(f => f.peerIdString === snap.peerIdString)
      entries.push({
        peerIdString: snap.peerIdString,
        displayName:  friend?.friendDisplayName ?? `${snap.peerIdString.slice(0, 10)}…`,
        snapshot:     snap,
        isSelf:       false,
        isStale:      isSnapshotStale(snap),
        score:        extractScore(snap, metric, horizon),
      })
    }

    // Add the local user's own row (always present when snapshot is ready)
    if (localSnapshot) {
      entries.push({
        peerIdString: SELF_ID,
        displayName:  userProfile?.userName ?? 'You',
        snapshot:     localSnapshot,
        isSelf:       true,
        isStale:      false,   // self is always fresh
        score:        extractScore(localSnapshot, metric, horizon),
      })
    }

    // Sort descending by active metric score, then assign ranks
    return entries
      .sort((a, b) => b.score - a.score)
      .map((e, i) => ({ ...e, rank: i + 1 }))
  }, [peerSnapshots, localSnapshot, friends, metric, horizon, userProfile])

  /* ── Peer status display helpers ──────────────────────────── */
  const statusLabel = {
    initializing: 'Initializing P2P mesh…',
    ready:        `Online · ${myPeerId?.slice(0, 14) ?? ''}…`,
    error:        'Connection error',
    unavailable:  'Offline — cached data only',
  }[peerStatus]

  const statusDotCls = {
    initializing: styles.statusDotInit,
    ready:        styles.statusDotReady,
    error:        styles.statusDotError,
    unavailable:  styles.statusDotUnavail,
  }[peerStatus]

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className={styles.layout}>

      {/* ═══════════════════════════════════════════════════
          LEFT — Connection Shelf
          ═══════════════════════════════════════════════════ */}
      <aside className={styles.connectionPanel}>

        {/* Your Peer ID */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Your Peer ID</span>
          <div className={styles.peerIdRow}>
            <span className={styles.peerIdText} title={myPeerId ?? 'Generating…'}>
              {myPeerId ?? 'Generating…'}
            </span>
            <button
              onClick={handleCopy}
              disabled={!myPeerId}
              className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <div className={styles.statusRow}>
            <span className={`${styles.statusDot} ${statusDotCls}`} aria-hidden />
            <span className={styles.statusText}>{statusLabel}</span>
          </div>
        </div>

        <div className={styles.panelDivider} />

        {/* Add Friend */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Add Friend</span>
          <div className={styles.connectRow}>
            <input
              className={styles.connectInput}
              type="text"
              placeholder="Paste Peer ID…"
              value={connectInput}
              onChange={e => setConnectInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              disabled={peerStatus !== 'ready'}
              aria-label="Friend's Peer ID"
            />
            <button
              onClick={handleConnect}
              disabled={!connectInput.trim() || connecting || peerStatus !== 'ready'}
              className={styles.connectBtn}
              aria-label="Connect to friend"
            >
              {connecting ? '…' : '→'}
            </button>
          </div>

          {lastSyncMsg && (
            <p className={styles.syncMsg} role="status">✓ {lastSyncMsg}</p>
          )}
          {peerError && (
            <p className={styles.errorMsg} role="alert">{peerError}</p>
          )}
          {peerStatus === 'unavailable' && !peerError && (
            <p className={styles.errorMsg}>P2P unavailable — viewing cached data</p>
          )}
        </div>

        <div className={styles.panelDivider} />

        {/* Friends List */}
        <div className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <span className={styles.sectionLabel}>Friends</span>
            <span className={styles.countChip}>{friends.length}</span>
          </div>
          <div className={styles.friendsList}>
            {friends.length === 0 ? (
              <p className={styles.emptyFriends}>
                No peers connected yet — share your Peer ID above
              </p>
            ) : (
              friends.map(f => (
                <div key={f.id} className={styles.friendRow}>
                  <span className={styles.friendDot} aria-hidden />
                  <span className={styles.friendName} title={f.friendDisplayName}>
                    {f.friendDisplayName}
                  </span>
                  <button
                    onClick={() => removeFriend(f.id)}
                    className={styles.removeBtn}
                    aria-label={`Remove ${f.friendDisplayName}`}
                    title="Remove friend and their snapshot"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.panelDivider} />

        {/* Privacy Settings (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShowPrivacy(v => !v)}
            className={styles.privacyToggleBtn}
            aria-expanded={showPrivacy}
          >
            <span className={styles.sectionLabel}>Privacy Settings</span>
            <span
              className={styles.privacyChevron}
              style={{ transform: showPrivacy ? 'rotate(180deg)' : 'rotate(0deg)' }}
              aria-hidden
            >
              ▾
            </span>
          </button>

          {/* grid-template-rows expand — rule 25 */}
          <div className={`${styles.privacyPanel} ${showPrivacy ? styles.privacyPanelOpen : ''}`}>
            <div className={styles.privacyPanelInner}>
              <PrivacyToggle id="priv-study"   label="Study Minutes"  checked={privacy.shareStudyMinutes}   onChange={v => updatePrivacy({ ...privacy, shareStudyMinutes:   v })} />
              <PrivacyToggle id="priv-streak"  label="Habit Streak"   checked={privacy.shareHabitStreak}    onChange={v => updatePrivacy({ ...privacy, shareHabitStreak:    v })} />
              <PrivacyToggle id="priv-cardio"  label="Cardio Miles"   checked={privacy.shareCardioMiles}    onChange={v => updatePrivacy({ ...privacy, shareCardioMiles:    v })} />
              <PrivacyToggle id="priv-books"   label="Books"          checked={privacy.shareBooksCompleted} onChange={v => updatePrivacy({ ...privacy, shareBooksCompleted: v })} />
              <PrivacyToggle id="priv-credits" label="✦ Credits"      checked={privacy.shareCosmeticPoints} onChange={v => updatePrivacy({ ...privacy, shareCosmeticPoints: v })} />
              <PrivacyToggle id="priv-calendar" label="Shared Calendar" checked={privacy.shareCalendar}      onChange={v => updatePrivacy({ ...privacy, shareCalendar:       v })} />

              <p className={styles.privacyDisclaimer}>
                Disabled metrics broadcast as zero. With Shared Calendar on,
                your upcoming events sync to connected friends and appear on
                their calendar. Data travels directly between browsers via
                WebRTC — no central server.
              </p>
            </div>
          </div>
        </div>

      </aside>

      {/* ═══════════════════════════════════════════════════
          RIGHT — Leaderboard Terminal
          ═══════════════════════════════════════════════════ */}
      <div className={styles.leaderboardPanel}>

        {/* ── Time horizon tab bar ────────────────────────── */}
        <div className={styles.horizonTabs} role="tablist" aria-label="Time horizon">
          {HORIZONS.map(h => (
            <button
              key={h}
              role="tab"
              aria-selected={horizon === h}
              onClick={() => setHorizon(h)}
              className={`${styles.horizonTab} ${horizon === h ? styles.horizonTabActive : ''}`}
            >
              {HORIZON_LABELS[h]}
            </button>
          ))}
        </div>

        {/* ── Metric selector chips ────────────────────────── */}
        <div className={styles.metricRow} role="group" aria-label="Scoring metric">
          {METRICS.map(m => (
            <button
              key={m}
              aria-pressed={metric === m}
              onClick={() => setMetric(m)}
              className={`${styles.metricChip} ${metric === m ? styles.metricChipActive : ''}`}
            >
              {metric === m && <span className={styles.metricDot} aria-hidden />}
              {METRIC_META[m].label}
            </button>
          ))}
        </div>

        {/* ── Standings card ───────────────────────────────── */}
        <div className={styles.leaderboardCard}>
          <div className={styles.leaderboardHeader}>
            <span className={styles.leaderboardTitle}>
              Standings · {HORIZON_LABELS[horizon]} · {METRIC_META[metric].label}
            </span>
            <button
              onClick={refreshLocal}
              className={styles.refreshBtn}
              title="Refresh your local stats"
              aria-label="Refresh local stats"
            >
              ↺
            </button>
          </div>

          {leaderboardEntries.length === 0 ? (
            <div className={styles.emptyLeaderboard}>
              <span className={styles.emptyGlyph} aria-hidden>◈</span>
              <p className={styles.emptyLabel}>Standings loading…</p>
              <p className={styles.emptyHint}>
                Share your Peer ID with friends to start the leaderboard
              </p>
            </div>
          ) : (
            <div className={styles.leaderboardStack} role="list">
              {leaderboardEntries.map((entry, i) => (
                <div
                  key={entry.peerIdString}
                  role="listitem"
                  className={`${styles.rankRow} ${entry.isSelf ? styles.rankRowSelf : ''}`}
                  style={{ animationDelay: `${i * 55}ms` }}
                >
                  {/* Rank badge */}
                  <span className={rankBadgeCls(entry.rank)}>
                    [ #{entry.rank} ]
                  </span>

                  {/* Name + tag chips */}
                  <div className={styles.rankInfo}>
                    <span className={styles.rankName}>{entry.displayName}</span>
                    {entry.isSelf && (
                      <span className={styles.selfTag} aria-label="This is you">YOU</span>
                    )}
                    {entry.isStale && (
                      <span className={styles.staleTag} title="Snapshot older than 48 hours">
                        STALE
                      </span>
                    )}
                  </div>

                  {/* Score value */}
                  <span className={styles.rankScore}>
                    {fmtScore(entry.score, metric)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info strip */}
        <p className={styles.infoStrip}>
          ⊕ End-to-end encrypted P2P sync via WebRTC · No server · Snapshots refresh each session
        </p>

      </div>
    </div>
  )
}
