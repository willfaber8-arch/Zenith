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

/** Structured response object from /api/study-ai. */
export interface StudyAiResponse {
  markdownSummary: string      // Markdown-formatted study summary
  flashcards:      Flashcard[] // 10–15 review cards
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
  createdAt:       number   // Unix ms
  noteId?:         number   // IDB id of the quickNotes row that cached this session
}
