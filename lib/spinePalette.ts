/**
 * lib/spinePalette.ts — give each book a spine colour taken from its cover.
 *
 * There is no such thing as a spine image to fetch. Open Library and
 * Google Books both serve front covers only; nobody publishes scans of
 * spines, so a shelf can never show the real printed spine of a book.
 *
 * What makes a real shelf read as a library is not the artwork anyway —
 * it is that every spine is its own colour. Ours were picked from a fixed
 * palette by hashing the book id, so a Sanderson sat next to a Sanderson
 * in unrelated colours and the whole shelf looked arbitrary.
 *
 * So the colour is sampled from the cover instead, weighted to its left
 * edge, which on most jackets is where the design wraps around onto the
 * real spine. The result is not the printed spine, but it is that book's
 * colour rather than a random one, and a shelf of them looks like a
 * shelf.
 *
 * This is only possible because covers are proxied through our own
 * origin: reading pixels from a cross-origin image taints the canvas and
 * throws. Before the proxy this could not have been done at all.
 */

'use client'

/** Fraction of the cover's width treated as the wrap-around edge. */
const EDGE_FRACTION = 0.18

/** Downscale before sampling — a thumbnail is plenty and it is quick. */
const SAMPLE_W = 40
const SAMPLE_H = 60

/**
 * Extract a spine colour from a loaded cover image.
 *
 * Returns null rather than throwing when the image cannot be read: a
 * tainted canvas, a zero-size image, or a browser without canvas support
 * all just mean the book keeps its existing colour.
 */
export function spineColorFromCover(img: HTMLImageElement): string | null {
  if (!img.naturalWidth || !img.naturalHeight) return null

  let data: Uint8ClampedArray
  try {
    const canvas = document.createElement('canvas')
    canvas.width  = SAMPLE_W
    canvas.height = SAMPLE_H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, SAMPLE_W, SAMPLE_H)
    data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data
  } catch {
    return null                      // cross-origin taint, most likely
  }

  const edgeCols = Math.max(1, Math.round(SAMPLE_W * EDGE_FRACTION))

  let r = 0, g = 0, b = 0, weight = 0
  for (let y = 0; y < SAMPLE_H; y++) {
    for (let x = 0; x < SAMPLE_W; x++) {
      const i = (y * SAMPLE_W + x) * 4
      if (data[i + 3] < 128) continue          // transparent — skip

      const pr = data[i], pg = data[i + 1], pb = data[i + 2]

      /*
       * Near-white and near-black pixels are deliberately down-weighted.
       * Most covers carry a lot of both — white margins, black text — and
       * averaging them in drags every spine toward the same grey, which
       * is exactly the arbitrary look this replaces.
       */
      const max = Math.max(pr, pg, pb)
      const min = Math.min(pr, pg, pb)
      const lum = (max + min) / 2
      const sat = max === min ? 0 : (max - min) / (255 - Math.abs(2 * lum - 255) || 1)
      if (lum > 240 || lum < 12) continue

      // The wrap-around edge counts for more than the middle of the cover.
      const edgeBoost = x < edgeCols ? 3 : 1
      const w = edgeBoost * (0.35 + sat)

      r += pr * w; g += pg * w; b += pb * w; weight += w
    }
  }

  if (weight === 0) return null
  return toSpineHex(r / weight, g / weight, b / weight)
}

/**
 * Nudge a sampled colour into something a spine can actually use.
 *
 * The lettering on a spine is cream and non-negotiable, so the colour has
 * to stay dark enough to carry it. Rather than clamping — which turns
 * every bright cover into the same muddy brown — the hue and a good deal
 * of the saturation are kept, and only lightness is brought into range.
 */
export function toSpineHex(r: number, g: number, b: number): string {
  const [h, s, l] = rgbToHsl(r, g, b)

  /*
   * Keep it recognisably the cover's colour, but always readable.
   *
   * The saturation floor is skipped for a cover that has no colour at
   * all. Applying it to a greyscale jacket invented a hue out of nothing
   * — and since `rgbToHsl` reports hue 0 for grey, every black-and-white
   * book came out dull red.
   */
  const s2 = s < 0.02 ? 0 : Math.min(0.62, Math.max(0.16, s * 0.85))
  const l2 = Math.min(0.34, Math.max(0.16, l * 0.62 + 0.06))

  const [r2, g2, b2] = hslToRgb(h, s2, l2)
  return '#' + [r2, g2, b2].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
}

/* ── Colour space ──────────────────────────────────────────────────── */

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else                h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = l * 255; return [v, v, v] }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const ch = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [ch(h + 1 / 3) * 255, ch(h) * 255, ch(h - 1 / 3) * 255]
}
