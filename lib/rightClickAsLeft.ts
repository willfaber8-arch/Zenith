/**
 * lib/rightClickAsLeft.ts — a right-click that does what a left-click would.
 *
 * On a laptop trackpad a right-click is one stray finger away, and in Zenith
 * it almost always means nothing: the browser's own menu opens and the
 * button you meant to press does not. With this on (the default), a
 * right-click on anything clickable clicks it instead.
 *
 * It steps aside wherever a right-click is wanted:
 *
 *   · Something in Zenith already handles right-click. Minesweeper's flags
 *     and the hold-to-undo button both call `preventDefault()` in their
 *     `onContextMenu`, which they must to keep the browser menu away. The
 *     listener here runs on `window` in the bubble phase — after React's
 *     handlers at the root — so it sees `defaultPrevented` and leaves the
 *     event alone. A future right-click feature is covered the same way,
 *     with no list to keep up to date. (A handler that stops propagation
 *     never reaches this listener at all, which also leaves it alone.)
 *   · Text fields and editable notes keep the browser menu, for paste and
 *     spell-check.
 *   · Selected text keeps it, for copy.
 *   · Touch and pen: a long-press is deliberate, not a stray finger.
 *   · The keyboard's menu key (no pointer involved).
 *   · Shift + right-click, anywhere — the way back to the browser menu.
 *
 * The decision is `shouldActAsLeftClick`, pure and tested; the listener
 * only gathers the facts it needs and, when it says yes, cancels the menu
 * and dispatches a click on the same element at the same point.
 */

export const RIGHT_CLICK_KEY = 'zenith_right_click_v1'
export const RIGHT_CLICK_EVENT = 'zenith:right-click-mode'
export type RightClickMode = 'left' | 'native'

/** On unless the person switched it off. */
export function loadRightClickMode(): RightClickMode {
  try { return localStorage.getItem(RIGHT_CLICK_KEY) === 'native' ? 'native' : 'left' } catch { return 'left' }
}

export function saveRightClickMode(mode: RightClickMode): void {
  try { localStorage.setItem(RIGHT_CLICK_KEY, mode) } catch { /* private mode: this tab only */ }
  window.dispatchEvent(new CustomEvent(RIGHT_CLICK_EVENT, { detail: mode }))
}

/* ── the decision ─────────────────────────────────────────────────── */

export interface RightClickFacts {
  enabled:          boolean
  /** A component already handled this right-click. */
  defaultPrevented: boolean
  shiftKey:         boolean
  /** Pointer type of the press that opened the menu; null when none (keyboard). */
  pointerType:      string | null
  /** The target is a text field or editable content. */
  editable:         boolean
  /** The right-click landed on selected text. */
  onSelection:      boolean
}

export function shouldActAsLeftClick(f: RightClickFacts): boolean {
  return f.enabled
    && !f.defaultPrevented
    && !f.shiftKey
    && f.pointerType === 'mouse'
    && !f.editable
    && !f.onSelection
}

/* ── facts from the DOM ───────────────────────────────────────────── */

/** Input types that are buttons or pickers, not places to type. */
const NON_TEXT_INPUTS = new Set([
  'button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image',
])

export function isEditableTarget(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type)
  if (el instanceof HTMLElement && el.isContentEditable) return true
  return !!el.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]')
}

function onSelectedText(win: Window, target: Element): boolean {
  const sel = win.getSelection?.()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false
  try { return sel.getRangeAt(0).intersectsNode(target) } catch { return false }
}

/* ── the listener ─────────────────────────────────────────────────── */

/** A press older than this did not open this menu. */
const PRESS_WINDOW_MS = 1500

/**
 * Installs the behaviour on `win` and returns the uninstaller. Mounted once
 * for the whole app by `components/RightClickAsLeft.tsx`.
 */
export function installRightClickAsLeft(win: Window): () => void {
  let mode: RightClickMode = loadRightClickMode()
  let lastPress: { type: string; at: number } | null = null

  const onPointerDown = (e: Event) => {
    const type = (e as PointerEvent).pointerType
    lastPress = { type: typeof type === 'string' && type ? type : 'mouse', at: Date.now() }
  }

  const onContextMenu = (e: Event) => {
    const me = e as MouseEvent
    const target = me.target instanceof Element ? me.target : null
    if (!target) return
    const recent = lastPress && Date.now() - lastPress.at < PRESS_WINDOW_MS ? lastPress.type : null

    const act = shouldActAsLeftClick({
      enabled:          mode === 'left',
      defaultPrevented: me.defaultPrevented,
      shiftKey:         me.shiftKey,
      pointerType:      recent,
      editable:         isEditableTarget(target),
      onSelection:      onSelectedText(win, target),
    })
    if (!act) return

    me.preventDefault()
    target.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true, composed: true, view: win, detail: 1,
      button: 0, buttons: 0,
      clientX: me.clientX, clientY: me.clientY, screenX: me.screenX, screenY: me.screenY,
    }))
  }

  const onMode = () => { mode = loadRightClickMode() }

  win.addEventListener('pointerdown', onPointerDown, true)
  win.addEventListener('contextmenu', onContextMenu)            // bubble: after React's handlers
  win.addEventListener(RIGHT_CLICK_EVENT, onMode)
  win.addEventListener('storage', onMode)                      // another tab changed it
  return () => {
    win.removeEventListener('pointerdown', onPointerDown, true)
    win.removeEventListener('contextmenu', onContextMenu)
    win.removeEventListener(RIGHT_CLICK_EVENT, onMode)
    win.removeEventListener('storage', onMode)
  }
}
