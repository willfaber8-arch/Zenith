'use client'

import { useState, useEffect, useCallback, type CSSProperties, type MouseEvent } from 'react'
import { useHardscapeInteraction } from '@/hooks/useHardscapeInteraction'
import {
  PALETTE_ENTRIES, TANK_PRESETS, ELEMENT_BASE_DIMS, ELEMENT_SHAPES,
  type HardscapeElement, type HardscapeElementType, type PaletteEntry, type TankPreset,
} from '@/types/hardscape'
import styles from './HardscapeSimulator.module.css'

/* ── ElementShape ─────────────────────────────────────────────────
   Renders the SVG silhouette for a given element type.
   Used both on the canvas (full size) and in the palette shelf (preview).
   ───────────────────────────────────────────────────────────────── */

function ElementShape({
  type, fillColor, strokeColor,
}: {
  type: HardscapeElementType
  fillColor: string
  strokeColor: string
}) {
  const shape = ELEMENT_SHAPES[type]
  return (
    <svg
      viewBox={shape.viewBox}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      <path d={shape.d} fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
      {shape.detailLines?.map((l, i) => (
        <line
          key={i}
          x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke={strokeColor}
          strokeWidth="0.8"
          opacity={0.55}
        />
      ))}
    </svg>
  )
}

/* ── RotationHud ──────────────────────────────────────────────────
   SVG ring centered on a selected element. Drag the ring or its
   handle to set rotationAngle. Invisible wide stroke is the hit
   target; the visible dashed ring is purely decorative.
   ───────────────────────────────────────────────────────────────── */

