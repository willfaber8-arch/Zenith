/**
 * services/p2pNetwork.ts — Decentralized P2P Mesh Networking Bridge
 * Phase 5 · Step 5.5 — Multiplayer Pomodoro Focus Rooms
 *
 * WebRTC data channels via PeerJS for signaling.
 * PeerJS's public cloud server is only used for ICE/SDP handshake;
 * all Pomodoro and chat data flows directly peer-to-peer afterward.
 *
 * SSR safety: PeerJS is dynamically imported inside async methods so
 * the browser-only module never runs during Next.js server rendering.
 */

import type { TimerState } from '@/lib/hooks/usePomodoroStateMachine'

/* ════════════════════════════════════════════════════════════════
   MESSAGE PROTOCOL
   ════════════════════════════════════════════════════════════════ */

/** Broadcast by host every 5 seconds — peers force-align to this. */
export type HostHeartbeatPayload = {
  remainingSeconds: number
  timerState:       TimerState
  totalSecs:        number
}

export type SyncMessage =
  | {
      type:    'SYNC_TIME'
      payload: HostHeartbeatPayload
    }
  | {
      type:    'HOST_HEARTBEAT'
      payload: HostHeartbeatPayload
    }
  | {
      type:    'PEER_PRESENCE'
      payload: { userName: string; avatarAssetId: string; currentTaskTitle: string }
    }
  | {
      type:    'CHAT_MESSAGE'
      payload: { id: string; text: string; timestamp: number; userName: string }
    }

/* ════════════════════════════════════════════════════════════════
   NETWORK EVENTS  (dispatched to React subscribers)
   ════════════════════════════════════════════════════════════════ */

export type NetworkEventKind =
  | 'room_ready'   // local peer ID registered on signaling server
  | 'peer_joined'  // new DataConnection opened
  | 'peer_left'    // DataConnection closed or errored
  | 'message'      // SyncMessage received from a peer
  | 'error'

export interface NetworkEvent {
  kind:     NetworkEventKind
  peerId?:  string
  message?: SyncMessage
  error?:   string
}

export type NetworkListener = (event: NetworkEvent) => void

/* ════════════════════════════════════════════════════════════════
   ROOM ID GENERATION
   ════════════════════════════════════════════════════════════════ */

const PREFIXES  = ['ZEN', 'DEEP', 'GRIT', 'FLOW', 'RISE', 'PEAK', 'CALM', 'SYNC']
const SUBJECTS  = ['MATH', 'CHEM', 'CODE', 'LAW', 'BIO', 'HIST', 'LIT', 'ECO']

function generateRoomId(): string {
  const p = PREFIXES[Math.floor(Math.random() * PREFIXES.length)]
  const s = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)]
  const n = Math.floor(100 + Math.random() * 900)
  return `${p}-${s}-${n}`
}

/* ════════════════════════════════════════════════════════════════
   P2P NETWORK CONTROLLER
   ════════════════════════════════════════════════════════════════ */

class P2PNetwork {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private peer:        any = null   // PeerJS Peer instance (dynamic import)
  private connections: Map<string, any> = new Map()  // peerId → DataConnection
  /* eslint-enable @typescript-eslint/no-explicit-any */

  private listeners: Set<NetworkListener> = new Set()
  private _roomId:   string | null        = null
  private _localId:  string | null        = null

  /* ── Subscription ─────────────────────────────────────────── */

  subscribe(fn: NetworkListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(event: NetworkEvent): void {
    this.listeners.forEach(h => h(event))
  }

  /* ── Accessors ────────────────────────────────────────────── */

  get roomId():    string | null { return this._roomId  }
  get localId():   string | null { return this._localId }
  get peerIds():   string[]      { return Array.from(this.connections.keys()) }
  get peerCount(): number        { return this.connections.size }

  /* ── Create Focus Room — Host Broker ──────────────────────── */

  async createFocusRoom(): Promise<string> {
    await this.teardown()

    const { Peer } = await import('peerjs')
    const roomId   = generateRoomId()
    this._roomId   = roomId

    return new Promise((resolve, reject) => {
      this.peer = new Peer(roomId, { debug: 0 })

      this.peer.on('open', (id: string) => {
        this._localId = id
        this.emit({ kind: 'room_ready' })
        resolve(id)
      })

      // Accept incoming peer connections
      this.peer.on('connection', (conn: unknown) => {
        this.wireConnection(conn)
      })

      this.peer.on('error', (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        this.emit({ kind: 'error', error: msg })
        reject(new Error(msg))
      })
    })
  }

  /* ── Join Focus Room — Peer Client ────────────────────────── */

  async joinFocusRoom(targetRoomId: string): Promise<void> {
    await this.teardown()

    const { Peer } = await import('peerjs')
    this._roomId   = targetRoomId

    return new Promise((resolve, reject) => {
      this.peer = new Peer({ debug: 0 })

      this.peer.on('open', (id: string) => {
        this._localId = id
        const conn = this.peer.connect(targetRoomId)
        this.wireConnection(conn, () => {
          this.emit({ kind: 'room_ready' })
          resolve()
        })
      })

      this.peer.on('error', (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        this.emit({ kind: 'error', error: msg })
        reject(new Error(msg))
      })
    })
  }

  /* ── Wire a DataConnection ────────────────────────────────── */

  private wireConnection(conn: unknown, onOpen?: () => void): void {
    const c = conn as {
      peer:  string
      open:  boolean
      on:    (event: string, cb: (...args: unknown[]) => void) => void
      send:  (data: unknown) => void
      close: () => void
    }

    c.on('open', () => {
      this.connections.set(c.peer, c)
      this.emit({ kind: 'peer_joined', peerId: c.peer })
      onOpen?.()
    })

    c.on('data', (raw: unknown) => {
      this.emit({ kind: 'message', peerId: c.peer, message: raw as SyncMessage })
    })

    c.on('close', () => {
      this.connections.delete(c.peer)
      this.emit({ kind: 'peer_left', peerId: c.peer })
    })

    c.on('error', () => {
      this.connections.delete(c.peer)
      this.emit({ kind: 'peer_left', peerId: c.peer })
    })
  }

  /* ── Broadcast to every connected peer ───────────────────── */

  broadcast(message: SyncMessage): void {
    this.connections.forEach(conn => {
      if (conn.open) conn.send(message)
    })
  }

  /* ── Teardown — close all connections and destroy peer ───── */

  async teardown(): Promise<void> {
    this.connections.forEach(conn => {
      try { conn.close() } catch { /* already closed */ }
    })
    this.connections.clear()
    try { this.peer?.destroy() } catch { /* already destroyed */ }
    this.peer    = null
    this._roomId = null
    this._localId = null
  }
}

/* ════════════════════════════════════════════════════════════════
   SSR-SAFE SINGLETON
   Client bundle  → real P2PNetwork instance
   Server bundle  → null cast (never reached in browser-only code)
   ════════════════════════════════════════════════════════════════ */

export const p2pNetwork: P2PNetwork =
  typeof window !== 'undefined'
    ? new P2PNetwork()
    : (null as unknown as P2PNetwork)

export { P2PNetwork, generateRoomId }
