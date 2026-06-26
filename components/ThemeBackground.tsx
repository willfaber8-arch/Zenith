'use client'

import { useNav } from '@/lib/NavContext'
import styles from './ThemeBackground.module.css'

export default function ThemeBackground() {
  const { activeCategory } = useNav()
  const tintVar = activeCategory ? `var(--tint-${activeCategory})` : 'var(--tint-home)'
  return (
    <div
      className={styles.bg}
      style={{
        backgroundColor: tintVar,
        /* The ambient pattern (equipped shop background OR Theme Forge backdrop)
           is layered ON TOP of the tint colour here. ThemeApplicator sets the
           --body-bg-* vars on <html>; this fixed layer is the only element that
           paints them visibly — the <body>'s own background sits behind this div
           and is fully occluded by the opaque tint. */
        backgroundImage:  'var(--body-bg-image, radial-gradient(circle, rgba(150, 160, 190, 0.045) 1px, transparent 1px))',
        backgroundSize:   'var(--body-bg-size, 30px 30px)',
        backgroundRepeat: 'var(--body-bg-repeat, repeat)',
      }}
      aria-hidden="true"
    />
  )
}
