/**
 * components/StravaPanel.tsx — the watch bridge, in the Cardio tab.
 *
 * Garmin has no consumer API: its Connect programme needs company
 * approval and speaks OAuth 1.0a. The watch already pushes to Strava,
 * and Strava has a public API you can register for in minutes, so that
 * is the road in.
 *
 * Four states, and each says what to do next rather than only what is
 * wrong: unconfigured (a deployment problem), disconnected (press
 * Connect), connected (press Sync), and mid-import.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/lib/ToastContext'
import { useStrava, describeCallback, type ImportSummary } from '@/lib/hooks/useStrava'
import styles from './StravaPanel.module.css'

const FULL_HISTORY_DAYS = 3650

export default function StravaPanel({ onImported }: {
  /** Banked by the parent, which owns the Vitality balance. */
  onImported: (summary: ImportSummary) => void
}) {
  const { toast } = useToast()
  const { status, importing, error, connect, disconnect, importNow } = useStrava()
  const [last, setLast] = useState<ImportSummary | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  /* The OAuth callback lands on the app root with a result in the query
     string. Report it once, then strip it so a refresh does not repeat
     the message. */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const param = q.get('strava')
    if (!param) return

    const said = describeCallback(param, q.get('reason'))
    if (said) toast(said.text, said.tone)

    q.delete('strava'); q.delete('reason')
    const rest = q.toString()
    window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))
  }, [toast])

  const runImport = useCallback(async (days?: number) => {
    const summary = await importNow(days)
    if (!summary) return
    setLast(summary)
    onImported(summary)

    if (summary.imported === 0) {
      toast(
        summary.duplicates > 0
          ? 'Already up to date.'
          : 'No new activities on Strava.',
        'info',
      )
      return
    }
    toast(
      `Imported ${summary.imported} ${summary.imported === 1 ? 'activity' : 'activities'}`
      + ` · +${summary.vitalityEarned} VP`,
      'success',
    )
  }, [importNow, onImported, toast])

  /* Errors are shown in place rather than only as a toast: a rate limit
     lasts fifteen minutes and a toast is gone in three seconds. */
  useEffect(() => {
    if (error === 'rate_limited') {
      toast('Strava is rate-limiting requests. Try again in about 15 minutes.', 'error')
    } else if (error === 'unreachable') {
      toast('Could not reach Strava.', 'error')
    } else if (error === 'upstream_failed') {
      toast('Strava refused the request.', 'error')
    }
  }, [error, toast])

  if (!status) return null

  /* ── Not set up on this deployment ─────────────────────────── */
  if (!status.configured) {
    return (
      <section className={styles.root}>
        <header className={styles.head}>
          <span className={styles.icon}><Icon name="link" size={16} /></span>
          <div>
            <h3 className={styles.title}>Watch import</h3>
            <p className={styles.sub}>Not configured on this deployment</p>
          </div>
        </header>
        <p className={styles.note}>
          Your Garmin syncs to Strava, and Strava is what Zenith reads.
          Create an app at strava.com/settings/api, then set{' '}
          <code className={styles.code}>STRAVA_CLIENT_ID</code> and{' '}
          <code className={styles.code}>STRAVA_CLIENT_SECRET</code> in your
          environment.
        </p>
      </section>
    )
  }

  /* ── Set up, not connected ─────────────────────────────────── */
  if (!status.connected) {
    return (
      <section className={styles.root}>
        <header className={styles.head}>
          <span className={styles.icon}><Icon name="link" size={16} /></span>
          <div>
            <h3 className={styles.title}>Import from your watch</h3>
            <p className={styles.sub}>Via Strava, which your Garmin already syncs to</p>
          </div>
        </header>
        <button className={styles.primaryBtn} onClick={connect}>
          <Icon name="link" size={16} />
          Connect Strava
        </button>
        <p className={styles.note}>
          Read-only, and only your activities. Zenith never posts anything
          to Strava.
        </p>
      </section>
    )
  }

  /* ── Connected ─────────────────────────────────────────────── */
  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <span className={`${styles.icon} ${styles.iconOn}`}><Icon name="check" size={16} /></span>
        <div>
          <h3 className={styles.title}>
            Strava connected{status.athleteName ? ` · ${status.athleteName}` : ''}
          </h3>
          <p className={styles.sub}>
            {last
              ? `Last sync: ${last.imported} imported`
                + (last.duplicates ? `, ${last.duplicates} already held` : '')
                + (last.skipped ? `, ${last.skipped} unusable` : '')
              : 'Runs, rides, swims and walks land in the log below'}
          </p>
        </div>
      </header>

      <div className={styles.actions}>
        <button
          className={styles.primaryBtn}
          onClick={() => void runImport()}
          disabled={importing}
        >
          <span className={importing ? styles.spin : undefined}>
            <Icon name="reset" size={16} />
          </span>
          {importing ? 'Syncing…' : 'Sync activities'}
        </button>

        <button
          className={styles.quietBtn}
          onClick={() => void runImport(FULL_HISTORY_DAYS)}
          disabled={importing}
          title="Reaches back years instead of since the last sync"
        >
          Full history
        </button>
      </div>

      {last && !last.complete && (
        <p className={styles.warn}>
          There was more history than one sync could carry. Run it again to
          continue.
        </p>
      )}

      {confirmDisconnect ? (
        <div className={styles.confirmRow}>
          <span className={styles.confirmText}>
            Disconnect? Imported sessions stay in your log.
          </span>
          <button
            className={styles.dangerBtn}
            onClick={() => { setConfirmDisconnect(false); void disconnect() }}
          >Disconnect</button>
          <button className={styles.quietBtn} onClick={() => setConfirmDisconnect(false)}>
            Keep
          </button>
        </div>
      ) : (
        <button className={styles.quietBtn} onClick={() => setConfirmDisconnect(true)}>
          Disconnect Strava
        </button>
      )}
    </section>
  )
}
