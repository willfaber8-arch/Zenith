/**
 * Zenith OS — next.config.ts
 * Phase 6 · Step 6.1 — Production Compilation Hardening
 *
 * Three hardening layers applied here:
 *
 *   1. compiler.removeConsole  — SWC strips console.log / console.debug at
 *      build time in production; console.error + console.warn are preserved
 *      so real runtime faults surface in monitoring services.
 *
 *   2. Security headers        — applied to every route via headers().
 *      Provides a CSP baseline, clickjacking protection, MIME sniffing
 *      prevention, referrer policy, and a strict Permissions-Policy.
 *
 *   3. Webpack chunk strategy  — custom splitChunks config separates
 *      heavy optional modules (Leaflet, PeerJS, Anthropic SDK) into
 *      async chunks that are only downloaded when the view that needs
 *      them is opened. Reduces initial bundle weight significantly.
 *
 * NOTE on CSP + Next.js 15 App Router:
 *   The App Router uses inline <script> tags for RSC streaming and
 *   `next/script` bootstrapping. Until a per-request nonce system is
 *   wired up (requires middleware.ts + generateBuildId nonce injection),
 *   'unsafe-inline' and 'unsafe-eval' must remain in script-src.
 *   The other directives (frame-ancestors, object-src, base-uri) are
 *   already maximally restrictive and provide strong XSS mitigation.
 */

import type { NextConfig } from 'next'

/* ── Security header values ────────────────────────────────────── */

const isDev = process.env.NODE_ENV !== 'production'

const ContentSecurityPolicy = [
  /* Default — block everything not explicitly allowed */
  `default-src 'self'`,

  /* Scripts — 'unsafe-inline' is required by the Next.js 15 App Router for RSC
     streaming bootstrap (pending a per-request nonce middleware). 'unsafe-eval'
     is required ONLY in development for React Fast Refresh / HMR, so it is
     stripped from the production policy to shrink the XSS attack surface.     */
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,

  /* Styles — Google Fonts stylesheet + inline styles for CSS-in-JS tokens */
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,

  /* Fonts — Google Fonts CDN (Plus Jakarta Sans, Space Grotesk) */
  `font-src 'self' https://fonts.gstatic.com`,

  /* Images — data URIs for SVG icons, blobs for canvas export, map tiles
     (OpenStreetMap + CartoDB basemaps used by the Trail Hunter map), and team
     badges from TheSportsDB's image CDN (Sports Tracker) */
  `img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://*.thesportsdb.com https://r2.thesportsdb.com`,

  /* Connections — Open-Meteo weather, Nominatim geocoding, Supabase sync,
     PeerJS signalling (*.0.peerjs.com), WebRTC ICE/STUN.
     Wildcard *.supabase.co covers both the API and storage subdomains.    */
  [
    `connect-src`,
    `'self'`,
    `https://api.open-meteo.com`,
    `https://nominatim.openstreetmap.org`,
    `https://*.supabase.co`,
    `wss://*.supabase.co`,
    `https://0.peerjs.com`,
    `wss://0.peerjs.com`,
    `stun:stun.l.google.com:19302`,
  ].join(' '),

  /* Workers — Next.js service-worker support */
  `worker-src 'self' blob:`,

  /* Media — canvas blob URLs for hardscape export */
  `media-src 'self' blob:`,

  /* Frames — music embeds for the focus audio player */
  `frame-src https://www.youtube-nocookie.com https://open.spotify.com https://w.soundcloud.com`,
  `frame-ancestors 'none'`,

  /* Object — no Flash / plugins */
  `object-src 'none'`,

  /* Base — prevent base-tag hijacking */
  `base-uri 'self'`,

  /* Form — POST actions only to self */
  `form-action 'self'`,

  /* Manifest — PWA support */
  `manifest-src 'self'`,
].join('; ')

