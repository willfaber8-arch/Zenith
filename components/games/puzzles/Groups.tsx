'use client'

/**
 * Groups — a Connections-style word grouping puzzle.
 *
 * Sixteen words hide four secret categories. Select four tiles and submit; a
 * correct set locks in as a coloured band that slides to the top, a wrong set
 * shakes and burns a mistake ("One away!" when three of four belong together).
 * Solve all four groups before the mistakes run out. Difficulty controls the
 * mistake budget and the puzzle bank (easy = 6 mistakes, medium/hard = 4).
 */

import { useState, useRef, useCallback, useEffect, useMemo, type CSSProperties } from 'react'
import type { PuzzleGameProps, Difficulty } from './types'
import { usePuzzleTimer } from './usePuzzleTimer'
import PuzzleStopwatch from './PuzzleStopwatch'
import { pickGroupsPuzzle, type GroupsPuzzle } from './data/groupsPuzzles'
import styles from './Groups.module.css'

const MISTAKE_BUDGET: Record<Difficulty, number> = { easy: 6, medium: 4, hard: 4 }

/** Rank colours: easiest → hardest (yellow, green, blue, purple). */
const RANK_COLOR = ['#e0b64e', '#52cca3', '#6ea8ff', '#b184f0']

interface Tile { word: string; group: number }

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildTiles(puzzle: GroupsPuzzle): Tile[] {
  const flat: Tile[] = []
  puzzle.groups.forEach((g, gi) => g.words.forEach(word => flat.push({ word, group: gi })))
  return shuffle(flat)
}

type Status = 'playing' | 'won' | 'lost'

