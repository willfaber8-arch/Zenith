'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * UniversalGameWrapper — Step 2.3
 * Universal layout container + session lifecycle orchestrator for
 * every 2D game plugin in the Arcade Hub.
 *
 * Responsibilities:
 *   • Capacity pre-flight gate (blocks launch when target resource is full)
 *   • Session clock via performance.now() — immune to setInterval drift
 *   • onGameComplete interceptor pipeline:
 *       score → payoutFormula → addResources → capacity-aware result modal
 *   • Child remount via sessionKey so each new session starts with
 *     a completely fresh component tree
 *   • Full memory-leak prevention: interval + isMounted ref guards
 * ════════════════════════════════════════════════════════════════
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react'
import { RESOURCE_META }       from '@/lib/gamesDb'
import {
  useZenithEconomy,
  type AddResourcesResult,
} from '@/hooks/useZenithEconomy'
import styles from './UniversalGameWrapper.module.css'

/* ════════════════════════════════════════════════════════════════
   §1  PUBLIC API TYPES
   ════════════════════════════════════════════════════════════════ */

/**
 * Payload emitted by the child game component when a round ends.
 * The wrapper injects `onGameComplete` via React.cloneElement —
 * the child component must declare and call this prop.
 */
export interface GameSessionResult {
  /** Raw numerical outcome — meaning is game-specific (score, lines, etc.). */
  score: number
  /** Natural completion vs user-initiated exit. Abandoned sessions pay 0. */
  status: 'completed' | 'abandoned'
  /** Arbitrary game telemetry reserved for future analytics. */
  metadata?: Record<string, unknown>
}

/**
 * Props for UniversalGameWrapper.
 *
 * Design `payoutFormula` as a pure, side-effect-free function — the
 * wrapper clamps its output to `Math.max(0, Math.round(…))` before
 * crediting the economy hook, so negative / fractional values are safe.
 */
export interface UniversalGameWrapperProps {
  /** Stable slug identifying this game plugin (used as a data attr). */
  gameId: string
  /** Human-readable title shown in the wrapper header. */
  gameTitle: string
  /** The raw resource this game awards on session completion. */
  targetResourceId: 'raw_data_shards' | 'organic_spores' | 'cosmic_dust'
  /**
   * Pure function mapping raw score → resource payout amount.
   * Called once per completed session inside the interceptor pipeline.
   */
  payoutFormula: (score: number) => number
  /**
   * The child game component. Must accept and call the injected
   * `onGameComplete` prop when its round concludes.
   */
  children: React.ReactElement<{ onGameComplete: (result: GameSessionResult) => void }>
}

/* ════════════════════════════════════════════════════════════════
   §2  INTERNAL TYPES
   ════════════════════════════════════════════════════════════════ */

/** Three-state phase machine. Transitions: idle → playing → result → idle */
type WrapperPhase = 'idle' | 'playing' | 'result'

/** Computed session summary — populated by the onGameComplete pipeline. */
interface SessionSummary {
  score: number
  durationMs: number
  payoutAdded: number
  payoutCapped: boolean
  payoutOverflow: number
}

/* ════════════════════════════════════════════════════════════════
   §3  PURE UTILITIES
   ════════════════════════════════════════════════════════════════ */

