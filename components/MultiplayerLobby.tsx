'use client'
/**
 * components/MultiplayerLobby.tsx — Cowork Focus Lobby
 * Phase 5 · Step 5.5
 *
 * Two screens:
 *   Lobby  — create or join a focus room
 *   Room   — split panel: peer sidebar + synced Pomodoro + chat feed
 */

import {
  useState, useEffect, useRef,
  type FormEvent, type KeyboardEvent,
} from 'react'
import { useFocusRoom, type PeerPresence, type ChatEntry } from '@/lib/hooks/useFocusRoom'
import type { PomodoroMachine }   from '@/lib/hooks/usePomodoroStateMachine'
import PomodoroCanvas              from '@/components/PomodoroCanvas'
import styles from './MultiplayerLobby.module.css'

/* ── Helpers ─────────────────────────────────────────────────── */

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Deterministic hue from a string for avatar color variety. */
function nameHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h % 360
}

/* ════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════════════════ */

/* ── Peer Card ───────────────────────────────────────────────── */

function PeerCard({ p, isLocal }: { p: PeerPresence; isLocal: boolean }) {
  const hue = nameHue(p.userName)
  return (
    <div className={`${styles.peerCard} anim-slide-in`}>
      <span
        className={styles.peerAvatar}
        style={{
          background: `hsl(${hue}, 35%, 28%)`,
          borderColor: `hsl(${hue}, 45%, 45%)`,
          color: `hsl(${hue}, 60%, 75%)`,
        }}
        aria-hidden="true"
      >
        {p.userName[0]?.toUpperCase() ?? '?'}
      </span>
      <div className={styles.peerInfo}>
        <span className={styles.peerName}>
          {p.userName}{isLocal ? ' (you)' : ''}
        </span>
        <span className={styles.peerTask}>{p.currentTaskTitle}</span>
      </div>
      <span className={styles.presenceDot} aria-label="Online" />
    </div>
  )
}

/* ── Chat Message ────────────────────────────────────────────── */

function ChatMsg({ entry, isOwn }: { entry: ChatEntry; isOwn: boolean }) {
  return (
    <div className={`${styles.chatMsg} ${isOwn ? styles.chatMsgOwn : ''} anim-slide-in`}>
      {!isOwn && <span className={styles.chatName}>{entry.userName}</span>}
      <span className={styles.chatText}>{entry.text}</span>
      <span className={styles.chatTime}>{fmtTime(entry.timestamp)}</span>
    </div>
  )
}

/* ── Timer Controls (host only) ──────────────────────────────── */

