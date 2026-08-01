'use client'

/**
 * MiniCrossword — a polished 5×5 NYT-Mini-style crossword.
 *
 * Puzzles are authored in ./data/miniCrosswords.ts as solution grids ('#' =
 * blocked cell). All clue numbering is DERIVED from the grid here by the
 * standard crossword rule, so the rendered numbers always match the data.
 *
 * Contract: default export MiniCrossword({ difficulty, onWin }).
 * onWin(finalElapsedMs) is called exactly once, only on a genuine correct fill.
 */

import { useState, useMemo, useRef, useCallback, useEffect, type CSSProperties } from 'react'
import type { PuzzleGameProps } from './types'
import { usePuzzleTimer } from './usePuzzleTimer'
import PuzzleStopwatch from './PuzzleStopwatch'
import { pickPuzzle, type MiniPuzzle } from './data/miniCrosswords'
import styles from './MiniCrossword.module.css'

const SIZE = 5
type Dir = 'across' | 'down'

interface Slot {
  num: number
  dir: Dir
  cells: number[]      // flat indices r*SIZE + c
  answer: string       // solution letters for this run
}

interface Derived {
  white: boolean[]                 // per flat index
  numbers: number[]                // per flat index (0 = none)
  solution: string[]               // per flat index ('' if blocked)
  across: Slot[]                   // sorted by num
  down: Slot[]                     // sorted by num
  slotAcrossAt: (number | null)[]  // flat index -> position in `across`
  slotDownAt: (number | null)[]
}

const key = (r: number, c: number) => r * SIZE + c

/** Standard crossword numbering + slot extraction, derived from the grid. */
function deriveNumbering(grid: string[]): Derived {
  const white: boolean[] = new Array(SIZE * SIZE).fill(false)
  const solution: string[] = new Array(SIZE * SIZE).fill('')
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const ch = grid[r][c]
      if (ch !== '#') {
        white[key(r, c)] = true
        solution[key(r, c)] = ch.toUpperCase()
      }
    }
  }
  const isWhite = (r: number, c: number) =>
    r >= 0 && r < SIZE && c >= 0 && c < SIZE && white[key(r, c)]

  const numbers: number[] = new Array(SIZE * SIZE).fill(0)
  const across: Slot[] = []
  const down: Slot[] = []
  let n = 0

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!isWhite(r, c)) continue
      const startA = (c === 0 || !isWhite(r, c - 1)) && isWhite(r, c + 1)
      const startD = (r === 0 || !isWhite(r - 1, c)) && isWhite(r + 1, c)
      if (startA || startD) numbers[key(r, c)] = ++n
      if (startA) {
        const cells: number[] = []
        let cc = c
        let ans = ''
        while (isWhite(r, cc)) { cells.push(key(r, cc)); ans += solution[key(r, cc)]; cc++ }
        across.push({ num: n, dir: 'across', cells, answer: ans })
      }
      if (startD) {
        const cells: number[] = []
        let rr = r
        let ans = ''
        while (isWhite(rr, c)) { cells.push(key(rr, c)); ans += solution[key(rr, c)]; rr++ }
        down.push({ num: n, dir: 'down', cells, answer: ans })
      }
    }
  }

  const slotAcrossAt: (number | null)[] = new Array(SIZE * SIZE).fill(null)
  const slotDownAt: (number | null)[] = new Array(SIZE * SIZE).fill(null)
  across.forEach((s, i) => s.cells.forEach(ci => { slotAcrossAt[ci] = i }))
  down.forEach((s, i) => s.cells.forEach(ci => { slotDownAt[ci] = i }))

  return { white, numbers, solution, across, down, slotAcrossAt, slotDownAt }
}

function isEditableTarget(): boolean {
  const el = typeof document !== 'undefined' ? document.activeElement : null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return (el as HTMLElement).isContentEditable === true
}

