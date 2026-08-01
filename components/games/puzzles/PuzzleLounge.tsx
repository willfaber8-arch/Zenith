'use client'

/**
 * PuzzleLounge — the Arcade "Puzzles" section.
 *
 * Hosts four self-contained puzzle games (Word Guess, Groups, Mini Crossword,
 * Solitaire). Each game manages its own stopwatch and calls onWin(timeMs) when
 * solved; the lounge awards a difficulty-scaled raw arcade resource and toasts.
 * A game+difficulty change remounts the active game to reset it cleanly.
 */

import { useState, useCallback } from 'react'
import { useToast } from '@/lib/ToastContext'
import { useZenithEconomy } from '@/hooks/useZenithEconomy'
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from './types'
import { PUZZLE_REWARD, type PuzzleGameId } from './puzzleReward'
import WordGuess     from './WordGuess'
import Groups        from './Groups'
import MiniCrossword from './MiniCrossword'
import Solitaire     from './Solitaire'
import styles from './PuzzleLounge.module.css'

interface GameMeta { id: PuzzleGameId; label: string; icon: string; blurb: string }

const GAMES: GameMeta[] = [
  { id: 'wordguess', label: 'Word Guess',    icon: '◧', blurb: 'Guess the hidden word' },
  { id: 'groups',    label: 'Groups',        icon: '⊞', blurb: 'Find the four connections' },
  { id: 'crossword', label: 'Mini Crossword',icon: '#', blurb: 'Fill the 5×5 grid' },
  { id: 'solitaire', label: 'Solitaire',     icon: '♠', blurb: 'Classic Klondike' },
]

export default function PuzzleLounge() {
  const { toast } = useToast()
  const { addResources } = useZenithEconomy()

  const [game, setGame]             = useState<PuzzleGameId>('wordguess')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [resetNonce, setResetNonce] = useState(0)

  const reward = PUZZLE_REWARD[game]

  const handleWin = useCallback(async (timeMs: number) => {
    const amount = reward.amounts[difficulty]
    try {
      const res = await addResources(reward.resource, amount)
      const secs = (timeMs / 1000).toFixed(1)
      if (res.added > 0) {
        toast(`Solved in ${secs}s · +${res.added} ${reward.label}`, 'success')
      } else {
        toast(`Solved in ${secs}s · ${reward.label} storage full`, 'info')
      }
    } catch {
      toast('Solved! (reward could not be credited)', 'info')
    }
  }, [addResources, reward, difficulty, toast])

  const renderGame = () => {
    const props = { difficulty, onWin: handleWin }
    switch (game) {
      case 'wordguess': return <WordGuess {...props} />
      case 'groups':    return <Groups {...props} />
      case 'crossword': return <MiniCrossword {...props} />
      case 'solitaire': return <Solitaire {...props} />
    }
  }

  return (
    <div className={styles.lounge}>
      {/* Game selector */}
      <div className={styles.gameTabs} role="tablist" aria-label="Puzzle games">
        {GAMES.map(g => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={game === g.id}
            className={`${styles.gameTab} ${game === g.id ? styles.gameTabActive : ''}`}
            onClick={() => setGame(g.id)}
          >
            <span className={styles.gameIcon} aria-hidden="true">{g.icon}</span>
            <span className={styles.gameLabel}>{g.label}</span>
          </button>
        ))}
      </div>

      {/* Controls row: difficulty + reward hint + new game */}
      <div className={styles.controls}>
        <div className={styles.diffGroup} role="group" aria-label="Difficulty">
          {DIFFICULTIES.map(d => (
            <button
              key={d}
              type="button"
              aria-pressed={difficulty === d}
              className={`${styles.diffBtn} ${difficulty === d ? styles.diffBtnActive : ''}`}
              onClick={() => setDifficulty(d)}
            >
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>

        <span className={styles.rewardHint}>
          Win → <strong>+{reward.amounts[difficulty]}</strong> {reward.label}
        </span>

        <button
          type="button"
          className={styles.newBtn}
          onClick={() => setResetNonce(n => n + 1)}
          title="Restart with a fresh puzzle"
        >
          ↻ New puzzle
        </button>
      </div>

      {/* Active game — key remounts it on any game/difficulty/new change */}
      <div className={styles.gameStage} key={`${game}-${difficulty}-${resetNonce}`}>
        {renderGame()}
      </div>
    </div>
  )
}