function TimerControls({ m }: { m: PomodoroMachine }) {
  const { timerState, start, pause, resume, skip, reset } = m
  const isIdle    = timerState === 'IDLE'
  const isRunning = timerState === 'WORK' || timerState === 'SHORT_BREAK' || timerState === 'LONG_BREAK'
  const isPaused  = timerState === 'PAUSED'

  return (
    <div className={styles.timerControls} role="group" aria-label="Timer controls">
      {isIdle && (
        <button className={`${styles.timerBtn} ${styles.timerBtnPrimary}`} onClick={start}>
          Start Focus
        </button>
      )}
      {isRunning && (
        <button className={styles.timerBtn} onClick={pause}>Pause</button>
      )}
      {isPaused && (
        <button className={`${styles.timerBtn} ${styles.timerBtnPrimary}`} onClick={resume}>
          Resume
        </button>
      )}
      {!isIdle && (
        <button className={styles.timerBtn} onClick={skip}>Skip</button>
      )}
      {!isIdle && (
        <button className={styles.timerBtn} onClick={reset}>Reset</button>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   LOBBY SCREEN
   ════════════════════════════════════════════════════════════════ */

interface LobbyScreenProps {
  connecting:  boolean
  errorMsg:    string | null
  onCreate:    () => void
  onJoin:      (id: string) => void
}

function LobbyScreen({ connecting, errorMsg, onCreate, onJoin }: LobbyScreenProps) {
  const [joinInput, setJoinInput] = useState('')

  function handleJoin(e: FormEvent) {
    e.preventDefault()
    if (joinInput.trim()) onJoin(joinInput)
  }

  function handleJoinKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onJoin(joinInput)
  }

  return (
    <div className={styles.lobbyWrap}>
      <div className={styles.lobbyGrid}>

        {/* Create a Room */}
        <div className={`${styles.lobbyCard} ${styles.lobbyCardCreate}`}>
          <p className={styles.lobbyCardEyebrow}>HOST</p>
          <p className={styles.lobbyCardTitle}>Start a Room</p>
          <p className={styles.lobbyCardDesc}>
            Create a new focus room and share the code with your peers to sync your Pomodoro sessions in real time.
          </p>
          <button
            className={`${styles.lobbyBtn} ${styles.lobbyBtnPrimary}`}
            onClick={onCreate}
            disabled={connecting}
          >
            {connecting ? 'Connecting…' : 'Create Room'}
          </button>
        </div>

        {/* Join a Room */}
        <div className={`${styles.lobbyCard} ${styles.lobbyCardJoin}`}>
          <p className={styles.lobbyCardEyebrow}>PEER</p>
          <p className={styles.lobbyCardTitle}>Join a Room</p>
          <p className={styles.lobbyCardDesc}>
            Have a room code? Enter it below to connect to a running focus session and sync to the host timer.
          </p>
          <form className={styles.joinForm} onSubmit={handleJoin}>
            <input
              className={styles.joinInput}
              type="text"
              value={joinInput}
              onChange={e => setJoinInput(e.target.value.toUpperCase())}
              onKeyDown={handleJoinKey}
              placeholder="ZEN-MATH-932"
              maxLength={16}
              aria-label="Room code"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className={styles.lobbyBtn}
              type="submit"
              disabled={connecting || !joinInput.trim()}
            >
              {connecting ? 'Joining…' : 'Join Room'}
            </button>
          </form>
        </div>

      </div>

      {errorMsg && (
        <p className={styles.errorNote} role="alert">{errorMsg}</p>
      )}

      <p className={styles.p2pNote}>
        Rooms are serverless and peer-to-peer via WebRTC. No data leaves your browser except to direct peers.
      </p>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   ROOM SCREEN
   ════════════════════════════════════════════════════════════════ */

interface RoomScreenProps {
  role:      'host' | 'peer'
  roomId:    string
  presences: PeerPresence[]
  chat:      ChatEntry[]
  displayTimer: { remaining: number; timerState: import('@/lib/hooks/usePomodoroStateMachine').TimerState; totalSecs: number }
  machine:   PomodoroMachine
  onLeave:   () => void
  onSendChat: (text: string) => void
}

function RoomScreen({
  role, roomId, presences, chat,
  displayTimer, machine, onLeave, onSendChat,
}: RoomScreenProps) {
  const [chatInput, setChatInput] = useState('')
  const [copied,    setCopied]    = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll chat feed to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.length])

  function handleCopy() {
    navigator.clipboard.writeText(roomId).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleChatSubmit(e: FormEvent) {
    e.preventDefault()
    if (!chatInput.trim()) return
    onSendChat(chatInput)
    setChatInput('')
  }

  function handleChatKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!chatInput.trim()) return
      onSendChat(chatInput)
      setChatInput('')
    }
  }

  const cyclePos = role === 'host' ? machine.sessionCount % 4 : 0

  return (
    <div className={`${styles.room} anim-scale-in`}>

      {/* ── Room header ─────────────────────────────────────── */}
      <div className={styles.roomHeader}>
        <div className={styles.roomMeta}>
          <span className={styles.roomEyebrow}>
            FOCUS ROOM · {role === 'host' ? 'HOST BROKER' : 'PEER CLIENT'}
          </span>
          <span
            className={styles.roomId}
            title="Room identifier"
            aria-label={`Room ID: ${roomId}`}
          >
            {roomId}
          </span>
        </div>
        <button
          className={styles.leaveBtn}
          onClick={onLeave}
          aria-label="Leave focus room"
        >
          Leave Room
        </button>
      </div>

      {/* ── Split layout ────────────────────────────────────── */}
      <div className={styles.roomLayout}>

        {/* LEFT: Peer Sidebar */}
        <aside className={styles.peerSidebar} aria-label="Connected peers">
          <p className={styles.sidebarLabel}>ACTIVE PEERS</p>

          {presences.length === 0 ? (
            <p className={styles.noPeers}>Waiting for peers to join…</p>
          ) : (
            <div className={styles.peerList}>
              {presences.map(p => (
                <PeerCard key={p.peerId} p={p} isLocal={p.peerId === 'local'} />
              ))}
            </div>
          )}

          {/* Room code (host shows it for sharing) */}
          {role === 'host' && (
            <div className={styles.roomCodeBox}>
              <p className={styles.roomCodeLabel}>INVITE CODE</p>
              <p className={styles.roomCodeValue}>{roomId}</p>
              <button
                className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`}
                onClick={handleCopy}
                aria-label="Copy room code to clipboard"
              >
                {copied ? '✓ Copied' : 'Copy Code'}
              </button>
            </div>
          )}
        </aside>

        {/* RIGHT: Main Canvas */}
        <main className={styles.roomMain}>

          {/* Timer pane */}
          <div className={styles.timerPane}>
            <div className={styles.timerHeader}>
              <p className={styles.timerEyebrow}>SHARED POMODORO</p>
              {role === 'peer' && (
                <span className={styles.syncBadge}>⟳ Synced from host</span>
              )}
            </div>

            <PomodoroCanvas
              timerState={displayTimer.timerState}
              remaining={displayTimer.remaining}
              totalSecs={displayTimer.totalSecs}
              cyclePosition={cyclePos}
            />

            {role === 'host' ? (
              <TimerControls m={machine} />
            ) : (
              <p className={styles.peerNote}>
                The host controls this timer. Focus and let the rhythm guide you.
              </p>
            )}
          </div>

          {/* Chat pane */}
          <div className={styles.chatPane} aria-label="Focus chat">
            <p className={styles.chatLabel}>FOCUS CHAT</p>

            <div className={styles.chatFeed} role="log" aria-live="polite">
              {chat.length === 0 ? (
                <p className={styles.chatEmpty}>No messages yet — say something encouraging!</p>
              ) : (
                chat.map(entry => (
                  <ChatMsg key={entry.id} entry={entry} isOwn={entry.peerId === 'local'} />
                ))
              )}
              <div ref={chatEndRef} aria-hidden="true" />
            </div>

            <form className={styles.chatForm} onSubmit={handleChatSubmit}>
              <input
                className={styles.chatInput}
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleChatKey}
                placeholder="Send a message… (Enter to send)"
                maxLength={200}
                aria-label="Chat message"
                autoComplete="off"
              />
              <button
                className={styles.chatSendBtn}
                type="submit"
                disabled={!chatInput.trim()}
                aria-label="Send"
              >
                →
              </button>
            </form>
          </div>

        </main>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function MultiplayerLobby() {
  const {
    phase, role, roomId, errorMsg,
    presences, chat, displayTimer, machine,
    createRoom, joinRoom, leaveRoom, sendChat,
  } = useFocusRoom()

  const inRoom = phase === 'ready' && role !== null

  if (inRoom) {
    return (
      <RoomScreen
        role={role as 'host' | 'peer'}
        roomId={roomId!}
        presences={presences}
        chat={chat}
        displayTimer={displayTimer}
        machine={machine}
        onLeave={leaveRoom}
        onSendChat={sendChat}
      />
    )
  }

  return (
    <LobbyScreen
      connecting={phase === 'connecting'}
      errorMsg={errorMsg}
      onCreate={createRoom}
      onJoin={joinRoom}
    />
  )
}
