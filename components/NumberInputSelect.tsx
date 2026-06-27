'use client'

/**
 * NumberInputSelect — zero-render global helper.
 *
 * Selects the entire value of any <input type="number"> the moment it receives
 * focus, so the user can immediately type a replacement value (e.g. type "11"
 * over an existing "5") without manually clearing it or nudging with arrow keys.
 *
 * Implemented as a single delegated `focusin` listener on the document so it
 * covers every number input in the app — current and future — with no per-input
 * wiring. The select() is deferred to the next animation frame because some
 * browsers place the caret (overriding an immediate select()) after the focus
 * event resolves.
 */

import { useEffect } from 'react'

export default function NumberInputSelect() {
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target
      if (t instanceof HTMLInputElement && t.type === 'number') {
        requestAnimationFrame(() => {
          // Guard: focus may have moved on by the time the frame runs.
          if (document.activeElement === t) {
            try { t.select() } catch { /* some inputs disallow select() */ }
          }
        })
      }
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [])

  return null
}
