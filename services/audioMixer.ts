/**
 * AudioMixerService — singleton Web Audio API context manager.
 *
 * Phase 14.1 · Audio Atmosphere — Lo-Fi Soundscapes
 *
 * ── Graph topology ──────────────────────────────────────────────
 *
 *  RAIN (procedural):
 *   BrownNoiseBuf(8s, stereo) → LPF 1100 Hz → LPF 1800 Hz → bodyGain(0.72)
 *                                                                   ↑ LFO(0.072 Hz) ±0.20
 *   WhiteNoiseBuf(8s, stereo) → HPF 3600 Hz               → dropGain(0.50)
 *   bodyGain + dropGain ─────────────────────────────────────→ rainChannelGain
 *
 *  FIREPLACE (procedural):
 *   BrownNoiseBuf(10s, stereo) → LPF 160 Hz      → rumbleGain(0.85)
 *   WhiteNoiseBuf(10s, stereo) → BPF 380 Hz Q0.4 → warmGain(0.42)
 *   + randomly scheduled crackle impulses (BPF 800–1500 Hz, 22ms)
 *   all ──────────────────────────────────────────────────────→ fireplaceChannelGain
 *
 *  KEYBOARD (on-demand, per keypress):
 *   NoiseBurst(55ms) → HPF 3000 Hz → clickEnv(exp decay 42ms) ─→ keyboardChannelGain
 *   SineOsc(90 Hz)               → thudEnv(exp decay 25ms)   ─→ keyboardChannelGain
 *
 *  rainChannelGain + fireplaceChannelGain + keyboardChannelGain → masterGain(0.88) → destination
 *
 * ── SSR safety ──────────────────────────────────────────────────
 * No top-level browser APIs are invoked. AudioContext is created
 * inside `start()`, which is only called inside a user gesture handler.
 */

export type AtmosphereChannel = 'rain' | 'fireplace' | 'keyboard'

export interface ChannelLevels {
  rain:      number   // 0–1
  fireplace: number   // 0–1
  keyboard:  number   // 0–1
}

// ─── Constants ────────────────────────────────────────────────────────────

const MASTER_GAIN    = 0.88
const RAIN_BUF_SECS  = 8     // stereo loop buffer length (rain)
const FIRE_BUF_SECS  = 10    // stereo loop buffer length (fireplace)
const CRACKLE_MIN_MS = 480
const CRACKLE_MAX_MS = 2600

// ─── Service class ────────────────────────────────────────────────────────

class AudioMixerService {
  // Context + master bus
  private ctx:           AudioContext | null = null
  private masterGain:    GainNode     | null = null

  // Per-channel gain buses (direct handles for setValueAtTime)
  private rainGain:      GainNode | null = null
  private fireplaceGain: GainNode | null = null
  private keyboardGain:  GainNode | null = null

  // Source nodes (kept to allow stop() on teardown)
  private rainBodySrc:  AudioBufferSourceNode | null = null
  private rainDropSrc:  AudioBufferSourceNode | null = null
  private fireSrc:      AudioBufferSourceNode | null = null
  private fireMidSrc:   AudioBufferSourceNode | null = null
  private rainLfo:      OscillatorNode        | null = null

  // Crackle scheduler handle
  private crackleTimer: ReturnType<typeof setTimeout> | null = null

  /** Whether the AudioContext is alive and audio is flowing. */
  isRunning = false

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Create the AudioContext + build all audio graphs.
   * MUST be called from within a user-gesture handler (browser autoplay policy).
   */
  async start(levels: ChannelLevels): Promise<void> {
    if (this.isRunning) return

    this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }

    const ctx = this.ctx

    // Master output bus
    this.masterGain           = ctx.createGain()
    this.masterGain.gain.value = MASTER_GAIN
    this.masterGain.connect(ctx.destination)

