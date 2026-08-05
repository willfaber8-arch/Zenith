'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — useMediaQuery
 *
 * SSR-safe `window.matchMedia` subscription.
 *
 * The initial render ALWAYS returns `false` (both on the server and on
 * the client's first paint) so the hydrated markup matches the markup
 * the server produced — no hydration mismatch. The real value lands in
 * a post-mount effect.
 *
 * Because of that, this hook must never be used to decide layout that
 * would flash. Layout belongs in CSS media queries; this hook exists
 * for things CSS cannot express — ARIA semantics, focus management,
 * and event wiring.
 * ════════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)

    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Matches the `@media (max-width: 767px)` breakpoint used across Zenith's CSS Modules. */
export const MOBILE_QUERY = '(max-width: 767px)'

export function useIsMobileViewport(): boolean {
  return useMediaQuery(MOBILE_QUERY)
}
