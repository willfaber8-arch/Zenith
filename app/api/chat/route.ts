/**
 * Zenith OS — Academic Co-Pilot Chat Gateway
 * Phase 7 · Step 7.1 — Secure Streaming Chat Completions Endpoint
 *
 * POST /api/chat
 * Body: {
 *   messages:       { role: 'user' | 'assistant', content: string }[]
 *   contextPayload: string   // compiled by utils/aiContextBridge on the client
 * }
 * Returns: text/plain stream — raw UTF-8 text chunks from the model
 *
 * Security:
 *   • LLM_API_KEY lives exclusively in server process.env — never sent to the
 *     browser bundle or logged in error responses.
 *   • contextPayload is injected only into the server-side system prompt, not
 *     echoed back to the client.
 *   • Input message lengths are capped to prevent prompt-stuffing attacks.
 */

import Anthropic   from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

/* ── Constants ────────────────────────────────────────────────── */

const MAX_USER_MSG_CHARS   = 4_000   // hard cap per user turn
const MAX_HISTORY_MESSAGES = 20      // sliding window — oldest pairs dropped first
const MAX_TOKENS_RESPONSE  = 1_024   // generous for explanation-style answers

/* ── Base system persona ──────────────────────────────────────── */

const SYSTEM_BASE = `\
You are the Zenith OS Academic Co-Pilot — an elite, hyper-personalised cognitive accelerator embedded in the user's personal productivity dashboard.

Your capabilities:
• Answer scholastic and academic questions with depth and precision
• Identify behavioral friction patterns from the user's task and habit context
• Suggest cross-disciplinary scheduling adjustments calibrated to current stress and energy levels
• Provide evidence-based study strategies tailored to the user's specific workload and cognitive state

Operational rules:
• Always synthesise responses with the user's specific context data — no generic advice
• Be precise and actionable — avoid hedging when the context data gives you clear signals
• Use markdown for clarity: **bold** key terms, use ## headers for multi-section answers, use \`code\` for formulas or commands
• Keep responses focused — do not pad with caveats or meta-commentary about your own limitations
• When you reference the user's data, cite it directly (e.g. "Given your 3 overdue assignments…")

Tone: Expert mentor — precise, empathetic, results-focused.`

/* ── Types ────────────────────────────────────────────────────── */

interface ChatMessage {
  role:    'user' | 'assistant'
  content: string
}

/* ── POST handler ─────────────────────────────────────────────── */

export async function POST(req: NextRequest): Promise<Response> {
  /* 1 — API key guard */
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service not configured. Add LLM_API_KEY to .env.local.' },
      { status: 503 },
    )
  }

  /* 2 — Parse and validate body */
  let messages: ChatMessage[]
  let contextPayload: string | undefined
  try {
    const body = await req.json()
    messages       = Array.isArray(body.messages) ? body.messages : []
    contextPayload = typeof body.contextPayload === 'string'
      ? body.contextPayload
      : undefined
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (messages.length === 0) {
    return NextResponse.json({ error: 'No messages provided.' }, { status: 400 })
  }

  /* 3 — Sanitise inputs
   *   a) Trim each user turn to MAX_USER_MSG_CHARS
   *   b) Enforce sliding window to bound total prompt size
   *   c) Remove any injected system-role messages from the client payload
   */
  const sanitised: ChatMessage[] = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role:    m.role,
      content: m.role === 'user'
        ? String(m.content).slice(0, MAX_USER_MSG_CHARS)
        : String(m.content),
    }))
    .slice(-MAX_HISTORY_MESSAGES)

  /* 4 — Compose system prompt
   *   The contextPayload block (compiled from IDB client-side) is appended
   *   after the persona instructions so the model has full situational
   *   awareness.  We NEVER return this block to the client.
   */
  const systemPrompt = contextPayload
    ? `${SYSTEM_BASE}\n\n${contextPayload}`
    : SYSTEM_BASE

  /* 5 — Stream from Anthropic */
  const model  = process.env.LLM_MODEL ?? 'claude-haiku-4-5-20251001'
  const client = new Anthropic({ apiKey })

  try {
    const stream = client.messages.stream({
      model,
      max_tokens: MAX_TOKENS_RESPONSE,
      system:     systemPrompt,
      messages:   sanitised,
    })

    const encoder = new TextEncoder()

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
        } catch (err) {
          // Surface a visible inline error rather than silently closing the stream
          const msg = err instanceof Error ? err.message : 'Stream interrupted'
          controller.enqueue(encoder.encode(`\n\n_[Co-Pilot error: ${msg}]_`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type':      'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control':     'no-store',
        'X-Accel-Buffering': 'no',   // disable Nginx/proxy buffering for true streaming
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `AI service error: ${msg}` },
      { status: 502 },
    )
  }
}
