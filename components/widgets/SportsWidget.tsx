'use client'

import { useNav } from '@/lib/NavContext'
import { useFollowedTeams } from '@/lib/hooks/useFollowedTeams'
import wStyles from './Widget.module.css'

/* Compact snapshot of the teams the user follows in the Sports Tracker.
   Kept API-free (reads the local follow list) so it never blocks render. */

export default function SportsWidget() {
  const { navigate } = useNav()
  const { teams, mounted } = useFollowedTeams()

  const go = () => navigate('sports', 'creator')
  const preview = teams.slice(0, 4)

  return (
    <div
      className={`${wStyles.card} ${wStyles.clickable}`}
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') go() }}
      aria-label="Open Sports Tracker"
    >
      <div className={wStyles.cardHeader}>
        <div>
          <p className={wStyles.eyebrow}>Creator · Sports</p>
          <p className={wStyles.title}>My Teams</p>
        </div>
        <span className={wStyles.navArrow}>→</span>
      </div>

      <div className={wStyles.widgetBody}>
        {!mounted ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '0.8rem' }}>Loading…</p>
        ) : teams.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>
            Follow teams in the Sports Tracker to see them here.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--cat-accent, var(--accent-green))', lineHeight: 1 }}>
                {teams.length}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                team{teams.length === 1 ? '' : 's'} followed
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {preview.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  {t.badge
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={t.badge} alt="" width={18} height={18} style={{ objectFit: 'contain', flexShrink: 0 }} loading="lazy" />
                    : <span style={{ width: 18, height: 18, borderRadius: 4, background: 'var(--bg-hover)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', flexShrink: 0 }}>{t.name.slice(0, 1)}</span>}
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.name}
                  </span>
                </div>
              ))}
              {teams.length > preview.length && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>
                  +{teams.length - preview.length} more
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
