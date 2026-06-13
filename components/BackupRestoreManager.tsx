'use client'

/**
 * BackupRestoreManager — Phase 15.1 · The "Eject Button"
 *
 * Two-pane UI for the full-database backup/restore system.
 *   Left:  [ EJECT LOCAL BACKUP DATA ] — exports all 30 IDB tables to JSON
 *   Right: [ RESTORE ARCHIVE FROM FILE ] — imports a previous backup JSON
 *
 * Design rules:
 *   - Mineral-dark #0d0f12 surface with parchment-gold accents (#e5c17c)
 *   - Monospace bracket notation for all labels and status text
 *   - Three restore states: idle → working (pulsing) → done (success / error)
 *   - Zero page reload — Dexie useLiveQuery hooks re-fire automatically
 *     after the transaction commits; zenith:db-restored dispatched for
 *     non-Dexie state (localStorage, in-memory caches)
 *   - File input is hidden; the styled button triggers it via ref.click()
 */

import { useRef, useState, useCallback } from 'react'
import { exportLocalDatabaseToJson }     from '@/utils/dbExporter'
import { importJsonToLocalDatabase }     from '@/utils/dbImporter'
import type { ImportResult }             from '@/utils/dbImporter'
import styles from './BackupRestoreManager.module.css'

/* ── Local state machine ──────────────────────────────────────── */

type ExportStatus = 'idle' | 'working' | 'done'
type ImportStatus = 'idle' | 'working' | 'done' | 'error'

/* ══════════════════════════════════════════════════════════════════
   BackupRestoreManager
   ══════════════════════════════════════════════════════════════════ */

export default function BackupRestoreManager() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle')
  const [exportNote,   setExportNote  ] = useState<string>('')

  const [importStatus, setImportStatus] = useState<ImportStatus>('idle')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError,  setImportError  ] = useState<string>('')

  /* ── Export ─────────────────────────────────────────────────── */

  const handleExport = useCallback(async () => {
    if (exportStatus === 'working') return
    setExportStatus('working')
    setExportNote('')

    try {
      await exportLocalDatabaseToJson()
      const d = new Date()
      const label = `zenith_os_backup_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}_${String(d.getDate()).padStart(2, '0')}.json`
      setExportNote(label)
      setExportStatus('done')
    } catch (err) {
      setExportNote((err as Error).message ?? 'Export failed.')
      setExportStatus('idle')
    }
  }, [exportStatus])

  /* ── Import ─────────────────────────────────────────────────── */

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      /* Reset so the same file can be re-selected after an error */
      if (fileInputRef.current) fileInputRef.current.value = ''

      setImportStatus('working')
      setImportResult(null)
      setImportError('')

      const reader = new FileReader()
      reader.onload = async (ev) => {
        const jsonString = ev.target?.result as string
        try {
          const result = await importJsonToLocalDatabase(jsonString)
          setImportResult(result)
          setImportStatus('done')
        } catch (err) {
          setImportError((err as Error).message ?? 'Restore failed — unknown error.')
          setImportStatus('error')
        }
      }
      reader.onerror = () => {
        setImportError('Could not read file — please try again.')
        setImportStatus('error')
      }
      reader.readAsText(file)
    },
    [],
  )

  const triggerFilePicker = useCallback(() => {
    if (importStatus === 'working') return
    fileInputRef.current?.click()
  }, [importStatus])

  /* ── Status strip content ───────────────────────────────────── */

  const renderStatus = () => {
    /* Import status takes priority in the shared strip */
    if (importStatus === 'working') {
      return (
        <>
          <span className={`${styles.dot} ${styles.dotWorking}`} />
          <span className={styles.statusWorking}>
            [ RESTORING LOCAL CHANNELS... ]
          </span>
        </>
      )
    }
    if (importStatus === 'done' && importResult) {
      return (
        <>
          <span className={`${styles.dot} ${styles.dotSuccess}`} />
          <span className={styles.statusSuccess}>
            [ ARCHIVE RESTORED — {importResult.restoredTables.length} TABLE{importResult.restoredTables.length !== 1 ? 'S' : ''} · {importResult.totalRowsWritten.toLocaleString()} ROWS ]
          </span>
        </>
      )
    }
    if (importStatus === 'error') {
      return (
        <>
          <span className={`${styles.dot} ${styles.dotError}`} />
          <span className={styles.statusError}>
            [ RESTORE FAULT ] {importError}
          </span>
        </>
      )
    }
    if (exportStatus === 'working') {
      return (
        <>
          <span className={`${styles.dot} ${styles.dotWorking}`} />
          <span className={styles.statusWorking}>
            [ EJECTING CHANNELS... ]
          </span>
        </>
      )
    }
    if (exportStatus === 'done' && exportNote) {
      return (
        <>
          <span className={`${styles.dot} ${styles.dotSuccess}`} />
          <span className={styles.statusSuccess}>
            [ EJECTED → {exportNote} ]
          </span>
        </>
      )
    }
    return (
      <>
        <span className={`${styles.dot} ${styles.dotIdle}`} />
        <span className={styles.statusIdle}>
          [ CHANNELS NOMINAL — NO OPERATION PENDING ]
        </span>
      </>
    )
  }

  return (
    <div className={styles.panel}>

      {/* ── Action row ─────────────────────────────────────────── */}
      <div className={styles.actions}>

        {/* ── Export ─────────────────────────────────────────── */}
        <div className={styles.cell}>
          <p className={styles.cellLabel}>Eject Backup</p>
          <p className={styles.cellDesc}>
            Serialise every local database table into a portable JSON archive
            and download it to your device. The file contains all habits, notes,
            calendar events, assignments, arcade data, and settings.
          </p>
          <button
            className={styles.ejectBtn}
            onClick={() => void handleExport()}
            disabled={exportStatus === 'working' || importStatus === 'working'}
            aria-busy={exportStatus === 'working'}
          >
            {exportStatus === 'working' ? '[ EJECTING... ]' : '[ EJECT LOCAL BACKUP DATA ]'}
          </button>
        </div>

        {/* ── Import ─────────────────────────────────────────── */}
        <div className={styles.cell}>
          <p className={styles.cellLabel}>Restore Archive</p>
          <p className={styles.cellDesc}>
            Load a previous Zenith OS backup file. Every local table will be
            cleared and repopulated from the archive — this is a full replace,
            not a merge. No page reload required.
          </p>
          <button
            className={styles.restoreBtn}
            onClick={triggerFilePicker}
            disabled={importStatus === 'working' || exportStatus === 'working'}
            aria-busy={importStatus === 'working'}
          >
            {importStatus === 'working'
              ? '[ RESTORING... ]'
              : '[ RESTORE ARCHIVE FROM FILE ]'}
          </button>
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleFileChange(e)}
            aria-label="Select Zenith OS backup file"
          />
        </div>

      </div>

      {/* ── Status strip ───────────────────────────────────────── */}
      <div
        className={styles.status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {renderStatus()}
      </div>

    </div>
  )
}
