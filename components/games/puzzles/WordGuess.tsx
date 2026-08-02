'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { PuzzleGameProps, Difficulty } from './types'
import { usePuzzleTimer } from './usePuzzleTimer'
import PuzzleStopwatch from './PuzzleStopwatch'
import { isValidGuess, randomAnswer } from './data/wordGuessWords'
import styles from './WordGuess.module.css'

/* ── Difficulty tuning ───────────────────────────────────────────────────────
 * easy   → 4-letter word, 6 guesses (gentle warm-up)
 * medium → 5-letter word, 6 guesses (classic Wordle)
 * hard   → 6-letter word, 5 guesses (longer word + one fewer try)
 */
interface DiffConfig { length: number; rows: number }
const DIFF_CONFIG: Record<Difficulty, DiffConfig> = {
  easy:   { length: 4, rows: 6 },
  medium: { length: 5, rows: 6 },
  hard:   { length: 6, rows: 5 },
}

type TileState = 'empty' | 'filled' | 'correct' | 'present' | 'absent'
type Phase = 'playing' | 'won' | 'lost'

/** Keyboard layout rows. */
const KEY_ROWS: string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'back'],
]

/**
 * Standard Wordle coloring with correct duplicate handling.
 * Pass 1 marks exact-position matches (green) and consumes those answer
 * letters; pass 2 marks present-but-wrong-position (amber) only while
 * unconsumed copies remain — everything else is absent (grey).
 */
function scoreGuess(guess: string, answer: string): TileState[] {
  const len = answer.length
  const result: TileState[] = new Array(len).fill('absent')
  const remaining: Record<string, number> = {}

  for (let i = 0; i < len; i++) {
    const ch = answer[i]
    remaining[ch] = (remaining[ch] ?? 0) + 1
  }
  for (let i = 0; i < len; i++) {
    if (guess[i] === answer[i]) {
      result[i] = 'correct'
      remaining[guess[i]] -= 1
    }
  }
  for (let i = 0; i < len; i++) {
    if (result[i] === 'correct') continue
    const ch = guess[i]
    if ((remaining[ch] ?? 0) > 0) {
      result[i] = 'present'
      remaining[ch] -= 1
    }
  }
  return result
}

/** Merge tile states into per-letter keyboard states (best state wins). */
const RANK: Record<string, number> = { absent: 1, present: 2, correct: 3 }
function mergeKeyState(prev: TileState | undefined, next: TileState): TileState {
  if (!prev) return next
  return (RANK[next] ?? 0) > (RANK[prev] ?? 0) ? next : prev
}

