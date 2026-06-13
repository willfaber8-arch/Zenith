export type HardscapeElementType = 'STONE' | 'DRIFTWOOD' | 'SUBSTRATE_LINE'

export interface HardscapeElement {
  id: string
  type: HardscapeElementType
  label: string
  /** Centre x as % of canvas width (0–100) */
  xPercent: number
  /** Centre y as % of canvas height (0–100) */
  yPercent: number
  /** Clockwise rotation in degrees (0–360) */
  rotationAngle: number
  /** Uniform scale factor (0.5–2.0) */
  scaleFactor: number
}

export interface AquascapeLayout {
  id?: number
  name: string
  elements: HardscapeElement[]
  tankPreset: TankPreset
  savedAt: number
}

export type TankPreset = '5g' | '10g' | '20g-l' | '29g'

export const TANK_PRESETS: Record<TankPreset, { label: string; dims: string; aspectRatio: number }> = {
  '5g':    { label: '5G Pico',      dims: '16"×8"×10"',  aspectRatio: 2.0 },
  '10g':   { label: '10G Standard', dims: '20"×10"×12"', aspectRatio: 2.0 },
  '20g-l': { label: '20G Long',     dims: '30"×12"×12"', aspectRatio: 2.5 },
  '29g':   { label: '29G Standard', dims: '30"×12"×18"', aspectRatio: 2.5 },
}

export interface PaletteEntry {
  paletteId: string
  type: HardscapeElementType
  label: string
  shortLabel: string
  fillColor: string
  strokeColor: string
}

export const PALETTE_ENTRIES: PaletteEntry[] = [
  { paletteId: 'seiryu-stone',     type: 'STONE',          label: 'Seiryu Stone',    shortLabel: 'SEIRYU',    fillColor: 'rgba(76,102,130,0.88)',  strokeColor: 'rgba(130,172,212,0.50)' },
  { paletteId: 'dragon-stone',     type: 'STONE',          label: 'Dragon Stone',    shortLabel: 'DRAGON',    fillColor: 'rgba(72,60,50,0.90)',     strokeColor: 'rgba(140,118,88,0.50)'  },
  { paletteId: 'spider-wood',      type: 'DRIFTWOOD',      label: 'Spider Wood',     shortLabel: 'SPIDER W',  fillColor: 'rgba(90,52,35,0.88)',     strokeColor: 'rgba(170,110,65,0.50)'  },
  { paletteId: 'manzanita',        type: 'DRIFTWOOD',      label: 'Manzanita Wood',  shortLabel: 'MANZANITA', fillColor: 'rgba(110,70,42,0.88)',    strokeColor: 'rgba(180,130,80,0.50)'  },
  { paletteId: 'substrate-border', type: 'SUBSTRATE_LINE', label: 'Substrate Border',shortLabel: 'SUBSTRATE', fillColor: 'rgba(55,42,28,0.88)',     strokeColor: 'rgba(110,88,62,0.45)'  },
  { paletteId: 'anubias-rock',     type: 'STONE',          label: 'Anubias Rock',    shortLabel: 'ANUBIAS',   fillColor: 'rgba(35,68,48,0.90)',     strokeColor: 'rgba(65,148,92,0.50)'  },
]

/** Base element dimensions as % of canvas (at scaleFactor = 1.0) */
export const ELEMENT_BASE_DIMS: Record<HardscapeElementType, { wPct: number; hPct: number }> = {
  STONE:          { wPct: 10, hPct: 12 },
  DRIFTWOOD:      { wPct: 18, hPct:  8 },
  SUBSTRATE_LINE: { wPct: 24, hPct:  5 },
}

/** SVG silhouette paths for each element type */
export const ELEMENT_SHAPES: Record<HardscapeElementType, {
  viewBox: string
  d: string
  detailLines?: Array<{ x1: number; y1: number; x2: number; y2: number }>
}> = {
  STONE: {
    viewBox: '0 0 80 70',
    d: 'M26,62 L10,46 L7,28 L18,12 L38,6 L60,11 L72,28 L70,48 L54,64 Z',
    detailLines: [
      { x1: 20, y1: 30, x2: 50, y2: 22 },
      { x1: 36, y1: 10, x2: 40, y2: 48 },
    ],
  },
  DRIFTWOOD: {
    viewBox: '0 0 120 50',
    d: 'M6,38 C16,10 42,6 66,9 C88,12 108,20 114,34 C110,48 86,46 64,43 C40,40 18,46 6,38 Z',
    detailLines: [
      { x1: 20, y1: 22, x2: 80, y2: 15 },
      { x1: 30, y1: 38, x2: 90, y2: 30 },
    ],
  },
  SUBSTRATE_LINE: {
    viewBox: '0 0 160 32',
    d: 'M10,16 C10,7 16,4 24,4 L136,4 C146,4 150,7 150,16 C150,25 146,28 136,28 L24,28 C16,28 10,25 10,16 Z',
    detailLines: [
      { x1: 22, y1: 16, x2: 138, y2: 16 },
      { x1: 50, y1: 9,  x2: 50,  y2: 23  },
      { x1: 110, y1: 9, x2: 110, y2: 23  },
    ],
  },
}
