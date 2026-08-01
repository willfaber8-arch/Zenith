/**
 * Shared contract for the Arcade "Puzzles" section.
 * Every puzzle game is a self-contained component implementing PuzzleGameProps.
 */

export type Difficulty = 'easy' | 'medium' | 'hard'
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy', medium: 'Medium', hard: 'Hard',
}

export interface PuzzleGameProps {
  difficulty: Difficulty
  /** Call exactly once when the puzzle is solved; timeMs = solve duration. */
  onWin: (timeMs: number) => void
}