export default function WordGuess({ difficulty, onWin }: PuzzleGameProps) {
  const cfg = DIFF_CONFIG[difficulty]
  const { length: WORD_LEN, rows: MAX_ROWS } = cfg

  const [answer, setAnswer]       = useState('')
  const [guesses, setGuesses]     = useState<string[]>([])          // submitted rows
  const [scores, setScores]       = useState<TileState[][]>([])     // scored rows
  const [current, setCurrent]     = useState('')                    // in-progress row
  const [phase, setPhase]         = useState<Phase>('playing')
  const [message, setMessage]     = useState('')                    // inline invalid msg
  const [shakeRow, setShakeRow]   = useState(false)
  const [revealRow, setRevealRow] = useState(-1)                    // row index animating flip
  const [finalMs, setFinalMs]     = useState(0)

  const timer = usePuzzleTimer()

  // Refs so the global keydown handler always reads fresh state.
  const phaseRef    = useRef(phase)
  const currentRef  = useRef(current)
  const guessesRef  = useRef(guesses)
  const answerRef   = useRef(answer)
  const onWinFired  = useRef(false)
  const msgTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null)

  phaseRef.current   = phase
  currentRef.current = current
  guessesRef.current = guesses
  answerRef.current  = answer

  /** Fresh game — new random answer + full reset. */
  const startGame = useCallback(() => {
    setAnswer(randomAnswer(WORD_LEN))
    setGuesses([])
    setScores([])
    setCurrent('')
    setPhase('playing')
    setMessage('')
    setShakeRow(false)
    setRevealRow(-1)
    setFinalMs(0)
    onWinFired.current = false
    timer.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WORD_LEN])

  // Boot / re-boot whenever the difficulty (word length) changes.
  useEffect(() => {
    startGame()
  }, [startGame])

  const flashMessage = useCallback((text: string) => {
    setMessage(text)
    if (msgTimeout.current) clearTimeout(msgTimeout.current)
    msgTimeout.current = setTimeout(() => setMessage(''), 1600)
  }, [])

  const doShake = useCallback(() => {
    setShakeRow(true)
    setTimeout(() => setShakeRow(false), 480)
  }, [])

  /** Attempt to submit the in-progress row. */
  const submitGuess = useCallback(() => {
    const guess = currentRef.current
    const ans   = answerRef.current
    if (phaseRef.current !== 'playing') return
    if (guess.length !== WORD_LEN) {
      flashMessage('Not enough letters')
      doShake()
      return
    }
    if (!isValidGuess(guess, WORD_LEN)) {
      flashMessage('Not in word list')
      doShake()
      return
    }

    const rowScore = scoreGuess(guess, ans)
    const rowIndex = guessesRef.current.length

    setGuesses((g) => [...g, guess])
    setScores((s) => [...s, rowScore])
    setCurrent('')
    setRevealRow(rowIndex)

    const solved = guess === ans
    const lastRow = rowIndex + 1 >= MAX_ROWS
    const revealDelay = WORD_LEN * 220 + 260   // wait for the flip cascade

    if (solved) {
      const ms = timer.stop()
      setFinalMs(ms)
      window.setTimeout(() => {
        setPhase('won')
        if (!onWinFired.current) {
          onWinFired.current = true
          onWin(ms)
        }
      }, revealDelay)
    } else if (lastRow) {
      timer.stop()
      window.setTimeout(() => setPhase('lost'), revealDelay)
    }
  }, [WORD_LEN, MAX_ROWS, flashMessage, doShake, timer, onWin])

  /** Central input handler shared by physical + on-screen keyboards. */
  const handleKey = useCallback((raw: string) => {
    if (phaseRef.current !== 'playing') return
    const key = raw.toLowerCase()

    if (key === 'enter') { submitGuess(); return }
    if (key === 'back' || key === 'backspace') {
      setCurrent((c) => c.slice(0, -1))
      return
    }
    if (/^[a-z]$/.test(key)) {
      if (!timer.running && guessesRef.current.length === 0 && currentRef.current.length === 0) {
        timer.start()   // stopwatch begins on the very first letter
      }
      setCurrent((c) => (c.length < WORD_LEN ? c + key : c))
    }
  }, [WORD_LEN, submitGuess, timer])

  // Physical keyboard listener (mounted once; reads fresh state via handleKey deps).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement
      const tag = el?.tagName
      const editable = tag === 'INPUT' || tag === 'TEXTAREA' ||
        (el instanceof HTMLElement && el.isContentEditable)
      if (editable) return

      const k = e.key
      if (k === 'Enter') { e.preventDefault(); handleKey('enter'); return }
      if (k === 'Backspace') { e.preventDefault(); handleKey('back'); return }
      if (k === ' ') { e.preventDefault(); return }   // stop page scroll
      if (/^[a-zA-Z]$/.test(k)) { handleKey(k) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleKey])

  useEffect(() => () => { if (msgTimeout.current) clearTimeout(msgTimeout.current) }, [])

  // Per-letter keyboard coloring derived from all scored guesses.
  const keyStates = useMemo(() => {
    const map: Record<string, TileState> = {}
    guesses.forEach((g, r) => {
      const sc = scores[r]
      if (!sc) return
      for (let i = 0; i < g.length; i++) {
        map[g[i]] = mergeKeyState(map[g[i]], sc[i])
      }
    })
    return map
  }, [guesses, scores])

  // Build the fixed grid of rows for render.
  const gridRows = useMemo(() => {
    const rows: { letters: string[]; states: TileState[]; index: number }[] = []
    for (let r = 0; r < MAX_ROWS; r++) {
      const letters: string[] = new Array(WORD_LEN).fill('')
      const stateArr: TileState[] = new Array(WORD_LEN).fill('empty')
      if (r < guesses.length) {
        const g = guesses[r]
        const sc = scores[r] ?? []
        for (let i = 0; i < WORD_LEN; i++) {
          letters[i] = g[i] ?? ''
          stateArr[i] = sc[i] ?? 'absent'
        }
      } else if (r === guesses.length && phase === 'playing') {
        for (let i = 0; i < WORD_LEN; i++) {
          letters[i] = current[i] ?? ''
          stateArr[i] = current[i] ? 'filled' : 'empty'
        }
      }
      rows.push({ letters, states: stateArr, index: r })
    }
    return rows
  }, [MAX_ROWS, WORD_LEN, guesses, scores, current, phase])

  const activeRowIndex = guesses.length

  return (
    <div className={styles.wrap} data-len={WORD_LEN}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.title}>Word Guess</span>
          <span className={styles.sub}>{WORD_LEN} letters · {MAX_ROWS} tries</span>
        </div>
        <PuzzleStopwatch ms={timer.elapsedMs} running={timer.running} />
      </div>

      {/* Inline status / invalid message (aria-live) */}
      <div className={styles.statusLine} aria-live="polite" role="status">
        {message ? <span className={styles.toastMsg}>{message}</span> : null}
      </div>

      {/* Board */}
      <div className={styles.board} style={{ ['--cols' as string]: WORD_LEN }}>
        {gridRows.map((row) => {
          const isActive = row.index === activeRowIndex && phase === 'playing'
          const isRevealing = row.index === revealRow
          return (
            <div
              key={row.index}
              className={`${styles.row} ${isActive && shakeRow ? styles.rowShake : ''}`}
              aria-label={
                row.index < guesses.length
                  ? `Row ${row.index + 1}: ${guesses[row.index]}`
                  : `Row ${row.index + 1} empty`
              }
            >
              {row.letters.map((ltr, i) => {
                const st = row.states[i]
                const revealed = st === 'correct' || st === 'present' || st === 'absent'
                return (
                  <div
                    key={i}
                    className={[
                      styles.tile,
                      styles[`tile_${st}`] ?? '',
                      ltr && st === 'filled' ? styles.tilePop : '',
                      isRevealing && revealed ? styles.tileFlip : '',
                    ].join(' ')}
                    style={isRevealing ? { animationDelay: `${i * 220}ms` } : undefined}
                    data-state={st}
                  >
                    <span className={styles.tileFace}>{ltr.toUpperCase()}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Win / loss banner */}
      {phase !== 'playing' && (
        <div className={`${styles.result} ${phase === 'won' ? styles.resultWon : styles.resultLost}`}>
          {phase === 'won' ? (
            <>
              <span className={styles.resultBig}>Solved!</span>
              <span className={styles.resultMeta}>
                <strong>{answer.toUpperCase()}</strong> in {guesses.length}{' '}
                {guesses.length === 1 ? 'guess' : 'guesses'} · {(finalMs / 1000).toFixed(1)}s
              </span>
              <span className={styles.confetti} aria-hidden="true">
                {Array.from({ length: 14 }).map((_, i) => (
                  <i key={i} style={{ ['--n' as string]: i }} />
                ))}
              </span>
            </>
          ) : (
            <>
              <span className={styles.resultBig}>Out of tries</span>
              <span className={styles.resultMeta}>
                The word was <strong>{answer.toUpperCase()}</strong>
              </span>
            </>
          )}
          <button className={styles.playAgain} onClick={startGame} aria-label="Play again">
            Play again
          </button>
        </div>
      )}

      {/* On-screen keyboard */}
      <div className={styles.keyboard} role="group" aria-label="On-screen keyboard">
        {KEY_ROWS.map((krow, ri) => (
          <div key={ri} className={styles.keyRow}>
            {krow.map((k) => {
              const wide = k === 'enter' || k === 'back'
              const st = keyStates[k]
              const label = k === 'back' ? '⌫' : k === 'enter' ? 'Enter' : k.toUpperCase()
              return (
                <button
                  key={k}
                  type="button"
                  className={[
                    styles.key,
                    wide ? styles.keyWide : '',
                    st ? styles[`key_${st}`] ?? '' : '',
                  ].join(' ')}
                  onClick={() => handleKey(k)}
                  disabled={phase !== 'playing'}
                  aria-label={k === 'back' ? 'Backspace' : k === 'enter' ? 'Enter' : `Letter ${k}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
