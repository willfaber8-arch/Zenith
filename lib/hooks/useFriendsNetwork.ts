'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import {
  evaluateTemporalSnapshot,
} from '@/types/friendsNetwork'
import type {
  PeerFriend,
  PeerLeaderboardSnapshot,
  SyncPayload,
  PrivacySettings,
} from '@/types/friendsNetwork'

/* ── Constants ────────────────────────────────────────────── */

const PRIVACY_KEY      = 'zenith_friend_privacy_v1'
export const SELF_ID   = 'self'   // PK reserved for the local user's own snapshot

const DEFAULT_PRIVACY: PrivacySettings = {
  shareStudyMinutes:   true,
  shareHabitStreak:    true,
  shareCardioMiles:    true,
  shareBooksCompleted: true,
  shareCosmeticPoints: false,
}

/* ── localStorage privacy helpers ────────────────────────── */

function readPrivacy(): PrivacySettings {
  try {
    const raw = localStorage.getItem(PRIVACY_KEY)
    if (raw) return { ...DEFAULT_PRIVACY, ...JSON.parse(raw) }
  } catch { /* unavailable */ }
  return DEFAULT_PRIVACY
}

/* ── Snapshot compilation ─────────────────────────────────── */

/**
 * Compiles the local user's stat snapshot from multiple IDB tables.
 * Privacy flags zero-out any field the user has opted out of sharing.
 * The caller passes `selfId` — which is either the live PeerJS ID or
 * the fallback constant SELF_ID.
 */
export async function compileLocalSnapshot(
  selfId:  string,
  privacy: PrivacySettings
): Promise<PeerLeaderboardSnapshot> {
  const now      = Date.now()
  const weekAgo  = now - 7  * 86_400_000
  const monthAgo = now - 30 * 86_400_000

  /* ── Pomodoro study minutes ─────────────────────────────── */
  const sessions      = await db.pomodoroSessions
    .where('sessionType').equals('work')
    .toArray()
  const allTimeStudy  = sessions.reduce((s, x) => s + x.durationMinutes, 0)
  const weeklyStudy   = sessions.filter(x => x.completedAt >= weekAgo)
    .reduce((s, x) => s + x.durationMinutes, 0)
  const monthlyStudy  = sessions.filter(x => x.completedAt >= monthAgo)
    .reduce((s, x) => s + x.durationMinutes, 0)

  /* ── Habit streak (max across all habits) ───────────────── */
  const habits    = await db.habits.toArray()
  const maxStreak = habits.length > 0
    ? Math.max(0, ...habits.map(h => h.streakCount))
    : 0

  /* ── Books completed (quickNotes category = 'books') ──── */
  const notes          = await db.quickNotes.toArray()
  const booksCompleted = notes.filter(n =>
    n.category?.toLowerCase().includes('book')
  ).length

  /* ── Cardio miles (convert km → mi) ─────────────────────── */
  const cardioSessions = await db.cardioSessions.toArray()
  const rawMiles       = cardioSessions.reduce((sum, s) => {
    const d = s.distance ?? 0
    return sum + (s.distanceUnit === 'km' ? d * 0.621371 : d)
  }, 0)
  const totalMiles = parseFloat(rawMiles.toFixed(1))

  /* ── Cosmetic points from GamesOS DB ───────────────────── */
  let cosmeticPts = 0
  try {
    if (typeof window !== 'undefined') {
      const { getGamesDb } = await import('@/lib/gamesDb')
      const gdb     = getGamesDb()
      const profile = await gdb.user_profile_config.get('active_user')
      cosmeticPts   = profile?.cosmeticPointsBalance ?? 0
    }
  } catch { /* gamesDb unavailable */ }

  /* ── English vocab mastered cards ──────────────────────── */
  let vocabMastered = 0
  try {
    const engCards = await db.vocab_cards
      .where('reviewIntervalDays').aboveOrEqual(21)
      .toArray()
    vocabMastered = engCards.length
  } catch { /* vocab table may not exist yet */ }

  return {
    peerIdString:        selfId,
    weeklyStudyMinutes:  privacy.shareStudyMinutes    ? weeklyStudy   : 0,
    monthlyStudyMinutes: privacy.shareStudyMinutes    ? monthlyStudy  : 0,
    allTimeStudyMinutes: privacy.shareStudyMinutes    ? allTimeStudy  : 0,
    activeHabitStreak:   privacy.shareHabitStreak     ? maxStreak     : 0,
    totalBooksCompleted: privacy.shareBooksCompleted  ? booksCompleted: 0,
    totalCardioMiles:    privacy.shareCardioMiles      ? totalMiles    : 0,
    totalCosmeticPoints: privacy.shareCosmeticPoints  ? cosmeticPts   : 0,
    totalVocabMastered:  vocabMastered,
    snapshotTimestamp:   now,
  }
}

