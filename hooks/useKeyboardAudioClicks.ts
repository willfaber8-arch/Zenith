/**
 * useKeyboardAudioClicks — global document keydown listener that
 * triggers a mechanical-switch synthesis click via the audioMixer
 * singleton on every printable keystroke.
 *
 * Phase 14.1 · Audio Atmosphere
 *
 * Rules:
 * - Only fires when `enabled` is true (audio is active).
 * - Skips modifier-only presses (Shift, Ctrl, Alt, Meta alone).
 * - Skips IME composition events (CJK input method intermediates).
 * - Backspace fires a click (tactile feedback on deletion).
 * - Arrow keys, function keys, etc. are ignored.
 * - No throttle needed — the audioMixer.triggerKeyClick() pipeline
 *   creates independent AudioBufferSourceNodes per call, so rapid
 *   typing generates independent, non-overlapping click events.
 */

import { useEffect } from 'react'
import { audioMixer } from '@/services/audioMixer'

export function useKeyboardAudioClicks(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    const handleKeydown = (e: KeyboardEvent) => {
      // Skip while IME composition is in progress
      if (e.isComposing) return

      // Only fire for printable characters (key.length === 1 covers
      // all alphanumeric, punctuation, space) + Backspace
      if (e.key.length !== 1 && e.key !== 'Backspace') return

      // Skip Ctrl/Cmd+key combos (copy, paste, save…)
      if (e.ctrlKey || e.metaKey) return

      audioMixer.triggerKeyClick()
    }

    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [enabled])
}
