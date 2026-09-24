'use client'

import { useEffect, useRef } from 'react'
import styles from './CosmosCanvas.module.css'

interface Star {
  x: number
  y: number
  r: number          // radius px
  opacity: number    // current opacity  (0.06 – 0.45)
  target: number     // opacity target for twinkle lerp
  speed: number      // lerp speed per frame (varies per star)
  vx: number         // drift velocity x  (≈ ±0.02 px/frame)
  vy: number         // drift velocity y  (≈ ±0.02 px/frame)
  warm: boolean      // slightly warmer tint vs cool blue-white
}

const STAR_COUNT = 115

function buildStars(w: number, h: number): Star[] {
  return Array.from({ length: STAR_COUNT }, () => {
    const base = Math.random() * 0.28 + 0.06          // 0.06 – 0.34
    return {
      x:       Math.random() * w,
      y:       Math.random() * h,
      r:       Math.random() * 0.72 + 0.18,            // 0.18 – 0.9 px
      opacity: base,
      target:  base,
      speed:   Math.random() * 0.011 + 0.006,          // 0.006 – 0.017 per frame
      vx:      (Math.random() - 0.5) * 0.022,
      vy:      (Math.random() - 0.5) * 0.022,
      warm:    Math.random() > 0.72,
    }
  })
}

/* Canvas takes literal colours, never CSS functions — see CLAUDE.md. */
const COOL = '#d4deff'
const WARM = '#fff6e4'

export default function CosmosCanvas() {
  const canvasRef  = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = window.innerWidth
    let H = window.innerHeight
    canvas.width  = W
    canvas.height = H

    let stars = buildStars(W, H)
    let raf = 0
    let resizeTimer: ReturnType<typeof setTimeout> | null = null

    /* One static frame for anyone who has asked the OS for less motion.
       A drifting, twinkling starfield behind every screen is exactly the
       kind of ambient animation that setting exists to turn off. */
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')

    const paint = () => {
      ctx.clearRect(0, 0, W, H)
      /*
       * Opacity rides on globalAlpha rather than being baked into a
       * per-star `rgba(...)` string. The old form built 115 numbers with
       * toFixed(3) and 115 template strings every frame — ~14,000 short-
       * lived strings a second for the browser to parse back into the
       * same two colours, all of it garbage by the next frame.
       */
      let currentFill = ''
      for (const s of stars) {
        const fill = s.warm ? WARM : COOL
        if (fill !== currentFill) { ctx.fillStyle = fill; currentFill = fill }
        ctx.globalAlpha = s.opacity
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const step = () => {
      for (const s of stars) {
        s.x = (s.x + s.vx + W) % W
        s.y = (s.y + s.vy + H) % H

        const d = s.target - s.opacity
        if (Math.abs(d) < 0.007) {
          s.target = Math.random() * 0.28 + 0.06
        } else {
          s.opacity += d * s.speed
        }
      }
    }

    const tick = () => {
      step()
      paint()
      raf = requestAnimationFrame(tick)
    }

    /* Sorting warm stars together lets the loop above set fillStyle twice
       per frame instead of once per star. */
    const restart = () => {
      if (raf) cancelAnimationFrame(raf)
      stars = buildStars(W, H).sort((a, b) => Number(a.warm) - Number(b.warm))
      if (reduced?.matches) { paint(); raf = 0 }
      else raf = requestAnimationFrame(tick)
    }

    /*
     * Resizing rebuilt the whole field on every resize event — dozens a
     * second while a window is dragged, each one re-randomising 115 stars
     * so the sky visibly churned. Settle first, then rebuild once.
     */
    const onResize = () => {
      if (resizeTimer != null) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        resizeTimer = null
        W = window.innerWidth
        H = window.innerHeight
        canvas.width  = W
        canvas.height = H
        restart()
      }, 150)
    }

    window.addEventListener('resize', onResize, { passive: true })
    reduced?.addEventListener?.('change', restart)
    restart()

    return () => {
      if (raf) cancelAnimationFrame(raf)
      if (resizeTimer != null) clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      reduced?.removeEventListener?.('change', restart)
    }
  }, [])

  return <canvas ref={canvasRef} className={`${styles.canvas} cosmosCanvas`} aria-hidden="true" />
}
