/**
 * Zenith OS — AI Task Roadmap Streamer
 * Phase 8 · Step 8.2 — Structured Goal Decomposition Endpoint
 *
 * POST /api/roadmap
 * Body: { goal: string }
 * Returns: { tasks: RoadmapTask[] }
 *
 * Uses @anthropic-ai/sdk with a strict JSON-only system prompt.
 * Non-streaming: waits for the full response so the complete array
 * can be validated and returned atomically before any IDB writes begin.
 *
 * Security:
 *   • LLM_API_KEY lives exclusively in server process.env
 *   • Goal text is capped at MAX_GOAL_CHARS before reaching the model
 *   • Response is structurally validated before being forwarded to client
 */

import Anthropic     from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/server/rateLimit'
import { detectProvider }     from '@/lib/aiProviderUtils'

const GEMINI_BASE          = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_MODEL_DEFAULT = 'gemini-2.0-flash'

async function callGemini(apiKey: string, goal: string, maxTokens: number): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? GEMINI_MODEL_DEFAULT
  const url   = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`
  const res   = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents:         [{ role: 'user', parts: [{ text: goal }] }],
      systemInstruction: { parts: [{ text: ROADMAP_SYSTEM }] },
      generationConfig: { maxOutputTokens: maxTokens },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 200)}`)
  }
  const data       = await res.json() as Record<string, unknown>
  const candidates = data.candidates as Array<Record<string, unknown>> | undefined
  const parts      = (candidates?.[0]?.content as Record<string, unknown> | undefined)
    ?.parts as Array<{ text?: string }> | undefined
  return parts?.map(p => p.text ?? '').join('') ?? ''
}

/* ── Constants ────────────────────────────────────────────────── */

const MAX_GOAL_CHARS = 600
const MAX_TOKENS     = 512          // ample for 4–7 task JSON objects

/* ── Exported shape (shared with roadmapInjector + RoadmapGeneratorButton) */
export interface RoadmapTask {
  title:       string   // concise action phrase, max 100 chars
  category:    'Academic' | 'Life'
  daysFromNow: number   // positive integer, 1–30
}

/* ── System prompt ────────────────────────────────────────────── */

const ROADMAP_SYSTEM = `\
You are a task decomposition engine. Your ONLY output is a valid JSON array. No markdown, no code fences, no prose.

REQUIRED OUTPUT FORMAT:
[{"title":"string","category":"Academic"|"Life","daysFromNow":integer}]

GENERATION RULES:
1. Produce exactly 4–7 tasks that break the user's goal into logical sequential milestones.
2. Space daysFromNow values linearly (e.g. 5 tasks → 2, 5, 8, 11, 14).
3. First task: daysFromNow must be 1 or 2 (immediate first step).
4. category = "Academic" for: study, research, writing, coursework, reading, exams, labs.
   category = "Life" for: all other goals (career, health, finance, personal, creative).
5. Each title is a verb-first action phrase, max 80 characters.
6. If the goal is vague, extrapolate the most sensible milestones toward its completion.

OUTPUT: Only the JSON array. Nothing else. Any other text is a critical error.`

/* ── JSON extraction helpers ──────────────────────────────────── */

function extractJSON(text: string): unknown {
  const s = text.trim()

  // Attempt 1 — direct parse
  try { return JSON.parse(s) } catch { /* continue */ }

  // Attempt 2 — strip markdown code fence
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()) } catch { /* continue */ }
  }

  // Attempt 3 — extract bare array pattern
  const arrayMatch = s.match(/\[[\s\S]*]/)
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]) } catch { /* continue */ }
  }

  throw new Error('AI response did not contain a valid JSON array')
}

function validateTasks(raw: unknown): RoadmapTask[] {
  if (!Array.isArray(raw)) throw new Error('Expected a JSON array')

  const tasks = (raw as unknown[])
    .filter((t): t is Record<string, unknown> =>
      typeof t === 'object' && t !== null,
    )
    .map<RoadmapTask>(t => ({
      title:       String(t.title ?? 'Untitled step').slice(0, 100),
      category:    t.category === 'Life' ? 'Life' : 'Academic',
      daysFromNow: Math.max(1, Math.min(30, Math.round(Number(t.daysFromNow) || 1))),
    }))
    .slice(0, 7)   // hard cap at 7

  if (tasks.length < 1) throw new Error('AI returned no valid tasks')
  return tasks
}

/* ── POST handler ─────────────────────────────────────────────── */

export async function POST(req: NextRequest): Promise<Response> {
  /* 0 — Throttle per client IP — this is a paid endpoint */
  const limit = rateLimit(`roadmap:${clientIp(req)}`, 10, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before trying again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  /* 1 — Resolve API key: user-supplied key takes priority over server env var */
  const userKey   = req.headers.get('x-user-api-key')?.trim() ?? ''
  const serverKey = process.env.LLM_API_KEY ?? ''
  const apiKey    = userKey || serverKey
  const provider  = detectProvider(apiKey)

  if (!apiKey) {
    return NextResponse.json(
      { error: 'No AI key configured. Add your Gemini or Anthropic key in Settings → AI Provider.' },
      { status: 503 },
    )
  }
  if (!provider) {
    return NextResponse.json(
      { error: 'Unrecognized API key format. Use a Google Gemini (AIza… or AQ.…) or Anthropic (sk-ant-…) key.' },
      { status: 400 },
    )
  }

  /* Reject oversized bodies before parsing */
  if (Number(req.headers.get('content-length') ?? 0) > 8_000) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 })
  }

  /* 2 — Parse + sanitise body */
  let goal: string
  try {
    const body = await req.json()
    goal = String(body.goal ?? '').trim().slice(0, MAX_GOAL_CHARS)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!goal) {
    return NextResponse.json({ error: 'goal is required.' }, { status: 400 })
  }

  /* 3 — Call AI provider (non-streaming — we need the full JSON first) */
  try {
    let rawText: string

    if (provider === 'gemini') {
      rawText = await callGemini(apiKey, goal, MAX_TOKENS)
    } else {
      const model  = process.env.LLM_MODEL ?? 'claude-haiku-4-5-20251001'
      const client = new Anthropic({ apiKey })
      const message = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system:     ROADMAP_SYSTEM,
        messages:   [{ role: 'user', content: goal }],
      })
      rawText = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('')
    }

    /* 4 — Parse + validate the JSON array */
    const rawParsed = extractJSON(rawText)
    const tasks     = validateTasks(rawParsed)

    return NextResponse.json({ tasks }, {
      status:  200,
      headers: { 'Cache-Control': 'no-store' },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Roadmap generation failed: ${msg}` },
      { status: 502 },
    )
  }
}
