'use client'

import { formatStopwatch } from './usePuzzleTimer'
import styles from './PuzzleStopwatch.module.css'

/** Compact monospace stopwatch chip used by every puzzle game. */
export default function PuzzleStopwatch({ ms, running }: { ms: number; running?: boolean }) {
  return (
    <span className={`${styles.watch} ${running ? styles.watchRunning : ''}`} aria-label="Stopwatch">
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.time}>{formatStopwatch(ms)}</span>
    </span>
  )
}
