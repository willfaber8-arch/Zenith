'use client'

/**
 * ContextMenuContext — Phase 14.2 · Custom Context Menus
 *
 * Global right-click interceptor that replaces the browser's native
 * context menu with a premium mineral-dark action menu.
 *
 * Target detection: walks composedPath() up the DOM looking for the
 * first element with a `data-ctx-type` attribute. Falls through to
 * 'GENERIC' if none is found.
 *
 * Text-editing exemption: INPUT / TEXTAREA / [contenteditable]
 * elements are NOT intercepted — browser copy/paste stays intact.
 *
 * Usage in any child component:
 *   Add HTML attributes to opt-in to richer menus:
 *   - data-ctx-type="TASK"     data-ctx-id="42"
 *   - data-ctx-type="CALENDAR" data-ctx-date="2026-06-11"
 *   - data-ctx-type="WALLPAPER"   (marks a canvas/background region)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CustomContextMenu } from '@/components/CustomContextMenu'

/* ── Public types ─────────────────────────────────────────────── */

export type TargetType = 'TASK' | 'CALENDAR' | 'WALLPAPER' | 'WIDGET' | 'GENERIC'

export interface CtxTargetData {
  id?:    string | number   /* numeric or string entity ID       */
  date?:  string            /* ISO date string for CALENDAR type */
  label?: string            /* human-readable label for display  */
}

/* ── Internal state ───────────────────────────────────────────── */

interface CtxMenuState {
  isVisible:  boolean
  position:   { x: number; y: number }
  targetType: TargetType
  targetData: CtxTargetData
  openId:     number        /* increments on each show → forces child remount */
}

/* ── Context value ────────────────────────────────────────────── */

interface CtxMenuCtxValue {
  state: CtxMenuState
  hide:  () => void
}

const INITIAL_STATE: CtxMenuState = {
  isVisible:  false,
  position:   { x: 0, y: 0 },
  targetType: 'GENERIC',
  targetData: {},
  openId:     0,
}

const CtxMenuCtx = createContext<CtxMenuCtxValue>({
  state: INITIAL_STATE,
  hide:  () => {},
})

export function useContextMenu(): CtxMenuCtxValue {
  return useContext(CtxMenuCtx)
}

/* ── Text-editing exemption test ──────────────────────────────── */

function isTextEditTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const el = target as Element
  /* Check closest so clicking inside a form field is handled */
  return !!(el.closest('input, textarea, [contenteditable="true"], [contenteditable=""]'))
}

/* ── Provider ─────────────────────────────────────────────────── */

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menuState, setMenuState] = useState<CtxMenuState>(INITIAL_STATE)
  const openIdRef = useRef(0)

  const hide = useCallback(() => {
    setMenuState(prev =>
      prev.isVisible ? { ...prev, isVisible: false } : prev
    )
  }, [])

  useEffect(() => {
    /* ── Right-click interceptor ────────────────────────────── */
    const onContextMenu = (e: MouseEvent) => {
      /* Pass through to browser on text-editing elements */
      if (isTextEditTarget(e.target)) return

      e.preventDefault()
      e.stopPropagation()

      /* Walk composedPath() to find nearest data-ctx-type */
      const path = (e.composedPath?.() ?? []) as EventTarget[]
      let type:  TargetType  = 'GENERIC'
      let data:  CtxTargetData = {}

      for (const node of path) {
        if (!(node instanceof HTMLElement)) continue
        const ctxType = node.dataset?.ctxType as TargetType | undefined
        if (!ctxType) continue

        type = ctxType
        const rawId = node.dataset.ctxId
        data = {
          id: rawId !== undefined
            ? isNaN(Number(rawId)) ? rawId : Number(rawId)
            : undefined,
          date:  node.dataset.ctxDate,
          label: node.dataset.ctxLabel,
        }
        break
      }

      openIdRef.current += 1
      setMenuState({
        isVisible:  true,
        position:   { x: e.clientX, y: e.clientY },
        targetType: type,
        targetData: data,
        openId:     openIdRef.current,
      })
    }

    /* ── Close on outside pointer-down ──────────────────────── */
    const onPointerDown = (e: PointerEvent) => {
      /* Don't close when clicking inside the menu itself */
      if ((e.target as Element)?.closest?.('[data-ctx-menu]')) return
      hide()
    }

    /* ── Close on Escape ─────────────────────────────────────── */
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide()
    }

    /* ── Close on scroll (feel natural — menu is anchored) ───── */
    const onScroll = () => hide()

    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown',     onKeyDown)
    document.addEventListener('scroll',      onScroll, { passive: true, capture: true })

    return () => {
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown',     onKeyDown)
      document.removeEventListener('scroll',      onScroll, { capture: true })
    }
  }, [hide])

  return (
    <CtxMenuCtx.Provider value={{ state: menuState, hide }}>
      {children}
      {/*
       * key={menuState.openId} forces remount on every show,
       * replaying the spring-pop entrance animation each time.
       */}
      {menuState.isVisible && (
        <CustomContextMenu
          key={menuState.openId}
          position={menuState.position}
          targetType={menuState.targetType}
          targetData={menuState.targetData}
          onClose={hide}
        />
      )}
    </CtxMenuCtx.Provider>
  )
}
