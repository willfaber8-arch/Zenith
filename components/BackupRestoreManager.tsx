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
import { importJsonToLocalDatabase, inspectBackup } from '@/utils/dbImporter'
import type { ImportResult, BackupSummary }        from '@/utils/dbImporter'
import styles from './BackupRestoreManager.module.css'

/* ── Local state machine ──────────────────────────────────────── */

type ExportStatus = 'idle' | 'working' | 'done'
/*
 * `armed` exists because restoring is not an edit, it is a replacement:
 * every table is cleared before the backup is written. Choosing a file
 * used to do that immediately — the file picker's OK button was the
 * point of no return for every note, habit and event in the database,
 * and nothing said so. The file is read and described first now, and
 * the replacement waits for a second, deliberate press.
 */
type ImportStatus = 'idle' | 'armed' | 'working' | 'done' | 'error'

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

  /* The chosen file, held between reading it and being told to use it. */
  const [pending,     setPending]     = useState<BackupSummary | null>(null)
  const pendingJsonRef                = useRef<string | null>(null)

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

      setImportResult(null)
      setImportError('')

      const reader = new FileReader()
      /*
       * Reads and validates only. Nothing is written until the summary
       * below has been shown and confirmed, so a mis-picked file costs
       * a glance rather than everything.
       */
      reader.onload = () => {
        const jsonString = String(reader.result ?? '')
        try {
          const summary = inspectBackup(jsonString)
          pendingJsonRef.current = jsonString
          setPending(summary)
          setImportStatus('armed')
        } catch (err) {
          pendingJsonRef.current = null
          setPending(null)
          setImportError((err as Error).message ?? 'Could not read that file.')
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

  /** The second press: this is the one that replaces everything. */
  const confirmRestore = useCallback(async () => {
    const jsonString = pendingJsonRef.current
    if (!jsonString) return
    setImportStatus('working')
    try {
      const result = await importJsonToLocalDatabase(jsonString)
      setImportResult(result)
      setImportStatus('done')
    } catch (err) {
      setImportError((err as Error).message ?? 'Restore failed — unknown error.')
      setImportStatus('error')
    } finally {
      pendingJsonRef.current = null
      setPending(null)
    }
  }, [])

  const cancelRestore = useCallback(() => {
    pendingJsonRef.current = null
    setPending(null)
    setImportStatus('idle')
  }, [])

  const triggerFilePicker = useCallback(() => {
    if (importStatus === 'working') return
    if (importStatus === 'armed') return
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
            Restoring…
          </span>
        </>
      )
    }
    if (importStatus === 'done' && importResult) {
      return (
        <>
          <span className={`${styles.dot} ${styles.dotSuccess}`} />
          <span className={styles.statusSuccess}>
            Archive restored — {importResult.restoredTables.length} table{importResult.restoredTables.length !== 1 ? 's' : ''} · {importResult.totalRowsWritten.toLocaleString()} rows
          </span>
        </>
      )
    }
    if (importStatus === 'error') {
      return (
        <>
          <span className={`${styles.dot} ${styles.dotError}`} />
          <span className={styles.statusError}>
            Restore failed — {importError}
          </span>
        </>
      )
    }
    if (exportStatus === 'working') {
      return (
        <>
          <span className={`${styles.dot} ${styles.dotWorking}`} />
          <span className={styles.statusWorking}>
            Exporting…
          </span>
        </>
      )
    }
    if (exportStatus === 'done' && exportNote) {
      return (
        <>
          <span className={`${styles.dot} ${styles.dotSuccess}`} />
          <span className={styles.statusSuccess}>
            Backup saved → {exportNote}
          </span>
        </>
      )
    }
    return (
      <>
        <span className={`${styles.dot} ${styles.dotIdle}`} />
        <span className={styles.statusIdle}>
          Ready
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
          <p className={styles.cellLabel}>Export</p>
          <p className={styles.cellDesc}>
            Download all your data — habits, notes, calendar, assignments, and
            settings — as a single JSON file.
          </p>
          <button
            className={styles.ejectBtn}
            onClick={() => void handleExport()}
            disabled={exportStatus === 'working' || importStatus === 'working'}
            aria-busy={exportStatus === 'working'}
          >
            {exportStatus === 'working' ? 'Exporting…' : 'Export Backup'}
          </button>
        </div>

        {/* ── Import ─────────────────────────────────────────── */}
        <div className={styles.cell}>
          <p className={styles.cellLabel}>Restore</p>
          <p className={styles.cellDesc}>
            Load a previous backup file. This fully replaces your current data,
            not a merge.
          </p>
          <button
            className={styles.restoreBtn}
            onClick={triggerFilePicker}
            disabled={importStatus === 'working' || exportStatus === 'working'}
            aria-busy={importStatus === 'working'}
          >
            {importStatus === 'working'
              ? 'Restoring…'
              : importStatus === 'armed'
                ? 'Waiting for confirmation…'
                : 'Restore from File'}
          </button>
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleFileChange(e)}
            aria-label="Select Zenith backup file"
          />
        </div>

      </div>

      {/* ── The confirmation ───────────────────────────────────
          Both halves of the trade are named: what is in the file, and
          that everything currently here goes. A warning that does not
          say what you are losing is a warning you click through. */}
      {importStatus === 'armed' && pending && (
        <div className={styles.confirmPanel} role="alertdialog" aria-label="Confirm restore">
          <p className={styles.confirmTitle}>Replace everything with this backup?</p>
          <p className={styles.confirmBody}>
            Taken {new Date(pending.exportedAt).toLocaleString()} ·{' '}
            {pending.rowCount.toLocaleString()} rows across {pending.tableCount}{' '}
            {pending.tableCount === 1 ? 'table' : 'tables'}
            {pending.largest.length > 0 && (
              <> — largest: {pending.largest.map(t => `${t.name} (${t.rows})`).join(', ')}</>
            )}
          </p>
          <p className={styles.confirmWarn}>
            Everything currently in Zenith is cleared first. This cannot be undone,
            so export a backup of what you have now if you might want it back.
          </p>
          <div className={styles.confirmActions}>
            <button className={styles.confirmYes} onClick={() => void confirmRestore()}>
              Replace everything
            </button>
            <button className={styles.confirmNo} onClick={cancelRestore}>
              Cancel
            </button>
          </div>
        </div>
      )}

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