function RotationHud({
  el, onRingMouseDown,
}: {
  el: HardscapeElement
  onRingMouseDown: (e: React.MouseEvent) => void
}) {
  const RAD = 46
  const CX  = 52
  const CY  = 52
  const SIZE = 104
  // 0° = top (12-o'clock), increases clockwise
  const angleRad = (el.rotationAngle - 90) * (Math.PI / 180)
  const hx = CX + RAD * Math.cos(angleRad)
  const hy = CY + RAD * Math.sin(angleRad)

  return (
    <div
      className={styles.hudRing}
      style={{ left: `${el.xPercent}%`, top: `${el.yPercent}%` }}
    >
      <svg
        width={SIZE} height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ pointerEvents: 'none', display: 'block' }}
      >
        {/* Wide invisible hit area for the ring */}
        <circle
          cx={CX} cy={CY} r={RAD}
          fill="none"
          stroke="transparent"
          strokeWidth={16}
          style={{ pointerEvents: 'stroke', cursor: 'grab' }}
          onMouseDown={onRingMouseDown}
        />
        {/* Dashed visual ring */}
        <circle
          cx={CX} cy={CY} r={RAD}
          fill="none"
          stroke="rgba(124,149,255,0.35)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          style={{ pointerEvents: 'none' }}
        />
        {/* 0° tick at top */}
        <line
          x1={CX} y1={CY - RAD - 7}
          x2={CX} y2={CY - RAD - 1}
          stroke="rgba(124,149,255,0.60)"
          strokeWidth="1.5"
          style={{ pointerEvents: 'none' }}
        />
        {/* Rotation handle */}
        <circle
          cx={hx} cy={hy} r={6}
          fill="rgba(124,149,255,0.90)"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="1.5"
          style={{ pointerEvents: 'all', cursor: 'grab' }}
          onMouseDown={onRingMouseDown}
        />
        {/* Angle readout */}
        <text
          x={CX} y={CY + 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(124,149,255,0.55)"
          fontSize={9}
          fontFamily="monospace"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {Math.round(el.rotationAngle)}°
        </text>
      </svg>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────── */

export default function HardscapeSimulator() {
  const [tankPreset,    setTankPreset]    = useState<TankPreset>('10g')
  const [activePalette, setActivePalette] = useState<PaletteEntry | null>(null)
  const [mounted,       setMounted]       = useState(false)

  const {
    elements, selectedId, isDragging, canvasRef,
    addElement, selectElement, deleteSelected, updateScale, clearAll, loadLayout,
    getElementMouseDown, getRotateMouseDown,
  } = useHardscapeInteraction()

  const selectedEl      = elements.find(el => el.id === selectedId) ?? null
  const preset          = TANK_PRESETS[tankPreset]

  /* ── IDB auto-load on mount ─────────────────────────────────── */
  useEffect(() => {
    import('@/lib/db').then(({ db }) => {
      db.aquascapeLayouts.get(1).then(layout => {
        if (layout) {
          loadLayout(layout)
          setTankPreset((layout.tankPreset as TankPreset) ?? '10g')
        }
      }).catch(() => {})
      setMounted(true)
    })
  }, [loadLayout])

  /* ── IDB auto-save on change (debounced 600ms) ──────────────── */
  useEffect(() => {
    if (!mounted) return
    const timer = setTimeout(() => {
      import('@/lib/db').then(({ db }) => {
        db.aquascapeLayouts.put({
          id: 1,
          name: 'autosave',
          elements,
          tankPreset,
          savedAt: Date.now(),
        })
      })
    }, 600)
    return () => clearTimeout(timer)
  }, [elements, tankPreset, mounted])

  /* ── Canvas background click ────────────────────────────────── */
  const handleCanvasMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== canvasRef.current) return
    if (activePalette) {
      const rect = canvasRef.current!.getBoundingClientRect()
      const xPct = ((e.clientX - rect.left) / rect.width)  * 100
      const yPct = ((e.clientY - rect.top)  / rect.height) * 100
      addElement(activePalette, xPct, yPct)
      setActivePalette(null)
    } else {
      selectElement(null)
    }
  }, [activePalette, addElement, canvasRef, selectElement])

  /* ── Palette entry lookup for canvas elements ───────────────── */
  const getPaletteEntry = (el: HardscapeElement): PaletteEntry =>
    PALETTE_ENTRIES.find(p => p.label === el.label)
    ?? PALETTE_ENTRIES.find(p => p.type === el.type)!

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className={styles.simulator}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.panelLabel}>Hardscape Simulator</span>
          <div className={styles.presetRow}>
            {(Object.entries(TANK_PRESETS) as [TankPreset, typeof TANK_PRESETS[TankPreset]][]).map(([key, cfg]) => (
              <button
                key={key}
                className={`${styles.presetBtn} ${tankPreset === key ? styles.presetBtnActive : ''}`}
                onClick={() => setTankPreset(key)}
              >
                {cfg.label}
                <span className={styles.presetDims}>{cfg.dims}</span>
              </button>
            ))}
          </div>
        </div>
        <button className={styles.clearBtn} onClick={clearAll}>Clear All</button>
      </div>

      {/* ── Work area: shelf + canvas ─────────────────────────── */}
      <div className={styles.workArea}>

        {/* Left palette shelf */}
        <div className={styles.shelf}>
          <span className={styles.shelfLabel}>Elements</span>
          {PALETTE_ENTRIES.map(entry => (
            <button
              key={entry.paletteId}
              className={`${styles.shelfItem} ${activePalette?.paletteId === entry.paletteId ? styles.shelfItemActive : ''}`}
              onClick={() => setActivePalette(p => p?.paletteId === entry.paletteId ? null : entry)}
              onDoubleClick={() => { addElement(entry); setActivePalette(null) }}
              title={`Click to place ${entry.label} · Double-click to stamp at centre`}
            >
              <div className={styles.shelfItemPreview}>
                <ElementShape
                  type={entry.type}
                  fillColor={entry.fillColor}
                  strokeColor={entry.strokeColor}
                />
              </div>
              <span className={styles.shelfItemLabel}>{entry.shortLabel}</span>
            </button>
          ))}
          {activePalette && (
            <button className={styles.cancelBtn} onClick={() => setActivePalette(null)}>
              ✕ Cancel
            </button>
          )}
        </div>

        {/* Canvas */}
        <div
          className={styles.canvasWrapper}
          style={{ paddingBottom: `${(1 / preset.aspectRatio) * 100}%` }}
        >
          <div
            ref={canvasRef}
            className={`${styles.canvas} ${activePalette ? styles.canvasPlacing : ''} ${isDragging ? styles.canvasDragging : ''}`}
            onMouseDown={handleCanvasMouseDown}
          >

            {/* Rotation HUD — rendered below elements (z-index: 3) */}
            {selectedEl && (
              <RotationHud
                el={selectedEl}
                onRingMouseDown={getRotateMouseDown(selectedEl.id)}
              />
            )}

            {/* Canvas elements */}
            {elements.map(el => {
              const dims   = ELEMENT_BASE_DIMS[el.type]
              const entry  = getPaletteEntry(el)
              const isSel  = el.id === selectedId
              const wPct   = dims.wPct * el.scaleFactor
              const hPct   = dims.hPct * el.scaleFactor
              return (
                <div
                  key={el.id}
                  className={`${styles.element} ${isSel ? styles.elementSelected : ''}`}
                  style={{
                    left:            `${el.xPercent - wPct / 2}%`,
                    top:             `${el.yPercent - hPct / 2}%`,
                    width:           `${wPct}%`,
                    height:          `${hPct}%`,
                    transform:       `rotate(${el.rotationAngle}deg)`,
                    transformOrigin: 'center center',
                    zIndex:          isSel ? 4 : 2,
                    willChange:      'transform',
                  } as CSSProperties}
                  onMouseDown={getElementMouseDown(el.id)}
                >
                  <ElementShape
                    type={el.type}
                    fillColor={entry.fillColor}
                    strokeColor={entry.strokeColor}
                  />
                </div>
              )
            })}

            {/* Placing mode overlay */}
            {activePalette && (
              <div className={styles.placingOverlay}>
                <span>Click to place <strong>{activePalette.label}</strong></span>
              </div>
            )}

            {/* Empty state */}
            {elements.length === 0 && !activePalette && (
              <div className={styles.emptyState}>
                <p>Select an element from the shelf to begin laying out your hardscape.</p>
                <p className={styles.emptyHint}>Double-click any shelf item to stamp it at centre.</p>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Controls bar ──────────────────────────────────────── */}
      {selectedEl ? (
        <div className={styles.controlsBar}>
          <div className={styles.selectedInfo}>
            <span className={styles.selectedLabel}>{selectedEl.label}</span>
            <span className={styles.rotBadge}>{Math.round(selectedEl.rotationAngle)}°</span>
          </div>

          <label className={styles.scaleGroup}>
            <span className={styles.scaleLabel}>Scale</span>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.05}
              value={selectedEl.scaleFactor}
              onChange={e => updateScale(selectedEl.id, parseFloat(e.target.value))}
              className={styles.scaleRange}
              style={{
                '--fill-pct': `${((selectedEl.scaleFactor - 0.5) / 1.5) * 100}%`,
              } as CSSProperties}
            />
            <span className={styles.scaleValue}>{selectedEl.scaleFactor.toFixed(2)}×</span>
          </label>

          <button className={styles.deleteBtn} onClick={deleteSelected}>
            Remove
          </button>
        </div>
      ) : (
        <div className={styles.controlsHint}>
          <span>
            {activePalette
              ? `Click canvas to place ${activePalette.label} — or double-click shelf to stamp at centre.`
              : elements.length > 0
                ? 'Click an element to select — then drag to reposition, twist the ring to rotate, or adjust scale.'
                : 'Choose an element type from the shelf, then click the canvas to place it.'}
          </span>
        </div>
      )}

    </div>
  )
}
