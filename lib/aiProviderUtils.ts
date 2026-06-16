/**
 * Shared AI provider utilities — usable in both client and server contexts.
 * No 'use client' directive; no browser APIs.
 */

export type AiProvider = 'anthropic' | 'gemini' | 'openai'

/**
 * Auto-detect the AI provider from the key prefix.
 * Strips non-printable / non-ASCII chars before checking — zero-width spaces
 * and other invisible Unicode characters are commonly introduced when pasting
 * keys from web dashboards, and trim() alone won't remove them.
 *
 * Google issues Gemini keys in two formats: the classic "AIza…" keys and the
 * newer "AQ.…" keys from AI Studio. Both authenticate the Generative Language
 * API via the ?key= query parameter.
 * OpenAI keys start with "sk-" (sk-ant- checked first to distinguish Anthropic).
 */
export function detectProvider(key: string): AiProvider | null {
  const k = key.replace(/[^\x20-\x7E]/g, '').trim()
  if (k.startsWith('sk-ant-')) return 'anthropic'
  if (k.startsWith('AIza') || k.startsWith('AQ.')) return 'gemini'
  if (k.startsWith('sk-')) return 'openai'
  return null
}

/**
 * Sanitize a raw user-pasted key the same way detectProvider() does.
 * Call this before storing to localStorage so the saved value is clean.
 */
export function sanitizeApiKey(key: string): string {
  return key.replace(/[^\x20-\x7E]/g, '').trim()
}

/**
 * Classify a Gemini 429 quota error from its raw response body.
 *
 * Google's QuotaFailure details carry a `quotaId` like
 * `GenerateRequestsPerDayPerProjectPerModel-FreeTier` (daily cap) or
 * `GenerateRequestsPerMinutePerProjectPerModel-FreeTier` (per-minute burst).
 *
 *   • 'per_minute' — transient; a short wait clears it → safe to retry.
 *   • 'per_day'    — daily free-tier cap; will NOT clear until the Pacific-time
 *                    reset → retrying only burns more of the same quota.
 *   • 'unknown'    — no violation details; treat as non-retryable to avoid
 *                    wasting daily quota (this is the conservative default).
 */
export type GeminiQuotaClass = 'per_minute' | 'per_day' | 'unknown'

export function classifyGeminiQuota(rawText: string): GeminiQuotaClass {
  if (/per[\s_]?day/i.test(rawText))    return 'per_day'
  if (/per[\s_]?minute/i.test(rawText)) return 'per_minute'
  return 'unknown'
}

/**
 * Map a non-OK Gemini REST response to a clear, user-facing message.
 * Keeps the raw Google error JSON out of the UI — the user only sees an
 * actionable sentence. Used by all three AI routes (chat, study-ai, roadmap).
 */
export function friendlyGeminiError(status: number, rawText: string): string {
  switch (status) {
    case 429:
      return classifyGeminiQuota(rawText) === 'per_day'
        ? 'Gemini daily free-tier cap reached. Google resets this at midnight Pacific time — until then this key can\'t make more requests. Add billing in Google AI Studio, use a different key, or switch to an Anthropic / OpenAI key in Settings → AI Provider.'
        : 'Gemini rate limit reached (too many requests in a short window). Wait a minute and try again, or check your plan in Google AI Studio.'
    case 400:
      return /api[_ ]?key/i.test(rawText)
        ? 'Gemini rejected the API key. Re-check the key in Settings → AI Provider.'
        : 'Gemini could not process the request. Please try again.'
    case 401:
    case 403:
      return 'Gemini denied access. Use a key from Google AI Studio (aistudio.google.com/app/apikey), not the Google Cloud Console. Cloud Console keys require manually enabling the Generative Language API — AI Studio keys work immediately and have a free tier.'
    case 404:
      return 'The configured Gemini model was not found. It may have been renamed or retired.'
    case 500:
    case 503:
      return 'Gemini is temporarily overloaded. Please try again in a moment.'
    default:
      return `Gemini API error ${status}. Please try again.`
  }
}
