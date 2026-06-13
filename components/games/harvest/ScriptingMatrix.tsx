'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * ScriptingMatrix — Games Tab · Step 4.1 · Harvest Station
 *
 * Typography speed game — users type engineering prompts drawn from
 * the Zenith codebase to harvest Raw Data Shards.
 *
 * Session contract:
 *  • 60-second countdown; starts on the player's first keystroke.
 *  • Character-by-character real-time colour feedback:
 *      correct  → --accent-green  (#52cca3)
 *      error    → --accent-purple (#7c95ff)
 *      pending  → --text-muted (low contrast)
 *      cursor   → --text-primary + blinking underline
 *  • addResources('raw_data_shards', payout) fires on every
 *    completed prompt — fire-and-forget, non-blocking.
 *  • Payout formula: words × speed_tier (1–4) + accuracy_bonus (0–4)
 *  • WPM computed via performance.now() epoch — immune to
 *    setInterval drift and tab hibernation.
 *  • All hot-path reads go through refs to prevent stale closures
 *    inside the onChange handler and the completion callback.
 *  • Compatible with UniversalGameWrapper via the optional
 *    onGameComplete prop; also usable standalone via onSessionComplete.
 * ════════════════════════════════════════════════════════════════
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import { useZenithEconomy }      from '@/hooks/useZenithEconomy'
import type { GameSessionResult } from '@/components/games/UniversalGameWrapper'
import styles from './ScriptingMatrix.module.css'

/* ════════════════════════════════════════════════════════════════
   §1  CONSTANTS
   ════════════════════════════════════════════════════════════════ */

const SESSION_DURATION_S = 60

/**
 * 20 high-density engineering strings drawn from the Zenith
 * codebase — real API surface, real design tokens, real patterns.
 * Chosen for typographic density and authentic Zen Tech aesthetics.
 */
const PROMPT_POOL: readonly string[] = [
  'const activeTheme = useLiveQuery();',
  'db.resource_inventory.upsert(payload);',
  '0.4s cubic-bezier(0.25, 1, 0.5, 1);',
  'await addResources("raw_data_shards", payout);',
  'border: 1px solid var(--border-subtle);',
  'transform: translateX(-100%) scale(0.97);',
  'export type ResourceId = "raw_data_shards";',
  'const { addResources } = useZenithEconomy();',
  'useLiveQuery(() => db.habits.toArray(), []);',
  'background: var(--surface-card);',
  'font-family: var(--font-mono);',
  'transition: opacity 360ms var(--ease-expo);',
  'interface ResourceNode { id: ResourceId; }',
  'const [phase, setPhase] = useState("idle");',
  'return gamesDb.transaction("rw", [table]);',
  '@keyframes scaleIn { from { scale: 0.96; } }',
  'const sessionKey = useRef(performance.now());',
  'type WrapperPhase = "idle" | "playing" | "result";',
  'db.resource_inventory.update(id, { balance });',
  'const wpm = Math.round((chars / 5) / elapsed);',
] as const

/* ════════════════════════════════════════════════════════════════
   §2  PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

/** Live session snapshot — describes the current harvesting state. */
export interface MatrixPromptSession {
  activePrompt:   string
  charIndex:      number
  rawScore:       number
  wordsPerMinute: number
  accuracyRate:   number
}

export interface ScriptingMatrixProps {
  /** Called with the total shards harvested when the session ends. */
  onSessionComplete?: (finalScore: number) => void
  /**
   * Injected by UniversalGameWrapper when ScriptingMatrix is mounted
   * as an Arcade Hub plugin. Optional — the component is also fully
   * functional as a standalone card.
   */
  onGameComplete?: (result: GameSessionResult) => void
}

/* ════════════════════════════════════════════════════════════════
   §3  INTERNAL TYPES
   ════════════════════════════════════════════════════════════════ */

/** Three-phase session machine: ready → active → ended */
type SessionPhase = 'ready' | 'active' | 'ended'

/* ════════════════════════════════════════════════════════════════
   §4  PURE UTILITIES
   ════════════════════════════════════════════════════════════════ */

/**
 * Returns a random prompt from the pool that is different from the
 * currently active one, ensuring the player always sees a new string.
 */
function pickNext(current: string): string {
  const pool = (PROMPT_POOL as string[]).filter(p => p !== current)
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Formats an integer seconds value as `M:SS` for the timer display. */
function fmtTime(secs: number): string {
  const s = Math.max(0, Math.floor(secs))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Shard payout for one completed prompt.
 *
 * Scale:
 *   words × speed_tier  — word count rewards longer prompts;
 *                          tier climbs 1 → 4 every 20 WPM step.
 *   + accuracy_bonus    — 0–4 bonus shards per accuracy quartile.
 *
 * Floor of 1 ensures even the slowest typist earns something.
 */
function computePayout(prompt: string, wpm: number, accuracyPct: number): number {
  const words    = prompt.trim().split(/\s+/).length
  const tier     = wpm < 20 ? 1 : wpm < 40 ? 2 : wpm < 60 ? 3 : 4
  const accBonus = Math.floor(accuracyPct / 25)   // one bonus shard per 25% accuracy
  return Math.max(1, words * tier + accBonus)
}

/* ════════════════════════════════════════════════════════════════
   §5  SUB-COMPONENT: CharDisplay
   Character-level prompt renderer. Pure — no hooks, no side effects.
   Renders each character of `prompt` in one of four visual states
   depending on the player's typed progress.
   ════════════════════════════════════════════════════════════════ */

interface CharDisplayProps {
  prompt: string
  typed:  string
}

function CharDisplay({ prompt, typed }: CharDisplayProps) {
  return (
    <span className={styles.promptText} aria-hidden="true">
      {Array.from(prompt).map((char, i) => {
        let cls: string
        if (i < typed.length) {
          cls = typed[i] === char ? styles.charCorrect : styles.charError
        } else if (i === typed.length) {
          cls = styles.charCursor
        } else {
          cls = styles.charPending
        }
        // Render a non-breaking space so the layout doesn't collapse on spaces
        return (
          <span key={i} className={cls}>
            {char === ' ' ? ' ' : char}
          </span>
        )
      })}
    </span>
  )
}

/* ════════════════════════════════════════════════════════════════
   §6  COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function ScriptingMatrix({
  onSessionComplete,
  onGameComplete,
}: ScriptingMatrixProps) {
  const { addResources } = useZenithEconomy()

  /* ── React state (drives renders) ───────────────────────────── */
  const [phase,        setPhase]        = useState<SessionPhase>('ready')
  const [activePrompt, setActivePrompt] = useState<string>(
    () => PROMPT_POOL[Math.floor(Math.random() * PROMPT_POOL.length)] as string
  )
  const [inputValue,   setInputValue]   = useState('')
  const [timeLeft,     setTimeLeft]     = useState(SESSION_DURATION_S)
  const [rawScore,     setRawScore]     = useState(0)
  const [promptsDone,  setPromptsDone]  = useState(0)
  const [totalKeys,    setTotalKeys]    = useState(0)
  const [errorKeys,    setErrorKeys]    = useState(0)
  const [totalChars,   setTotalChars]   = useState(0)

  /* ── Refs: synchronous reads inside async-capable callbacks ──── */

  const inputRef        = useRef<HTMLInputElement>(null)
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef    = useRef(true)
  const sessionStartRef = useRef(0)

  // Mirrors of React state — updated before setXxx() so that callbacks
  // executed between setState() and the next render always read fresh values.
  const phaseRef          = useRef<SessionPhase>('ready')
  const activePromptRef   = useRef(activePrompt)
  const inputValueRef     = useRef('')
  const totalKeysRef      = useRef(0)
  const errorKeysRef      = useRef(0)
  const totalCharsRef     = useRef(0)
  const rawScoreRef       = useRef(0)
  const promptsDoneRef    = useRef(0)

  // Sync refs every render — runs synchronously before JSX, so
  // any callback reading these refs gets the post-render truth.
  phaseRef.current        = phase
  activePromptRef.current = activePrompt

  /* ── Lifecycle ───────────────────────────────────────────────── */

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Trap focus immediately on mount so the player can type without
  // manually clicking the input field first.
  useEffect(() => { inputRef.current?.focus() }, [])

  /* ── Derived display metrics ─────────────────────────────────── */

  const wordsPerMinute = useMemo(() => {
    if (phase === 'ready' || totalChars === 0) return 0
    const elapsedMin = (SESSION_DURATION_S - timeLeft) / 60
    return elapsedMin > 0 ? Math.round((totalChars / 5) / elapsedMin) : 0
  }, [phase, totalChars, timeLeft])

  const accuracyRate = useMemo(
    () =>
      totalKeys === 0
        ? 100
        : Math.round(((totalKeys - errorKeys) / totalKeys) * 100),
    [totalKeys, errorKeys]
  )

  /* ── Session end detection ───────────────────────────────────── */

  useEffect(() => {
    if (phase !== 'active' || timeLeft > 0) return

    // Transition to ended and fire both callback variants
    setPhase('ended')
    phaseRef.current = 'ended'

    const finalScore = rawScoreRef.current
    onSessionComplete?.(finalScore)
    onGameComplete?.({ score: finalScore, status: 'completed' })
  }, [phase, timeLeft, onSessionComplete, onGameComplete])

  /* ── startSession ────────────────────────────────────────────── */

  const startSession = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)

    sessionStartRef.current = performance.now()
    phaseRef.current = 'active'
    setPhase('active')

    timerRef.current = setInterval(() => {
      setTimeLeft(t => Math.max(0, t - 1))
    }, 1000)
  }, [])

  /* ── handlePromptComplete ────────────────────────────────────── */

  const handlePromptComplete = useCallback(() => {
    const prompt    = activePromptRef.current
    const elapsedMs = performance.now() - sessionStartRef.current

    // Compute WPM including the chars we're about to credit
    const charsNow  = totalCharsRef.current + prompt.length
    const wpm       = elapsedMs > 0
      ? Math.round((charsNow / 5) / (elapsedMs / 60_000))
      : 0

    const accPct = totalKeysRef.current === 0
      ? 100
      : Math.round(
          ((totalKeysRef.current - errorKeysRef.current) / totalKeysRef.current) * 100
        )

    const payout = computePayout(prompt, wpm, accPct)

    // Atomic economy commit — addResources is documented as throw-never;
    // the void + catch guards against any unexpected IDB failure at runtime.
    void addResources('raw_data_shards', payout).catch(() => {})

    // Advance all accumulators via refs (synchronous) + React state (async)
    rawScoreRef.current    += payout
    promptsDoneRef.current += 1
    totalCharsRef.current  += prompt.length

    setRawScore(rawScoreRef.current)
    setPromptsDone(promptsDoneRef.current)
    setTotalChars(totalCharsRef.current)

    // Clear input and rotate to next prompt
    inputValueRef.current = ''
    setInputValue('')

    const next = pickNext(prompt)
    activePromptRef.current = next
    setActivePrompt(next)
  }, [addResources])

  /* ── handleInputChange ───────────────────────────────────────── */

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value

      // Start the session clock on the player's very first keystroke
      if (phaseRef.current === 'ready' && newVal.length > 0) startSession()

      // Discard input after the session window closes
      if (phaseRef.current === 'ended') return

      const prompt = activePromptRef.current

      // Clamp: prevent typing past the end of the prompt
      if (newVal.length > prompt.length) return

      // Track keystrokes on forward progress only (ignore backspaces)
      if (newVal.length > inputValueRef.current.length) {
        const pos = inputValueRef.current.length
        totalKeysRef.current += 1
        setTotalKeys(totalKeysRef.current)

        if (newVal[pos] !== prompt[pos]) {
          errorKeysRef.current += 1
          setErrorKeys(errorKeysRef.current)
        }
      }

      inputValueRef.current = newVal
      setInputValue(newVal)

      // Exact match → commit payout and advance
      if (newVal === prompt) handlePromptComplete()
    },
    [startSession, handlePromptComplete]
  )

  /* ── handleReset ─────────────────────────────────────────────── */

  const handleReset = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

    phaseRef.current       = 'ready'
    inputValueRef.current  = ''
    totalKeysRef.current   = 0
    errorKeysRef.current   = 0
    totalCharsRef.current  = 0
    rawScoreRef.current    = 0
    promptsDoneRef.current = 0

    setPhase('ready')
    setTimeLeft(SESSION_DURATION_S)
    setInputValue('')
    setTotalKeys(0)
    setErrorKeys(0)
    setTotalChars(0)
    setRawScore(0)
    setPromptsDone(0)

    const next = PROMPT_POOL[
      Math.floor(Math.random() * PROMPT_POOL.length)
    ] as string
    activePromptRef.current = next
    setActivePrompt(next)

    // Brief timeout so the disabled state clears before re-focusing
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [])

  /* ── Derived display values ──────────────────────────────────── */

  const progressPct = Math.round(
    ((SESSION_DURATION_S - timeLeft) / SESSION_DURATION_S) * 100
  )

  const isUrgent = phase === 'active' && timeLeft <= 10

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div
      className={styles.root}
      data-phase={phase}
      // Click anywhere in the arena to re-focus the hidden input
      onClick={() => inputRef.current?.focus()}
    >

      {/* ════════════════════════════════════════════════════════
          STATS BAR — WPM | accuracy | shards harvested | timer
          ════════════════════════════════════════════════════════ */}
      <div className={styles.statsBar} aria-label="Session statistics">

        <div className={styles.stat}>
          <span className={styles.statLabel}>WPM</span>
          <span className={styles.statValue}>{wordsPerMinute}</span>
        </div>

        <div className={styles.statDivider} aria-hidden="true" />

        <div className={styles.stat}>
          <span className={styles.statLabel}>ACC</span>
          <span className={styles.statValue}>{accuracyRate}%</span>
        </div>

        <div className={styles.statDivider} aria-hidden="true" />

        <div className={styles.stat}>
          <span className={styles.statLabel}>SHARDS</span>
          <span className={`${styles.statValue} ${styles.statGreen}`}>
            {rawScore}
          </span>
        </div>

        <div className={styles.statDivider} aria-hidden="true" />

        <div className={styles.stat}>
          <span className={styles.statLabel}>TIME</span>
          <span
            className={`${styles.statValue} ${isUrgent ? styles.statUrgent : ''}`}
          >
            {fmtTime(timeLeft)}
          </span>
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════
          PROMPT PANEL — character-level colour feedback stream
          ════════════════════════════════════════════════════════ */}
      <div
        className={styles.promptPanel}
        role="region"
        aria-label="Current typing prompt"
      >
        <CharDisplay prompt={activePrompt} typed={inputValue} />
      </div>

      {/* ════════════════════════════════════════════════════════
          PROGRESS TRACK — time elapsed across the 60 s window
          ════════════════════════════════════════════════════════ */}
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Session time progress"
      >
        <div
          className={styles.progressFill}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ════════════════════════════════════════════════════════
          INPUT CONDUIT — borderless text entry with animated
          bottom-underline that shifts to --accent-purple on focus
          ════════════════════════════════════════════════════════ */}
      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          className={styles.inputField}
          value={inputValue}
          onChange={handleInputChange}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={phase === 'ended'}
          aria-label="Type the prompt shown above"
          aria-live="off"
          placeholder={phase === 'ready' ? 'Start typing to begin your session…' : ''}
        />
      </div>

      {/* ════════════════════════════════════════════════════════
          FOOTER HINT — contextual guidance line
          ════════════════════════════════════════════════════════ */}
      <p className={styles.hint} aria-live="polite">
        {phase === 'ready' && (
          'Type the prompt above — session begins on your first keystroke.'
        )}
        {phase === 'active' && (
          `${promptsDone} prompt${promptsDone !== 1 ? 's' : ''} harvested`
        )}
        {phase === 'ended' && ' '}
      </p>

      {/* ════════════════════════════════════════════════════════
          SESSION-END OVERLAY — results + replay CTA
          ════════════════════════════════════════════════════════ */}
      {phase === 'ended' && (
        <div
          className={styles.resultOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Session results"
        >
          <div className={styles.resultCard}>

            <p className={styles.resultHeading}>[ SESSION COMPLETE ]</p>

            <div className={styles.resultGrid}>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Shards Harvested</span>
                <span className={`${styles.resultVal} ${styles.resultGreen}`}>
                  +{rawScore}
                </span>
              </div>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Prompts Typed</span>
                <span className={styles.resultVal}>{promptsDone}</span>
              </div>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Words per Minute</span>
                <span className={styles.resultVal}>{wordsPerMinute}</span>
              </div>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Accuracy</span>
                <span className={styles.resultVal}>{accuracyRate}%</span>
              </div>
            </div>

            <button
              className={styles.restartBtn}
              onClick={handleReset}
              aria-label="Start a new harvesting session"
            >
              Harvest Again
            </button>

          </div>
        </div>
      )}

    </div>
  )
}
