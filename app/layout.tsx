/**
 * Zenith OS — Root Layout
 * Phase 1 · Step 1.1 — Design Token & Visual Foundations Port
 *
 * FONT STRATEGY
 * ─────────────────────────────────────────────────────────────
 * Two Google Fonts loaded via next/font for zero-layout-shift,
 * automatic subset optimisation, and self-hosting:
 *
 *   --font-jakarta  →  Plus Jakarta Sans
 *     Geometric humanist sans. Dense utility interfaces, task lists,
 *     data labels, and body copy. Variable range 200–800.
 *
 *   --font-cabinet  →  Space Grotesk  (Cabinet Grotesk stand-in)
 *     Geometric display sans with distinctive x-height. Headings,
 *     hero metrics, and prominent labels. Weight range 300–700.
 *
 *     TO UPGRADE to Cabinet Grotesk or Clash Display:
 *       1. Download .woff2 files from https://www.fontshare.com/fonts/cabinet-grotesk
 *       2. Place them in /public/fonts/cabinet-grotesk/
 *       3. Replace the spaceGrotesk declaration below with:
 *
 *          import localFont from 'next/font/local'
 *          const cabinetGrotesk = localFont({
 *            src: [
 *              { path: '../public/fonts/cabinet-grotesk/CabinetGrotesk-Medium.woff2',     weight: '500' },
 *              { path: '../public/fonts/cabinet-grotesk/CabinetGrotesk-Bold.woff2',       weight: '700' },
 *              { path: '../public/fonts/cabinet-grotesk/CabinetGrotesk-Extrabold.woff2',  weight: '800' },
 *            ],
 *            variable: '--font-cabinet',
 *            display: 'swap',
 *          })
 *
 * Both fonts expose CSS variables on <html> that are consumed by the
 * @theme → --font-display / --font-sans cascade in globals.css.
 */

import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google'
import './globals.css'

import { NavProvider }        from '@/lib/NavContext'
import { NavBadgeProvider }   from '@/lib/NavBadgeContext'
import { AuthProvider }       from '@/lib/AuthContext'
import { SyncProvider }       from '@/lib/SyncContext'
import { ToastProvider }      from '@/lib/ToastContext'
import { StudyModeProvider }  from '@/lib/StudyModeContext'
import { FatigueProvider }    from '@/lib/FatigueContext'
import ThemeBackground   from '@/components/ThemeBackground'
import CosmosCanvas      from '@/components/CosmosCanvas'
import AppContent        from '@/components/AppContent'
import Toast             from '@/components/Toast'
import FatigueLayer      from '@/components/FatigueLayer'
import ErrorBoundary     from '@/components/ErrorBoundary'
/* TestBridge is only bundled when NEXT_PUBLIC_E2E=1 (playwright.config.ts webServer.env) */
import TestBridge        from '@/components/TestBridge'
/* Vercel observability — Phase 6.3
 * Analytics: pageview + custom event tracking via Vercel's edge collector.
 * SpeedInsights: Core Web Vitals (LCP, INP, CLS) via PerformanceObserver;
 *   uses requestIdleCallback so it never blocks the main thread.
 * Both components render null outside Vercel deployments, so local dev is
 * unaffected. Activated automatically when NEXT_PUBLIC_VERCEL_ENV is set. */
import { Analytics }     from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

/* ── Plus Jakarta Sans — body / utility text ──────────────────── */
const plusJakartaSans = Plus_Jakarta_Sans({
  variable:  '--font-jakarta',
  subsets:   ['latin'],
  display:   'swap',
  weight:    ['300', '400', '500', '600', '700', '800'],
  fallback:  ['ui-sans-serif', 'system-ui', 'sans-serif'],
})

