/**
 * Spine colour derivation.
 *
 * `spineColorFromCover` needs a canvas and a decoded image, so the pixel
 * sampling is exercised in the browser. What is tested here is the part
 * that decides what a sampled colour is allowed to become — which is
 * where the constraint lives: spine lettering is cream, so the colour has
 * to stay dark enough to carry it while still being recognisably the
 * book's own.
 */

import { toSpineHex } from '@/lib/spinePalette'

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Perceptual-ish lightness, 0–1. */
function lightness(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255)
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
}

/** Shortest distance between two hues, since the scale wraps at 360. */
function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function hue(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return -1
  const d = max - min
  if (max === r) return (((g - b) / d + (g < b ? 6 : 0)) / 6) * 360
  if (max === g) return (((b - r) / d + 2) / 6) * 360
  return (((r - g) / d + 4) / 6) * 360
}

describe('toSpineHex', () => {
  it('returns a valid hex colour', () => {
    expect(toSpineHex(200, 40, 60)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('keeps every colour dark enough for cream lettering', () => {
    // The whole constraint. A bright cover must not produce a spine the
    // title disappears into.
    const samples: Array<[number, number, number]> = [
      [255, 255, 255], [250, 240, 120], [0, 255, 255],
      [255, 0, 0], [20, 20, 20], [0, 0, 0], [128, 128, 128],
    ]
    for (const [r, g, b] of samples) {
      expect(lightness(toSpineHex(r, g, b))).toBeLessThanOrEqual(0.36)
    }
  })

  it('never goes so dark the spine reads as black', () => {
    expect(lightness(toSpineHex(0, 0, 0))).toBeGreaterThanOrEqual(0.14)
  })

  it('preserves the hue, so a red book stays red', () => {
    // Clamping lightness without keeping hue would turn every cover into
    // the same muddy brown, which is the arbitrary look this replaces.
    expect(hueGap(hue(toSpineHex(220, 30, 40)), 0)).toBeLessThan(20)         // red
    const blue = hue(toSpineHex(30, 60, 210))
    expect(blue).toBeGreaterThan(200); expect(blue).toBeLessThan(260)
    const green = hue(toSpineHex(40, 190, 70))
    expect(green).toBeGreaterThan(90); expect(green).toBeLessThan(160)
  })

  it('gives visibly different colours to different covers', () => {
    // If two unrelated covers collapse to the same spine, the shelf looks
    // exactly as arbitrary as the hashed palette it replaced.
    const set = new Set([
      toSpineHex(200, 40, 60), toSpineHex(40, 80, 200),
      toSpineHex(50, 170, 90), toSpineHex(200, 160, 40),
    ])
    expect(set.size).toBe(4)
  })

  it('is deterministic', () => {
    expect(toSpineHex(123, 45, 67)).toBe(toSpineHex(123, 45, 67))
  })

  it('handles a greyscale cover without producing a false hue', () => {
    // rgbToHsl reports hue 0 for grey, so a saturation floor applied
    // unconditionally turned every black-and-white jacket dull red.
    const grey = toSpineHex(128, 128, 128)
    const [r, g, b] = hexToRgb(grey)
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(2)
  })
})