    // Channel buses — connect to master
    this.rainGain      = this._gain(levels.rain)
    this.fireplaceGain = this._gain(levels.fireplace)
    this.keyboardGain  = this._gain(levels.keyboard)
    this.rainGain.connect(this.masterGain)
    this.fireplaceGain.connect(this.masterGain)
    this.keyboardGain.connect(this.masterGain)

    // Build audio graphs
    this._buildRain(ctx)
    this._buildFireplace(ctx)
    this._scheduleCrackle()

    this.isRunning = true
  }

  /** Tear down AudioContext and all nodes. Safe to call multiple times. */
  stop(): void {
    if (!this.isRunning) return
    this.isRunning = false   // set BEFORE teardown so crackle fire() exits early
    this._teardown()
  }

  /**
   * Instantly update a channel's gain.
   * Uses `setValueAtTime` for zero-latency visual feedback parity.
   */
  setChannelGain(channel: AtmosphereChannel, value: number): void {
    if (!this.ctx) return
    const clamped = Math.max(0, Math.min(1, value))
    const node    = channel === 'rain'      ? this.rainGain
                  : channel === 'fireplace' ? this.fireplaceGain
                  :                          this.keyboardGain
    node?.gain.setValueAtTime(clamped, this.ctx.currentTime)
  }

  /**
   * Synthesise a snappy mechanical click transient.
   * Must be called from a keydown event handler (already inside user gesture
   * context, so AudioContext is not suspended after first start()).
   */
  triggerKeyClick(): void {
    if (!this.ctx || !this.keyboardGain || !this.isRunning) return
    const ctx = this.ctx
    const now = ctx.currentTime

    // ─ Transient click: short white-noise burst, exponential decay ─
    const sampleLen = Math.ceil(ctx.sampleRate * 0.055)
    const clickBuf  = ctx.createBuffer(1, sampleLen, ctx.sampleRate)
    const data      = clickBuf.getChannelData(0)
    for (let i = 0; i < sampleLen; i++) {
      // Bake exponential amplitude decay directly into buffer data
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / sampleLen, 9)
    }

    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = clickBuf

    const hpf         = ctx.createBiquadFilter()
    hpf.type            = 'highpass'
    hpf.frequency.value = 3000
    hpf.Q.value         = 0.75

    const clickEnv = ctx.createGain()
    clickEnv.gain.setValueAtTime(0.88, now)
    clickEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.042)

    noiseSrc.connect(hpf)
    hpf.connect(clickEnv)
    clickEnv.connect(this.keyboardGain)

    // ─ Mechanical thud: low sine oscillator, very fast decay ──────
    const thudOsc         = ctx.createOscillator()
    thudOsc.frequency.value = 88
    thudOsc.type            = 'sine'

    const thudEnv = ctx.createGain()
    thudEnv.gain.setValueAtTime(0.28, now)
    thudEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.025)

    thudOsc.connect(thudEnv)
    thudEnv.connect(this.keyboardGain)

    // Fire and forget — browser GC cleans up disconnected nodes
    noiseSrc.start(now)
    noiseSrc.stop(now + 0.060)
    thudOsc.start(now)
    thudOsc.stop(now + 0.030)
  }

  // ── Audio graph builders ────────────────────────────────────────────────

  private _buildRain(ctx: AudioContext): void {
    // ─ Body layer: IIR-integrated brown noise through dual LPF ────────
    const bodyBuf = this._brownNoiseBuf(ctx, RAIN_BUF_SECS, 0.42)
    this.rainBodySrc        = ctx.createBufferSource()
    this.rainBodySrc.buffer  = bodyBuf
    this.rainBodySrc.loop    = true

    const lpf1           = ctx.createBiquadFilter()
    lpf1.type            = 'lowpass'
    lpf1.frequency.value = 1100
    lpf1.Q.value         = 0.50

    const lpf2           = ctx.createBiquadFilter()
    lpf2.type            = 'lowpass'
    lpf2.frequency.value = 1800

    const bodyGain       = ctx.createGain()
    bodyGain.gain.value  = 0.72

    // LFO → body amplitude modulation for organic rainfall surges
    this.rainLfo                   = ctx.createOscillator()
    this.rainLfo.frequency.value   = 0.072   // ~14 s per surge cycle
    this.rainLfo.type              = 'sine'

    const lfoAmp       = ctx.createGain()
    lfoAmp.gain.value  = 0.20               // modulation depth: ±0.20 around 0.72

    this.rainLfo.connect(lfoAmp)
    lfoAmp.connect(bodyGain.gain)           // Audio param modulation (additive)

    this.rainBodySrc.connect(lpf1)
    lpf1.connect(lpf2)
    lpf2.connect(bodyGain)
    bodyGain.connect(this.rainGain!)

    // ─ Drop/hiss layer: high-frequency white noise ─────────────────
    const dropBuf = this._whiteNoiseBuf(ctx, RAIN_BUF_SECS, 0.10)
    this.rainDropSrc        = ctx.createBufferSource()
    this.rainDropSrc.buffer  = dropBuf
    this.rainDropSrc.loop    = true

    const hpf           = ctx.createBiquadFilter()
    hpf.type            = 'highpass'
    hpf.frequency.value = 3600
    hpf.Q.value         = 0.50

    const dropGain      = ctx.createGain()
    dropGain.gain.value = 0.52

    this.rainDropSrc.connect(hpf)
    hpf.connect(dropGain)
    dropGain.connect(this.rainGain!)

    // Start
    this.rainBodySrc.start()
    this.rainDropSrc.start()
    this.rainLfo.start()
  }

  private _buildFireplace(ctx: AudioContext): void {
    // ─ Hearth rumble: very-low-frequency brown noise ───────────────
    const rumbleBuf = this._brownNoiseBuf(ctx, FIRE_BUF_SECS, 0.55)
    this.fireSrc        = ctx.createBufferSource()
    this.fireSrc.buffer  = rumbleBuf
    this.fireSrc.loop    = true

    const lpfRumble           = ctx.createBiquadFilter()
    lpfRumble.type            = 'lowpass'
    lpfRumble.frequency.value = 160

    const rumbleGain       = ctx.createGain()
    rumbleGain.gain.value  = 0.85

    this.fireSrc.connect(lpfRumble)
    lpfRumble.connect(rumbleGain)
    rumbleGain.connect(this.fireplaceGain!)

    // ─ Warmth mid: bandpass white noise (fire "breath") ───────────
    const warmBuf = this._whiteNoiseBuf(ctx, FIRE_BUF_SECS, 0.16)
    this.fireMidSrc        = ctx.createBufferSource()
    this.fireMidSrc.buffer  = warmBuf
    this.fireMidSrc.loop    = true

    const bpfWarm           = ctx.createBiquadFilter()
    bpfWarm.type            = 'bandpass'
    bpfWarm.frequency.value = 380
    bpfWarm.Q.value         = 0.40

    const warmGain      = ctx.createGain()
    warmGain.gain.value = 0.42

    this.fireMidSrc.connect(bpfWarm)
    bpfWarm.connect(warmGain)
    warmGain.connect(this.fireplaceGain!)

    this.fireSrc.start()
    this.fireMidSrc.start()
  }

  /** Recursively schedules random wood-crackle impulses. */
  private _scheduleCrackle(): void {
    // Arrow function captures `this` from _scheduleCrackle's execution context
    const fire = () => {
      if (!this.ctx || !this.fireplaceGain || !this.isRunning) return

      const ctx = this.ctx
      const now = ctx.currentTime

      // Short bandpass-filtered noise burst → wood crackle
      const len  = Math.ceil(ctx.sampleRate * 0.022)
      const buf  = ctx.createBuffer(1, len, ctx.sampleRate)
      const d    = buf.getChannelData(0)
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 5)
      }

      const src = ctx.createBufferSource()
      src.buffer = buf

      const bpf           = ctx.createBiquadFilter()
      bpf.type            = 'bandpass'
      bpf.frequency.value = 800 + Math.random() * 700   // 800–1500 Hz
      bpf.Q.value         = 0.90

      const env = ctx.createGain()
      const pk  = 0.18 + Math.random() * 0.52
      env.gain.setValueAtTime(pk, now)
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.020)

      src.connect(bpf)
      bpf.connect(env)
      env.connect(this.fireplaceGain!)

      src.start(now)
      src.stop(now + 0.030)

      // 22% chance of realistic double-pop (rapid succession crackle)
      if (Math.random() < 0.22) {
        const doublePop = 38 + Math.random() * 60   // 38–98 ms
        this.crackleTimer = setTimeout(fire, doublePop)
        return
      }

      const nextMs = CRACKLE_MIN_MS + Math.random() * (CRACKLE_MAX_MS - CRACKLE_MIN_MS)
      this.crackleTimer = setTimeout(fire, nextMs)
    }

    // Initial crackle after a short warm-up
    this.crackleTimer = setTimeout(fire, 280 + Math.random() * 500)
  }

  // ── Teardown ────────────────────────────────────────────────────────────

  private _teardown(): void {
    if (this.crackleTimer !== null) {
      clearTimeout(this.crackleTimer)
      this.crackleTimer = null
    }

    const killBuf = (n: AudioBufferSourceNode | null) => {
      if (!n) return
      try { n.stop() }     catch { /* already stopped */ }
      try { n.disconnect() } catch { /* noop */ }
    }
    const killOsc = (n: OscillatorNode | null) => {
      if (!n) return
      try { n.stop() }     catch { /* already stopped */ }
      try { n.disconnect() } catch { /* noop */ }
    }
    const kill = (n: AudioNode | null) => {
      try { n?.disconnect() } catch { /* noop */ }
    }

    killBuf(this.rainBodySrc)
    killBuf(this.rainDropSrc)
    killBuf(this.fireSrc)
    killBuf(this.fireMidSrc)
    killOsc(this.rainLfo)
    kill(this.rainGain)
    kill(this.fireplaceGain)
    kill(this.keyboardGain)
    kill(this.masterGain)

    this.rainBodySrc = this.rainDropSrc = this.fireSrc = this.fireMidSrc = null
    this.rainLfo     = null
    this.rainGain    = this.fireplaceGain = this.keyboardGain = this.masterGain = null

    this.ctx?.close().catch(() => { /* noop */ })
    this.ctx = null
  }

  // ── Buffer factories ────────────────────────────────────────────────────

  /**
   * IIR-integrated brown noise — strongly low-frequency biased.
   * Two independent channels for natural stereo width.
   * Per rule 54: stereo buffer, normalized to targetPeak ≤ 0.70.
   */
  private _brownNoiseBuf(
    ctx: AudioContext,
    seconds: number,
    targetPeak: number,       // keep ≤ 0.70 (rule 54)
  ): AudioBuffer {
    const len = Math.ceil(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)

    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch)
      let   last = 0
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1
        last    = (last + 0.02 * w) / 1.02    // leaky integrator
        data[i] = last
      }
      // Normalize to targetPeak
      let peak = 0
      for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(data[i]))
      if (peak > 0) {
        const scale = targetPeak / peak
        for (let i = 0; i < len; i++) data[i] *= scale
      }
    }

    return buf
  }

  /**
   * Flat white noise buffer — for high-frequency textural layers.
   * Two independent channels for stereo width.
   */
  private _whiteNoiseBuf(
    ctx: AudioContext,
    seconds: number,
    amplitude: number,        // final amplitude (≤ 0.70 per rule 54)
  ): AudioBuffer {
    const len = Math.ceil(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)

    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * amplitude
      }
    }

    return buf
  }

  /** Utility: create and connect a GainNode with an initial value. */
  private _gain(value: number): GainNode {
    const g = this.ctx!.createGain()
    g.gain.value = Math.max(0, Math.min(1, value))
    return g
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────
// One AudioContext per browser session — shared by widget + keyboard hook.
export const audioMixer = new AudioMixerService()
