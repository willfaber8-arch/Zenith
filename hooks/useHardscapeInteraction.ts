'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { HardscapeElement, AquascapeLayout, PaletteEntry } from '@/types/hardscape'
import { ELEMENT_BASE_DIMS } from '@/types/hardscape'

interface DragRef {
  elementId: string
  offsetXPct: number
  offsetYPct: number
}

interface RotateRef {
  elementId: string
  centerXPx: number
  centerYPx: number
  startMouseAngleDeg: number
  startRotationDeg: number
}

export interface UseHardscapeReturn {
  elements: HardscapeElement[]
  selectedId: string | null
  isDragging: boolean
  canvasRef: React.RefObject<HTMLDivElement | null>
  addElement: (entry: PaletteEntry, xPct?: number, yPct?: number) => void
  selectElement: (id: string | null) => void
  deleteSelected: () => void
  updateScale: (id: string, scale: number) => void
  clearAll: () => void
  loadLayout: (layout: AquascapeLayout) => void
  getElementMouseDown: (id: string) => (e: React.MouseEvent) => void
  getRotateMouseDown: (id: string) => (e: React.MouseEvent) => void
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export function useHardscapeInteraction(): UseHardscapeReturn {
  const [elements,   setElements]   = useState<HardscapeElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const canvasRef   = useRef<HTMLDivElement>(null)
  const dragRef     = useRef<DragRef | null>(null)
  const rotateRef   = useRef<RotateRef | null>(null)
  // Live ref so document handlers see current elements without stale closures
  const elementsRef = useRef<HardscapeElement[]>([])
  useEffect(() => { elementsRef.current = elements }, [elements])

  const getRect = useCallback(() => canvasRef.current?.getBoundingClientRect() ?? null, [])

  /* ── Document-level pointer handlers ───────────────────────────── */

  const handleDocMouseMove = useCallback((e: MouseEvent) => {
    if (dragRef.current) {
      const rect = getRect()
      if (!rect) return
      const { elementId, offsetXPct, offsetYPct } = dragRef.current
      const rawX = ((e.clientX - rect.left) / rect.width)  * 100 - offsetXPct
      const rawY = ((e.clientY - rect.top)  / rect.height) * 100 - offsetYPct
      setElements(prev => prev.map(el => {
        if (el.id !== elementId) return el
        const d  = ELEMENT_BASE_DIMS[el.type]
        const hw = (d.wPct * el.scaleFactor) / 2
        const hh = (d.hPct * el.scaleFactor) / 2
        return { ...el, xPercent: clamp(rawX, hw, 100 - hw), yPercent: clamp(rawY, hh, 100 - hh) }
      }))
    }

    if (rotateRef.current) {
      const { elementId, centerXPx, centerYPx, startMouseAngleDeg, startRotationDeg } = rotateRef.current
      const angle = Math.atan2(e.clientY - centerYPx, e.clientX - centerXPx) * (180 / Math.PI)
      const delta = angle - startMouseAngleDeg
      const next  = ((startRotationDeg + delta) % 360 + 360) % 360
      setElements(prev => prev.map(el => el.id === elementId ? { ...el, rotationAngle: next } : el))
    }
  }, [getRect])

  const handleDocMouseUp = useCallback(() => {
    dragRef.current   = null
    rotateRef.current = null
    setIsDragging(false)
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleDocMouseMove)
    document.addEventListener('mouseup',   handleDocMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleDocMouseMove)
      document.removeEventListener('mouseup',   handleDocMouseUp)
    }
  }, [handleDocMouseMove, handleDocMouseUp])

  /* ── State mutations ───────────────────────────────────────────── */

  const addElement = useCallback((entry: PaletteEntry, xPct = 50, yPct = 50) => {
    const newEl: HardscapeElement = {
      id: crypto.randomUUID(),
      type: entry.type,
      label: entry.label,
      xPercent: xPct,
      yPercent: yPct,
      rotationAngle: 0,
      scaleFactor: 1.0,
    }
    setElements(prev => [...prev, newEl])
    setSelectedId(newEl.id)
  }, [])

  const selectElement = useCallback((id: string | null) => setSelectedId(id), [])

  const deleteSelected = useCallback(() => {
    setSelectedId(prev => {
      if (prev) setElements(els => els.filter(el => el.id !== prev))
      return null
    })
  }, [])

  const updateScale = useCallback((id: string, scale: number) => {
    setElements(prev => prev.map(el =>
      el.id === id ? { ...el, scaleFactor: clamp(scale, 0.5, 2.0) } : el,
    ))
  }, [])

  const clearAll = useCallback(() => { setElements([]); setSelectedId(null) }, [])

  const loadLayout = useCallback((layout: AquascapeLayout) => {
    setElements(layout.elements)
    setSelectedId(null)
  }, [])

  /* ── Interaction handler factories ────────────────────────────── */

  const getElementMouseDown = useCallback((id: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const rect = getRect()
    const el   = elementsRef.current.find(el => el.id === id)
    if (!rect || !el) return
    const mxPct = ((e.clientX - rect.left) / rect.width)  * 100
    const myPct = ((e.clientY - rect.top)  / rect.height) * 100
    dragRef.current = { elementId: id, offsetXPct: mxPct - el.xPercent, offsetYPct: myPct - el.yPercent }
    setSelectedId(id)
    setIsDragging(true)
  }, [getRect])

  const getRotateMouseDown = useCallback((id: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const rect = getRect()
    const el   = elementsRef.current.find(el => el.id === id)
    if (!rect || !el) return
    const cxPx = rect.left + (el.xPercent / 100) * rect.width
    const cyPx = rect.top  + (el.yPercent / 100) * rect.height
    rotateRef.current = {
      elementId: id,
      centerXPx: cxPx,
      centerYPx: cyPx,
      startMouseAngleDeg: Math.atan2(e.clientY - cyPx, e.clientX - cxPx) * (180 / Math.PI),
      startRotationDeg: el.rotationAngle,
    }
  }, [getRect])

  return {
    elements, selectedId, isDragging, canvasRef,
    addElement, selectElement, deleteSelected, updateScale, clearAll, loadLayout,
    getElementMouseDown, getRotateMouseDown,
  }
}
