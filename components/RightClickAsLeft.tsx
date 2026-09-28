'use client'

/**
 * RightClickAsLeft — zero-render global helper.
 *
 * Makes a right-click act as a left-click everywhere a right-click would
 * otherwise only open the browser menu, while leaving it alone wherever
 * Zenith or the person actually wants it. All of the rules live in
 * lib/rightClickAsLeft.ts; this only installs them once for the app.
 * On/off in Settings → Mouse.
 */

import { useEffect } from 'react'
import { installRightClickAsLeft } from '@/lib/rightClickAsLeft'

export default function RightClickAsLeft() {
  useEffect(() => installRightClickAsLeft(window), [])
  return null
}