/* ── Hook public interface ────────────────────────────────── */

export interface FriendsNetworkState {
  myPeerId:      string | null
  peerStatus:    'initializing' | 'ready' | 'error' | 'unavailable'
  peerError:     string | null
  connecting:    boolean
  lastSyncMsg:   string | null
  friends:       PeerFriend[]
  peerSnapshots: PeerLeaderboardSnapshot[]   // peer rows only (not 'self')
  localSnapshot: PeerLeaderboardSnapshot | null
  privacy:       PrivacySettings
  updatePrivacy: (p: PrivacySettings)        => void
  connectToPeer: (targetId: string)          => Promise<void>
  removeFriend:  (id: string)                => Promise<void>
  refreshLocal:  ()                          => Promise<void>
}

/* ── Hook ─────────────────────────────────────────────────── */

export function useFriendsNetwork(): FriendsNetworkState {
  const [myPeerId,      setMyPeerId]      = useState<string | null>(null)
  const [peerStatus,    setPeerStatus]    = useState<FriendsNetworkState['peerStatus']>('initializing')
  const [peerError,     setPeerError]     = useState<string | null>(null)
  const [connecting,    setConnecting]    = useState(false)
  const [lastSyncMsg,   setLastSyncMsg]   = useState<string | null>(null)
  const [localSnapshot, setLocalSnapshot] = useState<PeerLeaderboardSnapshot | null>(null)
  const [privacy,       setPrivacyState]  = useState<PrivacySettings>(() =>
    typeof window !== 'undefined' ? readPrivacy() : DEFAULT_PRIVACY
  )

  /* Mutable refs — used inside PeerJS callbacks to avoid stale closures */
  const peerRef      = useRef<any>(null)
  const privacyRef   = useRef(privacy)
  const myPeerIdRef  = useRef<string | null>(null)
  const cancelledRef = useRef(false)

  /* Keep refs in sync with state */
  useEffect(() => { privacyRef.current  = privacy },   [privacy])
  useEffect(() => { myPeerIdRef.current = myPeerId },  [myPeerId])

  /* ── Live IDB queries ───────────────────────────────────── */

  const friends = useLiveQuery(
    () => db.peer_friends.orderBy('connectedAt').reverse().toArray(),
    []
  ) ?? []

  const allSnapshots = useLiveQuery(
    () => db.peer_leaderboard_snapshots.toArray(),
    []
  ) ?? []

  const peerSnapshots = useMemo(
    () => allSnapshots.filter(s => s.peerIdString !== SELF_ID),
    [allSnapshots]
  )

  /* ── Compile + persist local snapshot ───────────────────── */

  const refreshLocal = useCallback(async () => {
    if (typeof window === 'undefined') return
    const selfId = myPeerIdRef.current ?? SELF_ID
    const snap   = await compileLocalSnapshot(selfId, privacyRef.current)
    if (!cancelledRef.current) setLocalSnapshot(snap)
    // Persist with the reserved SELF_ID key so the row survives page reload
    await db.peer_leaderboard_snapshots.put({ ...snap, peerIdString: SELF_ID })
  }, [])

  /* ── Connection data handler (stable via empty-dep useCallback) ── */

  const handleConnection = useCallback((conn: any) => {

    conn.on('open', async () => {
      /* Emit our own snapshot to the peer */
      const selfId  = myPeerIdRef.current ?? SELF_ID
      const snap    = await compileLocalSnapshot(selfId, privacyRef.current)
      const profile = await db.userProfile.get(1).catch(() => null)
      const payload: SyncPayload = {
        type:          'ZENITH_FRIEND_SYNC',
        senderId:      selfId,
        displayName:   profile?.userName ?? 'Unknown',
        avatarAssetId: '',
        snapshot:      snap,
      }
      conn.send(JSON.stringify(payload))
    })

    conn.on('data', async (rawData: any) => {
      /* Parse and validate incoming payload */
      let payload: SyncPayload
      try {
        payload = typeof rawData === 'string' ? JSON.parse(rawData) : rawData
        if (payload?.type !== 'ZENITH_FRIEND_SYNC') return
      } catch { return }

      /* ── Multi-temporal evaluation ─────────────────────────
         Zero rolling-window fields whose window has elapsed.
         All-time fields pass through unchanged.
         ──────────────────────────────────────────────────── */
      const evaluated = evaluateTemporalSnapshot(payload.snapshot)

      /* Upsert peer_friends (one row per peer, keyed by peerIdString) */
      const existing = await db.peer_friends
        .where('peerIdString').equals(payload.senderId)
        .first()

      if (!existing) {
        await db.peer_friends.add({
          id:                crypto.randomUUID(),
          peerIdString:      payload.senderId,
          friendDisplayName: payload.displayName,
          avatarAssetId:     payload.avatarAssetId,
          connectedAt:       Date.now(),
        })
      } else {
        await db.peer_friends.update(existing.id, {
          friendDisplayName: payload.displayName,
          avatarAssetId:     payload.avatarAssetId,
        })
      }

      /* Upsert snapshot — temporal-evaluated version replaces any prior row */
      await db.peer_leaderboard_snapshots.put({
        ...evaluated,
        peerIdString: payload.senderId,
      })

      if (!cancelledRef.current) {
        setLastSyncMsg(`Synced with ${payload.displayName}`)
        setTimeout(() => {
          if (!cancelledRef.current) setLastSyncMsg(null)
        }, 4_000)
      }
    })

    conn.on('error', () => {
      if (!cancelledRef.current) setConnecting(false)
    })

  }, []) // Empty deps — all external state read via refs

  /* ── PeerJS lifecycle ───────────────────────────────────── */

  useEffect(() => {
    if (typeof window === 'undefined') {
      setPeerStatus('unavailable')
      return
    }

    cancelledRef.current = false

    /* Compile local snapshot immediately (shows own row before peers connect) */
    refreshLocal()

    let cleanupCalled = false

    async function initPeer() {
      try {
        const { Peer } = await import('peerjs')
        if (cancelledRef.current) return

        const peer = new Peer()
        peerRef.current = peer

        peer.on('open', (id: string) => {
          if (cancelledRef.current) return
          setMyPeerId(id)
          myPeerIdRef.current = id
          setPeerStatus('ready')
          // Recompile with the real peer ID for accurate senderId in payloads
          setTimeout(() => refreshLocal(), 150)
        })

        peer.on('error', (err: any) => {
          if (cancelledRef.current) return
          setPeerStatus('error')
          setPeerError(String(err?.message ?? err))
          setTimeout(() => {
            if (!cancelledRef.current) setPeerError(null)
          }, 6_000)
        })

        // Handle incoming connections from friends who add us
        peer.on('connection', (conn: any) => {
          if (cancelledRef.current) return
          handleConnection(conn)
        })

      } catch (e: unknown) {
        if (!cancelledRef.current) {
          setPeerStatus('unavailable')
          setPeerError('PeerJS could not initialise — offline mode active.')
        }
      }
    }

    initPeer()

    return () => {
      cancelledRef.current = true
      cleanupCalled = true
      peerRef.current?.destroy()
      peerRef.current = null
    }
  }, [refreshLocal, handleConnection])

  /* ── Outgoing connection initiator ──────────────────────── */

  const connectToPeer = useCallback(async (targetId: string) => {
    const trimmed = targetId.trim()
    if (!trimmed || !peerRef.current || peerStatus !== 'ready') return

    setConnecting(true)
    setPeerError(null)

    const conn = peerRef.current.connect(trimmed, { reliable: true })
    handleConnection(conn)

    const timeout = setTimeout(() => {
      if (!cancelledRef.current) {
        setConnecting(false)
        setPeerError('Connection timed out — check the Peer ID and try again.')
        setTimeout(() => { if (!cancelledRef.current) setPeerError(null) }, 5_000)
      }
    }, 15_000)

    conn.on('open', () => {
      clearTimeout(timeout)
      if (!cancelledRef.current) setConnecting(false)
    })

    conn.on('error', () => {
      clearTimeout(timeout)
      if (!cancelledRef.current) setConnecting(false)
    })
  }, [peerStatus, handleConnection])

  /* ── Privacy management ──────────────────────────────────── */

  const updatePrivacy = useCallback((p: PrivacySettings) => {
    setPrivacyState(p)
    privacyRef.current = p
    try { localStorage.setItem(PRIVACY_KEY, JSON.stringify(p)) } catch { /* noop */ }
    // Recompile snapshot immediately so leaderboard self-row reflects changes
    setTimeout(() => refreshLocal(), 50)
  }, [refreshLocal])

  /* ── Friend removal ──────────────────────────────────────── */

  const removeFriend = useCallback(async (id: string) => {
    const friend = await db.peer_friends.get(id).catch(() => null)
    if (!friend) return
    await Promise.all([
      db.peer_friends.delete(id),
      db.peer_leaderboard_snapshots.delete(friend.peerIdString),
    ])
  }, [])

  return {
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
  }
}
