'use client'

/* ════════════════════════════════════════════════════════════════
   Zenith OS — Hardscape Layout Simulator
   Phase 4 · Step 4.3

   Grid-snapped canvas workspace for planning aquarium hardscape.
   Elements are placed by selecting a palette type, then clicking
   the canvas. Existing elements can be repositioned by dragging.
   All element sizes are adjustable via scale controls. Layout
   persists in localStorage between sessions.
   ════════════════════════════════════════════════════════════════ */

import {
  useState, useRef, useEffect, useCallback,
  type CSSProperties, type MouseEvent,
} from 'react'
import styles from './HardscapeSimulator.module.css'

/* ── Constants ────────────────────────────────────────────────── */

const COLS = 20
const ROWS = 10
const LS_KEY = 'zenith_hardscape_v1'

/* ── Types ────────────────────────────────────────────────────── */

type ElementType =
  | 'seiryu-stone'
  | 'dragon-stone'
  | 'spider-wood'
  | 'driftwood'
  | 'anubias'
  | 'java-fern'

type TankPreset = '5g' | '10g' | '20g-l' | '29g'

interface HardscapeItem {
  id: string
  type: ElementType
  x: number   // grid column, 0-indexed
  y: number   // grid row, 0-indexed
  w: number   // width in grid cols (≥ 1)
  h: number   // height in grid rows (≥ 1)
}

interface DragState {
  itemId: string
  startItemX: number
  startItemY: number
  startMouseX: number
  startMouseY: number
  itemW: number
  itemH: number
}

/* ── Config tables ────────────────────────────────────────────── */

const ELEMENT_CONFIG: Record<ElementType, {
  label: string
  shortLabel: string
  bg: string
  border: string
  defaultW: number
  defaultH: number
}> = {
  'seiryu-stone': {
    label: 'Seiryu Stone',     shortLabel: 'SEIRYU',
    bg: 'rgba(76,102,120,0.90)',  border: 'rgba(120,160,190,0.35)',
    defaultW: 2, defaultH: 2,
  },
  'dragon-stone': {
    label: 'Dragon Stone',     shortLabel: 'DRAGON',
    bg: 'rgba(72,62,56,0.92)',    border: 'rgba(130,110,90,0.35)',
    defaultW: 3, defaultH: 2,
  },
  'spider-wood': {
    label: 'Spider Wood',      shortLabel: 'SPIDER W',
    bg: 'rgba(90,52,35,0.90)',    border: 'rgba(160,100,60,0.35)',
    defaultW: 5, defaultH: 1,
  },
  'driftwood': {
    label: 'Driftwood',        shortLabel: 'DRIFT',
    bg: 'rgba(110,80,50,0.88)',   border: 'rgba(180,140,90,0.35)',
    defaultW: 6, defaultH: 1,
  },
  'anubias': {
    label: 'Anubias',          shortLabel: 'ANUBIAS',
    bg: 'rgba(25,72,45,0.95)',    border: 'rgba(60,160,90,0.40)',
    defaultW: 1, defaultH: 2,
  },
  'java-fern': {
    label: 'Java Fern',        shortLabel: 'J.FERN',
    bg: 'rgba(32,90,52,0.95)',    border: 'rgba(70,180,100,0.40)',
    defaultW: 2, defaultH: 2,
  },
}

const PALETTE_ORDER: ElementType[] = [
  'seiryu-stone', 'dragon-stone', 'spider-wood', 'driftwood', 'anubias', 'java-fern',
]

const TANK_PRESETS: Record<TankPreset, { label: string; dims: string; ratio: number }> = {
  '5g':    { label: '5G Pico',      dims: '16"×8"×10"',  ratio: 2.0   },
  '10g':   { label: '10G Standard', dims: '20"×10"×12"', ratio: 2.0   },
  '20g-l': { label: '20G Long',     dims: '30"×12"×12"', ratio: 2.5   },
  '29g':   { label: '29G Standard', dims: '30"×12"×18"', ratio: 2.5   },
}

/* ── Component ────────────────────────────────────────────────── */

