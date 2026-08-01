'use client'

/**
 * Solitaire — a polished Klondike implementation for the Arcade Puzzles lounge.
 *
 * Pure game state lives in React state; every mutation clones state (immutable
 * snapshots power the undo stack). Interaction is click-to-select-then-place
 * (the most robust model) plus double-click to auto-send a card to a foundation.
 *
 * Difficulty maps to draw count + redeal allowance:
 *   easy   → draw 1, unlimited redeals
 *   medium → draw 3, unlimited redeals
 *   hard   → draw 3, 2 redeals
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PuzzleGameProps, Difficulty } from './types'
import { usePuzzleTimer } from './usePuzzleTimer'
import PuzzleStopwatch from './PuzzleStopwatch'
import styles from './Solitaire.module.css'

/* ─── Cards ────────────────────────────────────────────────────────── */

type Suit = 'S' | 'H' | 'D' | 'C'
type CardColor = 'red' | 'black'

interface Card {
  id:     string   // stable identity, e.g. "S-1"
  suit:   Suit
  rank:   number   // 1 (Ace) … 13 (King)
  faceUp: boolean
}

const SUITS: Suit[] = ['S', 'H', 'D', 'C']
const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
const SUIT_COLOR:  Record<Suit, CardColor> = { S: 'black', H: 'red', D: 'red', C: 'black' }
const RANK_LABEL: string[] = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

const suitIndex = (s: Suit) => SUITS.indexOf(s)

/* Fanning geometry (fractions of card height).
   Face-up cards fan wide enough that every buried card's top-left index
   (rank + suit) stays legible; face-down cards stay tightly stacked. */
const EXPOSE_UP   = 0.38
const EXPOSE_DOWN = 0.15

/* Pointer must travel this many px before a press becomes a drag (so a
   plain click/tap still registers as click-to-move). */
const DRAG_THRESHOLD = 6

/* ─── Locations ────────────────────────────────────────────────────── */

type Location =
  | { type: 'waste' }
  | { type: 'tableau';    col: number }
  | { type: 'foundation'; idx: number }

interface Selection { loc: Location; index: number }

/** Encode a drop-target pile as a `data-drop` attribute string. */
function dropAttr(loc: Location): string {
  if (loc.type === 'waste')      return 'waste'
  if (loc.type === 'tableau')    return `tableau:${loc.col}`
  return `foundation:${loc.idx}`
}

/** Parse a `data-drop` attribute string back into a Location. */
function parseDrop(s: string): Location | null {
  if (s === 'waste') return { type: 'waste' }
  const [kind, n] = s.split(':')
  const idx = Number(n)
  if (kind === 'tableau'    && Number.isFinite(idx)) return { type: 'tableau', col: idx }
  if (kind === 'foundation' && Number.isFinite(idx)) return { type: 'foundation', idx }
  return null
}

/* Transient state for the floating drag layer. */
interface DragState {
  from:      Location
  fromIndex: number
  cards:     Card[]
  cardW:     number   // px
  cardH:     number   // px
  offsetX:   number   // pointer→card-top-left offset at pickup
  offsetY:   number
  x:         number   // pointer position when the drag began (initial render)
  y:         number
}

/* ─── Game state ───────────────────────────────────────────────────── */

interface GameState {
  stock:       Card[]
  waste:       Card[]
  foundations: Card[][]   // 4 piles, fixed by SUITS order
  tableau:     Card[][]   // 7 columns
  redealsUsed: number
}

interface DiffConfig { draw: number; redeals: number | null; label: string }

const CONFIG: Record<Difficulty, DiffConfig> = {
  easy:   { draw: 1, redeals: null, label: 'Draw 1 · Unlimited redeals' },
  medium: { draw: 3, redeals: null, label: 'Draw 3 · Unlimited redeals' },
  hard:   { draw: 3, redeals: 2,    label: 'Draw 3 · 2 redeals' },
}

/* ─── Pure helpers ─────────────────────────────────────────────────── */

