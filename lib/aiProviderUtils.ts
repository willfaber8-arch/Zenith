/**
 * Shared AI provider utilities — usable in both client and server contexts.
 * No 'use client' directive; no browser APIs.
 */

export type AiProvider = 'anthropic' | 'gemini'

/**
 * Auto-detect the AI provider from the key prefix.
 * Strips non-printable / non-ASCII chars before checking — zero-width spaces
 * and other invisible Unicode characters are commonly introduced when pasting
 * keys from web dashboards, and trim() alone won't remove them.
 *
 * Google issues Gemini keys in two formats: the classic "AIza…" keys and the
 * newer "AQ.…" keys from AI Studio. Both authenticate the Generative Language
 * API via the ?key= query parameter.
 */
export function detectProvider(key: string): AiProvider | null {
  const k = key.replace(/[^\x20-\x7E]/g, '').trim()
  if (k.startsWith('sk-ant-')) return 'anthropic'
  if (k.startsWith('AIza') || k.startsWith('AQ.')) return 'gemini'
  return null
}

/**
 * Sanitize a raw user-pasted key the same way detectProvider() does.
 * Call this before storing to localStorage so the saved value is clean.
 */
export function sanitizeApiKey(key: string): string {
  return key.replace(/[^\x20-\x7E]/g, '').trim()
}
