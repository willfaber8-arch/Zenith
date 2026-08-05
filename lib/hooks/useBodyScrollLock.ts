'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — useBodyScrollLock
 *
 * Reference-counted `document.body` scroll lock.
 *
 * Several overlays can want the body frozen at the same time (the
 * study cockpit and the mobile nav drawer are the two current
 * callers). If each one wrote `document.body.style.overflow` directly,
 * whichever unmounted first would release the lock for everybody.
 *
 * The module-level counter fixes that: `overflow: hidden` is applied
 * on the 0 → 1 transition and the original inline value is restored
 * only on the 1 → 0 transition.
 *
 * Usage:
 *   useBodyScrollLock(isOverlayOpen)
 * ════════════════════════════════════════════════════════════════
 */

import { useEffect } from 'react'

let lockCount = 0
let previousOverflow = ''

function acquire() {
  if (typeof document === 'undefined') return
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1
}

function release() {
  if (typeof document === 'undefined') return
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow
    previousOverflow = ''
  }
}

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    acquire()
    /* Cleanup runs on unmount too, so a component that disappears while
       still holding the lock cannot strand the body in `overflow:hidden`. */
    return release
  }, [active])
}
