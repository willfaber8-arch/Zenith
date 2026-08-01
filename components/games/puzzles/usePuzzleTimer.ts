'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Lightweight stopwatch for the puzzle games. RAF-driven while running so the
 * display stays smooth; epoch-based so it's immune to setInterval drift.
 */
export interface PuzzleTimer {
  elapsedMs: number
  running:   boolean
  start:     () => void
  stop:      () => number   // returns final elapsed ms
  reset:     () => void
}

export function usePuzzleTimer(): PuzzleTimer {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [running,   setRunning]   = useState(false)
  const startRef = useRef(0)
  const baseRef  = useRef(0)          // accumulated ms before the current run
  const rafRef   = useRef<number | null>(null)
  const runningRef = useRef(false)

  const tick = useCallback(() => {
    if (!runningRef.current) return
    setElapsedMs(baseRef.current + (performance.now() - startRef.current))
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const start = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)
    startRef.current = performance.now()
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  const stop = useCallback((): number => {
    if (!runningRef.current) return baseRef.current
    runningRef.current = false
    setRunning(false)
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    const total = baseRef.current + (performance.now() - startRef.current)
    baseRef.current = total
    setElapsedMs(total)
    return total
  }, [])

  const reset = useCallback(() => {
    runningRef.current = false
    setRunning(false)
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    baseRef.current = 0
    setElapsedMs(0)
  }, [])

  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }, [])

  return { elapsedMs, running, start, stop, reset }
}

/** Format ms as M:SS.cs (centiseconds) for the stopwatch display. */
export function formatStopwatch(ms: number): string {
  const cs = Math.floor((ms % 1000) / 10)
  const s  = Math.floor(ms / 1000) % 60
  const m  = Math.floor(ms / 60000)
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
