'use client'

import { useState, useRef, useCallback, useEffect, type CSSProperties } from 'react'
import styles from './FocusAudioPlayer.module.css'

/* ── Types ────────────────────────────────────────────────────────── */

type AudioPreset = 'brown' | 'white' | 'focus' | 'waves' | 'rain'
type MusicStream = 'lofi' | 'chillhop' | 'jazz'

/* ── Static data ──────────────────────────────────────────────────── */

const AUDIO_PRESETS: { id: AudioPreset; label: string; icon: string; desc: string }[] = [
  { id: 'brown', label: 'Brown Noise', icon: '◫', desc: 'Warm deep static — easy on the ears' },
  { id: 'white', label: 'White Noise', icon: '◻', desc: 'Flat spectrum — masks distractions' },
  { id: 'waves', label: 'Ocean Waves', icon: '〰', desc: 'LFO-modulated surge — rhythmic wash' },
  { id: 'rain',  label: 'Rainfall',    icon: '⌁', desc: 'Layered filtered noise — steady rain' },
  { id: 'focus', label: 'Focus Tone',  icon: '◈', desc: '40 Hz binaural beat — use headphones' },
]

const MUSIC_STREAMS: { id: MusicStream; label: string; embedUrl: string }[] = [
  { id: 'lofi',     label: 'Lofi Hip Hop',  embedUrl: 'https://www.youtube-nocookie.com/embed/5qap5aO4i9A?autoplay=1' },
  { id: 'chillhop', label: 'Chillhop',      embedUrl: 'https://www.youtube-nocookie.com/embed/5yx6BWlEVcY?autoplay=1' },
  { id: 'jazz',     label: 'Jazz Focus',    embedUrl: 'https://www.youtube-nocookie.com/embed/Dx5qFachd3A?autoplay=1' },
]

