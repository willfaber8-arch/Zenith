'use client'

/**
 * useAiConfig — user-supplied AI provider key, stored in localStorage only.
 *
 * The key is NEVER sent to our server except as a per-request header
 * (X-User-Api-Key) so it can forward the call to the upstream AI provider.
 * It is never logged, never persisted server-side, and never in IDB.
 */

import { useState, useEffect, useCallback } from 'react'
import { detectProvider, sanitizeApiKey, type AiProvider } from '@/lib/aiProviderUtils'

export type { AiProvider }
export { detectProvider }

export interface AiConfig {
  userApiKey: string
  provider:   AiProvider | null
}

const STORAGE_KEY = 'zenith_ai_config_v1'

function load(): AiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AiConfig>
      const key    = typeof parsed.userApiKey === 'string' ? parsed.userApiKey : ''
      return { userApiKey: key, provider: detectProvider(key) }
    }
  } catch { /* noop */ }
  return { userApiKey: '', provider: null }
}

export function useAiConfig() {
  const [config,  setConfig]  = useState<AiConfig>({ userApiKey: '', provider: null })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setConfig(load())
    setMounted(true)
  }, [])

  const saveKey = useCallback((rawKey: string) => {
    const key      = sanitizeApiKey(rawKey)  // strips invisible chars trim() won't catch
    const provider = detectProvider(key)
    const next: AiConfig = { userApiKey: key, provider }
    setConfig(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
  }, [])

  const clearKey = useCallback(() => {
    setConfig({ userApiKey: '', provider: null })
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
  }, [])

  // Show only last 4 chars to the user — never expose the full key in UI
  const maskedKey = config.userApiKey.length > 4
    ? `${'•'.repeat(Math.min(config.userApiKey.length - 4, 20))}${config.userApiKey.slice(-4)}`
    : config.userApiKey

  // Attach to any fetch headers if a key is set
  const authHeaders = useCallback((): Record<string, string> => {
    const k = load().userApiKey   // read fresh from storage (avoids stale closure)
    return k ? { 'x-user-api-key': k } : {}
  }, [])

  return { config, saveKey, clearKey, maskedKey, mounted, authHeaders }
}
