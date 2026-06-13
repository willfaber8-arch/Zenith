'use client'
/**
 * lib/hooks/useFocusRoom.ts — Focus Room state manager
 * Phase 5 · Step 5.5
 *
 * Bridges the P2P network service with React state.
 * Host authority architecture:
 *   • Host runs the full Pomodoro FSM, broadcasts state on transitions
 *     and via a 5-second heartbeat.
 *   • Peers receive HOST_HEARTBEAT and force-align their display state.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useLiveQuery }           from 'dexie-react-hooks'
import { db }                     from '@/lib/db'
import { useAuth }                from '@/lib/AuthContext'
import {
  usePomodoroStateMachine,
  type TimerState,
}                                 from '@/lib/hooks/usePomodoroStateMachine'
import { p2pNetwork }             from '@/services/p2pNetwork'
import type { SyncMessage }       from '@/services/p2pNetwork'

/* ════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════ */

export type RoomRole    = 'host' | 'peer' | null
export type LobbyPhase  = 'idle' | 'connecting' | 'ready' | 'error'

export interface PeerPresence {
  peerId:           string
  userName:         string
  avatarAssetId:    string
  currentTaskTitle: string
}

export interface ChatEntry {
  id:        string
  text:      string
  timestamp: number
  userName:  string
  peerId:    string   // 'local' for own messages
}

export interface SyncedTimer {
  remaining:  number
  timerState: TimerState
  totalSecs:  number
}

/* ════════════════════════════════════════════════════════════════
   HOOK
   ════════════════════════════════════════════════════════════════ */

