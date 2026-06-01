'use client'
/**
 * HomeView — Phase 1 · Step 1.4
 * Greeting hero (DB-hydrated name) + configurable WidgetSandbox.
 * The Phase 0 design-token showcase is preserved below the fold
 * for reference during active development.
 */

import GreetingHero      from '@/components/GreetingHero'
import WidgetSandbox     from '@/components/WidgetSandbox'
import RpgStatusWidget   from '@/components/RpgStatusWidget'
import ZenHeading        from '@/components/ui/ZenHeading'
import ZenCard           from '@/components/ui/ZenCard'
import { useStudyMode }  from '@/lib/StudyModeContext'
import styles from './HomeView.module.css'

const COLOR_TOKENS = [
  { name: '--bg-main',       value: '#0b0d13',              label: 'Cosmos Black'  },
  { name: '--surface-card',  value: '#141923',              label: 'Indigo-Grey'   },
  { name: '--accent-purple', value: '#7c95ff',              label: 'Periwinkle'    },
  { name: '--accent-green',  value: '#52cca3',              label: 'Ocean Sage'    },
  { name: '--text-primary',  value: '#e8eaf6',              label: 'Soft White'    },
  { name: '--text-muted',    value: '#9ba3c4',              label: 'Slate Grey'    },
  { name: '--text-dark',     value: '#5c6487',              label: 'Guide Slate'   },
  { name: '--border-subtle', value: 'rgba(124,149,255,.1)', label: 'Violet Border' },
] as const

export default function HomeView() {
  const { enterStudyWorkspace } = useStudyMode()

  return (
    <>
      {/* ── Greeting (hydrated from DB userProfile + auth session) ── */}
      <GreetingHero />

      {/* ── Study Mode Entry CTA ─────────────────────────────────── */}
      <div className={`${styles.studyModeCta} anim-slide-in delay-3`}>
        <div className={styles.studyModeCtaInner}>
          <div className={styles.studyModeCtaMeta}>
            <span className={styles.studyModeCtaEyebrow}>Focus Protocol · Active</span>
            <p className={styles.studyModeCtaTitle}>
              Deep work mode eliminates distractions and locks in your{' '}
              Pomodoro timer, notes, and recall tools.
            </p>
          </div>
          <button
            type="button"
            className={styles.studyModeCtaBtn}
            onClick={enterStudyWorkspace}
            aria-label="Enter distraction-free study mode"
          >
            <span className={styles.studyModeCtaBracket} aria-hidden="true">[</span>
            Enter Study Mode
            <span className={styles.studyModeCtaBracket} aria-hidden="true">]</span>
          </button>
        </div>
      </div>

      <div className={styles.showcase}>

        {/* ── Character Lifecycle RPG Banner ───────────────────────── */}
        <div className="anim-slide-in delay-2">
          <RpgStatusWidget />
        </div>

        {/* ── PRIMARY: Configurable widget sandbox ─────────────────── */}
        <section className="anim-fade-in">
          <WidgetSandbox />
        </section>

        {/* ── REFERENCE: Design-token showcase (Phase 0) ─────────── */}
        <div className={`${styles.devDivider} anim-fade-in delay-2`}>
          <span className={styles.devLabel}>Design System Reference · Phase 0</span>
        </div>

        <div className="anim-fade-in delay-2">
          <ZenHeading
            eyebrow="Phase 0 · Step 1.1"
            title={`Design\nFoundations.`}
            subtitle="Token system, typography, and spatial rhythm — the visual substrate every Zenith module is built on."
            size="lg"
          />
        </div>

        <section className={`${styles.section} anim-slide-in delay-1`}>
          <p className={styles.sectionLabel}>System Color Matrix</p>
          <div className={styles.palette}>
            {COLOR_TOKENS.map((token) => (
              <div key={token.name} className={styles.swatch}>
                <div
                  className={styles.swatchChip}
                  style={{ background: token.value }}
                  aria-label={token.label}
                />
                <p className={styles.swatchLabel}>{token.label}</p>
                <p className={styles.swatchMeta}>{token.name}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`${styles.section} anim-slide-in delay-2`}>
          <p className={styles.sectionLabel}>Typography Specimen</p>
          <div className={styles.typePanel}>
            <div className={styles.typeRow}>
              <span className={styles.typeTag}>Display · Space Grotesk 700</span>
              <p className={styles.specimenDisplay}>Aa&thinsp;Zenith OS</p>
            </div>
            <div className={styles.typeDivider} />
            <div className={styles.typeRow}>
              <span className={styles.typeTag}>Body · Plus Jakarta Sans 400</span>
              <p className={styles.specimenBody}>
                The discipline of excellence is not a destination — it is the
                architecture of every hour, every decision, every quiet refusal
                to settle for less than what clarity demands.
              </p>
            </div>
            <div className={styles.typeDivider} />
            <div className={styles.typeRow}>
              <span className={styles.typeTag}>Mono · Cascadia Code</span>
              <p className={styles.specimenMono}>09:41 · Friday, 29 May 2026</p>
            </div>
          </div>
        </section>

        <section className={`${styles.section} anim-slide-in delay-3`}>
          <p className={styles.sectionLabel}>Card Components</p>
          <div className={styles.cardGrid}>
            <ZenCard
              eyebrow="Academic · Priority"
              title="Thesis Draft Due"
              body="Chapter 3 revision needs to be completed before the committee review on Friday. Estimated 4 hours remaining."
              accent="purple"
            />
            <ZenCard
              eyebrow="Habit · Streak"
              title="Deep Work Session"
              body="12-day streak maintained. Today's 90-minute block starts at 09:00. Pomodoro timer queued."
              accent="green"
            />
            <ZenCard
              eyebrow="System · Status"
              title="Widget Sandbox Live"
              body="Reactive data hooks, live badge counts, and configurable dashboard panels initialized across all modules."
              accent="purple"
            />
          </div>
        </section>

      </div>
    </>
  )
}
