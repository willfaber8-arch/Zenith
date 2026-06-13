'use client'

import { useState } from 'react'
import ZenHeading          from '@/components/ui/ZenHeading'
import GameFinderDashboard from '@/components/GameFinderDashboard'
import TournamentHubView   from './TournamentHubView'

type Tab = 'finder' | 'tournament'

const TAB_STYLE_BASE: React.CSSProperties = {
  padding: '6px 18px',
  borderRadius: '99px',
  border: '1px solid var(--border-subtle)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.5625rem',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
  transition: 'background 110ms ease, color 110ms ease, border-color 110ms ease',
}

const TAB_STYLE_ACTIVE: React.CSSProperties = {
  background: 'rgba(124,149,255,0.12)',
  color: 'var(--text-primary)',
  borderColor: 'rgba(124,149,255,0.30)',
}

export default function GameFinderView() {
  const [tab, setTab] = useState<Tab>('finder')

  return (
    <div>
      <div style={{ padding: 'var(--sp-8) var(--sp-8) var(--sp-3)' }}>
        <ZenHeading
          eyebrow="Life · Social"
          title="Game Hub."
          subtitle="Find the perfect multiplayer game or run a tournament with your group."
        />
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-5)', flexWrap: 'wrap' }}>
          <button
            style={{ ...TAB_STYLE_BASE, ...(tab === 'finder' ? TAB_STYLE_ACTIVE : {}) }}
            onClick={() => setTab('finder')}
          >
            ◈ Game Finder
          </button>
          <button
            style={{ ...TAB_STYLE_BASE, ...(tab === 'tournament' ? TAB_STYLE_ACTIVE : {}) }}
            onClick={() => setTab('tournament')}
          >
            ⬡ Tournament
          </button>
        </div>
      </div>

      {tab === 'finder' ? (
        <GameFinderDashboard />
      ) : (
        <TournamentHubView />
      )}
    </div>
  )
}