export default function HardscapeSimulator() {
  const [items,       setItems]       = useState<HardscapeItem[]>([])
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const [activeTool,  setActiveTool]  = useState<ElementType | null>(null)
  const [tankPreset,  setTankPreset]  = useState<TankPreset>('10g')
  const [mounted,     setMounted]     = useState(false)

  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef   = useRef<DragState | null>(null)

  const preset = TANK_PRESETS[tankPreset]
  const selectedItem = items.find(i => i.id === selectedId) ?? null

  /* ── Persistence ──────────────────────────────────────────── */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {}
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    try { localStorage.setItem(LS_KEY, JSON.stringify(items)) } catch {}
  }, [items, mounted])

  /* ── Grid helpers ─────────────────────────────────────────── */

  const pixelToCell = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { col: 0, row: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    const col = Math.max(0, Math.min(COLS - 1, Math.floor((clientX - rect.left)  / rect.width  * COLS)))
    const row = Math.max(0, Math.min(ROWS - 1, Math.floor((clientY - rect.top) / rect.height * ROWS)))
    return { col, row }
  }, [])

  /* ── Drag (document-level) ────────────────────────────────── */

  const handleDocMouseMove = useCallback((e: globalThis.MouseEvent) => {
    const drag = dragRef.current
    if (!drag || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const dx = Math.round((e.clientX - drag.startMouseX) / rect.width  * COLS)
    const dy = Math.round((e.clientY - drag.startMouseY) / rect.height * ROWS)

    setItems(prev => prev.map(item => {
      if (item.id !== drag.itemId) return item
      return {
        ...item,
        x: Math.max(0, Math.min(COLS - drag.itemW, drag.startItemX + dx)),
        y: Math.max(0, Math.min(ROWS - drag.itemH, drag.startItemY + dy)),
      }
    }))
  }, [])

  const handleDocMouseUp = useCallback(() => { dragRef.current = null }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleDocMouseMove)
    document.addEventListener('mouseup',   handleDocMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleDocMouseMove)
      document.removeEventListener('mouseup',   handleDocMouseUp)
    }
  }, [handleDocMouseMove, handleDocMouseUp])

  /* ── Canvas interaction ───────────────────────────────────── */

  const handleCanvasDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== canvasRef.current) return  // element click handled separately
    if (activeTool) {
      const { col, row } = pixelToCell(e.clientX, e.clientY)
      const cfg = ELEMENT_CONFIG[activeTool]
      const newItem: HardscapeItem = {
        id: crypto.randomUUID(),
        type: activeTool,
        x: Math.min(col, COLS - cfg.defaultW),
        y: Math.min(row, ROWS - cfg.defaultH),
        w: cfg.defaultW,
        h: cfg.defaultH,
      }
      setItems(prev => [...prev, newItem])
      setSelectedId(newItem.id)
      setActiveTool(null)
    } else {
      setSelectedId(null)
    }
  }

  const handleElementDown = (e: MouseEvent<HTMLDivElement>, item: HardscapeItem) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(item.id)
    dragRef.current = {
      itemId:       item.id,
      startItemX:   item.x,
      startItemY:   item.y,
      startMouseX:  e.clientX,
      startMouseY:  e.clientY,
      itemW:        item.w,
      itemH:        item.h,
    }
  }

  /* ── Selected element mutations ───────────────────────────── */

  const scaleSelected = (dim: 'w' | 'h', delta: number) => {
    if (!selectedId) return
    setItems(prev => prev.map(item => {
      if (item.id !== selectedId) return item
      if (dim === 'w') {
        const nw = Math.max(1, Math.min(COLS - item.x, item.w + delta))
        return { ...item, w: nw }
      }
      const nh = Math.max(1, Math.min(ROWS - item.y, item.h + delta))
      return { ...item, h: nh }
    }))
  }

  const deleteSelected = () => {
    if (!selectedId) return
    setItems(prev => prev.filter(i => i.id !== selectedId))
    setSelectedId(null)
  }

  const clearAll = () => { setItems([]); setSelectedId(null) }

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className={styles.simulator}>

      {/* ── Header row ────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.panelLabel}>Hardscape Simulator</span>
          <div className={styles.presetRow}>
            {(Object.keys(TANK_PRESETS) as TankPreset[]).map(p => (
              <button
                key={p}
                className={`${styles.presetBtn} ${tankPreset === p ? styles.presetBtnActive : ''}`}
                onClick={() => setTankPreset(p)}
              >
                {TANK_PRESETS[p].label}
                <span className={styles.presetDims}>{TANK_PRESETS[p].dims}</span>
              </button>
            ))}
          </div>
        </div>
        <button className={styles.clearBtn} onClick={clearAll}>Clear All</button>
      </div>

      {/* ── Palette ───────────────────────────────────────────── */}
      <div className={styles.palette}>
        <span className={styles.paletteLabel}>Add Element:</span>
        {PALETTE_ORDER.map(type => {
          const cfg = ELEMENT_CONFIG[type]
          return (
            <button
              key={type}
              className={`${styles.paletteBtn} ${activeTool === type ? styles.paletteBtnActive : ''}`}
              style={{ '--el-bg': cfg.bg, '--el-border': cfg.border } as CSSProperties}
              onClick={() => setActiveTool(prev => prev === type ? null : type)}
            >
              {cfg.label}
            </button>
          )
        })}
        {activeTool && (
          <button className={styles.deselBtn} onClick={() => setActiveTool(null)}>
            ✕ Cancel
          </button>
        )}
        {activeTool && (
          <span className={styles.placeHint}>
            Click the canvas to place
          </span>
        )}
      </div>

      {/* ── Canvas ────────────────────────────────────────────── */}
      <div
        className={styles.canvasWrapper}
        style={{ paddingBottom: `${(1 / preset.ratio) * 100}%` }}
      >
        <div
          ref={canvasRef}
          className={`${styles.canvas} ${activeTool ? styles.canvasPlacing : ''}`}
          onMouseDown={handleCanvasDown}
          style={{
            backgroundSize: `${100 / COLS}% ${100 / ROWS}%`,
          }}
        >
          {items.map(item => {
            const cfg = ELEMENT_CONFIG[item.type]
            const isSelected = item.id === selectedId
            return (
              <div
                key={item.id}
                className={`${styles.element} ${isSelected ? styles.elementSelected : ''}`}
                style={{
                  left:    `${(item.x / COLS) * 100}%`,
                  top:     `${(item.y / ROWS) * 100}%`,
                  width:   `${(item.w / COLS) * 100}%`,
                  height:  `${(item.h / ROWS) * 100}%`,
                  background: cfg.bg,
                  borderColor: cfg.border,
                } as CSSProperties}
                onMouseDown={e => handleElementDown(e, item)}
              >
                <span className={styles.elementLabel}>{cfg.shortLabel}</span>
              </div>
            )
          })}

          {/* Empty-state overlay */}
          {items.length === 0 && !activeTool && (
            <div className={styles.canvasEmpty}>
              <p>Select an element from the palette above, then click here to place it.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Controls bar ──────────────────────────────────────── */}
      {selectedItem ? (
        <div className={styles.controls}>
          <div className={styles.controlItem}>
            <span className={styles.controlsLabel}>
              {ELEMENT_CONFIG[selectedItem.type].label}
            </span>
          </div>
          <div className={styles.controlGroup}>
            <span className={styles.controlDimLabel}>W</span>
            <button className={styles.scaleBtn} onClick={() => scaleSelected('w', -1)}>−</button>
            <span className={styles.scaleDim}>{selectedItem.w}</span>
            <button className={styles.scaleBtn} onClick={() => scaleSelected('w', +1)}>+</button>
          </div>
          <div className={styles.controlGroup}>
            <span className={styles.controlDimLabel}>H</span>
            <button className={styles.scaleBtn} onClick={() => scaleSelected('h', -1)}>−</button>
            <span className={styles.scaleDim}>{selectedItem.h}</span>
            <button className={styles.scaleBtn} onClick={() => scaleSelected('h', +1)}>+</button>
          </div>
          <button className={styles.deleteBtn} onClick={deleteSelected}>
            Remove Element
          </button>
        </div>
      ) : (
        <div className={styles.controlsHint}>
          <span>
            {items.length > 0
              ? 'Click an element to select it — then drag, scale, or delete.'
              : 'Choose a palette element type above to begin building your layout.'}
          </span>
        </div>
      )}
    </div>
  )
}
