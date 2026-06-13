/**
 * Jest configuration for the Zenith Games Tab unit + integration test suite.
 *
 * Strategy:
 *   • Delegate TypeScript transformation to next/jest's built-in SWC pipeline —
 *     it handles `'use client'` directives, path aliases, and everything else
 *     that bare ts-jest would trip on in an App Router project.
 *   • jest-environment-jsdom provides a browser-like global (window, navigator)
 *     so the SSR-safety checks in lib/gamesDb.ts (`typeof window !== 'undefined'`)
 *     evaluate to true and the Dexie singleton is actually created.
 *   • fake-indexeddb/auto (loaded in jest.setup.ts) patches the jsdom global
 *     indexedDB before any test module is imported, ensuring all Dexie
 *     instances use the in-memory store instead of a real browser IDB.
 *   • transformIgnorePatterns is loosened to allow SWC to transpile
 *     ESM-only node_modules (fake-indexeddb v5+ and dexie-react-hooks).
 */

import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const baseConfig: Config = {
  /* ── Test discovery ─────────────────────────────────────────── */
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/',   // Playwright suite lives here — not Jest territory
  ],

  /* ── Environment & setup ────────────────────────────────────── */
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  /* ── Module resolution — mirrors tsconfig.json paths ────────── */
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  /* ── ESM packages — allow SWC to transpile them ─────────────── */
  transformIgnorePatterns: [
    '/node_modules/(?!(fake-indexeddb|dexie|dexie-react-hooks)/)',
  ],

  /* ── Execution ──────────────────────────────────────────────── */
  testTimeout:  15_000,   // generous ceiling for Dexie transaction sequences
  maxWorkers:   1,        // IDB singleton — serialise suites to prevent db race
  verbose:      true,
}

export default createJestConfig(baseConfig)
