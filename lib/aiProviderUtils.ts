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
 * Map a non-OK Gemini REST response to a clear, user-facing message.
 * Keeps the raw Google error JSON out of the UI — the user only sees an
 * actionable sentence. Used by all three AI routes (chat, study-ai, roadmap).
 */
export function friendlyGeminiError(status: number, rawText: string): string {
  switch (status) {
    case 429:
      return 'Gemini quota exceeded. You\'ve hit Google\'s rate limit or daily free-tier cap — wait a minute and try again, or check your plan and billing in Google AI Studio.'
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