export default function Groups({ difficulty, onWin }: PuzzleGameProps) {
  const timer = usePuzzleTimer()
  const startedRef = useRef(false)
  const wonRef = useRef(false)

  const [initial] = useState(() => pickGroupsPuzzle(difficulty))
  const [puzzle, setPuzzle] = useState<GroupsPuzzle>(initial.puzzle)
  const [puzzleIndex, setPuzzleIndex] = useState<number>(initial.index)

  const [tiles, setTiles] = useState<Tile[]>(() => buildTiles(initial.puzzle))
  const [selected, setSelected] = useState<string[]>([])
  const [solved, setSolved] = useState<number[]>([])          // solved group indices, in solve order
  const [autoRevealed, setAutoRevealed] = useState<number[]>([]) // groups exposed on a loss
  const [mistakesLeft, setMistakesLeft] = useState<number>(MISTAKE_BUDGET[difficulty])
  const [status, setStatus] = useState<Status>('playing')
  const [message, setMessage] = useState<string>('')
  const [shaking, setShaking] = useState(false)
  const [shuffleNonce, setShuffleNonce] = useState(0)
  const [finalMs, setFinalMs] = useState(0)

  const total = MISTAKE_BUDGET[difficulty]

  /* Reset to a brand new puzzle of the same difficulty. */
  const resetGame = useCallback(() => {
    const picked = pickGroupsPuzzle(difficulty, puzzleIndex)
    wonRef.current = false
    startedRef.current = false
    timer.reset()
    setPuzzle(picked.puzzle)
    setPuzzleIndex(picked.index)
    setTiles(buildTiles(picked.puzzle))
    setSelected([])
    setSolved([])
    setAutoRevealed([])
    setMistakesLeft(MISTAKE_BUDGET[difficulty])
    setStatus('playing')
    setMessage('')
    setFinalMs(0)
    setShuffleNonce(n => n + 1)
  }, [difficulty, puzzleIndex, timer])

  const toggleTile = useCallback((word: string) => {
    if (status !== 'playing') return
    if (!startedRef.current) { startedRef.current = true; timer.start() }
    setMessage('')
    setSelected(prev => {
      if (prev.includes(word)) return prev.filter(w => w !== word)
      if (prev.length >= 4) return prev
      return [...prev, word]
    })
  }, [status, timer])

  const handleSubmit = useCallback(() => {
    if (status !== 'playing' || selected.length !== 4) return

    const groupOf = new Map(tiles.map(t => [t.word, t.group]))
    const picks = selected.map(w => groupOf.get(w) ?? -1)
    const first = picks[0]
    const allSame = picks.every(g => g === first)

    if (allSame && first >= 0 && !solved.includes(first)) {
      const next = [...solved, first]
      setSolved(next)
      setSelected([])
      if (next.length === 4) {
        if (!wonRef.current) {
          wonRef.current = true
          const ms = timer.stop()
          setFinalMs(ms)
          setStatus('won')
          setMessage('Flawless — all four groups found!')
          onWin(ms)
        }
      } else {
        setMessage(`${puzzle.groups[first].name} — locked in.`)
      }
      return
    }

    // Wrong guess -------------------------------------------------------
    const counts = new Map<number, number>()
    picks.forEach(g => counts.set(g, (counts.get(g) ?? 0) + 1))
    const oneAway = [...counts.values()].some(c => c === 3)

    setShaking(true)
    window.setTimeout(() => setShaking(false), 540)

    const left = mistakesLeft - 1
    setMistakesLeft(left)

    if (left <= 0) {
      timer.stop()
      const remaining = [0, 1, 2, 3].filter(g => !solved.includes(g)).sort((a, b) => a - b)
      setAutoRevealed(remaining)
      setSelected([])
      setStatus('lost')
      setMessage('Out of guesses — the groups are revealed.')
    } else {
      setMessage(oneAway ? 'One away…' : 'Not a group.')
    }
  }, [status, selected, tiles, solved, mistakesLeft, puzzle, timer, onWin])

  const deselectAll = useCallback(() => {
    if (status !== 'playing') return
    setSelected([])
    setMessage('')
  }, [status])

  const shuffleTiles = useCallback(() => {
    if (status !== 'playing') return
    setTiles(prev => shuffle(prev))
    setShuffleNonce(n => n + 1)
  }, [status])

  /* Enter submits when a full set is selected. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (status !== 'playing') return
      if (e.key === 'Enter' && selected.length === 4) { e.preventDefault(); handleSubmit() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, selected, handleSubmit])

  const lockedSet = useMemo(
    () => new Set([...solved, ...autoRevealed]),
    [solved, autoRevealed],
  )

  /* Bands render in solve order, then any auto-revealed groups (ascending). */
  const bands = useMemo(
    () => [
      ...solved.map(g => ({ g, auto: false })),
      ...autoRevealed.map(g => ({ g, auto: true })),
    ],
    [solved, autoRevealed],
  )

  const remainingTiles = useMemo(
    () => tiles.filter(t => !lockedSet.has(t.group)),
    [tiles, lockedSet],
  )

  const gameOver = status !== 'playing'

  return (
    <div className={styles.wrap}>
      {/* HUD ---------------------------------------------------------- */}
      <div className={styles.hud}>
        <PuzzleStopwatch ms={gameOver ? finalMs || timer.elapsedMs : timer.elapsedMs} running={timer.running} />
        <div className={styles.mistakes}>
          <span className={styles.mistakesLabel}>Mistakes</span>
          <span className={styles.pips} aria-label={`${mistakesLeft} of ${total} mistakes remaining`}>
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`${styles.pip} ${i >= mistakesLeft ? styles.pipUsed : ''}`}
                aria-hidden="true"
              />
            ))}
          </span>
        </div>
      </div>

      {/* Solved / revealed bands ------------------------------------- */}
      {bands.length > 0 && (
        <div className={styles.bands}>
          {bands.map(({ g, auto }, idx) => (
            <div
              key={g}
              className={`${styles.band} ${auto ? styles.bandAuto : ''}`}
              style={{ '--rank': RANK_COLOR[g], animationDelay: `${idx * 90}ms` } as CSSProperties}
            >
              <span className={styles.bandName}>{puzzle.groups[g].name}</span>
              <span className={styles.bandWords}>{puzzle.groups[g].words.join(' · ')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tile grid ---------------------------------------------------- */}
      {remainingTiles.length > 0 && (
        <div key={shuffleNonce} className={styles.grid}>
          {remainingTiles.map(t => {
            const isSel = selected.includes(t.word)
            return (
              <button
                key={t.word}
                type="button"
                disabled={gameOver}
                aria-pressed={isSel}
                className={`${styles.tile} ${isSel ? styles.tileSelected : ''} ${isSel && shaking ? styles.tileShake : ''}`}
                onClick={() => toggleTile(t.word)}
              >
                <span className={styles.tileWord}>{t.word}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Feedback ----------------------------------------------------- */}
      <div
        className={`${styles.feedback} ${status === 'won' ? styles.feedbackWin : ''} ${status === 'lost' ? styles.feedbackLoss : ''}`}
        aria-live="polite"
        role="status"
      >
        {message || (status === 'playing' ? `Find the four groups — pick ${4 - selected.length} more.` : ' ')}
      </div>

      {/* Controls ----------------------------------------------------- */}
      {!gameOver ? (
        <div className={styles.controls}>
          <button type="button" className={styles.ctrlGhost} onClick={shuffleTiles}>
            ⤮ Shuffle
          </button>
          <button
            type="button"
            className={styles.ctrlGhost}
            onClick={deselectAll}
            disabled={selected.length === 0}
          >
            Deselect all
          </button>
          <button
            type="button"
            className={styles.ctrlPrimary}
            onClick={handleSubmit}
            disabled={selected.length !== 4}
          >
            Submit
          </button>
        </div>
      ) : (
        <div className={`${styles.endBar} ${status === 'won' ? styles.endBarWin : styles.endBarLoss}`}>
          {status === 'won' && (
            <div className={styles.sparkles} aria-hidden="true">
              {Array.from({ length: 14 }).map((_, i) => (
                <span
                  key={i}
                  className={styles.spark}
                  style={{
                    left: `${(i * 37 + 8) % 96}%`,
                    animationDelay: `${(i % 7) * 80}ms`,
                    background: RANK_COLOR[i % 4],
                  }}
                />
              ))}
            </div>
          )}
          <span className={styles.endText}>
            {status === 'won'
              ? `Solved in ${(finalMs / 1000).toFixed(1)}s`
              : 'Better luck next round'}
          </span>
          <button type="button" className={styles.ctrlPrimary} onClick={resetGame}>
            ↻ Play again
          </button>
        </div>
      )}
    </div>
  )
}