function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}-${rank}`, suit, rank, faceUp: false })
    }
  }
  return deck
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function deal(): GameState {
  const deck = shuffle(buildDeck())
  const tableau: Card[][] = [[], [], [], [], [], [], []]
  let d = 0
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck[d++]
      tableau[col].push({ ...card, faceUp: row === col })
    }
  }
  const stock = deck.slice(d).map(c => ({ ...c, faceUp: false }))
  return { stock, waste: [], foundations: [[], [], [], []], tableau, redealsUsed: 0 }
}

function cloneState(s: GameState): GameState {
  return {
    stock:       s.stock.map(c => ({ ...c })),
    waste:       s.waste.map(c => ({ ...c })),
    foundations: s.foundations.map(f => f.map(c => ({ ...c }))),
    tableau:     s.tableau.map(col => col.map(c => ({ ...c }))),
    redealsUsed: s.redealsUsed,
  }
}

function pileOf(s: GameState, loc: Location): Card[] {
  if (loc.type === 'waste')      return s.waste
  if (loc.type === 'tableau')    return s.tableau[loc.col]
  return s.foundations[loc.idx]
}

function isRun(cards: Card[]): boolean {
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].faceUp) return false
    if (i > 0) {
      const prev = cards[i - 1], cur = cards[i]
      if (prev.rank !== cur.rank + 1) return false
      if (SUIT_COLOR[prev.suit] === SUIT_COLOR[cur.suit]) return false
    }
  }
  return true
}

function canFoundation(s: GameState, card: Card): boolean {
  const f = s.foundations[suitIndex(card.suit)]
  return f.length === 0 ? card.rank === 1 : f[f.length - 1].rank === card.rank - 1
}

function foundationCount(s: GameState): number {
  return s.foundations.reduce((n, f) => n + f.length, 0)
}

/** Attempt a move; returns the resulting (new) state or null if illegal. */
function performMove(s: GameState, from: Location, fromIndex: number, to: Location): GameState | null {
  if (from.type === to.type &&
      (from.type === 'waste' ||
       (from.type === 'tableau'    && 'col' in to && from.col === to.col) ||
       (from.type === 'foundation' && 'idx' in to && from.idx === to.idx))) {
    return null
  }
  const src = pileOf(s, from)
  const moving = src.slice(fromIndex)
  if (moving.length === 0) return null
  const head = moving[0]
  if (!head.faceUp) return null

  const ns = cloneState(s)

  if (to.type === 'foundation') {
    if (moving.length !== 1) return null
    if (to.idx !== suitIndex(head.suit)) return null
    if (!canFoundation(ns, head)) return null
    ns.foundations[to.idx].push({ ...head })
  } else if (to.type === 'tableau') {
    if (!isRun(moving)) return null
    const dest = ns.tableau[to.col]
    const ok = dest.length === 0
      ? head.rank === 13
      : (dest[dest.length - 1].faceUp &&
         SUIT_COLOR[dest[dest.length - 1].suit] !== SUIT_COLOR[head.suit] &&
         dest[dest.length - 1].rank === head.rank + 1)
    if (!ok) return null
    dest.push(...moving.map(c => ({ ...c })))
  } else {
    return null
  }

  // Remove the moving cards from the source, flipping any newly-exposed card.
  if (from.type === 'foundation') {
    ns.foundations[from.idx] = pileOf(ns, from).slice(0, fromIndex)
  } else if (from.type === 'waste') {
    ns.waste = ns.waste.slice(0, fromIndex)
  } else {
    const kept = ns.tableau[from.col].slice(0, fromIndex)
    if (kept.length && !kept[kept.length - 1].faceUp) {
      kept[kept.length - 1] = { ...kept[kept.length - 1], faceUp: true }
    }
    ns.tableau[from.col] = kept
  }
  return ns
}

function drawCards(s: GameState, n: number): GameState {
  const stock = [...s.stock], waste = [...s.waste]
  const k = Math.min(n, stock.length)
  for (let i = 0; i < k; i++) {
    const c = stock.pop()!
    waste.push({ ...c, faceUp: true })
  }
  return { ...s, stock, waste }
}

function recycle(s: GameState): GameState {
  const stock = [...s.waste].reverse().map(c => ({ ...c, faceUp: false }))
  return { ...s, stock, waste: [], redealsUsed: s.redealsUsed + 1 }
}

/* ─── Card view ────────────────────────────────────────────────────── */

function CardView({ card }: { card: Card }) {
  if (!card.faceUp) {
    return (
      <div className={`${styles.card} ${styles.cardDown}`} aria-hidden="true">
        <div className={styles.backPattern} />
      </div>
    )
  }
  const label = RANK_LABEL[card.rank]
  const sym = SUIT_SYMBOL[card.suit]
  return (
    <div
      className={`${styles.card} ${styles.cardUp} ${styles[SUIT_COLOR[card.suit]]}`}
      aria-label={`${label} of ${card.suit}`}
    >
      <span className={`${styles.corner} ${styles.cornerTL}`}>
        <span className={styles.cornerRank}>{label}</span>
        <span className={styles.cornerSuit}>{sym}</span>
      </span>
      <span className={styles.centerPip}>{sym}</span>
      <span className={`${styles.corner} ${styles.cornerBR}`}>
        <span className={styles.cornerRank}>{label}</span>
        <span className={styles.cornerSuit}>{sym}</span>
      </span>
    </div>
  )
}

/* ─── Component ────────────────────────────────────────────────────── */

export default function Solitaire({ difficulty, onWin }: PuzzleGameProps) {
  const cfg = CONFIG[difficulty]
  const timer = usePuzzleTimer()

  const [game, setGame]           = useState<GameState | null>(null)
  const [undoStack, setUndoStack] = useState<GameState[]>([])
  const [sel, setSel]             = useState<Selection | null>(null)
  const [moves, setMoves]         = useState(0)
  const [autoRunning, setAuto]    = useState(false)
  const [showWin, setShowWin]     = useState(false)

  const [drag, setDrag] = useState<DragState | null>(null)

  const wonRef        = useRef(false)
  const startedRef    = useRef(false)
  const autoGuard     = useRef(0)
  const gameRef       = useRef<GameState | null>(game)
  const dragLayerRef  = useRef<HTMLDivElement | null>(null)

  // Keep a live ref so window pointer handlers read the latest board.
  useEffect(() => { gameRef.current = game }, [game])

  // Deal on mount (client only → no SSR / hydration mismatch from Math.random).
  useEffect(() => { setGame(deal()) }, [])

  const ensureStarted = useCallback(() => {
    if (!startedRef.current) { startedRef.current = true; timer.start() }
  }, [timer])

  const commit = useCallback((next: GameState, opts?: { auto?: boolean }) => {
    if (!opts?.auto && game) {
      const prev = game
      setUndoStack(u => [...u.slice(-249), prev])
      setMoves(m => m + 1)
    }
    setGame(next)
    setSel(null)
    if (foundationCount(next) === 52 && !wonRef.current) {
      wonRef.current = true
      const final = timer.stop()
      setShowWin(true)
      setAuto(false)
      onWin(final)
    }
  }, [game, timer, onWin])

  /* Selectability of a card at a location. */
  const isSelectable = useCallback((g: GameState, loc: Location, index: number): boolean => {
    const pile = pileOf(g, loc)
    const card = pile[index]
    if (!card || !card.faceUp) return false
    if (loc.type === 'waste')      return index === pile.length - 1
    if (loc.type === 'foundation') return index === pile.length - 1
    return isRun(pile.slice(index))          // tableau run from here down
  }, [])

  const locToDest = (loc: Location): Location | null =>
    loc.type === 'waste' ? null : loc

  const tryMove = useCallback((g: GameState, from: Location, fromIndex: number, to: Location): boolean => {
    const ns = performMove(g, from, fromIndex, to)
    if (!ns) return false
    ensureStarted()
    commit(ns)
    return true
  }, [commit, ensureStarted])

  /* Click a card: select, place, or reselect. */
  const onCardClick = useCallback((loc: Location, index: number) => {
    if (!game || autoRunning || showWin) return
    if (sel) {
      if (sel.loc.type === loc.type &&
          JSON.stringify(sel.loc) === JSON.stringify(loc) && sel.index === index) {
        setSel(null); return
      }
      const to = locToDest(loc)
      if (to && tryMove(game, sel.loc, sel.index, to)) return
      // move failed → reselect the clicked card if it can be picked up
      if (isSelectable(game, loc, index)) setSel({ loc, index })
      else setSel(null)
      return
    }
    if (isSelectable(game, loc, index)) setSel({ loc, index })
  }, [game, autoRunning, showWin, sel, tryMove, isSelectable])

  /* Click empty pile area (empty column / empty foundation) as a drop target. */
  const onPileClick = useCallback((loc: Location) => {
    if (!game || autoRunning || showWin || !sel) return
    const to = locToDest(loc)
    if (!to || !tryMove(game, sel.loc, sel.index, to)) setSel(null)
  }, [game, autoRunning, showWin, sel, tryMove])

  /* Pointer drag: pick up a movable card (and the valid run beneath it),
     float it under the cursor, then drop-test on release. Click-to-move still
     works because a press that never crosses DRAG_THRESHOLD stays a click. */
  const handleCardPointerDown = useCallback(
    (loc: Location, index: number, e: ReactPointerEvent<HTMLDivElement>) => {
      if (!game || autoRunning || showWin) return
      if (e.button !== 0) return                       // primary button / touch only
      if (!isSelectable(game, loc, index)) return      // only movable origins drag

      const pile = pileOf(game, loc)
      const cards = pile.slice(index).map(c => ({ ...c }))
      const rect = e.currentTarget.getBoundingClientRect()
      const startX = e.clientX
      const startY = e.clientY
      const offsetX = startX - rect.left
      const offsetY = startY - rect.top
      let started = false

      const applyTransform = (px: number, py: number, lift: boolean) => {
        const layer = dragLayerRef.current
        if (!layer) return
        layer.style.transform =
          `translate(${px - offsetX}px, ${py - offsetY}px)` +
          (lift ? ' rotate(3deg) scale(1.045)' : ' rotate(0deg) scale(1)')
      }

      const move = (ev: PointerEvent) => {
        if (!started) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return
          started = true
          setSel(null)
          setDrag({
            from: loc, fromIndex: index, cards,
            cardW: rect.width, cardH: rect.height,
            offsetX, offsetY, x: ev.clientX, y: ev.clientY,
          })
        }
        applyTransform(ev.clientX, ev.clientY, true)
      }

      const finishSnap = () => setDrag(null)

      const cleanup = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
      }

      const up = (ev: PointerEvent) => {
        cleanup()
        if (!started) return   // pure click → leave it to the onClick handler

        // Swallow the click this drag would otherwise synthesise, so the drop
        // doesn't also fire click-to-move on whatever is under the pointer.
        const swallow = (ce: Event) => {
          ce.stopImmediatePropagation()
          ce.preventDefault()
          window.removeEventListener('click', swallow, true)
        }
        window.addEventListener('click', swallow, true)
        window.setTimeout(() => window.removeEventListener('click', swallow, true), 0)

        // Hit-test the pile under the pointer (drag layer is pointer-events:none).
        const under = document.elementFromPoint(ev.clientX, ev.clientY)
        const dropEl = under ? (under.closest('[data-drop]') as HTMLElement | null) : null
        const to = dropEl?.dataset.drop ? parseDrop(dropEl.dataset.drop) : null

        const g = gameRef.current
        if (to && g) {
          const ns = performMove(g, loc, index, to)
          if (ns) { ensureStarted(); commit(ns); setDrag(null); return }
        }

        // Invalid / dropped on nothing → animate a smooth snap back to origin.
        const layer = dragLayerRef.current
        if (!layer) { setDrag(null); return }
        layer.style.transition = 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)'
        applyTransform(rect.left + offsetX, rect.top + offsetY, false)
        layer.addEventListener('transitionend', finishSnap, { once: true })
        window.setTimeout(finishSnap, 320)
      }

      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    },
    [game, autoRunning, showWin, isSelectable, ensureStarted, commit],
  )

  /* Double-click a top card → send straight to its foundation. */
  const onCardAuto = useCallback((loc: Location, index: number) => {
    if (!game || autoRunning || showWin) return
    const pile = pileOf(game, loc)
    if (index !== pile.length - 1) return
    const card = pile[index]
    if (!card || !card.faceUp) return
    tryMove(game, loc, index, { type: 'foundation', idx: suitIndex(card.suit) })
  }, [game, autoRunning, showWin, tryMove])

  /* Stock click: draw or recycle. */
  const onStockClick = useCallback(() => {
    if (!game || autoRunning || showWin) return
    if (game.stock.length > 0) {
      ensureStarted()
      commit(drawCards(game, cfg.draw))
    } else if (game.waste.length > 0) {
      if (cfg.redeals != null && game.redealsUsed >= cfg.redeals) return
      ensureStarted()
      commit(recycle(game))
    }
  }, [game, autoRunning, showWin, cfg, ensureStarted, commit])

  const undo = useCallback(() => {
    if (autoRunning || wonRef.current || !undoStack.length) return
    setGame(undoStack[undoStack.length - 1])
    setUndoStack(u => u.slice(0, -1))
    setSel(null)
    setMoves(m => Math.max(0, m - 1))
  }, [autoRunning, undoStack])

  const newGame = useCallback(() => {
    wonRef.current = false
    startedRef.current = false
    autoGuard.current = 0
    timer.reset()
    setGame(deal())
    setUndoStack([])
    setSel(null)
    setMoves(0)
    setAuto(false)
    setShowWin(false)
  }, [timer])

  /* One step of the auto-finish sweep. */
  const computeAutoStep = useCallback((s: GameState): GameState | null => {
    for (let c = 0; c < 7; c++) {
      const col = s.tableau[c]
      if (!col.length) continue
      const top = col[col.length - 1]
      if (top.faceUp && canFoundation(s, top)) {
        const ns = performMove(s, { type: 'tableau', col: c }, col.length - 1,
          { type: 'foundation', idx: suitIndex(top.suit) })
        if (ns) { autoGuard.current = 0; return ns }
      }
    }
    if (s.waste.length) {
      const top = s.waste[s.waste.length - 1]
      if (canFoundation(s, top)) {
        const ns = performMove(s, { type: 'waste' }, s.waste.length - 1,
          { type: 'foundation', idx: suitIndex(top.suit) })
        if (ns) { autoGuard.current = 0; return ns }
      }
    }
    if (autoGuard.current > 64) return null      // safety against a stuck loop
    if (s.stock.length > 0) { autoGuard.current++; return drawCards(s, cfg.draw) }
    if (s.waste.length > 0) { autoGuard.current++; return recycle(s) }
    return null
  }, [cfg])

  useEffect(() => {
    if (!autoRunning || !game) return
    if (foundationCount(game) >= 52) { setAuto(false); return }
    const id = window.setTimeout(() => {
      const next = computeAutoStep(game)
      if (!next) { setAuto(false); return }
      commit(next, { auto: true })
    }, 120)
    return () => window.clearTimeout(id)
  }, [autoRunning, game, computeAutoStep, commit])

  const startAuto = useCallback(() => {
    ensureStarted()
    autoGuard.current = 0
    setSel(null)
    setAuto(true)
  }, [ensureStarted])

  /* Auto-finish becomes available once no face-down cards block the tableau. */
  const autoAvailable = useMemo(() => {
    if (!game || autoRunning || wonRef.current) return false
    if (foundationCount(game) >= 52) return false
    return game.tableau.every(col => col.every(c => c.faceUp))
  }, [game, autoRunning])

  const confetti = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({
      left: (i * 4.5 + (i % 3) * 6) % 100,
      delay: (i % 7) * 0.14,
      dur: 2.4 + (i % 5) * 0.35,
      hue: ['#52cca3', '#7c95ff', '#e8eaf6', '#38bdf8'][i % 4],
      rot: (i * 47) % 360,
    })),
    [],
  )

  if (!game) {
    return <div className={styles.loading}>Shuffling the deck…</div>
  }

  const redealsLeft = cfg.redeals == null ? Infinity : cfg.redeals - game.redealsUsed
  const stockCanAct = game.stock.length > 0 ||
    (game.waste.length > 0 && (cfg.redeals == null || game.redealsUsed < cfg.redeals))

  const selEq = (loc: Location, index: number) =>
    !!sel && sel.index === index && JSON.stringify(sel.loc) === JSON.stringify(loc)

  const isInSelectedRun = (loc: Location, index: number) =>
    !!sel && sel.loc.type === loc.type &&
    JSON.stringify(sel.loc) === JSON.stringify(loc) && index >= sel.index

  /* Cards currently carried by the drag layer (dimmed in place). */
  const isInDraggedRun = (loc: Location, index: number) =>
    !!drag && drag.from.type === loc.type &&
    JSON.stringify(drag.from) === JSON.stringify(loc) && index >= drag.fromIndex

  /* While dragging, is `loc` a legal destination for the carried run? */
  const isDropTarget = (loc: Location) =>
    !!drag && !!performMove(game, drag.from, drag.fromIndex, loc)

  /* Waste: show up to the last 3 cards fanned. */
  const wasteLen = game.waste.length
  const wasteStart = Math.max(0, wasteLen - 3)
  const wasteVisible = game.waste.slice(wasteStart)

  return (
    <div className={styles.solitaire}>
      {/* HUD */}
      <div className={styles.hud}>
        <PuzzleStopwatch ms={timer.elapsedMs} running={timer.running} />
        <span className={styles.mode}>{cfg.label}</span>
        <span className={styles.stat}>
          <span className={styles.statLabel}>Foundations</span>
          <span className={styles.statValue}>{foundationCount(game)}/52</span>
        </span>
        <span className={styles.stat}>
          <span className={styles.statLabel}>Moves</span>
          <span className={styles.statValue}>{moves}</span>
        </span>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={undo}
            disabled={!undoStack.length || autoRunning || wonRef.current}
          >
            ↶ Undo
          </button>
          {autoAvailable && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.autoBtn}`}
              onClick={startAuto}
            >
              ✦ Auto-finish
            </button>
          )}
          <button type="button" className={styles.actionBtn} onClick={newGame}>
            ↻ New game
          </button>
        </div>
      </div>

      {/* Top row: stock + waste clustered LEFT · 4 foundations clustered RIGHT */}
      <div className={styles.topRow}>
        <div className={styles.topLeft}>
          <button
            type="button"
            className={`${styles.slot} ${styles.stockSlot} ${stockCanAct ? '' : styles.slotDim}`}
            onClick={onStockClick}
            aria-label="Stock pile"
          >
            {game.stock.length > 0 ? (
              <CardView card={{ id: 'back', suit: 'S', rank: 0, faceUp: false }} />
            ) : (
              <span className={styles.recycleGlyph}>
                {game.waste.length > 0 && (cfg.redeals == null || game.redealsUsed < cfg.redeals) ? '↻' : '✕'}
              </span>
            )}
            {game.stock.length > 0 && <span className={styles.stockCount}>{game.stock.length}</span>}
          </button>

          <div
            className={`${styles.slot} ${styles.wasteSlot}`}
            onClick={() => onPileClick({ type: 'waste' })}
            aria-label="Waste pile"
          >
            {wasteVisible.length === 0 && <span className={styles.slotGhost} />}
            {wasteVisible.map((card, i) => {
              const globalIndex = wasteStart + i
              const isTop = globalIndex === wasteLen - 1
              const wasteLoc: Location = { type: 'waste' }
              return (
                <div
                  key={card.id}
                  className={`${styles.wasteCard} ${isTop && selEq(wasteLoc, globalIndex) ? styles.selected : ''} ${isInDraggedRun(wasteLoc, globalIndex) ? styles.dragging : ''}`}
                  style={{ left: `calc(var(--card-w) * ${i * 0.26})`, zIndex: i, pointerEvents: isTop ? 'auto' : 'none' }}
                  onPointerDown={isTop ? (e) => handleCardPointerDown(wasteLoc, globalIndex, e) : undefined}
                  onClick={isTop ? (e) => { e.stopPropagation(); onCardClick(wasteLoc, globalIndex) } : undefined}
                  onDoubleClick={isTop ? (e) => { e.stopPropagation(); onCardAuto(wasteLoc, globalIndex) } : undefined}
                >
                  <CardView card={card} />
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.foundations}>
          {game.foundations.map((f, idx) => {
            const topIndex = f.length - 1
            const loc: Location = { type: 'foundation', idx }
            return (
              <div
                key={idx}
                data-drop={dropAttr(loc)}
                className={`${styles.slot} ${styles.foundationSlot} ${isDropTarget(loc) ? styles.dropOk : ''}`}
                onClick={() => onPileClick(loc)}
                aria-label={`${SUIT_SYMBOL[SUITS[idx]]} foundation`}
              >
                {f.length === 0 ? (
                  <span className={`${styles.foundationGhost} ${styles[SUIT_COLOR[SUITS[idx]]]}`}>
                    {SUIT_SYMBOL[SUITS[idx]]}
                  </span>
                ) : (
                  <div
                    className={`${styles.foundationCard} ${selEq(loc, topIndex) ? styles.selected : ''} ${isInDraggedRun(loc, topIndex) ? styles.dragging : ''}`}
                    onPointerDown={(e) => handleCardPointerDown(loc, topIndex, e)}
                    onClick={(e) => { e.stopPropagation(); onCardClick(loc, topIndex) }}
                  >
                    <CardView card={f[topIndex]} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tableau */}
      <div className={styles.tableau}>
        {game.tableau.map((col, c) => {
          const loc: Location = { type: 'tableau', col: c }
          // cumulative vertical offsets
          let acc = 0
          const tops: number[] = []
          for (const card of col) { tops.push(acc); acc += card.faceUp ? EXPOSE_UP : EXPOSE_DOWN }
          const heightUnits = (col.length ? acc : 0) + 1
          return (
            <div
              key={c}
              data-drop={dropAttr(loc)}
              className={`${styles.column} ${isDropTarget(loc) ? styles.dropOk : ''}`}
              style={{ minHeight: `calc(var(--card-h) * ${heightUnits.toFixed(3)})` }}
              onClick={() => onPileClick(loc)}
            >
              {col.length === 0 && <span className={styles.slotGhost} />}
              {col.map((card, i) => {
                const selectedRun = card.faceUp && isInSelectedRun(loc, i)
                const draggedRun = card.faceUp && isInDraggedRun(loc, i)
                return (
                  <div
                    key={card.id}
                    className={`${styles.stackCard} ${selectedRun ? styles.selected : ''} ${draggedRun ? styles.dragging : ''}`}
                    style={{ top: `calc(var(--card-h) * ${tops[i].toFixed(3)})`, zIndex: i + 1 }}
                    onPointerDown={(e) => handleCardPointerDown(loc, i, e)}
                    onClick={(e) => { e.stopPropagation(); onCardClick(loc, i) }}
                    onDoubleClick={(e) => { e.stopPropagation(); onCardAuto(loc, i) }}
                  >
                    <CardView card={card} />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Floating drag layer — follows the pointer (transform only). */}
      {drag && (
        <div
          ref={dragLayerRef}
          className={styles.dragLayer}
          aria-hidden="true"
          style={{
            width: drag.cardW,
            transform: `translate(${drag.x - drag.offsetX}px, ${drag.y - drag.offsetY}px) rotate(3deg) scale(1.045)`,
          }}
        >
          {drag.cards.map((card, i) => (
            <div
              key={card.id}
              className={styles.dragCard}
              style={{
                top: `${i * EXPOSE_UP * drag.cardH}px`,
                width: drag.cardW,
                height: drag.cardH,
                zIndex: i,
              }}
            >
              <CardView card={card} />
            </div>
          ))}
        </div>
      )}

      {/* Win celebration */}
      {showWin && (
        <div className={styles.winOverlay} role="dialog" aria-label="You won">
          <div className={styles.confettiField} aria-hidden="true">
            {confetti.map((p, i) => (
              <span
                key={i}
                className={styles.confetti}
                style={{
                  left: `${p.left}%`,
                  background: p.hue,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.dur}s`,
                  ['--rot' as string]: `${p.rot}deg`,
                }}
              />
            ))}
          </div>
          <div className={styles.winCard}>
            <div className={styles.winGlyph}>♠♥♦♣</div>
            <h3 className={styles.winTitle}>You won!</h3>
            <p className={styles.winTime}>
              Solved in <strong>{(timer.elapsedMs / 1000).toFixed(1)}s</strong> · {moves} moves
            </p>
            <button type="button" className={`${styles.actionBtn} ${styles.autoBtn}`} onClick={newGame}>
              ↻ Play again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
