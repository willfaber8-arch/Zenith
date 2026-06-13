import type { db as DbType } from '@/lib/db'
import type { seedUserProfile } from '@/lib/db'

declare global {
  interface Window {
    __zenith?: {
      db:              typeof DbType
      seedUserProfile: typeof seedUserProfile
    }
  }
}

export {}
