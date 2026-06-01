/**
 * Global type augmentation for the Playwright TestBridge.
 * Declares window.__zenith so test helper files can call
 * window.__zenith.db.* without TypeScript errors.
 *
 * This file is included in tsconfig.json automatically via
 * the types/ directory. It has no runtime effect.
 */

import type { db as DbType } from '@/lib/db'
import type { awardXp, awardGold, seedUserProfile } from '@/lib/db'

declare global {
  interface Window {
    /**
     * Mounted by components/TestBridge.tsx when NEXT_PUBLIC_E2E=1.
     * Gives Playwright tests direct access to the live Dexie instance
     * so writes go through Dexie (triggering useLiveQuery reactivity
     * and sync hooks) rather than bypassing them via raw IndexedDB.
     */
    __zenith?: {
      db:              typeof DbType
      awardXp:         typeof awardXp
      awardGold:       typeof awardGold
      seedUserProfile: typeof seedUserProfile
    }
  }
}

export {}
