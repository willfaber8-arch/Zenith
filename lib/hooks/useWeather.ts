'use client'

/**
 * lib/hooks/useWeather.ts — Shared, persistent weather provider.
 *
 * Why this exists
 * ───────────────────────────────────────────────────────────────
 * Previously five separate components (WeatherWidget, GreetingHero,
 * Topbar, FreeWidgetCanvas, HomeScreen) each called
 * `navigator.geolocation.getCurrentPosition()` on mount. That meant
 * up to five geolocation lookups per page load and — on browsers that
 * surface a prompt per call — repeated permission prompts every time
 * Zenith opened.
 *
 * This module collapses all of that into ONE module-level singleton:
 *
 *   • The last known coordinates (and city) are cached in localStorage
 *     under COORDS_KEY. On every subsequent load weather is fetched
 *     instantly from the cached coordinates — no geolocation call, no
 *     prompt, no GPS spin.
 *   • A silent background refresh runs once per session with a long
 *     `maximumAge`, so when the permission grant persists (the common
 *     case) the browser returns a cached fix without re-prompting.
 *   • The very first time — and only the first time — Zenith may
 *     auto-prompt for location (tracked via permissionGate). After that
 *     the auto-prompt never fires again; the cached coordinates carry
 *     the feature forever.
 *
 * Every consumer subscribes to the same in-memory state, so there is
 * exactly one weather fetch and at most one geolocation call per
 * browser session no matter how many widgets are mounted.
 */

import { useEffect, useState } from 'react'
import { fetchWeather, type WeatherData } from '@/lib/weather'
import { hasAskedFor, markAskedFor }      from '@/lib/permissionGate'

const COORDS_KEY = 'zenith_geo_cache_v1'

/* Background refresh tolerance — a cached browser fix this fresh is
 * accepted silently (no prompt, no GPS hit). 6 hours. */
const MAX_POSITION_AGE_MS = 6 * 60 * 60 * 1000

export type WeatherStatus = 'idle' | 'loading' | 'ok' | 'denied' | 'error'

export interface WeatherState {
  status:  WeatherStatus
  weather: WeatherData | null
  city:    string | null
}

interface CachedCoords {
  lat:     number
  lon:     number
  city?:   string | null
  savedAt: number
}

/* ── Module-level singleton state ─────────────────────────────── */

let memo: WeatherState = { status: 'idle', weather: null, city: null }
let started = false
const listeners = new Set<(s: WeatherState) => void>()

function emit(next: WeatherState): void {
  memo = next
  listeners.forEach(l => l(memo))
}

/* ── localStorage coordinate cache ────────────────────────────── */

function readCoords(): CachedCoords | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(COORDS_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as CachedCoords
    if (typeof c.lat === 'number' && typeof c.lon === 'number') return c
    return null
  } catch {
    return null
  }
}

function writeCoords(c: CachedCoords): void {
  try { localStorage.setItem(COORDS_KEY, JSON.stringify(c)) } catch { /* non-fatal */ }
}

/* ── Reverse geocode (best-effort, city only) ─────────────────── */

async function reverseGeocodeCity(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'en' } },
    )
    if (!res.ok) return null
    const geo = await res.json()
    return geo?.address?.city ?? geo?.address?.town ?? geo?.address?.village ?? null
  } catch {
    return null
  }
}

/* ── Fetch weather for a coordinate ───────────────────────────── */

async function loadWeather(lat: number, lon: number, city: string | null): Promise<void> {
  const data = await fetchWeather(lat, lon)
  if (data) {
    emit({ status: 'ok', weather: data, city: city ?? memo.city })
  } else if (!memo.weather) {
    // Only surface an error if we have nothing cached to show
    emit({ status: 'error', weather: null, city: memo.city })
  }
}

/* ── Background location acquisition ──────────────────────────── */

function acquirePosition(isFirstAsk: boolean): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    if (!memo.weather) emit({ status: 'denied', weather: null, city: null })
    return
  }

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const { latitude: lat, longitude: lon } = coords
      // Reverse-geocode only if we don't already have a city name.
      const city = memo.city ?? (await reverseGeocodeCity(lat, lon))
      writeCoords({ lat, lon, city, savedAt: Date.now() })
      await loadWeather(lat, lon, city)
    },
    () => {
      // Denied / unavailable. Keep any cached weather we may already show.
      if (!memo.weather) emit({ status: 'denied', weather: null, city: memo.city })
    },
    { timeout: 8000, maximumAge: isFirstAsk ? 0 : MAX_POSITION_AGE_MS },
  )
}

/* ── One-time bootstrap (runs once per browser session) ───────── */

function ensureStarted(): void {
  if (started || typeof window === 'undefined') return
  started = true

  const cached = readCoords()

  if (cached) {
    // Instant weather from cached coordinates — no prompt, no GPS.
    emit({ status: 'loading', weather: null, city: cached.city ?? null })
    void loadWeather(cached.lat, cached.lon, cached.city ?? null)
    // Silently refresh coordinates in the background for next time.
    acquirePosition(false)
    return
  }

  // No cached coordinates yet. Auto-prompt at most once, ever.
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    emit({ status: 'denied', weather: null, city: null })
    return
  }
  if (hasAskedFor('location')) {
    // We asked before and never got coordinates → user declined. Stay
    // quiet; the user can re-enable from the browser, which will populate
    // the cache on the next successful lookup.
    emit({ status: 'denied', weather: null, city: null })
    return
  }

  emit({ status: 'loading', weather: null, city: null })
  markAskedFor('location')
  acquirePosition(true)
}

/* ── Public hook ──────────────────────────────────────────────── */

export function useWeather(): WeatherState {
  const [state, setState] = useState<WeatherState>(memo)

  useEffect(() => {
    listeners.add(setState)
    setState(memo)
    ensureStarted()
    return () => { listeners.delete(setState) }
  }, [])

  return state
}

/**
 * Force a fresh geolocation + weather fetch (e.g. a "Refresh" button).
 * Bypasses the once-per-session latch and prompts if the browser needs to.
 */
export function refreshWeather(): void {
  if (typeof window === 'undefined') return
  emit({ status: memo.weather ? 'ok' : 'loading', weather: memo.weather, city: memo.city })
  acquirePosition(true)
}
