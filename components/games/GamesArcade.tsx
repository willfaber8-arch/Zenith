'use client'

/**
 * GamesArcade.tsx
 * Phase 12.2 — Extracted from ViewRouter for lazy-loading boundary
 *
 * Rendered inside GamesTabShell's `arcadeContent` slot.
 * Six canvas/logic games share one scrollable viewport; a minimal chip-tab
 * row at the top switches between them without unmounting the shell.
 *
 * Lazy-loaded via lib/dynamicViews.tsx so the six canvas game bundles
 * (Minesweeper, ScriptingMatrix, ShiftMatrix, 2048, BioSynthesizer,
 * ZenSnake) are never included in the initial page load.
 */

import { useState } from 'react'
import UniversalGameWrapper from '@/components/games/UniversalGameWrapper'
import MinesweeperCore      from '@/components/games/refine/MinesweeperCore'
import ScriptingMatrix      from '@/components/games/harvest/ScriptingMatrix'
import ShiftMatrix          from '@/components/games/harvest/ShiftMatrix'
import Core2048             from '@/components/games/harvest/Core2048'
import BioSynthesizer       from '@/components/games/harvest/BioSynthesizer'
import ZenSnake             from '@/components/games/harvest/ZenSnake'

type GameId = 'refiner' | 'matrix' | 'shift' | '2048' | 'biosynth' | 'zensnake'

const GAME_LABELS: Record<GameId, string> = {
  refiner:  'Minesweeper',
  matrix:   'Speed Typer',
  shift:    'Sliding Puzzle',
  '2048':   '2048',
  biosynth: 'Ball Catcher',
  zensnake: 'Zen Snake',
}

const GAME_IDS = Object.keys(GAME_LABELS) as GameId[]

export default function GamesArcade() {
  const [activeGame, setActiveGame] = useState<GameId>('refiner')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>

      {/* Game selector chips */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
        {GAME_IDS.map(id => (
          <button
            key={id}
            onClick={() => setActiveGame(id)}
            type="button"
            aria-pressed={activeGame === id}
            style={{
              fontFamily:    'var(--font-mono)',
              fontSize:      '0.6rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding:       '4px 10px',
              borderRadius:  'var(--r-sm)',
              border:        `1px solid ${activeGame === id
                ? 'color-mix(in srgb, var(--cat-accent) 50%, transparent)'
                : 'color-mix(in srgb, var(--border-subtle) 40%, transparent)'}`,
              background:    activeGame === id
                ? 'color-mix(in srgb, var(--cat-accent) 12%, transparent)'
                : 'transparent',
              color:         activeGame === id ? 'var(--cat-accent)' : 'var(--text-muted)',
              cursor:        'pointer',
              transition:    'all 200ms var(--ease-smooth)',
            }}
          >
            {GAME_LABELS[id]}
          </button>
        ))}
      </div>

      {/* Active game — display:none keeps inactive games mounted */}

      <div style={{ display: activeGame === 'refiner' ? 'block' : 'none', flex: 1, minHeight: 0 }}>
        <UniversalGameWrapper
          gameId="mine-refiner"
          gameTitle="Minesweeper"
          targetResourceId="raw_data_shards"
          payoutFormula={score => score}
        >
          <MinesweeperCore mineCount={15} />
        </UniversalGameWrapper>
      </div>

      <div style={{ display: activeGame === 'matrix'   ? 'block' : 'none', flex: 1, minHeight: 0 }}>
        <ScriptingMatrix />
      </div>

      <div style={{ display: activeGame === 'shift'    ? 'block' : 'none', flex: 1, minHeight: 0 }}>
        <ShiftMatrix />
      </div>

      <div style={{ display: activeGame === '2048'     ? 'block' : 'none', flex: 1, minHeight: 0 }}>
        <Core2048 />
      </div>

      <div style={{ display: activeGame === 'biosynth' ? 'block' : 'none', flex: 1, minHeight: 0 }}>
        <BioSynthesizer />
      </div>

      <div style={{ display: activeGame === 'zensnake' ? 'block' : 'none', flex: 1, minHeight: 0 }}>
        <ZenSnake />
      </div>

    </div>
  )
}