/* ── Space Grotesk — display / heading text ───────────────────── */
const spaceGrotesk = Space_Grotesk({
  variable:  '--font-cabinet',   /* named --font-cabinet so globals.css @theme
                                    resolves transparently when real Cabinet
                                    Grotesk files are swapped in later         */
  subsets:   ['latin'],
  display:   'swap',
  weight:    ['300', '400', '500', '600', '700'],
  fallback:  ['ui-sans-serif', 'sans-serif'],
})

/* ── App metadata ─────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: {
    default:  'Zenith OS',
    template: '%s · Zenith OS',
  },
  description:
    'Your minimalist academic command centre — task management, ' +
    'study tools, habit tracking, and custom productivity modules.',
  keywords: ['productivity', 'academic', 'dashboard', 'study', 'tasks'],
  authors:  [{ name: 'Zenith OS' }],
}

export const viewport: Viewport = {
  themeColor:   '#0b0d13',   /* --color-bg-main — tints the mobile browser chrome */
  colorScheme:  'dark',
  width:        'device-width',
  initialScale: 1,
}

/* ── Root layout ──────────────────────────────────────────────── */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      /*
       * Font CSS variables are scoped to the <html> element by next/font.
       * globals.css @theme references them via var(--font-jakarta) and
       * var(--font-cabinet), cascading down through the entire document.
       */
      className={`${plusJakartaSans.variable} ${spaceGrotesk.variable}`}
    >
      <body>
        {/*
         * PROVIDER CHAIN (innermost wins for same context):
         *   NavProvider   — centralised view / category routing state
         *   AuthProvider  — localStorage session management
         *   ToastProvider — ephemeral notification queue
         *
         * FIXED-POSITION LAYER STACK (root stacking context):
         *   ThemeBackground  z-index:  0  — category bg tint (500 ms transition)
         *   CosmosCanvas     z-index:  1  — particle star field (always visible)
         *   AppContent
         *     AuthGate       z-index: 50  — login overlay (when unauthenticated)
         *     AppShell       z-index:  2  — full workspace (when authenticated)
         *   Toast            z-index: 600 — notification stack
         */}
        <NavProvider>
          <NavBadgeProvider>
          <AuthProvider>
            {/*
             * SyncProvider sits inside AuthProvider so it can observe the
             * Supabase session state, and outside ToastProvider so any
             * component in the tree (including Toast) can call useSyncStatus().
             */}
            <SyncProvider>
              <ToastProvider>
                {/*
                 * StudyModeProvider sits inside ToastProvider so cockpit
                 * components can fire toast notifications, and above AppContent
                 * so both AppShell and HomeView can access the context.
                 */}
                <StudyModeProvider>
                  {/*
                   * FatigueProvider sits inside ToastProvider so
                   * FatigueLayer can call useToast(), and inside
                   * StudyModeProvider so recovery state is independent
                   * of study mode.  CosmosCanvas reads FatigueCtx
                   * directly via useContext to slow star animations
                   * during fatigue without restarting the RAF loop.
                   */}
                  <FatigueProvider>
                    <ThemeBackground />
                    <CosmosCanvas />
                    {/* ErrorBoundary wraps the entire workspace layer.
                        Any uncaught crash in AppContent, AppShell, or any
                        view module renders the recovery card instead of a
                        blank white screen.                               */}
                    <ErrorBoundary>
                      <AppContent>{children}</AppContent>
                    </ErrorBoundary>
                    <Toast />
                    <FatigueLayer />
                    {/* Only rendered during Playwright runs (NEXT_PUBLIC_E2E=1) */}
                    {process.env.NEXT_PUBLIC_E2E === '1' && <TestBridge />}
                  </FatigueProvider>
                </StudyModeProvider>
              </ToastProvider>
            </SyncProvider>
          </AuthProvider>
          </NavBadgeProvider>
        </NavProvider>
        {/* Vercel Analytics + Speed Insights — outside all providers and the
            ErrorBoundary so they keep reporting even if the app tree crashes.
            Both are no-ops in non-Vercel environments (render null, no fetch). */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