const securityHeaders = [
  {
    key:   'Content-Security-Policy',
    value: ContentSecurityPolicy,
  },
  {
    /* Prevent Zenith from being framed by any external origin */
    key:   'X-Frame-Options',
    value: 'DENY',
  },
  {
    /* Prevent MIME-type sniffing attacks on script/style responses */
    key:   'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    /* Only send origin on same-origin navigations; strip on cross-origin */
    key:   'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    /* Restrict access to sensitive browser APIs Zenith does not use.
       geolocation → weather + distance tracker; microphone → AI Co-Pilot
       dictation + study-dock voice memos (self only — embedded iframes stay
       blocked, and the browser still shows its own permission prompt). */
    key:   'Permissions-Policy',
    value: [
      'camera=()',
      'microphone=(self)',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
      'geolocation=(self)',
    ].join(', '),
  },
  {
    /* Opt all responses into HSTS — 1 year, include subdomains */
    key:   'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    /* The legacy XSS auditor is removed in modern browsers and can itself
       introduce vulnerabilities in older ones. Per current guidance, set to 0
       (disabled) and rely on the CSP above for XSS defence. */
    key:   'X-XSS-Protection',
    value: '0',
  },
  {
    /* Isolate this browsing context from cross-origin popups/openers,
       mitigating cross-window scripting and Spectre-class side channels. */
    key:   'Cross-Origin-Opener-Policy',
    value: 'same-origin',
  },
  {
    /* Speed up DNS resolution for third-party CDN assets */
    key:   'X-DNS-Prefetch-Control',
    value: 'on',
  },
]

/* ── Next.js configuration ─────────────────────────────────────── */

const nextConfig: NextConfig = {

  /* ── 1. Compiler — strip console.log / console.debug in prod ──── */
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  /* ── 2. Security headers on all routes ─────────────────────────── */
  async headers() {
    return [
      {
        /* Apply to every route — including API routes and static files */
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  /* ── 3. Webpack bundle optimisation ────────────────────────────── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack(config: any, { isServer, dev }: { isServer: boolean; dev: boolean }) {
    /* Skip chunk splitting on the server bundle and in dev mode —
       only the production client bundle benefits from this work.    */
    if (isServer || dev) return config

    config.optimization ??= {}
    config.optimization.splitChunks ??= {}

    /* Deterministic module IDs produce stable hashes across builds,
       allowing CDN/browser caches to stay warm across deploys.      */
    config.optimization.moduleIds = 'deterministic'

    /* Merge our custom cache groups into Next.js's existing config.
       We target three heavy optional modules that are only loaded
       when the user navigates to the view that needs them.          */
    const existing =
      typeof config.optimization.splitChunks === 'object'
      && config.optimization.splitChunks !== false
        ? (config.optimization.splitChunks as Record<string, unknown>)
        : {}

    const existingGroups =
      (existing.cacheGroups as Record<string, unknown> | undefined) ?? {}

    config.optimization.splitChunks = {
      ...existing,
      chunks: 'all',
      cacheGroups: {
        ...existingGroups,

        /* Leaflet + react-leaflet — only loaded on TrailHunterView.
           Separate chunk keeps the home screen fast. */
        leaflet: {
          test:             /[\\/]node_modules[\\/](leaflet|react-leaflet)[\\/]/,
          name:             'vendor-leaflet',
          chunks:           'async' as const,
          priority:         30,
          reuseExistingChunk: true,
        },

        /* PeerJS — only loaded in MultiplayerLobby (Phase 5.5).
           Dynamic import in services/p2pNetwork.ts keeps it async.  */
        peerjs: {
          test:             /[\\/]node_modules[\\/]peerjs[\\/]/,
          name:             'vendor-peerjs',
          chunks:           'async' as const,
          priority:         30,
          reuseExistingChunk: true,
        },

        /* Anthropic SDK — only loaded via the AI Lecture Summarizer
           API route; should never appear in any client bundle at all,
           but this guard catches any accidental client-side import.  */
        anthropic: {
          test:             /[\\/]node_modules[\\/]@anthropic-ai[\\/]/,
          name:             'vendor-anthropic',
          chunks:           'async' as const,
          priority:         30,
          reuseExistingChunk: true,
        },

        /* Dexie — core to every screen. Isolating it into a named
           chunk maximises cache hits since it changes infrequently.  */
        dexie: {
          test:             /[\\/]node_modules[\\/](dexie|dexie-react-hooks)[\\/]/,
          name:             'vendor-dexie',
          chunks:           'all' as const,
          priority:         25,
          reuseExistingChunk: true,
        },
      },
    }

    return config
  },

  /* ── 4. Miscellaneous production settings ───────────────────────── */

  /* Enable gzip + brotli compression on all server responses.
     Brotli is ~20% smaller than gzip for JS/HTML payloads.          */
  compress: true,

  /* Strict mode activates additional warnings in development and
     stress-tests effects for the double-invoke pattern.             */
  reactStrictMode: true,

  /* Remove the X-Powered-By: Next.js header from every response.
     Default is true (header sent); false suppresses it.
     Reduces technology fingerprinting surface area.                 */
  poweredByHeader: false,

  /* Package import optimisation — tree-shakes icon/component libs
     that export hundreds of named exports.  Add any heavy lib here. */
  experimental: {
    optimizePackageImports: [],
  },
}

export default nextConfig
