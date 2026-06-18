'use client'

import {
  useState, useEffect, useCallback, useMemo, useRef,
  type CSSProperties,
} from 'react'
import { useLiveQuery }   from 'dexie-react-hooks'
import { useStudyMode }   from '@/lib/StudyModeContext'
import { usePomodoroStateMachine, SESSIONS_PER_LONG_BREAK, POMODORO_MODES } from '@/lib/hooks/usePomodoroStateMachine'
import PomodoroCanvas     from './PomodoroCanvas'
import FlashcardDeck      from './FlashcardDeck'
import { db }             from '@/lib/db'
import { markdownToHtml } from '@/utils/markdownToHtml'
import type { Flashcard } from '@/types/studyAi'
import styles from './StudyLayoutContainer.module.css'

/* ══════════════════════════════════════════════════════════════
   SECTION 1 — Constants
   ══════════════════════════════════════════════════════════════ */

const SESSIONS_PER_CYCLE = SESSIONS_PER_LONG_BREAK
const NOTES_KEY = 'zenith_cockpit_notes_v1'

/* ══════════════════════════════════════════════════════════════
   SECTION 2 — CockpitTopBar
   ══════════════════════════════════════════════════════════════ */

function CockpitTopBar({
  sessionCount,
  onExit,
}: {
  sessionCount: number
  onExit:       () => void
}) {
  const completedInCycle = sessionCount % SESSIONS_PER_CYCLE

  return (
    <div className={styles.cockpitTopBar}>
      <button
        type="button"
        className={styles.exitBtn}
        onClick={onExit}
        aria-label="Exit study mode"
      >
        ← Exit Focus
        <span className={styles.exitKeyHint} aria-hidden="true">esc</span>
      </button>

      <div className={styles.cockpitTitle} aria-hidden="true">
        <span className={styles.titleDot} />
        Study Mode
      </div>

      <div className={styles.sessionCounter} aria-label={`Session ${completedInCycle + 1} of ${SESSIONS_PER_CYCLE}`}>
        <div className={styles.sessionPips} aria-hidden="true">
          {Array.from({ length: SESSIONS_PER_CYCLE }, (_, i) => (
            <span
              key={i}
              className={`${styles.sessionPip} ${i < completedInCycle ? styles.sessionPipFilled : ''}`}
            />
          ))}
        </div>
        <span className={styles.sessionLabel}>
          {completedInCycle + 1} / {SESSIONS_PER_CYCLE}
        </span>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 3 — StudyPomodoroArena
   ══════════════════════════════════════════════════════════════ */

function StudyPomodoroArena({ contextSessionCount }: { contextSessionCount: number }) {
  const machine = usePomodoroStateMachine()
  const { timerState, remaining, totalSecs, distractionCount } = machine

  const isBreak   = timerState === 'SHORT_BREAK' || timerState === 'LONG_BREAK'
  const isRunning = timerState === 'WORK' || timerState === 'SHORT_BREAK' || timerState === 'LONG_BREAK'
  const isIdle    = timerState === 'IDLE'

  let primaryLabel: string
  let primaryAction: () => void
  if (timerState === 'IDLE') {
    primaryLabel  = '▶  Start Focus'
    primaryAction = machine.start
  } else if (timerState === 'PAUSED') {
    primaryLabel  = '▶  Resume'
    primaryAction = machine.resume
  } else if (isBreak) {
    primaryLabel  = '⏸  Pause Break'
    primaryAction = machine.pause
  } else {
    primaryLabel  = '⏸  Pause'
    primaryAction = machine.pause
  }

  return (
    <div
      className={`${styles.focalArena} ${isBreak ? styles.phaseBreak : ''}`}
      role="region"
      aria-label="Pomodoro timer arena"
    >
      <div className={styles.arenaGlow} aria-hidden="true" />

      <PomodoroCanvas
        timerState={timerState}
        remaining={remaining}
        totalSecs={totalSecs}
        cyclePosition={contextSessionCount % SESSIONS_PER_CYCLE}
      />

      {/* Focus-length ladder — only selectable while idle. Lets newcomers
          start small (5 min) and graduate to the true 25-min Pomodoro. */}
      {isIdle && (
        <div className={styles.modeRow} role="group" aria-label="Focus length">
          {POMODORO_MODES.map(m => (
            <button
              key={m.id}
              type="button"
              className={`${styles.modeBtn} ${machine.mode.id === m.id ? styles.modeBtnActive : ''}`}
              onClick={() => machine.setMode(m.id)}
              aria-pressed={machine.mode.id === m.id}
              title={m.hint}
            >
              <span className={styles.modeBtnLabel}>{m.label}</span>
              <span className={styles.modeBtnMins}>{Math.round(m.workSecs / 60)}m</span>
            </button>
          ))}
        </div>
      )}
      {isIdle && (
        <p className={styles.modeHint}>{machine.mode.hint}</p>
      )}

      <div className={styles.arenaControls} role="group" aria-label="Timer controls">
        <button
          type="button"
          className={`${styles.primaryBtn} ${isRunning && !isBreak ? styles.primaryBtnRunning : ''}`}
          onClick={primaryAction}
          aria-label={isIdle ? 'Start focus session' : isRunning ? 'Pause timer' : 'Resume timer'}
        >
          {primaryLabel}
        </button>

        {!isIdle && (
          <>
            <button type="button" className={styles.secondaryBtn} onClick={machine.skip} aria-label="Skip to next phase">
              Skip →
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={machine.reset} aria-label="Reset timer">
              Reset
            </button>
          </>
        )}
      </div>

      {timerState === 'WORK' && (
        <div className={styles.distractionRow}>
          <button
            type="button"
            className={styles.distractionBtn}
            onClick={machine.logDistraction}
            aria-label="Log a distraction and refocus"
          >
            I Got Distracted
          </button>
          {distractionCount > 0 && (
            <span className={styles.distractionCount} aria-live="polite" aria-atomic="true">
              {distractionCount} {distractionCount === 1 ? 'distraction' : 'distractions'} logged
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 4 — CockpitNotes  (Markdown Scratchpad + Voice)
   ══════════════════════════════════════════════════════════════ */

function CockpitNotes() {
  const [content,     setContent]     = useState('')
  const [preview,     setPreview]     = useState(false)
  const [hydrated,    setHydrated]    = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [memos,       setMemos]       = useState<{ url: string; label: string }[]>([])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mediaRecRef    = useRef<any>(null)
  const recChunksRef   = useRef<Blob[]>([])

  useEffect(() => {
    const saved = localStorage.getItem(NOTES_KEY) ?? ''
    setContent(saved)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(NOTES_KEY, content)
  }, [content, hydrated])

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      memos.forEach(m => URL.revokeObjectURL(m.url))
    }
    // memos intentionally omitted — cleanup on unmount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Speech-to-text dictation ─────────────────────────────── */
  const toggleDictation = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      setInterimText('')
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return   // browser unsupported — button hidden below

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR()
    rec.continuous      = true
    rec.interimResults  = true
    rec.lang            = 'en-US'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let final   = ''
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final   += e.results[i][0].transcript
        else                      interim += e.results[i][0].transcript
      }
      if (final) setContent(c => c + (c && !c.endsWith('\n') ? ' ' : '') + final)
      setInterimText(interim)
    }
    rec.onend   = () => { setIsListening(false); setInterimText('') }
    rec.onerror = () => { setIsListening(false); setInterimText('') }

    rec.start()
    recognitionRef.current = rec
    setIsListening(true)
  }, [isListening])

  /* ── Voice memo recorder ──────────────────────────────────── */
  const toggleMemo = useCallback(async () => {
    if (isRecording) {
      mediaRecRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec    = new MediaRecorder(stream)
      recChunksRef.current = []
      rec.ondataavailable = (e: BlobEvent) => recChunksRef.current.push(e.data)
      rec.onstop = () => {
        const blob = new Blob(recChunksRef.current, { type: 'audio/webm' })
        const url  = URL.createObjectURL(blob)
        setMemos(prev => [...prev, { url, label: `Memo ${prev.length + 1}` }])
        stream.getTracks().forEach(t => t.stop())
        setIsRecording(false)
      }
      rec.start()
      mediaRecRef.current = rec
      setIsRecording(true)
    } catch { /* mic permission denied — silently ignore */ }
  }, [isRecording])

  const deleteMemo = (idx: number) => {
    setMemos(prev => {
      URL.revokeObjectURL(prev[idx].url)
      return prev.filter((_, i) => i !== idx)
    })
  }

  /* ── Derived ──────────────────────────────────────────────── */
  const wordCount  = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content])
  const previewHtml = useMemo(() => (preview ? markdownToHtml(content) : ''), [preview, content])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasSpeechAPI = typeof window !== 'undefined' && !!((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)

  return (
    <div className={styles.notesPanel}>

      {/* Header row */}
      <div className={styles.notesPanelBar}>
        <span className={styles.notesPanelTitle}>Scratchpad</span>
        <div className={styles.notesPanelActions}>
          {hasSpeechAPI && (
            <button
              type="button"
              className={`${styles.notesMicBtn} ${isListening ? styles.notesMicBtnOn : ''}`}
              onClick={toggleDictation}
              aria-label={isListening ? 'Stop dictation' : 'Dictate into notes'}
              title={isListening ? 'Stop dictation' : 'Speak to add text'}
            >
              <span aria-hidden="true">{isListening ? '◉' : '◎'}</span>
            </button>
          )}
          <button
            type="button"
            className={`${styles.notesMemoBtn} ${isRecording ? styles.notesMemoBtnOn : ''}`}
            onClick={toggleMemo}
            aria-label={isRecording ? 'Stop recording' : 'Record voice memo'}
            title={isRecording ? 'Stop recording' : 'Record voice memo'}
          >
            <span aria-hidden="true">{isRecording ? '⏹' : '⏺'}</span>
          </button>
          <button
            type="button"
            className={styles.notesToggle}
            onClick={() => setPreview(v => !v)}
            aria-label={preview ? 'Edit mode' : 'Preview mode'}
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Interim speech overlay */}
      {interimText && (
        <p className={styles.notesInterim} aria-live="polite">{interimText}…</p>
      )}

      {/* Editor / preview */}
      {preview ? (
        <div
          className={styles.notesPreview}
          dangerouslySetInnerHTML={{
            __html: previewHtml || '<p style="color:var(--text-dark);font-size:0.625rem">Start typing to preview…</p>',
          }}
        />
      ) : (
        <textarea
          className={styles.notesTextarea}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={'# Heading\n**bold**  *italic*  `code`\n- bullet list\n\nStart typing or click ◎ to dictate…'}
          spellCheck={false}
          aria-label="Markdown notes"
        />
      )}

      {/* Footer */}
      <div className={styles.notesFooter}>
        <span className={styles.notesWordCount}>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
        {content.length > 0 && (
          <button type="button" className={styles.notesClearBtn} onClick={() => setContent('')}>
            Clear
          </button>
        )}
      </div>

      {/* Voice memos */}
      {memos.length > 0 && (
        <div className={styles.memoList}>
          {memos.map((m, i) => (
            <div key={m.url} className={styles.memoItem}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio src={m.url} controls className={styles.memoAudio} />
              <span className={styles.memoLabel}>{m.label}</span>
              <button
                type="button"
                className={styles.memoDelete}
                onClick={() => deleteMemo(i)}
                aria-label={`Delete ${m.label}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 5 — CockpitCards  (Flashcard Viewer)
   ══════════════════════════════════════════════════════════════ */

function CockpitCards() {
  const lastNote = useLiveQuery(
    () => db?.quickNotes
      ?.where('category').equals('ai-study')
      .toArray()
      .then(arr => arr.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null)
      ?? Promise.resolve(null),
    [],
  )

  const flashcards = useMemo<Flashcard[]>(() => {
    if (!lastNote) return []
    try {
      return (JSON.parse(lastNote.body) as { flashcards?: Flashcard[] }).flashcards ?? []
    } catch {
      return []
    }
  }, [lastNote])

  if (lastNote === undefined) return null

  if (flashcards.length === 0) {
    return (
      <div className={styles.cardsEmpty}>
        <span className={styles.cardsEmptyIcon} aria-hidden="true">◇</span>
        <p className={styles.cardsEmptyTitle}>No flashcards yet</p>
        <p className={styles.cardsEmptyBody}>
          Generate a study session in the AI Study tab — your latest flashcard deck will appear here automatically.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.cardsPanel}>
      {lastNote?.title && (
        <p className={styles.cardsDeckLabel}>{lastNote.title}</p>
      )}
      <FlashcardDeck flashcards={flashcards} />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 6 — CockpitAudio  (Ambient Engine + Music Player)
   ══════════════════════════════════════════════════════════════ */

type AudioPreset  = 'brown' | 'white' | 'focus' | 'waves' | 'rain'
type MusicStream  = 'lofi' | 'chillhop' | 'jazz'

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
    // YouTube watch URL
    const ytId = url.searchParams.get('v')
    if (url.hostname.includes('youtube.com') && ytId)
      return `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`
    // YouTube short URL
    if (url.hostname === 'youtu.be')
      return `https://www.youtube-nocookie.com/embed${url.pathname}?autoplay=1`
    // YouTube embed already
    if (url.hostname.includes('youtube-nocookie.com') ||
        (url.hostname.includes('youtube.com') && url.pathname.startsWith('/embed')))
      return s
    // Spotify — convert browse link to embed
    if (url.hostname === 'open.spotify.com' && !url.pathname.startsWith('/embed'))
      return `https://open.spotify.com/embed${url.pathname}?utm_source=generator`
    if (url.hostname === 'open.spotify.com') return s
    // SoundCloud — wrap in player widget
    if (url.hostname.includes('soundcloud.com'))
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(s)}&auto_play=true&visual=true&color=%237c95ff`
    // Anything else — try as-is
    return s
  } catch { return null }
}

function CockpitAudio() {
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
      /* Stereo brown noise — normalize after generation to prevent clipping */
      const len = ctx.sampleRate * 12
      const buf = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch)
        let last = 0
        for (let i = 0; i < len; i++) {
          last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
          d[i] = last
        }
        let peak = 0
        for (let i = 0; i < len; i++) if (Math.abs(d[i]) > peak) peak = Math.abs(d[i])
        if (peak > 0) for (let i = 0; i < len; i++) d[i] = (d[i] / peak) * 0.70
      }
      /* Gentle low-pass removes the thin hiss that makes brown noise harsh on headphones */
      const lpf = ctx.createBiquadFilter()
      lpf.type = 'lowpass'; lpf.frequency.value = 1200; lpf.Q.value = 0.5
      const src = ctx.createBufferSource()
      src.buffer = buf; src.loop = true; src.connect(lpf); lpf.connect(gain); src.start()
      nodes.push(src)

    } else if (preset === 'white') {
      /* Stereo white noise low-passed at 6 kHz — cuts the harsh hiss above speech range */
      const len = ctx.sampleRate * 4
      const buf = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch)
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.40
      }
      const lpf = ctx.createBiquadFilter()
      lpf.type = 'lowpass'; lpf.frequency.value = 6000; lpf.Q.value = 0.7
      const src = ctx.createBufferSource()
      src.buffer = buf; src.loop = true; src.connect(lpf); lpf.connect(gain); src.start()
      nodes.push(src)

    } else if (preset === 'waves') {
      /* Deep surge layer — low-passed brown noise shaped like an ocean roar */
      const len = ctx.sampleRate * 10
      const buf = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch)
        let last = 0
        for (let i = 0; i < len; i++) {
          last = (last + 0.018 * (Math.random() * 2 - 1)) / 1.018
          d[i] = last
        }
        let peak = 0
        for (let i = 0; i < len; i++) if (Math.abs(d[i]) > peak) peak = Math.abs(d[i])
        if (peak > 0) for (let i = 0; i < len; i++) d[i] = (d[i] / peak) * 0.70
      }
      const src = ctx.createBufferSource()
      src.buffer = buf; src.loop = true
      const lpf = ctx.createBiquadFilter()
      lpf.type = 'lowpass'; lpf.frequency.value = 380; lpf.Q.value = 0.6
      /* Dual LFO: primary ~9 s wave + secondary ~14 s swell for natural irregularity */
      const waveGain = ctx.createGain(); waveGain.gain.value = 0.55
      const lfo1 = ctx.createOscillator(); lfo1.type = 'sine'; lfo1.frequency.value = 0.11
      const lfo1g = ctx.createGain(); lfo1g.gain.value = 0.28
      lfo1.connect(lfo1g); lfo1g.connect(waveGain.gain)
      const lfo2 = ctx.createOscillator(); lfo2.type = 'sine'; lfo2.frequency.value = 0.07
      const lfo2g = ctx.createGain(); lfo2g.gain.value = 0.14
      lfo2.connect(lfo2g); lfo2g.connect(waveGain.gain)
      src.connect(lpf); lpf.connect(waveGain); waveGain.connect(gain)
      /* Foam/fizz layer — high-passed noise that swells with the waves */
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
      /* Stereo noise source — three parallel filter paths recreate rain texture */
      const len = ctx.sampleRate * 6
      const buf = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch)
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
      /* Layer 1: Rain body — the "shhhh" roar of steady rain */
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.35
      const bpG = ctx.createGain(); bpG.gain.value = 0.38
      /* Layer 2: Drop impacts — sharp transient character of drops hitting hard surfaces */
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2800; hp.Q.value = 0.4
      const hpG = ctx.createGain(); hpG.gain.value = 0.18
      /* Layer 3: Low rumble — distant drainage / rain on a roof below you */
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; lp.Q.value = 0.5
      const lpG = ctx.createGain(); lpG.gain.value = 0.14
      src.connect(bp);  bp.connect(bpG);   bpG.connect(gain)
      src.connect(hp);  hp.connect(hpG);   hpG.connect(gain)
      src.connect(lp);  lp.connect(lpG);   lpG.connect(gain)
      src.start()
      nodes.push(src)

    } else if (preset === 'focus') {
      const osc1 = ctx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = 220
      const osc1g = ctx.createGain(); osc1g.gain.value = 0.18
      const panL = ctx.createStereoPanner(); panL.pan.value = -1
      osc1.connect(osc1g); osc1g.connect(panL); panL.connect(gain)

      const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 260
      const osc2g = ctx.createGain(); osc2g.gain.value = 0.18
      const panR = ctx.createStereoPanner(); panR.pan.value = 1
      osc2.connect(osc2g); osc2g.connect(panR); panR.connect(gain)

      osc1.start(); osc2.start()
      nodes.push(osc1, osc2)
    }

    nodesRef.current = nodes
    setPlaying(preset)
  }, [volume, stopAll])

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume
  }, [volume])

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

  const activeStreamMeta  = MUSIC_STREAMS.find(s => s.id === activeStream)
  const resolvedEmbed     = activeStreamMeta ? activeStreamMeta.embedUrl : embedUrl

  return (
    <div className={styles.audioPanel}>

      {/* ── Ambient Sounds ──────────────────────────────────── */}
      <p className={styles.audioSectionLabel}>Ambient Sounds</p>

      {AUDIO_PRESETS.map(p => (
        <button
          key={p.id}
          type="button"
          className={`${styles.audioPreset} ${playing === p.id ? styles.audioPresetOn : ''}`}
          onClick={() => toggleAmbient(p.id)}
          aria-pressed={playing === p.id}
          aria-label={`${playing === p.id ? 'Stop' : 'Play'} ${p.label}`}
        >
          <div className={styles.audioPresetTop}>
            <span className={styles.audioPresetIcon} aria-hidden="true">{p.icon}</span>
            <span className={styles.audioPresetLabel}>{p.label}</span>
            <span className={styles.audioPresetStatus} aria-hidden="true">
              {playing === p.id ? '◉' : '○'}
            </span>
          </div>
          <p className={styles.audioPresetDesc}>{p.desc}</p>
        </button>
      ))}

      <div className={styles.audioVolRow}>
        <span className={styles.audioVolLabel}>Volume</span>
        <input
          type="range" min={0} max={1} step={0.05} value={volume}
          className={styles.audioVolSlider}
          onChange={e => setVolume(Number(e.target.value))}
          aria-label="Ambient volume"
          style={{ '--fill-pct': `${volume * 100}%` } as CSSProperties}
        />
        <span className={styles.audioVolValue}>{Math.round(volume * 100)}%</span>
      </div>

      {playing === 'focus' && (
        <p className={styles.audioHeadphoneNote}>Headphones required for binaural effect</p>
      )}

      {/* ── Music Player ─────────────────────────────────────── */}
      <div className={styles.audioSectionDivider} aria-hidden="true" />
      <p className={styles.audioSectionLabel}>Music Player</p>

      {/* Preset quick-access streams */}
      <div className={styles.musicStreamRow}>
        {MUSIC_STREAMS.map(s => (
          <button
            key={s.id}
            type="button"
            className={`${styles.musicStreamBtn} ${activeStream === s.id ? styles.musicStreamBtnOn : ''}`}
            onClick={() => toggleStream(s.id)}
            aria-pressed={activeStream === s.id}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Custom embed URL — YouTube, Spotify, SoundCloud, or any embed URL */}
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
        <p className={styles.customUrlHint}>
          Supports YouTube · Spotify · SoundCloud · any embed URL
        </p>
      </div>

      {/* Embedded player — preset stream or custom URL */}
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

/* ══════════════════════════════════════════════════════════════
   SECTION 7 — StudySideDock
   ══════════════════════════════════════════════════════════════ */

type DockTabId = 'notes' | 'cards'

const DOCK_TABS: { id: DockTabId; label: string; icon: string }[] = [
  { id: 'notes', label: 'Notes', icon: '⌗' },
  { id: 'cards', label: 'Cards', icon: '◇' },
]

function StudySideDock() {
  const [activeTab, setActiveTab] = useState<DockTabId>('notes')

  return (
    <aside className={styles.sideDock} aria-label="Study utility dock">
      {/* Tab bar */}
      <div className={styles.dockTabs} role="tablist" aria-label="Dock modules">
        {DOCK_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`dock-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`dock-panel-${tab.id}`}
            className={`${styles.dockTab} ${activeTab === tab.id ? styles.dockTabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={styles.dockTabIcon} aria-hidden="true">{tab.icon}</span>
            <span className={styles.dockTabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Panel — Notes always mounted so content persists on tab switch */}
      <div
        className={styles.dockContent}
        role="tabpanel"
        id={`dock-panel-${activeTab}`}
        aria-labelledby={`dock-tab-${activeTab}`}
      >
        <div className={activeTab === 'notes' ? styles.dockPaneFull : styles.dockPaneHidden}>
          <CockpitNotes />
        </div>
        <div className={activeTab === 'cards' ? styles.dockPaneFull : styles.dockPaneHidden}>
          <CockpitCards />
        </div>
      </div>
    </aside>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 8 — StudyLayoutContainer  (default export)
   ══════════════════════════════════════════════════════════════ */

export default function StudyLayoutContainer() {
  const { isStudyModeActive, sessionCount, exitStudyWorkspace } = useStudyMode()

  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const EXIT_DURATION = 450

  useEffect(() => {
    if (isStudyModeActive) {
      setMounted(true)
      const t = setTimeout(() => setVisible(true), 20)
      return () => clearTimeout(t)
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), EXIT_DURATION)
      return () => clearTimeout(t)
    }
  }, [isStudyModeActive])

  if (!mounted) return null

  const containerStyle: CSSProperties = {
    opacity:       visible ? 1 : 0,
    transform:     visible ? 'scale(1)' : 'scale(0.97)',
    pointerEvents: visible ? 'auto' : 'none',
    transition:    visible
      ? 'opacity 380ms ease, transform 420ms cubic-bezier(0.16, 1, 0.3, 1)'
      : `opacity ${EXIT_DURATION - 50}ms ease, transform ${EXIT_DURATION}ms cubic-bezier(0.4, 0, 1, 1)`,
  }

  return (
    <div
      className={styles.cockpit}
      style={containerStyle}
      role="dialog"
      aria-modal="true"
      aria-label="Study mode workspace"
    >
      <CockpitTopBar sessionCount={sessionCount} onExit={exitStudyWorkspace} />
      <div className={styles.cockpitBody}>
        <StudyPomodoroArena contextSessionCount={sessionCount} />
        <StudySideDock />
      </div>
    </div>
  )
}
