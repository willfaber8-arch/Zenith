/**
 * Jest global setup — runs once per test worker before any test file loads.
 *
 * Order of operations matters here:
 *   1. fake-indexeddb/auto patches globalThis.indexedDB (and related IDB
 *      constructors) with a fully spec-compliant in-memory implementation.
 *   2. Because this file runs via setupFilesAfterEnv (after the jsdom
 *      environment is initialised but before test modules are imported),
 *      every subsequent `import { gamesDb }` in test files sees the fake
 *      IndexedDB from the moment the Dexie singleton is first constructed.
 *   3. @testing-library/jest-dom extends Jest's `expect` with DOM matchers
 *      (toBeInTheDocument, toHaveValue, etc.) — present for UI tests.
 */

// ── 0. structuredClone polyfill ───────────────────────────────────────
// fake-indexeddb v6 calls structuredClone() to deep-clone values before
// insertion.  jsdom replaces the global scope with its own window object
// and does not forward Node's built-in structuredClone into it.
// We bridge the gap using Node's v8 module (a proper structured-clone
// implementation that handles Dates, TypedArrays, circular refs, etc.)
// before any IDB or Dexie code is imported.
if (typeof (global as Record<string, unknown>).structuredClone === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const v8 = require('v8') as {
    serialize:   (value: unknown) => Buffer
    deserialize: (buffer: Buffer) => unknown
  }
  ;(global as Record<string, unknown>).structuredClone =
    <T>(val: T): T => v8.deserialize(v8.serialize(val)) as T
}

// ── 1. In-memory IndexedDB ─────────────────────────────────────────────
// fake-indexeddb/auto attaches indexedDB, IDBKeyRange, IDBIndex,
// IDBObjectStore, IDBOpenDBRequest, IDBRequest, IDBTransaction, and
// IDBVersionChangeEvent to the global scope.
import 'fake-indexeddb/auto'

// ── 2. DOM assertion matchers ──────────────────────────────────────────
import '@testing-library/jest-dom'