/* Converts a user-pasted URL to an embeddable URL where possible */
function toEmbedUrl(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  try {
    const url = new URL(s)
    const ytId = url.searchParams.get('v')
    if (url.hostname.includes('youtube.com') && ytId)
      return `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`
    if (url.hostname === 'youtu.be')
      return `https://www.youtube-nocookie.com/embed${url.pathname}?autoplay=1`
    if (url.hostname.includes('youtube-nocookie.com') ||
        (url.hostname.includes('youtube.com') && url.pathname.startsWith('/embed')))
      return s
    if (url.hostname === 'open.spotify.com' && !url.pathname.startsWith('/embed'))
      return `https://open.spotify.com/embed${url.pathname}?utm_source=generator`
    if (url.hostname === 'open.spotify.com') return s
    if (url.hostname.includes('soundcloud.com'))
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(s)}&auto_play=true&visual=true&color=%237c95ff`
    return s
  } catch { return null }
}

/* ══════════════════════════════════════════════════════════════════
   FocusAudioPlayer — standalone ambient + music player for Settings
   ══════════════════════════════════════════════════════════════════ */

export default function FocusAudioPlayer() {
  const [playing,      setPlaying]      = useState<AudioPreset | null>(null)
  const [volume,       setVolume]       = useState(0.4)
  const [activeStream, setActiveStream] = useState<MusicStream | null>(null)
  const [customUrl,    setCustomUrl]    = useState('')
  const [embedUrl,     setEmbedUrl]     = useState<string | null>(null)
  const [urlError,     setUrlError]     = useState(false)

  const ctxRef   = useRef<AudioContext | null>(null)
  const gainRef  = useRef<GainNode | null>(null)
  const nodesRef = useRef<(AudioNode & { stop?: () => void })[]>([])

  const stopAll = useCallback(() => {
    nodesRef.current.forEach(n => {
      try { n.stop?.() } catch { /* already stopped */ }
      try { n.disconnect() } catch { /* already disconnected */ }
    })
    nodesRef.current = []
    try { ctxRef.current?.close() } catch { /* already closed */ }
    ctxRef.current = null
    gainRef.current = null
    setPlaying(null)
  }, [])

  const play = useCallback((preset: AudioPreset) => {
    stopAll()
    const ctx  = new AudioContext()
    const gain = ctx.createGain()
    gain.gain.value = volume
    gain.connect(ctx.destination)
    ctxRef.current  = ctx
    gainRef.current = gain
    const nodes: (AudioNode & { stop?: () => void })[] = []

    if (preset === 'brown') {
      const len = ctx.sampleRate * 12
      const buf = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch)
        let last = 0
        for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last }
        let peak = 0
        for (let i = 0; i < len; i++) if (Math.abs(d[i]) > peak) peak = Math.abs(d[i])
        if (peak > 0) for (let i = 0; i < len; i++) d[i] = (d[i] / peak) * 0.70
      }
      const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 1200; lpf.Q.value = 0.5
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
      src.connect(lpf); lpf.connect(gain); src.start(); nodes.push(src)

    } else if (preset === 'white') {
      const len = ctx.sampleRate * 4
      const buf = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch)
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.40
      }
      const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 6000; lpf.Q.value = 0.7
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
      src.connect(lpf); lpf.connect(gain); src.start(); nodes.push(src)

    } else if (preset === 'waves') {
      const len = ctx.sampleRate * 10
      const buf = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch)
        let last = 0
        for (let i = 0; i < len; i++) { last = (last + 0.018 * (Math.random() * 2 - 1)) / 1.018; d[i] = last }
        let peak = 0
        for (let i = 0; i < len; i++) if (Math.abs(d[i]) > peak) peak = Math.abs(d[i])
        if (peak > 0) for (let i = 0; i < len; i++) d[i] = (d[i] / peak) * 0.70
      }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
      const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 380; lpf.Q.value = 0.6
      const waveGain = ctx.createGain(); waveGain.gain.value = 0.55
      const lfo1 = ctx.createOscillator(); lfo1.type = 'sine'; lfo1.frequency.value = 0.11
      const lfo1g = ctx.createGain(); lfo1g.gain.value = 0.28
      lfo1.connect(lfo1g); lfo1g.connect(waveGain.gain)
      const lfo2 = ctx.createOscillator(); lfo2.type = 'sine'; lfo2.frequency.value = 0.07
      const lfo2g = ctx.createGain(); lfo2g.gain.value = 0.14
      lfo2.connect(lfo2g); lfo2g.connect(waveGain.gain)
      src.connect(lpf); lpf.connect(waveGain); waveGain.connect(gain)
      const fLen = ctx.sampleRate * 4
      const fBuf = ctx.createBuffer(2, fLen, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const d = fBuf.getChannelData(ch)
        for (let i = 0; i < fLen; i++) d[i] = (Math.random() * 2 - 1) * 0.30
      }
      const fSrc = ctx.createBufferSource(); fSrc.buffer = fBuf; fSrc.loop = true
      const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 3000; hpf.Q.value = 0.5
      const fGain = ctx.createGain(); fGain.gain.value = 0.07
      const fLfoG = ctx.createGain(); fLfoG.gain.value = 0.04
      lfo1.connect(fLfoG); fLfoG.connect(fGain.gain)
      fSrc.connect(hpf); hpf.connect(fGain); fGain.connect(gain)
      lfo1.start(); lfo2.start(); src.start(); fSrc.start()
      nodes.push(src, lfo1, lfo2, fSrc)

    } else if (preset === 'rain') {
      const len = ctx.sampleRate * 6
      const buf = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch)
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.35
      const bpG = ctx.createGain(); bpG.gain.value = 0.38
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2800; hp.Q.value = 0.4
      const hpG = ctx.createGain(); hpG.gain.value = 0.18
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; lp.Q.value = 0.5
      const lpG = ctx.createGain(); lpG.gain.value = 0.14
      src.connect(bp);  bp.connect(bpG);   bpG.connect(gain)
      src.connect(hp);  hp.connect(hpG);   hpG.connect(gain)
      src.connect(lp);  lp.connect(lpG);   lpG.connect(gain)
      src.start(); nodes.push(src)

    } else if (preset === 'focus') {
      const osc1 = ctx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = 220
      const osc1g = ctx.createGain(); osc1g.gain.value = 0.18
      const panL = ctx.createStereoPanner(); panL.pan.value = -1
      osc1.connect(osc1g); osc1g.connect(panL); panL.connect(gain)
      const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 260
      const osc2g = ctx.createGain(); osc2g.gain.value = 0.18
      const panR = ctx.createStereoPanner(); panR.pan.value = 1
      osc2.connect(osc2g); osc2g.connect(panR); panR.connect(gain)
      osc1.start(); osc2.start(); nodes.push(osc1, osc2)
    }

    nodesRef.current = nodes
    setPlaying(preset)
  }, [volume, stopAll])

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume
  }, [volume])

  /* Cleanup on unmount */
  useEffect(() => () => { try { stopAll() } catch { /* ignore */ } }, [stopAll])

  const toggleAmbient = (preset: AudioPreset) => {
    if (playing === preset) stopAll()
    else play(preset)
  }

  const toggleStream = (id: MusicStream) => {
    setEmbedUrl(null)
    setCustomUrl('')
    setActiveStream(prev => (prev === id ? null : id))
  }

  const handleLoadCustom = () => {
    const resolved = toEmbedUrl(customUrl)
    if (!resolved) { setUrlError(true); return }
    setUrlError(false)
    setActiveStream(null)
    setEmbedUrl(resolved)
  }

  const activeStreamMeta = MUSIC_STREAMS.find(s => s.id === activeStream)
  const resolvedEmbed    = activeStreamMeta ? activeStreamMeta.embedUrl : embedUrl

  return (
    <div className={styles.root}>

      {/* ── Ambient Sounds ──────────────────────────────────────────── */}
      <p className={styles.sectionLabel}>Ambient Sounds</p>

      <div className={styles.presetGrid}>
        {AUDIO_PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            className={`${styles.preset} ${playing === p.id ? styles.presetOn : ''}`}
            onClick={() => toggleAmbient(p.id)}
            aria-pressed={playing === p.id}
            aria-label={`${playing === p.id ? 'Stop' : 'Play'} ${p.label}`}
          >
            <div className={styles.presetTop}>
              <span className={styles.presetIcon} aria-hidden="true">{p.icon}</span>
              <span className={styles.presetLabel}>{p.label}</span>
              <span className={styles.presetStatus} aria-hidden="true">
                {playing === p.id ? '◉' : '○'}
              </span>
            </div>
            <p className={styles.presetDesc}>{p.desc}</p>
          </button>
        ))}
      </div>

      <div className={styles.volRow}>
        <span className={styles.volLabel}>Volume</span>
        <input
          type="range" min={0} max={1} step={0.05} value={volume}
          className={styles.volSlider}
          onChange={e => setVolume(Number(e.target.value))}
          aria-label="Ambient volume"
          style={{ '--fill-pct': `${volume * 100}%` } as CSSProperties}
        />
        <span className={styles.volValue}>{Math.round(volume * 100)}%</span>
      </div>

      {playing === 'focus' && (
        <p className={styles.headphoneNote}>◈ Headphones required for binaural beat effect</p>
      )}

      {/* ── Music Player ─────────────────────────────────────────────── */}
      <div className={styles.divider} aria-hidden="true" />
      <p className={styles.sectionLabel}>Music Player</p>

      <div className={styles.streamRow}>
        {MUSIC_STREAMS.map(s => (
          <button
            key={s.id}
            type="button"
            className={`${styles.streamBtn} ${activeStream === s.id ? styles.streamBtnOn : ''}`}
            onClick={() => toggleStream(s.id)}
            aria-pressed={activeStream === s.id}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className={styles.customUrlWrap}>
        <div className={styles.customUrlRow}>
          <input
            type="url"
            className={`${styles.customUrlInput} ${urlError ? styles.customUrlInputErr : ''}`}
            placeholder="YouTube, Spotify, or SoundCloud URL…"
            value={customUrl}
            onChange={e => { setCustomUrl(e.target.value); setUrlError(false) }}
            onKeyDown={e => { if (e.key === 'Enter') handleLoadCustom() }}
            aria-label="Custom music player URL"
          />
          <button
            type="button"
            className={styles.customUrlBtn}
            onClick={handleLoadCustom}
            disabled={!customUrl.trim()}
            aria-label="Load custom embed"
          >
            Load
          </button>
        </div>
        {urlError && (
          <p className={styles.customUrlError}>Couldn&apos;t parse that URL — try pasting the full page URL.</p>
        )}
        <p className={styles.customUrlHint}>Supports YouTube · Spotify · SoundCloud · any embed URL</p>
      </div>

      {resolvedEmbed && (
        <div className={styles.musicFrame}>
          <iframe
            key={resolvedEmbed}
            src={resolvedEmbed}
            title="Music player"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className={styles.musicIframe}
          />
        </div>
      )}

    </div>
  )
}