/** Formats a total-seconds count as a zero-padded `MM:SS` string. */
function fmtMmSs(totalSeconds: number): string {
  const abs = Math.abs(Math.floor(totalSeconds))
  const m   = Math.floor(abs / 60)
  const s   = abs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/* ════════════════════════════════════════════════════════════════
   §4  COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function UniversalGameWrapper({
  gameId,
  gameTitle,
  targetResourceId,
  payoutFormula,
  children,
}: UniversalGameWrapperProps) {
  const { isAtCapacity, addResources } = useZenithEconomy()

  /* ── Phase state machine ─────────────────────────────────────── */
  const [phase,      setPhase]      = useState<WrapperPhase>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [summary,    setSummary]    = useState<SessionSummary | null>(null)
  /**
   * Increments on every new session start. Placed as `key` on the
   * gameContainer div so the child game component gets a completely
   * fresh mount (and therefore clean internal state) each session.
   */
  const [sessionKey, setSessionKey] = useState(0)

  /* ── Refs: no re-render on mutation, immune to stale closures ── */

  /** `performance.now()` epoch captured at session start. */
  const sessionStartRef = useRef<number>(0)

  /**
   * ID of the one-second display-ticker interval.
   * Stored in a ref so `clearInterval` always reaches the current ID
   * even if the component re-renders between start and stop.
   */
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /**
   * Guards the async `handleGameComplete` tail — prevents state updates
   * after the wrapper has unmounted (e.g., mid-session tab navigation).
   * React 18 silently drops updates on unmounted components, but explicit
   * guarding keeps the intent clear and future-proofs against subtler
   * concurrency scenarios.
   */
  const isMountedRef = useRef(true)

  /* ── Mount / unmount lifecycle ────────────────────────────────── */
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      // Belt-and-suspenders: clear the ticker if we unmount mid-session.
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  /* ── startSession: shared logic for Launch and Play Again ─────── */
  const startSession = useCallback(() => {
    // Clear any orphaned ticker from a previous session.
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
    }
    sessionStartRef.current = performance.now()
    setElapsedSec(0)
    setSessionKey(k => k + 1)   // forces child game component to remount
    setPhase('playing')

    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((performance.now() - sessionStartRef.current) / 1000))
    }, 1000)
  }, [])

  /* ── Launch (idle → playing) ───────────────────────────────────── */
  const handleLaunch = useCallback(() => {
    startSession()
  }, [startSession])

  /* ── Abandon (playing → idle): clean teardown, no payout ──────── */
  const handleAbandon = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setElapsedSec(0)
    setPhase('idle')
  }, [])

  /* ── onGameComplete interceptor pipeline ──────────────────────── */
  const handleGameComplete = useCallback(async (result: GameSessionResult) => {
    // Step 1 — Lock in the precise duration before any async work.
    const durationMs = performance.now() - sessionStartRef.current

    // Stop the display ticker immediately.
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Step 2-3 — Compute clamped integer payout.
    // Abandoned sessions pay nothing; payoutFormula may return floats or
    // negative values — both are safe due to the clamp below.
    const rawPayout = result.status === 'abandoned'
      ? 0
      : Math.max(0, Math.round(payoutFormula(result.score)))

    // Step 4-5 — Credit the economy hook and read the capacity-gate result.
    let payoutResult: AddResourcesResult = {
      added: 0, capped: false, overflowDiscarded: 0,
    }
    if (rawPayout > 0) {
      try {
        payoutResult = await addResources(targetResourceId, rawPayout)
      } catch {
        // addResources is documented as throw-never; guard prevents layout
        // crashes if an unexpected IDB failure surfaces at runtime.
      }
    }

    // Guard: discard state updates if the wrapper has already unmounted.
    if (!isMountedRef.current) return

    // Step 6 — Transition to result phase with the full session summary.
    setSummary({
      score:          result.score,
      durationMs,
      payoutAdded:    payoutResult.added,
      payoutCapped:   payoutResult.capped,
      payoutOverflow: payoutResult.overflowDiscarded,
    })
    setPhase('result')
  }, [addResources, payoutFormula, targetResourceId])

  /* ── Dismiss result (result → idle) ───────────────────────────── */
  const handleDismiss = useCallback(() => {
    setSummary(null)
    setElapsedSec(0)
    setPhase('idle')
  }, [])

  /* ── Play Again (result → playing with fresh child mount) ──────── */
  const handlePlayAgain = useCallback(() => {
    setSummary(null)
    startSession()
  }, [startSession])

  /* ── Computed values ───────────────────────────────────────────── */
  const atCapacity   = isAtCapacity(targetResourceId)
  const resourceName = RESOURCE_META[targetResourceId].name

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div
      className={styles.wrapper}
      data-game-id={gameId}
      data-phase={phase}
    >

      {/* ════════════════════════════════════════════════════════════
          HEADER — game title | live elapsed clock | resource tag
          ════════════════════════════════════════════════════════════ */}
      <header className={styles.header}>
        <h3 className={styles.gameTitle}>{gameTitle}</h3>

        {phase === 'playing' && (
          <time
            className={styles.sessionTimer}
            aria-label="Session elapsed time"
            aria-live="off"
          >
            {fmtMmSs(elapsedSec)}
          </time>
        )}

        {phase === 'idle' && (
          <span className={styles.resourceTag} aria-label={`Earns ${resourceName}`}>
            → {resourceName}
          </span>
        )}
      </header>

      {/* ════════════════════════════════════════════════════════════
          CANVAS — fixed 16:9 frame; all phase content renders here
          ════════════════════════════════════════════════════════════ */}
      <div
        className={styles.canvas}
        role="region"
        aria-label={`${gameTitle} game canvas`}
      >

        {/* ── IDLE: launch screen or capacity gate ─────────────────── */}
        {phase === 'idle' && (
          <div className={styles.launchScreen}>
            {atCapacity ? (
              <div className={styles.capacityWarning} role="alert" aria-live="polite">
                <span className={styles.capacityIcon} aria-hidden="true">◈</span>
                <p className={styles.capacityTitle}>Storage Capacity Reached</p>
                <p className={styles.capacityDesc}>
                  Your <strong>{resourceName}</strong> inventory is full.
                  Spend resources or upgrade storage to earn more.
                </p>
              </div>
            ) : (
              <>
                <div className={styles.launchGlyph} aria-hidden="true">⬡</div>
                <p className={styles.launchHint}>
                  Rewards credited as{' '}
                  <span className={styles.launchHintResource}>{resourceName}</span>
                </p>
              </>
            )}

            <button
              className={styles.launchBtn}
              onClick={handleLaunch}
              disabled={atCapacity}
              aria-label={
                atCapacity
                  ? `Storage full — upgrade capacity to play ${gameTitle}`
                  : `Launch ${gameTitle} session`
              }
            >
              {atCapacity ? 'Storage Full' : 'Launch Session'}
            </button>
          </div>
        )}

        {/* ── PLAYING: active game + escape interceptor ─────────────── */}
        {phase === 'playing' && (
          <>
            <button
              className={styles.exitBtn}
              onClick={handleAbandon}
              aria-label="Abandon session and return to lobby"
              title="Abandon session (no payout)"
            >
              ✕ Exit
            </button>

            {/* key={sessionKey} forces a full remount on each new session */}
            <div className={styles.gameContainer} key={sessionKey}>
              {React.cloneElement(children, {
                onGameComplete: handleGameComplete,
              })}
            </div>
          </>
        )}

        {/* ── RESULT: session wrap-up overlay ──────────────────────── */}
        {phase === 'result' && summary && (
          <div
            className={styles.resultOverlay}
            role="dialog"
            aria-modal="true"
            aria-label={`${gameTitle} session results`}
          >
            <article className={styles.resultCard}>

              <p className={styles.resultHeading}>Session Complete</p>

              <div className={styles.resultStats}>

                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Score</span>
                  <span className={styles.resultValue}>
                    {summary.score.toLocaleString('en-US')}
                  </span>
                </div>

                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Duration</span>
                  <span className={styles.resultValue}>
                    {fmtMmSs(Math.floor(summary.durationMs / 1000))}
                  </span>
                </div>

                <div className={styles.resultDivider} aria-hidden="true" />

                {/* Resources credited — accent green */}
                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Earned</span>
                  <span className={`${styles.resultValue} ${styles.resultValueGreen}`}>
                    +{summary.payoutAdded.toLocaleString('en-US')}{' '}
                    <span className={styles.resultUnit}>{resourceName}</span>
                  </span>
                </div>

                {/* Overflow discarded — accent purple, only shown when capped */}
                {summary.payoutCapped && summary.payoutOverflow > 0 && (
                  <div className={styles.resultRow}>
                    <span className={styles.resultLabel}>Overflow</span>
                    <span className={`${styles.resultValue} ${styles.resultValuePurple}`}>
                      −{summary.payoutOverflow.toLocaleString('en-US')} discarded
                    </span>
                  </div>
                )}

              </div>

              {/* Storage ceiling advisory — periwinkle tinted aside */}
              {summary.payoutCapped && (
                <p className={styles.capNotice}>
                  Storage ceiling hit — upgrade capacity to claim full payouts.
                </p>
              )}

              <div className={styles.resultActions}>
                <button
                  className={styles.resultBtn}
                  onClick={handleDismiss}
                  aria-label="Return to game lobby"
                >
                  Lobby
                </button>
                <button
                  className={`${styles.resultBtn} ${styles.resultBtnPrimary}`}
                  onClick={handlePlayAgain}
                  disabled={atCapacity}
                  aria-label={
                    atCapacity
                      ? 'Storage full — cannot play again'
                      : `Play ${gameTitle} again`
                  }
                >
                  Play Again
                </button>
              </div>

            </article>
          </div>
        )}

      </div>
    </div>
  )
}