export function useFocusRoom() {
  const { session }  = useAuth()
  const profile      = useLiveQuery(() => db?.userProfile.get(1), [])
  const machine      = usePomodoroStateMachine()

  const userName      = profile?.userName ?? session?.userHandle ?? 'Scholar'
  const avatarAssetId = ''

  /* ── Room state ───────────────────────────────────────────── */
  const [phase,    setPhase]   = useState<LobbyPhase>('idle')
  const [role,     setRole]    = useState<RoomRole>(null)
  const [roomId,   setRoomId]  = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  /* ── Peer presence map ────────────────────────────────────── */
  const [presences, setPresences] = useState<Map<string, PeerPresence>>(new Map())

  /* ── Chat history ─────────────────────────────────────────── */
  const [chat, setChat] = useState<ChatEntry[]>([])

  /* ── Synced timer (written by incoming HOST_HEARTBEAT) ────── */
  const [syncedTimer, setSyncedTimer] = useState<SyncedTimer | null>(null)

  /* ── Stable refs — read inside effects without re-subscribing */
  const roleRef     = useRef<RoomRole>(null)
  const roomIdRef   = useRef<string | null>(null)
  const userNameRef = useRef(userName)
  const avatarRef   = useRef(avatarAssetId)
  const machineRef  = useRef(machine)

  useEffect(() => { roleRef.current    = role        }, [role])
  useEffect(() => { roomIdRef.current  = roomId      }, [roomId])
  useEffect(() => { userNameRef.current = userName   }, [userName])
  useEffect(() => { avatarRef.current  = avatarAssetId }, [avatarAssetId])
  useEffect(() => { machineRef.current = machine     })

  /* ── broadcast our own presence (reads from refs → stable) ── */
  function broadcastPresence() {
    p2pNetwork?.broadcast({
      type:    'PEER_PRESENCE',
      payload: {
        userName:         userNameRef.current,
        avatarAssetId:    avatarRef.current,
        currentTaskTitle: 'Focusing...',
      },
    })
  }

  /* ── Network event subscription (stable — runs once) ─────── */
  useEffect(() => {
    if (!p2pNetwork) return

    const unsub = p2pNetwork.subscribe(event => {
      switch (event.kind) {

        case 'peer_joined': {
          const pid = event.peerId!
          setPresences(prev => {
            if (prev.has(pid)) return prev
            const next = new Map(prev)
            next.set(pid, {
              peerId:           pid,
              userName:         pid.slice(-6).toUpperCase(),
              avatarAssetId:    '',
              currentTaskTitle: 'Joining…',
            })
            return next
          })
          // Send our presence so the new peer knows who we are
          broadcastPresence()
          break
        }

        case 'peer_left':
          setPresences(prev => {
            const next = new Map(prev)
            next.delete(event.peerId!)
            return next
          })
          break

        case 'message': {
          const msg    = event.message!
          const fromId = event.peerId!

          switch (msg.type) {

            case 'PEER_PRESENCE':
              setPresences(prev => {
                const next = new Map(prev)
                next.set(fromId, {
                  peerId:           fromId,
                  userName:         msg.payload.userName,
                  avatarAssetId:    msg.payload.avatarAssetId,
                  currentTaskTitle: msg.payload.currentTaskTitle,
                })
                return next
              })
              break

            // Host authority: force-align peer display to host state
            case 'HOST_HEARTBEAT':
            case 'SYNC_TIME':
              if (roleRef.current === 'peer') {
                setSyncedTimer({
                  remaining:  msg.payload.remainingSeconds,
                  timerState: msg.payload.timerState,
                  totalSecs:  msg.payload.totalSecs,
                })
              }
              break

            case 'CHAT_MESSAGE':
              setChat(prev => [
                ...prev.slice(-49),
                {
                  id:        msg.payload.id,
                  text:      msg.payload.text,
                  timestamp: msg.payload.timestamp,
                  userName:  msg.payload.userName,
                  peerId:    fromId,
                },
              ])
              break
          }
          break
        }

        case 'error':
          setPhase('error')
          setErrorMsg(event.error ?? 'Connection error')
          break
      }
    })

    return unsub
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Host heartbeat — broadcast every 5 s to all peers ───── */
  useEffect(() => {
    if (role !== 'host' || !roomId) return
    if (!p2pNetwork) return

    const id = setInterval(() => {
      if (p2pNetwork.peerCount === 0) return
      const m = machineRef.current
      p2pNetwork.broadcast({
        type:    'HOST_HEARTBEAT',
        payload: {
          remainingSeconds: m.remaining,
          timerState:       m.timerState,
          totalSecs:        m.totalSecs,
        },
      })
    }, 5000)

    return () => clearInterval(id)
  }, [role, roomId])

  /* ── Host: immediate SYNC_TIME on FSM state transitions ───── */
  const prevTimerStateRef = useRef<TimerState>('IDLE')
  useEffect(() => {
    if (role !== 'host' || !roomId) return
    if (machine.timerState === prevTimerStateRef.current) return

    prevTimerStateRef.current = machine.timerState
    p2pNetwork?.broadcast({
      type:    'SYNC_TIME',
      payload: {
        remainingSeconds: machine.remaining,
        timerState:       machine.timerState,
        totalSecs:        machine.totalSecs,
      },
    })
  }, [machine.timerState, machine.remaining, machine.totalSecs, role, roomId])

  /* ── Cleanup on unmount ───────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (roleRef.current !== null) {
        p2pNetwork?.teardown()
      }
    }
  }, [])

  /* ── Actions ──────────────────────────────────────────────── */

  const createRoom = useCallback(async () => {
    if (!p2pNetwork) return
    setPhase('connecting')
    setErrorMsg(null)
    try {
      const id = await p2pNetwork.createFocusRoom()
      setRoomId(id)
      setRole('host')
      setPhase('ready')
      // Seed self into presence map
      setPresences(new Map([['local', {
        peerId:           'local',
        userName,
        avatarAssetId,
        currentTaskTitle: 'Hosting…',
      }]]))
    } catch {
      setPhase('error')
      setErrorMsg('Could not create room. Check your connection and try again.')
    }
  }, [userName, avatarAssetId])

  const joinRoom = useCallback(async (targetId: string) => {
    if (!p2pNetwork) return
    setPhase('connecting')
    setErrorMsg(null)
    try {
      const clean = targetId.trim().toUpperCase()
      await p2pNetwork.joinFocusRoom(clean)
      setRoomId(clean)
      setRole('peer')
      setPhase('ready')
      setPresences(new Map([['local', {
        peerId:           'local',
        userName,
        avatarAssetId,
        currentTaskTitle: 'Focusing…',
      }]]))
      broadcastPresence()
    } catch {
      setPhase('error')
      setErrorMsg('Could not join room. Verify the Room ID and try again.')
    }
  }, [userName, avatarAssetId]) // eslint-disable-line react-hooks/exhaustive-deps

  const leaveRoom = useCallback(async () => {
    await p2pNetwork?.teardown()
    setRole(null)
    setRoomId(null)
    setPhase('idle')
    setPresences(new Map())
    setChat([])
    setSyncedTimer(null)
    setErrorMsg(null)
  }, [])

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed || !p2pNetwork) return
    const msg: SyncMessage = {
      type:    'CHAT_MESSAGE',
      payload: {
        id:        crypto.randomUUID(),
        text:      trimmed,
        timestamp: Date.now(),
        userName,
      },
    }
    p2pNetwork.broadcast(msg)
    // Echo to own chat feed immediately
    setChat(prev => [...prev.slice(-49), {
      id:        msg.payload.id,
      text:      msg.payload.text,
      timestamp: msg.payload.timestamp,
      userName,
      peerId:    'local',
    }])
  }, [userName])

  /* ── Derived display timer ────────────────────────────────── */
  // Host shows its own FSM; peers show the host-synced state
  const displayTimer: SyncedTimer =
    role === 'peer' && syncedTimer
      ? syncedTimer
      : { remaining: machine.remaining, timerState: machine.timerState, totalSecs: machine.totalSecs }

  return {
    phase,
    role,
    roomId,
    errorMsg,
    presences: Array.from(presences.values()),
    chat,
    displayTimer,
    machine,     // host manipulates the FSM through this
    createRoom,
    joinRoom,
    leaveRoom,
    sendChat,
  }
}
