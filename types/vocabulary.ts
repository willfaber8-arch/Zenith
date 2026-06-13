/**
 * Zenith OS — Polyglot Vocab Builder
 * Phase 8 · Step 8.1 — Spaced Repetition Schema
 *
 * Two IDB tables: vocab_decks (language containers) and
 * vocab_cards (individual flashcard entries with SM-2 tracking state).
 * Both use UUID string PKs (no auto-increment) for portable identity.
 */

/** A named language deck that groups related vocabulary cards. */
export interface VocabDeck {
  id:           string   // UUID PK — client-generated via crypto.randomUUID()
  languageName: string   // * indexed — e.g. 'Spanish', 'Japanese'
  description:  string   //   optional user notes about the deck
  createdAt:    number   // * indexed — UTC ms; chronological sort
}

/**
 * A single vocabulary flashcard tracked by the SM-2 recall algorithm.
 *
 * SM-2 tracking fields:
 *   easeFactor          — multiplier for interval growth (≥ 1.3, default 2.5)
 *   reviewIntervalDays  — gap in days before next review (starts at 1)
 *   consecutiveSuccesses — streak of grade ≥ 3 responses; resets on failure
 *   stabilityFactor     — normalized 0–1 confidence metric for UI display
 *   nextReviewTimestamp — UTC ms when this card becomes due again
 */
export interface VocabCard {
  id:                    string   // UUID PK
  deckId:                string   // * indexed — FK → VocabDeck.id
  foreignWord:           string   //   the word/phrase in the target language
  nativeTranslation:     string   //   the user's native language meaning
  phoneticSpelling:      string   //   IPA or romanization (may be empty)
  stabilityFactor:       number   //   0–1 confidence metric (derived, not raw SM-2)
  easeFactor:            number   //   SM-2 EF; default 2.5, floor 1.3
  reviewIntervalDays:    number   //   days until next review; default 1
  consecutiveSuccesses:  number   //   resets to 0 on grade < 3
  nextReviewTimestamp:   number   // * indexed — UTC ms; due-date filter
}

/**
 * SM-2 performance grade (0–5 scalar).
 *
 * 0 — Complete blackout: no recall at all
 * 1 — Wrong: recalled only after seeing the answer
 * 2 — Wrong: required a strong hint to recall
 * 3 — Correct: recalled with significant difficulty
 * 4 — Correct: recalled with minor hesitation
 * 5 — Flawless: perfect instant recall
 */
export type RecallGrade = 0 | 1 | 2 | 3 | 4 | 5
