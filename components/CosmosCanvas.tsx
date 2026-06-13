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
    let raf: number

    const onResize = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width  = W
      canvas.height = H
      stars = buildStars(W, H)
    }

    const tick = () => {
      ctx.clearRect(0, 0, W, H)

      for (const s of stars) {
        s.x = (s.x + s.vx + W) % W
        s.y = (s.y + s.vy + H) % H

        const d = s.target - s.opacity
        if (Math.abs(d) < 0.007) {
          s.target = Math.random() * 0.28 + 0.06
        } else {
          s.opacity += d * s.speed
        }

        // Cool blue-white (majority) or barely-warm white (minority)
        const [r, g, b] = s.warm ? [255, 246, 228] : [212, 222, 255]
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${s.opacity.toFixed(3)})`
        ctx.fill()
      }

      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('resize', onResize, { passive: true })
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={canvasRef} className={`${styles.canvas} cosmosCanvas`} aria-hidden="true" />
}