export default function MiniCrossword({ difficulty, onWin }: PuzzleGameProps) {
  // Pick an initial puzzle once per mount.
  const [{ puzzle, index }, setSelection] =
    useState<{ puzzle: MiniPuzzle; index: number }>(() => pickPuzzle(difficulty))

  const D = useMemo(() => deriveNumbering(puzzle.grid), [puzzle])

  // Merge derived numbering with authored clue text (keyed by number + dir).
  const clueText = useMemo(() => {
    const m = new Map<string, string>()
    puzzle.across.forEach(cl => m.set(`A${cl.num}`, cl.clue))
    puzzle.down.forEach(cl => m.set(`D${cl.num}`, cl.clue))
    return m
  }, [puzzle])

  const [fill, setFill] = useState<string[]>(() => new Array(SIZE * SIZE).fill(''))
  const [active, setActive] = useState<number>(() => D.across[0]?.cells[0] ?? firstWhite(D))
  const [dir, setDir] = useState<Dir>('across')
  const [solved, setSolved] = useState(false)
  const [badCells, setBadCells] = useState<Set<number>>(new Set())

  const boardRef = useRef<HTMLDivElement>(null)
  const timer = usePuzzleTimer()
  const startedRef = useRef(false)
  const wonRef = useRef(false)

  // ── Reset everything when the puzzle changes (Play again / difficulty) ──
  useEffect(() => {
    setFill(new Array(SIZE * SIZE).fill(''))
    setActive(D.across[0]?.cells[0] ?? firstWhite(D))
    setDir('across')
    setSolved(false)
    setBadCells(new Set())
    startedRef.current = false
    wonRef.current = false
    timer.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle])

  const slotAt = useCallback(
    (idx: number, d: Dir): Slot | null => {
      if (d === 'across') { const p = D.slotAcrossAt[idx]; return p == null ? null : D.across[p] }
      const p = D.slotDownAt[idx]; return p == null ? null : D.down[p]
    },
    [D],
  )

  // Direction that actually has a run through `idx`, preferring `want`.
  const resolveDir = useCallback(
    (idx: number, want: Dir): Dir => {
      if (slotAt(idx, want)) return want
      const other: Dir = want === 'across' ? 'down' : 'across'
      return slotAt(idx, other) ? other : want
    },
    [slotAt],
  )

  const currentSlot = useMemo(() => slotAt(active, dir) ?? slotAt(active, dir === 'across' ? 'down' : 'across'), [slotAt, active, dir])

  const focusBoard = () => boardRef.current?.focus()

  // ── Win detection ──
  const checkWin = useCallback(
    (grid: string[]) => {
      for (let i = 0; i < SIZE * SIZE; i++) {
        if (!D.white[i]) continue
        if (grid[i] !== D.solution[i]) return
      }
      if (wonRef.current) return
      wonRef.current = true
      const finalMs = timer.stop()
      setSolved(true)
      onWin(finalMs)
    },
    [D, timer, onWin],
  )

  const ensureStarted = useCallback(() => {
    if (!startedRef.current) { startedRef.current = true; timer.start() }
  }, [timer])

  // ── Cell / clue selection ──
  const selectCell = useCallback(
    (idx: number, toggleIfSame = true) => {
      if (!D.white[idx]) return
      setActive(prev => {
        if (prev === idx && toggleIfSame) {
          setDir(cur => {
            const other: Dir = cur === 'across' ? 'down' : 'across'
            return slotAt(idx, other) ? other : cur
          })
          return idx
        }
        setDir(cur => resolveDir(idx, cur))
        return idx
      })
    },
    [D.white, resolveDir, slotAt],
  )

  const selectClue = useCallback(
    (slot: Slot) => {
      setDir(slot.dir)
      const firstEmpty = slot.cells.find(ci => fill[ci] === '')
      setActive(firstEmpty ?? slot.cells[0])
      focusBoard()
    },
    [fill],
  )

  // ── Typing ──
  const typeLetter = useCallback(
    (ch: string) => {
      if (solved) return
      if (!D.white[active]) return
      ensureStarted()
      if (badCells.size) setBadCells(new Set())
      const next = fill.slice()
      next[active] = ch
      setFill(next)
      checkWin(next)
      // advance to next empty cell in the current word
      const slot = slotAt(active, dir) ?? slotAt(active, dir === 'across' ? 'down' : 'across')
      if (slot) {
        const i = slot.cells.indexOf(active)
        let j = i + 1
        while (j < slot.cells.length && next[slot.cells[j]] !== '') j++
        if (j < slot.cells.length) setActive(slot.cells[j])
        else if (i + 1 < slot.cells.length) setActive(slot.cells[i + 1])
      }
    },
    [solved, D.white, active, dir, fill, badCells, slotAt, ensureStarted, checkWin],
  )

  const backspace = useCallback(() => {
    if (solved) return
    const slot = currentSlot
    setFill(prev => {
      const next = prev.slice()
      if (next[active] !== '') {
        next[active] = ''
      } else if (slot) {
        const i = slot.cells.indexOf(active)
        if (i > 0) { const back = slot.cells[i - 1]; next[back] = ''; setActive(back) }
      }
      return next
    })
  }, [solved, active, currentSlot])

  // ── Arrow / tab navigation ──
  const moveArrow = useCallback(
    (dr: number, dc: number) => {
      const r0 = Math.floor(active / SIZE)
      const c0 = active % SIZE
      let r = r0 + dr
      let c = c0 + dc
      while (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
        if (D.white[key(r, c)]) {
          const idx = key(r, c)
          const want: Dir = dc !== 0 ? 'across' : 'down'
          setActive(idx)
          setDir(resolveDir(idx, want))
          return
        }
        r += dr; c += dc
      }
    },
    [active, D.white, resolveDir],
  )

  const jumpClue = useCallback(
    (delta: number) => {
      const order: Slot[] = [...D.across, ...D.down]
      if (!order.length) return
      const cur = currentSlot
      let idx = cur ? order.findIndex(s => s.dir === cur.dir && s.num === cur.num) : -1
      if (idx < 0) idx = 0
      const nextSlot = order[(idx + delta + order.length) % order.length]
      selectClue(nextSlot)
    },
    [D.across, D.down, currentSlot, selectClue],
  )

  // ── Global key handler (ignored when a real text field is focused elsewhere) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget() && document.activeElement !== boardRef.current) return
      const k = e.key
      if (k === 'Backspace') { e.preventDefault(); backspace(); return }
      if (k === 'Delete') { e.preventDefault(); if (!solved) setFill(prev => { const n = prev.slice(); n[active] = ''; return n }); return }
      if (k === 'ArrowLeft') { e.preventDefault(); moveArrow(0, -1); return }
      if (k === 'ArrowRight') { e.preventDefault(); moveArrow(0, 1); return }
      if (k === 'ArrowUp') { e.preventDefault(); moveArrow(-1, 0); return }
      if (k === 'ArrowDown') { e.preventDefault(); moveArrow(1, 0); return }
      if (k === 'Tab') { e.preventDefault(); jumpClue(e.shiftKey ? -1 : 1); return }
      if (k === 'Enter') { e.preventDefault(); jumpClue(1); return }
      if (k === ' ') { e.preventDefault(); setDir(cur => { const o: Dir = cur === 'across' ? 'down' : 'across'; return slotAt(active, o) ? o : cur }); return }
      if (/^[a-zA-Z]$/.test(k)) { e.preventDefault(); typeLetter(k.toUpperCase()) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, solved, backspace, moveArrow, jumpClue, typeLetter, slotAt])

  // ── Actions ──
  const playAgain = useCallback(() => {
    setSelection(pickPuzzle(difficulty, index))
  }, [difficulty, index])

  const clearBoard = useCallback(() => {
    if (solved) return
    setFill(new Array(SIZE * SIZE).fill(''))
    setBadCells(new Set())
    focusBoard()
  }, [solved])

  const checkGrid = useCallback(() => {
    if (solved) return
    const bad = new Set<number>()
    for (let i = 0; i < SIZE * SIZE; i++) {
      if (D.white[i] && fill[i] !== '' && fill[i] !== D.solution[i]) bad.add(i)
    }
    setBadCells(bad)
    if (bad.size) window.setTimeout(() => setBadCells(new Set()), 1400)
  }, [solved, D, fill])

  // ── Render helpers ──
  const activeSlotCells = useMemo(() => new Set(currentSlot?.cells ?? []), [currentSlot])
  const activeClueKey = currentSlot ? `${currentSlot.dir === 'across' ? 'A' : 'D'}${currentSlot.num}` : ''
  const activeClueLabel = currentSlot
    ? `${currentSlot.num}${currentSlot.dir === 'across' ? 'A' : 'D'} · ${clueText.get(activeClueKey) ?? ''}`
    : ''

  // white-cell running index for staggered win animation
  const whiteOrder = useMemo(() => {
    const map: number[] = new Array(SIZE * SIZE).fill(0)
    let w = 0
    for (let i = 0; i < SIZE * SIZE; i++) if (D.white[i]) map[i] = w++
    return map
  }, [D])

  return (
    <div className={styles.wrap}>
      {/* Header: stopwatch + active clue banner */}
      <div className={styles.topRow}>
        <PuzzleStopwatch ms={timer.elapsedMs} running={timer.running} />
        <div className={styles.clueBanner} aria-live="polite">
          {solved
            ? <span className={styles.solvedText}>Solved! Nicely done.</span>
            : <span className={styles.clueBannerText}>{activeClueLabel || 'Select a square to begin'}</span>}
        </div>
      </div>

      <div className={styles.playArea}>
        {/* Grid */}
        <div
          ref={boardRef}
          className={`${styles.board} ${solved ? styles.boardSolved : ''}`}
          tabIndex={0}
          role="grid"
          aria-label={`${difficulty} mini crossword`}
          onMouseDown={e => { e.preventDefault(); focusBoard() }}
        >
          {Array.from({ length: SIZE * SIZE }, (_, i) => {
            const r = Math.floor(i / SIZE)
            const c = i % SIZE
            if (!D.white[i]) return <div key={i} className={styles.block} aria-hidden="true" />
            const isActive = i === active
            const inWord = activeSlotCells.has(i)
            const num = D.numbers[i]
            const isBad = badCells.has(i)
            const cls = [
              styles.cell,
              inWord ? styles.cellInWord : '',
              isActive ? styles.cellActive : '',
              isBad ? styles.cellBad : '',
              solved ? styles.cellSolved : '',
            ].join(' ')
            return (
              <div
                key={i}
                className={cls}
                role="gridcell"
                aria-label={`Row ${r + 1}, column ${c + 1}${num ? `, ${num}` : ''}`}
                onClick={() => { selectCell(i); focusBoard() }}
                style={{ '--wi': whiteOrder[i] } as CSSProperties}
              >
                {num > 0 && <span className={styles.num}>{num}</span>}
                <span className={styles.letter}>{fill[i]}</span>
              </div>
            )
          })}
        </div>

        {/* Clue lists */}
        <div className={styles.clues}>
          <ClueColumn
            title="Across"
            slots={D.across}
            clueText={clueText}
            activeKey={activeClueKey}
            onPick={selectClue}
          />
          <ClueColumn
            title="Down"
            slots={D.down}
            clueText={clueText}
            activeKey={activeClueKey}
            onPick={selectClue}
          />
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {solved ? (
          <button type="button" className={styles.primaryBtn} onClick={playAgain}>
            ↻ Play again
          </button>
        ) : (
          <>
            <button type="button" className={styles.ghostBtn} onClick={checkGrid}>Check</button>
            <button type="button" className={styles.ghostBtn} onClick={clearBoard}>Clear</button>
            <button type="button" className={styles.ghostBtn} onClick={playAgain}>New puzzle</button>
          </>
        )}
      </div>
    </div>
  )
}

function ClueColumn({
  title, slots, clueText, activeKey, onPick,
}: {
  title: string
  slots: Slot[]
  clueText: Map<string, string>
  activeKey: string
  onPick: (s: Slot) => void
}) {
  const prefix = title === 'Across' ? 'A' : 'D'
  return (
    <div className={styles.clueCol}>
      <div className={styles.clueTitle}>{title}</div>
      <ul className={styles.clueList}>
        {slots.map(s => {
          const k = `${prefix}${s.num}`
          const isActive = k === activeKey
          return (
            <li key={k}>
              <button
                type="button"
                className={`${styles.clueItem} ${isActive ? styles.clueItemActive : ''}`}
                onClick={() => onPick(s)}
              >
                <span className={styles.clueNum}>{s.num}</span>
                <span className={styles.clueTextSpan}>{clueText.get(k) ?? ''}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function firstWhite(D: Derived): number {
  for (let i = 0; i < SIZE * SIZE; i++) if (D.white[i]) return i
  return 0
}
