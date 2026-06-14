/**
 * Shared AI provider utilities — usable in both client and server contexts.
 * No 'use client' directive; no browser APIs.
 */

export type AiProvider = 'anthropic' | 'gemini'

/** Auto-detect the AI provider from the key prefix. */
export function detectProvider(key: string): AiProvider | null {
  const k = key.trim()
  if (k.startsWith('sk-ant-')) return 'anthropic'
  if (k.startsWith('AIza'))    return 'gemini'
  return null
}
