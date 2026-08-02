import type { Difficulty } from './types'

export type PuzzleGameId = 'wordguess' | 'groups' | 'crossword' | 'solitaire'

/**
 * Completion rewards — raw arcade resources (NOT ✦ Credits, kept scarce), so
 * the puzzles feed the crafting economy like the other minigames. Amounts
 * scale with difficulty; raw-resource storage caps naturally limit farming.
 */
export interface RewardConfig {
  resource: string
  label:    string
  amounts:  Record<Difficulty, number>
}

export const PUZZLE_REWARD: Record<PuzzleGameId, RewardConfig> = {
  wordguess: { resource: 'cosmic_dust',     label: 'Cosmic Dust',     amounts: { easy: 15, medium: 30, hard: 55 } },
  groups:    { resource: 'organic_spores',  label: 'Organic Spores',  amounts: { easy: 15, medium: 30, hard: 55 } },
  crossword: { resource: 'raw_data_shards', label: 'Raw Data Shards', amounts: { easy: 15, medium: 30, hard: 55 } },
  solitaire: { resource: 'cosmic_dust',     label: 'Cosmic Dust',     amounts: { easy: 20, medium: 35, hard: 60 } },
}
