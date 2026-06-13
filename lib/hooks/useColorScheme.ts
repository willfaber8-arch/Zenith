'use client'
import { useState, useEffect, useCallback } from 'react'

export type ColorScheme = 'dark' | 'light'
const KEY = 'zenith_color_scheme_v1'

function applyScheme(s: ColorScheme) {
  if (s === 'light') {
    document.documentElement.setAttribute('data-color-scheme', 'light')
    document.documentElement.style.colorScheme = 'light'
  } else {
    document.documentElement.removeAttribute('data-color-scheme')
    document.documentElement.style.colorScheme = 'dark'
  }
}

export function useColorScheme() {
  const [scheme, setScheme] = useState<ColorScheme>('dark')

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY) as ColorScheme | null
      if (s === 'light') {
        applyScheme('light')
        setScheme('light')
      }
    } catch {}
  }, [])

  const toggle = useCallback(() => {
    setScheme(prev => {
      const next: ColorScheme = prev === 'dark' ? 'light' : 'dark'
      applyScheme(next)
      try { localStorage.setItem(KEY, next) } catch {}
      return next
    })
  }, [])

  return { scheme, toggle, isLight: scheme === 'light' }
}
