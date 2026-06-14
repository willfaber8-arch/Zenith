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
import { rateLimit, clientIp } from '@/lib/server/rateLimit'
import { detectProvider }     from '@/lib/aiProviderUtils'

/* ── Gemini REST streaming helper ─────────────────────────────── */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_MODEL_DEFAULT = 'gemini-2.0-flash'

async function streamGemini(
  apiKey:       string,
  systemPrompt: string,
  messages:     ChatMessage[],
  maxTokens:    number,
): Promise<ReadableStream<Uint8Array>> {
  const geminiMessages = messages.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const model = process.env.GEMINI_MODEL ?? GEMINI_MODEL_DEFAULT
  const url   = `${GEMINI_BASE}/${model}:streamGenerateContent?key=${apiKey}&alt=sse`

  const upstream = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents:         geminiMessages,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { maxOutputTokens: maxTokens },
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    throw new Error(`Gemini API error ${upstream.status}: ${errText.slice(0, 200)}`)
  }

  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader  = upstream.body!.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data) as Record<string, unknown>
              const candidates = parsed.candidates as Array<Record<string, unknown>> | undefined
              const text = (candidates?.[0]?.content as Record<string, unknown> | undefined)
                ?.parts as Array<{ text?: string }> | undefined
              const chunk = text?.[0]?.text ?? ''
              if (chunk) controller.enqueue(encoder.encode(chunk))
            } catch { /* malformed SSE line — skip */ }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream interrupted'
        controller.enqueue(encoder.encode(`\n\n_[Co-Pilot error: ${msg}]_`))
      } finally {
        controller.close()
      }
    },
  })
}

/* ── Constants ────────────────────────────────────────────────── */

const MAX_USER_MSG_CHARS   = 4_000     // hard cap per user turn
const MAX_HISTORY_MESSAGES = 20        // sliding window — oldest pairs dropped first
const MAX_TOKENS_RESPONSE  = 1_024     // generous for explanation-style answers
const MAX_BODY_BYTES       = 256 * 1024 // reject oversized request payloads

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
  /* 0 — Throttle per client IP — this is a paid endpoint */
  const limit = rateLimit(`chat:${clientIp(req)}`, 20, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before sending again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  /* 1 — Resolve API key: user-supplied key takes priority over server env var */
  const userKey    = req.headers.get('x-user-api-key')?.trim() ?? ''
  const serverKey  = process.env.LLM_API_KEY ?? ''
  const apiKey     = userKey || serverKey
  const provider   = detectProvider(apiKey)

  if (!apiKey) {
    return NextResponse.json(
      { error: 'No AI key configured. Add your Gemini or Anthropic key in Settings → AI Provider.' },
      { status: 503 },
    )
  }
  if (!provider) {
    return NextResponse.json(
      { error: 'Unrecognized API key format. Use a Google Gemini (AIza…) or Anthropic (sk-ant-…) key.' },
      { status: 400 },
    )
  }

  /* Reject oversized bodies before parsing */
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 })
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

  /* 5 — Stream from the appropriate provider */
  try {
    let readable: ReadableStream<Uint8Array>

    if (provider === 'gemini') {
      readable = await streamGemini(apiKey, systemPrompt, sanitised, MAX_TOKENS_RESPONSE)
    } else {
      // Anthropic path
      const model   = process.env.LLM_MODEL ?? 'claude-haiku-4-5-20251001'
      const client  = new Anthropic({ apiKey })
      const stream  = client.messages.stream({
        model,
        max_tokens: MAX_TOKENS_RESPONSE,
        system:     systemPrompt,
        messages:   sanitised,
      })
      const encoder = new TextEncoder()
      readable = new ReadableStream<Uint8Array>({
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
            const msg = err instanceof Error ? err.message : 'Stream interrupted'
            controller.enqueue(encoder.encode(`\n\n_[Co-Pilot error: ${msg}]_`))
          } finally {
            controller.close()
          }
        },
      })
    }

    return new Response(readable, {
      headers: {
        'Content-Type':      'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control':     'no-store',
        'X-Accel-Buffering': 'no',
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
