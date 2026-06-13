'use client'

/**
 * AudioAtmosphereWidget — Phase 14.1 · Audio Atmosphere
 *
 * Lo-Fi soundscape cockpit with procedural audio channels.
 * Controls: Rain / Fireplace / Keyboard click synthesis.
 * Persistence: zenith_atmosphere_levels_v1 localStorage.
 */

import { useCallback, useEffect, useState } from 'react'
import { audioMixer, type ChannelLevels } from '@/services/audioMixer'
import { useKeyboardAudioClicks } from '@/hooks/useKeyboardAudioClicks'
import styles from './AudioAtmosphereWidget.module.css'

/* ── Constants ──────────────────────────────────────────────── */

const STORAGE_KEY = 'zenith_atmosphere_levels_v1'

const DEFAULT_LEVELS: ChannelLevels = {
  rain:      0.68,
  fireplace: 0.55,
  keyboard:  0.40,
}

const CHANNEL_CONFIG: {
  key:   keyof ChannelLevels
  label: string
  glyph: string
}[] = [
  { key: 'rain',      label: 'Rain',      glyph: '⬡' },
  { key: 'fireplace', label: 'Fireplace', glyph: '◈' },
  { key: 'keyboard',  label: 'Keys',      glyph: '⌨' },
]

type AudioStatus = 'idle' | 'initializing' | 'active'

/* ── Helpers ────────────────────────────────────────────────── */

function loadLevels(): ChannelLevels {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_LEVELS }
    const parsed = JSON.parse(raw) as Partial<ChannelLevels>
    return {
      rain:      typeof parsed.rain      === 'number' ? parsed.rain      : DEFAULT_LEVELS.rain,
      fireplace: typeof parsed.fireplace === 'number' ? parsed.fireplace : DEFAULT_LEVELS.fireplace,
      keyboard:  typeof parsed.keyboard  === 'number' ? parsed.keyboard  : DEFAULT_LEVELS.keyboard,
    }
  } catch {
    return { ...DEFAULT_LEVELS }
  }
}

function saveLevels(levels: ChannelLevels): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(levels))
  } catch {
    // Quota exceeded or private mode — silently skip
  }
}

/* ── WaveformBars sub-component ─────────────────────────────── */

function WaveformBars({ active }: { active: boolean }) {
  return (
    <div className={`${styles.waveform} ${active ? '' : styles.waveformOff}`}>
      <div className={styles.wavBar} />
      <div className={styles.wavBar} />
      <div className={styles.wavBar} />
      <div className={styles.wavBar} />
      <div className={styles.wavBar} />
    </div>
  )
}

/* ── Main widget ────────────────────────────────────────────── */

export default function AudioAtmosphereWidget() {
  // Lazy init: if audio is already playing (navigated away & back), pick up 'active'
  const [status, setStatus] = useState<AudioStatus>(() =>
    audioMixer.isRunning ? 'active' : 'idle'
  )

  const [levels, setLevels] = useState<ChannelLevels>(() => loadLevels())

  // Wire keyboard click synth
  useKeyboardAudioClicks(status === 'active')

  // Sync channel levels to the audio engine whenever they change while active
  useEffect(() => {
    if (status !== 'active') return
    audioMixer.setChannelGain('rain',      levels.rain)
    audioMixer.setChannelGain('fireplace', levels.fireplace)
    audioMixer.setChannelGain('keyboard',  levels.keyboard)
  }, [levels, status])

  // Persist levels on change
  useEffect(() => {
    saveLevels(levels)
  }, [levels])

  // Stop audio cleanly on unmount (navigation away)
  useEffect(() => {
    return () => {
      // Do NOT stop here — the singleton intentionally keeps playing
      // when the user navigates away. Stopping only happens via the
      // toggle button in any mounted instance of this widget.
    }
  }, [])

  /* ── Toggle handler ──────────────────────────────────────── */

  const handleToggle = useCallback(async () => {
    if (status === 'active') {
      audioMixer.stop()
      setStatus('idle')
      return
    }

    if (status === 'initializing') return   // debounce double-tap

    setStatus('initializing')
    try {
      await audioMixer.start(levels)
      setStatus('active')
    } catch (err) {
      console.error('[AudioAtmosphereWidget] Failed to start audio:', err)
      setStatus('idle')
    }
  }, [status, levels])

  /* ── Slider handler ──────────────────────────────────────── */

  const handleSlider = useCallback(
    (channel: keyof ChannelLevels, value: number) => {
      setLevels(prev => {
        const next = { ...prev, [channel]: value }
        // Zero-latency gain update — no re-render needed for this
        if (status === 'active') {
          audioMixer.setChannelGain(channel, value)
        }
        return next
      })
    },
    [status]
  )

  /* ── Derived ─────────────────────────────────────────────── */

  const isActive       = status === 'active'
  const isInitializing = status === 'initializing'

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div
      className={styles.card}
      data-active={String(isActive)}
      role="region"
      aria-label="Audio Atmosphere Widget"
    >
      {/* Header row */}
      <div className={styles.header}>
        <span className={styles.eyebrow}>Audio · Atmosphere</span>
        <div
          className={styles.statusDot}
          data-active={String(isActive)}
          aria-hidden="true"
        />
      </div>

      {/* Master power toggle */}
      <button
        type="button"
        className={styles.toggleBtn}
        data-active={String(isActive)}
        onClick={handleToggle}
        disabled={isInitializing}
        aria-pressed={isActive}
        aria-label={isActive ? 'Stop audio atmosphere' : 'Start audio atmosphere'}
      >
        <span className={styles.toggleBracket}>[</span>

        {isInitializing ? (
          <span className={styles.toggleLabel}>INITIALIZING...</span>
        ) : (
          <span
            className={styles.toggleLabel}
            data-active={String(isActive)}
          >
            {isActive ? 'AMBIENT STREAM // ACTIVE' : 'AUDIO CAPSULE // OFFLINE'}
          </span>
        )}

        <WaveformBars active={isActive} />

        <span className={styles.toggleBracket}>]</span>
      </button>

      {/* Divider */}
      <div className={styles.divider}>
        <div className={styles.dividerLine} />
        <span className={styles.dividerLabel}>Channels</span>
        <div className={styles.dividerLine} />
      </div>

      {/* Channel sliders */}
      <div className={styles.channels}>
        {CHANNEL_CONFIG.map(({ key, label, glyph }) => {
          const val    = levels[key]
          const fillPct = Math.round(val * 100)

          return (
            <div
              key={key}
              className={styles.channelRow}
              data-channel-active={String(isActive && val > 0)}
            >
              <div className={styles.channelMeta}>
                <div className={styles.channelLeft}>
                  <span className={styles.channelGlyph} aria-hidden="true">
                    {glyph}
                  </span>
                  <span className={styles.channelLabel}>{label}</span>
                </div>
                <span className={styles.channelVol} aria-hidden="true">
                  {fillPct}
                </span>
              </div>

              <input
                type="range"
                className={styles.slider}
                min={0}
                max={1}
                step={0.01}
                value={val}
                disabled={!isActive}
                style={{ '--fill-pct': fillPct } as React.CSSProperties}
                aria-label={`${label} volume`}
                onChange={e => handleSlider(key, parseFloat(e.target.value))}
              />
            </div>
          )
        })}
      </div>

      {/* Keyboard hint — only shown when active */}
      {isActive && (
        <p className={styles.hint} aria-live="polite">
          ⟡ Type anywhere — keyboard sound active
        </p>
      )}
    </div>
  )
}
