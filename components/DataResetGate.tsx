'use client'

/* ════════════════════════════════════════════════════════════════
   DataResetGate — one-time local data wipe
   ----------------------------------------------------------------
   Clears ALL locally-stored Zenith data (IndexedDB + localStorage +
   sessionStorage) exactly once per device, guarded by a version
   sentinel. Used to ship a clean slate: no leftover development or
   personal data ends up in a user's browser.

   To trigger another wipe in a future release, bump WIPE_VERSION.
   Runs as the first mounted child so it executes before any provider
   opens the Dexie databases.
   ════════════════════════════════════════════════════════════════ */

import { useEffect } from 'react'

const WIPE_VERSION = 'v1'
const SENTINEL_KEY = 'zenith_data_wiped_' + WIPE_VERSION
const KNOWN_DBS    = ['ZenithOS', 'ZenithGamesOS']

export default function DataResetGate() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    let alreadyWiped = false
    try { alreadyWiped = localStorage.getItem(SENTINEL_KEY) === 'done' } catch { /* noop */ }
    if (alreadyWiped) return

    // Confirm localStorage is writable before touching anything. If it isn't,
    // we can't persist the sentinel — abort rather than risk a reload loop.
    try {
      localStorage.setItem(SENTINEL_KEY, 'pending')
      if (localStorage.getItem(SENTINEL_KEY) !== 'pending') return
    } catch {
      return
    }

    const finish = () => {
      try {
        // Re-set the sentinel AFTER clearing so it survives the wipe.
        localStorage.setItem(SENTINEL_KEY, 'done')
      } catch { /* noop */ }
      // Reload once so the app re-initialises against empty stores.
      window.location.reload()
    }

    try {
      // 1. Clear key/value stores (settings, sessions, follow lists, etc.)
      try { localStorage.clear() } catch { /* noop */ }
      try { sessionStorage.clear() } catch { /* noop */ }

      // 2. Delete IndexedDB databases.
      const idb = window.indexedDB
      if (!idb) { finish(); return }

      const names = new Set<string>(KNOWN_DBS)
      const deleteAll = () => {
        let pending = names.size
        if (pending === 0) { finish(); return }
        let done = false
        const settle = () => {
          pending -= 1
          if (pending <= 0 && !done) { done = true; finish() }
        }
        // Safety timeout in case a delete is blocked by an open connection.
        const timeout = window.setTimeout(() => { if (!done) { done = true; finish() } }, 1500)
        names.forEach(name => {
          try {
            const req = idb.deleteDatabase(name)
            req.onsuccess = settle
            req.onerror   = settle
            req.onblocked = settle
          } catch {
            settle()
          }
        })
        void timeout
      }

      // Enumerate any additional databases when the API is available.
      if (typeof idb.databases === 'function') {
        idb.databases()
          .then(list => {
            for (const d of list) { if (d?.name) names.add(d.name) }
          })
          .catch(() => { /* fall back to KNOWN_DBS */ })
          .finally(deleteAll)
      } else {
        deleteAll()
      }
    } catch {
      finish()
    }
  }, [])

  return null
}
