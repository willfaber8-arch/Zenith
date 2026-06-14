/**
 * Zenith OS — Study AI Gateway
 * Phase 3 · Step 3.5 — Secure LLM Proxy Endpoint
 *
 * POST /api/study-ai
 * Body: {
 *   text:     string,
 *   title?:   string,
 *   mode?:    'notes' | 'topic'      (default: 'notes')
 *   generate?: { summary, flashcards, practiceTest }
 * }
 * Returns: { markdownSummary, flashcards, practiceTest? }
 */

import Anthropic          from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { StudyAiResponse, GenerateOptions }      from '@/types/studyAi'
import { rateLimit, clientIp } from '@/lib/server/rateLimit'
import { detectProvider }     from '@/lib/aiProviderUtils'

/* ── Gemini non-streaming helper ──────────────────────────────── */

const GEMINI_BASE         = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_MODEL_DEFAULT = 'gemini-2.0-flash'

async function callGemini(
  apiKey:       string,
  systemPrompt: string,
  userMessage:  string,
  maxTokens:    number,
): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? GEMINI_MODEL_DEFAULT
  const url   = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents:         [{ role: 'user', parts: [{ text: userMessage }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { maxOutputTokens: maxTokens },
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json() as Record<string, unknown>
  const candidates = data.candidates as Array<Record<string, unknown>> | undefined
  const parts = (candidates?.[0]?.content as Record<string, unknown> | undefined)
    ?.parts as Array<{ text?: string }> | undefined
  return parts?.map(p => p.text ?? '').join('') ?? ''
}

/* ── Constants ────────────────────────────────────────────────── */

const MAX_INPUT_CHARS = 16_000
const MIN_INPUT_CHARS = 10
const MAX_BODY_BYTES  = 128 * 1024   // reject oversized request payloads

/* ── System prompt builder ────────────────────────────────────── */

function buildSystemPrompt(
  mode: 'notes' | 'topic',
  gen:  GenerateOptions,
): string {
  const parts: string[] = []

  parts.push(`You are Zenith AI — a precision academic study assistant embedded in a personal productivity dashboard.`)
  parts.push(``)

  if (mode === 'topic') {
    parts.push(`The user has described a topic they want to study. Generate high-quality study material FROM SCRATCH based on the topic description. Treat it as if writing a comprehensive study guide.`)
  } else {
    parts.push(`The user has provided raw study material (lecture notes, textbook text, etc.). Analyse it and produce a structured study package.`)
  }

  parts.push(``)
  parts.push(`CRITICAL OUTPUT RULE: Respond with ONLY a raw JSON object. No markdown code fences. No preamble. No trailing commentary. The first character must be { and the last must be }.`)
  parts.push(``)
  parts.push(`Required JSON structure (include ONLY the keys that are requested below):`)
  parts.push(`{`)
  if (gen.summary)      parts.push(`  "markdownSummary": "...",`)
  else                  parts.push(`  "markdownSummary": "",`)
  if (gen.flashcards)   parts.push(`  "flashcards": [{ "id": "1", "question": "...", "answer": "..." }],`)
  else                  parts.push(`  "flashcards": [],`)
  if (gen.practiceTest) parts.push(`  "practiceTest": [{ "id": "1", "question": "...", "choices": ["A...", "B...", "C...", "D..."], "correct": 0, "explain": "..." }]`)
  parts.push(`}`)
  parts.push(``)

  if (gen.summary) {
    parts.push(`════ markdownSummary Rules ════`)
    parts.push(`• Use ## for 2–4 major topic sections`)
    parts.push(`• Use **Term**: Definition pattern to introduce key vocabulary`)
    parts.push(`• Use - bullet lists for enumerated concepts, process steps, or examples`)
    parts.push(`• Target 350–600 words — dense academic prose, no filler`)
    parts.push(`• Structure: concise overview paragraph → key concepts → mechanisms / processes → applications or examples`)
    parts.push(``)
  }

  if (gen.flashcards) {
    parts.push(`════ flashcards Rules ════`)
    parts.push(`• Generate exactly 10–15 cards — more for rich material, fewer for thin input`)
    parts.push(`• Target the highest-yield, exam-relevant concepts only`)
    parts.push(`• Questions must be precise: prefer "What is…", "How does…", "Which…", "Define…" patterns`)
    parts.push(`• Answers must be complete standalone sentences — no pronouns without referent`)
    parts.push(`• Sequential string IDs starting at "1"`)
    parts.push(`• Vary cognitive level: ~40% recall, ~40% application, ~20% synthesis/comparison`)
    parts.push(``)
  }

  if (gen.practiceTest) {
    parts.push(`════ practiceTest Rules ════`)
    parts.push(`• Generate exactly 8–12 multiple-choice questions`)
    parts.push(`• Each question has exactly 4 choices (A, B, C, D) as an array`)
    parts.push(`• "correct" is the 0-indexed position of the right answer`)
    parts.push(`• "explain" is 1–2 sentences explaining why that choice is correct`)
    parts.push(`• Questions should test understanding, not trivial memorisation`)
    parts.push(`• Vary difficulty: ~30% easy, ~50% medium, ~20% hard`)
    parts.push(`• Sequential string IDs starting at "1"`)
    parts.push(``)
  }

  parts.push(`════ Graceful Degradation ════`)
  parts.push(`If the input is too short or ambiguous, still return the required JSON structure with minimal but valid content.`)

  return parts.join('\n')
}

/* ── POST handler ─────────────────────────────────────────────── */

export async function POST(req: NextRequest): Promise<NextResponse> {
  /* 0 ─ Throttle per client IP — this is the most expensive paid endpoint */
  const limit = rateLimit(`study-ai:${clientIp(req)}`, 10, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before generating again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  /* 1 ─ Resolve API key: user-supplied key takes priority over server env var */
  const userKey   = req.headers.get('x-user-api-key')?.trim() ?? ''
  const serverKey = process.env.LLM_API_KEY ?? ''
  const apiKey    = userKey || serverKey
  const provider  = detectProvider(apiKey) ?? (serverKey ? 'anthropic' : null)

  if (!apiKey) {
    return NextResponse.json(
      { error: 'No AI key configured. Add your Gemini or Anthropic key in Settings → AI Provider.' },
      { status: 503 },
    )
  }

  /* Reject oversized bodies before parsing */
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 })
  }

  /* 2 ─ Parse and validate request body */
  let text: string
  let title: string
  let mode:  'notes' | 'topic'
  let generate: GenerateOptions

  try {
    const body = await req.json()
    text  = typeof body.text  === 'string' ? body.text.trim()  : ''
    title = typeof body.title === 'string' ? body.title.trim() : 'Untitled Study Material'
    mode  = body.mode === 'topic' ? 'topic' : 'notes'
    generate = {
      summary:      body.generate?.summary      !== false,
      flashcards:   body.generate?.flashcards    !== false,
      practiceTest: body.generate?.practiceTest  === true,
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (text.length < MIN_INPUT_CHARS) {
    return NextResponse.json(
      { error: `Please provide at least ${MIN_INPUT_CHARS} characters of ${mode === 'topic' ? 'topic description' : 'study content'}.` },
      { status: 400 },
    )
  }

  /* 3 ─ Call the AI provider */
  const systemPrompt = buildSystemPrompt(mode, generate)
  const userMessage  = mode === 'topic'
    ? `Study topic: ${title}\n\nTopic description / what I want to learn:\n${text.slice(0, MAX_INPUT_CHARS)}`
    : `Title: ${title}\n\nStudy material:\n${text.slice(0, MAX_INPUT_CHARS)}`

  let raw: string
  try {
    if (provider === 'gemini') {
      raw = (await callGemini(apiKey, systemPrompt, userMessage, 4096)).trim()
    } else {
      const model  = process.env.LLM_MODEL ?? 'claude-haiku-4-5-20251001'
      const client = new Anthropic({ apiKey })
      const message = await client.messages.create({
        model,
        max_tokens: 4096,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userMessage }],
      })
      const block = message.content[0]
      raw = block.type === 'text' ? block.text.trim() : ''
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[study-ai] AI API error:', msg)
    return NextResponse.json(
      { error: 'The AI service returned an error. Please try again.' },
      { status: 502 },
    )
  }

  /* 4 ─ Parse and validate the JSON response */
  let parsed: StudyAiResponse
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[study-ai] JSON parse failure. Raw:\n', raw.slice(0, 500))
    return NextResponse.json(
      { error: 'AI returned a malformed response. Please try again.' },
      { status: 502 },
    )
  }

  if (typeof parsed.markdownSummary !== 'string' || !Array.isArray(parsed.flashcards)) {
    return NextResponse.json(
      { error: 'AI response did not match the expected schema. Please try again.' },
      { status: 502 },
    )
  }

  /* 5 ─ Return the structured study package */
  return NextResponse.json({
    markdownSummary: parsed.markdownSummary,
    flashcards:      parsed.flashcards,
    practiceTest:    parsed.practiceTest ?? undefined,
  } satisfies StudyAiResponse)
}
