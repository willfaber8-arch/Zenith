/**
 * Zenith OS — Root Layout
 * Phase 1 · Step 1.1 — Design Token & Visual Foundations Port
 * Phase 15 · Step 15.3 — Font Self-Hosting (CDN-free, zero CLS)
 *
 * FONT STRATEGY
 * ─────────────────────────────────────────────────────────────
 * Both fonts are served from /public/fonts/ via next/font/local.
 * No runtime Google CDN request — zero external font dependency.
 * adjustFontFallback: 'Arial' instructs Next.js to auto-compute
 * size-adjust / ascent-override / descent-override fallback metrics
 * so the system font placeholder matches the web font geometry.
 * Combined with display: 'swap', this eliminates layout shift (CLS = 0).
 *
 *   --font-jakarta  →  Plus Jakarta Sans (weights 300–800)
 *     Geometric humanist sans. Utility interfaces, task lists,
 *     data labels, and body copy.
 *     Files: /public/fonts/plus-jakarta-sans/*.woff2
 *
 *   --font-cabinet  →  Space Grotesk (weights 300–700)
 *     Geometric display sans with distinctive x-height. Headings,
 *     hero metrics, and prominent labels.
 *     Files: /public/fonts/space-grotesk/*.woff2
 *
 * TO ACQUIRE FONT FILES:
 *   Run: powershell scripts/download-fonts.ps1
 *   This downloads all 11 .woff2 files from Google Fonts and places
 *   them in the correct /public/fonts/ subdirectories.
 *
 *   OR upgrade --font-cabinet to Cabinet Grotesk (Fontshare):
 *     1. Download .woff2 files from https://www.fontshare.com/fonts/cabinet-grotesk
 *     2. Place in /public/fonts/cabinet-grotesk/
 *     3. Update the spaceGrotesk src array paths below.
 *
 * Both fonts expose CSS variables on <html> consumed by the
 * @theme → --font-display / --font-sans cascade in globals.css.
 */

import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

import { NavProvider }        from '@/lib/NavContext'
import { NavBadgeProvider }   from '@/lib/NavBadgeContext'
import { AuthProvider }       from '@/lib/AuthContext'
import { SyncProvider }       from '@/lib/SyncContext'
import { ToastProvider }      from '@/lib/ToastContext'
import { StudyModeProvider }  from '@/lib/StudyModeContext'
import { CopilotProvider }         from '@/lib/CopilotContext'
import { ContextMenuProvider }    from '@/lib/ContextMenuContext'
import ThemeBackground   from '@/components/ThemeBackground'
import CosmosCanvas      from '@/components/CosmosCanvas'
import AppContent        from '@/components/AppContent'
import Toast             from '@/components/Toast'
import ErrorBoundary     from '@/components/ErrorBoundary'
import ThemeApplicator from '@/components/ThemeApplicator'
import {
  LazyBackgroundCanvasManager as BackgroundCanvasManager,
  LazyAiCopilotSidebar        as AiCopilotSidebar,
  LazyTutorialSpotlight       as TutorialSpotlight,
  LazyOnboardingCinematic     as OnboardingCinematic,
} from '@/lib/dynamicViews'
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
/* Variable font: single .woff2 encodes the full 300–800 weight axis. */
const plusJakartaSans = localFont({
  src: [
    { path: '../public/fonts/plus-jakarta-sans/PlusJakartaSans-Variable.woff2', weight: '300 800', style: 'normal' },
  ],
  variable:             '--font-jakarta',
  display:              'swap',
  adjustFontFallback:   'Arial',   // Next.js auto-computes size-adjust / ascent-override / descent-override
  fallback:             ['ui-sans-serif', 'system-ui', 'sans-serif'],
})

/* ── Space Grotesk — display / heading text ───────────────────── */
/* Variable font: single .woff2 encodes the full 300–700 weight axis. */
const spaceGrotesk = localFont({
  src: [
    { path: '../public/fonts/space-grotesk/SpaceGrotesk-Variable.woff2', weight: '300 700', style: 'normal' },
  ],
  variable:             '--font-cabinet',   /* --font-cabinet so globals.css @theme resolves
                                               transparently; swap to Cabinet Grotesk by
                                               updating the src path above                   */
  display:              'swap',
  adjustFontFallback:   'Arial',
  fallback:             ['ui-sans-serif', 'sans-serif'],
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
  themeColor:   '#0d0f12',   /* --color-bg-main — tints the mobile browser chrome */
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
         *   ThemeBackground        z-index:  0  — category bg tint (500 ms transition)
         *   BackgroundCanvasManager z-index: 0  — animated canvas art (starfield / rain / grid)
         *   CosmosCanvas           z-index:  1  — particle star field (always visible)
         *   AppContent
         *     AuthGate       z-index: 50  — login overlay (when unauthenticated)
         *     AppShell       z-index:  2  — full workspace (when authenticated)
         *   Toast               z-index:  600 — notification stack
         *   OnboardingCinematic z-index: 9999 — first-session boot cinematic (self-removes)
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
                    <CopilotProvider>
                      <ContextMenuProvider>
                        <ThemeApplicator />
                        <ThemeBackground />
                        <BackgroundCanvasManager />
                        <CosmosCanvas />
                        <ErrorBoundary>
                          <AppContent>{children}</AppContent>
                        </ErrorBoundary>
                        <Toast />
                        <AiCopilotSidebar />
                        <TutorialSpotlight />
                        <OnboardingCinematic />
                        {process.env.NEXT_PUBLIC_E2E === '1' && <TestBridge />}
                      </ContextMenuProvider>
                    </CopilotProvider>
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
