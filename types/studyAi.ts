/**
 * Zenith OS — Study AI Types
 * Phase 3 · Step 3.5 — AI Lecture Summarizer & Flashcard Generator
 */

/** A single two-sided flashcard produced by the AI. */
export interface Flashcard {
  id:       string   // sequential "1", "2", …
  question: string   // front face — specific, testable question
  answer:   string   // back face  — complete standalone sentence
}

/** A single practice test question with answer choices. */
export interface PracticeQuestion {
  id:       string
  question: string
  choices:  string[]   // A–D options
  correct:  number     // 0-indexed index of the correct choice
  explain:  string     // brief explanation of why it's correct
}

/** What the dock should generate */
export interface GenerateOptions {
  summary:      boolean
  flashcards:   boolean
  practiceTest: boolean
}

/** Structured response object from /api/study-ai. */
export interface StudyAiResponse {
  markdownSummary: string           // Markdown-formatted study summary (may be empty string if not requested)
  flashcards:      Flashcard[]      // review cards (may be empty array if not requested)
  practiceTest?:   PracticeQuestion[] // MCQ test (only if requested)
}

/** Error payload returned on non-2xx. */
export interface StudyAiError {
  error: string
}

/** A completed AI study session held in component state. */
export interface StudySession {
  title:           string
  markdownSummary: string
  flashcards:      Flashcard[]
  practiceTest?:   PracticeQuestion[]
  createdAt:       number   // Unix ms
  noteId?:         number   // IDB id of the quickNotes row that cached this session
}
