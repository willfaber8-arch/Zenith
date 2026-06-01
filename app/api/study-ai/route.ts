/**
 * Zenith OS — Study AI Gateway
 * Phase 3 · Step 3.5 — Secure LLM Proxy Endpoint
 *
 * POST /api/study-ai
 * Body: { text: string, title?: string }
 * Returns: { markdownSummary: string, flashcards: Flashcard[] }
 *
 * The Anthropic API key is read exclusively from process.env.LLM_API_KEY
 * and never exposed to the browser bundle.  All LLM traffic is proxied
 * server-side so the client only sends plain study text and receives
 * structured JSON.
 */

import Anthropic          from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { StudyAiResponse }      from '@/types/studyAi'

/* ── Constants ────────────────────────────────────────────────── */

const MAX_INPUT_CHARS = 16_000   // ~4 k tokens — generous for lecture notes
const MIN_INPUT_CHARS = 40       // reject nonsense submissions

/* ── System prompt ────────────────────────────────────────────── */
/*
 * Strict instructions to produce a parseable JSON object with no
 * surrounding text or markdown fences.  The quality bar at the end
 * ensures graceful degradation on very short / unclear input.
 */
const SYSTEM_PROMPT = `\
You are Zenith AI — a precision academic study assistant embedded in a personal productivity dashboard.

Your sole task: analyse the provided study material and produce a structured JSON study package.

CRITICAL OUTPUT RULE: Respond with ONLY a raw JSON object. No markdown code fences. No preamble. No trailing commentary. The first character of your response must be { and the last must be }.

Required JSON structure (no additional keys):
{
  "markdownSummary": "...",
  "flashcards": [
    { "id": "1", "question": "...", "answer": "..." }
  ]
}

════ markdownSummary Rules ════
• Use ## for 2–4 major topic sections
• Use **Term**: Definition pattern to introduce key vocabulary
• Use - bullet lists for enumerated concepts, process steps, or examples
• Target 350–600 words — dense academic prose, no filler
• Structure: concise overview paragraph → key concepts → mechanisms / processes → applications or examples

════ flashcards Rules ════
• Generate exactly 10–15 cards — more for rich material, fewer for thin input
• Target the highest-yield, exam-relevant concepts only
• Questions must be precise and answerable:
  — Prefer "What is…", "How does…", "Which…", "Define…" patterns
  — Avoid vague "Explain…" or "Describe…" prompts
• Answers must be complete standalone sentences — no pronouns without referent
• Sequential string IDs starting at "1"
• Vary cognitive level: ~40 % recall, ~40 % application, ~20 % synthesis / comparison

════ Graceful Degradation ════
If the input is too short or ambiguous to fully analyse, still return the required JSON structure.
Set markdownSummary to a brief note about the limitation, and provide at least 3 generic
study-technique flashcards (e.g. spaced repetition, active recall, Feynman technique).`

/* ── POST handler ─────────────────────────────────────────────── */

export async function POST(req: NextRequest): Promise<NextResponse> {
  /* 1 ─ Guard: API key must be configured server-side */
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service is not configured. Set LLM_API_KEY in your .env.local file.' },
      { status: 503 },
    )
  }

  /* 2 ─ Parse and validate the request body */
  let text: string
  let title: string
  try {
    const body = await req.json()
    text  = typeof body.text  === 'string' ? body.text.trim()  : ''
    title = typeof body.title === 'string' ? body.title.trim() : 'Untitled Study Material'
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (text.length < MIN_INPUT_CHARS) {
    return NextResponse.json(
      { error: `Please provide at least ${MIN_INPUT_CHARS} characters of study content.` },
      { status: 400 },
    )
  }

  /* 3 ─ Call the Anthropic API */
  const model = process.env.LLM_MODEL ?? 'claude-haiku-4-5-20251001'

  const client = new Anthropic({ apiKey })

  let raw: string
  try {
    const message = await client.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{
        role:    'user',
        content: `Title: ${title}\n\nContent:\n${text.slice(0, MAX_INPUT_CHARS)}`,
      }],
    })

    const block = message.content[0]
    raw = block.type === 'text' ? block.text.trim() : ''
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[study-ai] Anthropic API error:', msg)
    return NextResponse.json(
      { error: 'The AI service returned an error. Please try again.' },
      { status: 502 },
    )
  }

  /* 4 ─ Parse and validate the JSON response */
  let parsed: StudyAiResponse
  try {
    // Strip accidental markdown fences the model might add despite instructions
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[study-ai] JSON parse failure. Raw response:\n', raw.slice(0, 500))
    return NextResponse.json(
      { error: 'AI returned a malformed response. Please try again.' },
      { status: 502 },
    )
  }

  if (
    typeof parsed.markdownSummary !== 'string' ||
    !Array.isArray(parsed.flashcards)          ||
    parsed.flashcards.some(
      c => typeof c.id !== 'string' || typeof c.question !== 'string' || typeof c.answer !== 'string'
    )
  ) {
    return NextResponse.json(
      { error: 'AI response did not match the expected schema. Please try again.' },
      { status: 502 },
    )
  }

  /* 5 ─ Return the structured study package */
  return NextResponse.json({
    markdownSummary: parsed.markdownSummary,
    flashcards:      parsed.flashcards,
  } satisfies StudyAiResponse)
}
