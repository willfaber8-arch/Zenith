'use client'

/**
 * components/CloudSyncBanner.tsx — when sync needs the user, it says so here.
 *
 * Shown at the top of every screen, phone and desktop, and only when one
 * of the safeguards in services/cloudSnapshot.ts has stopped sync (or the
 * cloud has newer changes waiting). It never offers the one thing that
 * could expose data: uploading one account's workspace into another's.
 *
 * Every decision here is about which copy of someone's data survives, so
 * the banner is written to be impossible to misread:
 *
 *   · It shows what each version holds — notes, tasks, habits, events —
 *     and when it last changed, side by side, so the choice is made on
 *     contents rather than on a device name.
 *   · Each choice carries a sentence saying exactly what it replaces and
 *     what it keeps, in the style of the Settings panel's Save/Load cells.
 *   · A choice that replaces anything asks once more, in place, naming
 *     what will be replaced ("Replace … with …?"), before it runs. The
 *     same in-place confirm the rest of Zenith uses (ConfirmDelete), not
 *     a dialog on top of the banner.
 *   · There is always a way to decide later that changes nothing.
 */

import { useEffect, useState } from 'react'
import { useCloudSync } from '@/lib/CloudSyncContext'
import { reloadPage } from '@/lib/reloadPage'
import { getSnapshotMeta, localDataSummary, type DataSummary, type SyncBlock } from '@/services/cloudSnapshot'
import { relativeTime } from '@/utils/relativeTime'
import styles from './CloudSyncBanner.module.css'

interface Choice {
  label:    string
  /** What this choice overwrites — shown as "Replaces: …". */
  replaces?: string
  /** What survives it, and where — shown as "Keeps: …". */
  keeps?:    string
  /** For a choice that changes nothing: says so plainly. */
  what?:     string
  run:      () => void | Promise<unknown>
  primary?: boolean
  /** Set on a choice that replaces data: the question asked before it runs… */
  confirm?: string
  /** …and the button that answers it. */
  yes?:     string
}

interface Side {
  heading: string
  summary: DataSummary | null | undefined
  when:    string
  /** Shown instead of counts when there is no such copy at all. */
  none?:   string
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`

/** "12 notes · 48 tasks · 9 habits · 130 events" */
export function describeSummary(s: DataSummary | null | undefined): string {
  if (s === undefined) return 'Counting…'
  if (s === null) return 'Contents not recorded — saved by an older version of Zenith'
  return [
    plural(s.notes, 'note'), plural(s.tasks, 'task'),
    plural(s.habits, 'habit'), plural(s.events, 'event'),
  ].join(' · ')
}

function Explain({ choice }: { choice: Choice }) {
  if (choice.what) return <p className={styles.choiceWhat}>{choice.what}</p>
  return (
    <div className={styles.choiceWhat}>
      {choice.replaces && (
        <p className={styles.line}><span className={styles.replaces}>Replaces</span>{choice.replaces}</p>
      )}
      {choice.keeps && (
        <p className={styles.line}><span className={styles.keeps}>Keeps</span>{choice.keeps}</p>
      )}
    </div>
  )
}

export default function CloudSyncBanner() {
  const sync = useCloudSync()
  const [hiddenFor, setHiddenFor] = useState<string | null>(null)
  const [armed, setArmed]         = useState<string | null>(null)
  const [local, setLocal]         = useState<DataSummary | null | undefined>(undefined)

  const key: string | null = sync.blocked ?? (sync.updateReady ? 'update' : null)

  /* A new situation always shows, even if an earlier one was dismissed,
     and never inherits a half-made confirmation from the last one. */
  useEffect(() => {
    if (key !== hiddenFor) setHiddenFor(null)
    setArmed(null)
  }, [key])   // eslint-disable-line react-hooks/exhaustive-deps

  /* What is on this device — counted when a decision appears, and kept
     current while it is on screen, so the numbers beside the choices are
     never the numbers from before the last edit. */
  useEffect(() => {
    if (!key) return
    let live = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const count = () => { void localDataSummary().then(s => { if (live) setLocal(s) }) }
    const soon  = () => { if (timer) clearTimeout(timer); timer = setTimeout(count, 400) }
    setLocal(undefined)
    count()
    /* The change event is throttled; the interval catches a burst's tail. */
    window.addEventListener('zenith:db-changed', soon)
    const every = setInterval(count, 4_000)
    return () => {
      live = false
      if (timer) clearTimeout(timer)
      clearInterval(every)
      window.removeEventListener('zenith:db-changed', soon)
    }
  }, [key, sync.remoteMeta?.updatedAt])

  if (!sync.available || !key || hiddenFor === key) return null

  const other  = sync.remoteMeta?.deviceLabel ?? 'your other device'
  const busy   = sync.pushing || sync.pulling
  const hide   = () => setHiddenFor(key)
  const remote = sync.remoteMeta?.summary
  const changedHere = getSnapshotMeta().lastLocalChangeAt

  const thisDevice: Side = {
    heading: 'This device',
    summary: local,
    when:    changedHere != null ? `Changed here ${relativeTime(changedHere)}` : 'No unsaved changes',
  }
  const hasCloudCopy = sync.remoteMeta != null
  const cloud: Side = {
    heading: `${other} (in the cloud)`,
    summary: remote,
    when:    `Saved ${relativeTime(sync.remoteMeta?.updatedAt ?? null)}`,
    none:    hasCloudCopy ? undefined : 'Nothing saved in the cloud yet',
  }

  const copy: Record<SyncBlock | 'update', { title: string; body: string; sides?: [Side, Side]; choices: Choice[] } | null> = {
    conflict: {
      title: 'Both devices changed since they last synced',
      body:  `This device and ${other} each have changes the other hasn’t seen. Nothing has been saved or loaded — ` +
             'sync is paused until you choose which version to keep.',
      sides: [thisDevice, cloud],
      choices: [
        {
          label: 'Keep this device’s version',
          replaces: `${other}’s version in the cloud. Your other devices switch to this one next time they open Zenith.`,
          keeps:    `${other}’s version, as a safety copy on this device.`,
          run:     sync.keepThisDevice,
          primary: true,
          confirm: `Replace ${other}’s changes with this device’s?`,
          yes:     'Yes, keep this device’s',
        },
        {
          label: `Keep ${other}’s version`,
          replaces: 'The changes made on this device. The page reloads.',
          keeps:    'This device’s version, as a safety copy on this device.',
          run:     sync.keepCloud,
          confirm: `Replace this device’s changes with ${other}’s?`,
          yes:     `Yes, keep ${other}’s`,
        },
        {
          label: 'Decide later',
          what:  'Changes nothing. Sync stays paused, so anything you do here stays on this device until you choose.',
          run:   hide,
        },
      ],
    },
    'account-mismatch': {
      title: 'This device’s data belongs to a different account',
      body:  'You’re signed in to a different account from the one this device last synced with. ' +
             'Sync is paused in both directions so the two accounts’ data never mix.' +
             (hasCloudCopy ? '' : ' This account has nothing saved in the cloud yet, so there is nothing to load.'),
      sides: [
        { ...thisDevice, heading: 'This device (the other account’s data)' },
        { ...cloud, heading: 'This account’s copy in the cloud' },
      ],
      choices: [
        ...(hasCloudCopy ? [{
          label: 'Load this account’s data',
          replaces: 'Everything on this device, with the copy saved in the account you’re signed in to now. Nothing is uploaded.',
          keeps:    'The other account’s data, as a safety copy on this device.',
          run:     sync.useAccountData,
          primary: true,
          confirm: 'Replace the other account’s data on this device with this account’s?',
          yes:     'Yes, load this account’s data',
        }] : []),
        {
          label: 'Keep sync off',
          what:  'Changes nothing. This device keeps its data, nothing is uploaded or loaded, and sync stays paused ' +
                 'while you’re signed in to this account. Sign back in to the other account to sync it again.',
          run:   hide,
        },
      ],
    },
    'outdated-app': {
      title: 'This copy of Zenith is out of date',
      body:  'Your data was last saved by a newer version of Zenith, so this one won’t save over it.',
      choices: [
        {
          label: 'Reload',
          what:  'Loads the newest Zenith. Nothing on this device or in the cloud is changed or lost.',
          run:     () => reloadPage(),
          primary: true,
        },
      ],
    },
    'mass-deletion': {
      title: 'Most of your data is missing on this device',
      body:  'Compared with your last sync, most of it is gone here — as if browser storage was cleared. ' +
             'It has not been saved to the cloud, so your other devices still have everything.',
      sides: [
        { ...thisDevice, heading: 'This device now' },
        { ...cloud, heading: 'Your last cloud copy' },
      ],
      choices: [
        {
          label: 'Bring it back from the cloud',
          replaces: 'What’s left on this device, with your last cloud copy. The page reloads.',
          keeps:    'What’s here now, as a safety copy on this device.',
          run:     sync.keepCloud,
          primary: true,
          confirm: 'Replace what’s on this device with your last cloud copy?',
          yes:     'Yes, bring it back',
        },
        {
          label: 'I deleted it on purpose — save',
          replaces: 'Your fuller copy in the cloud. Your other devices switch to the smaller one next time they open Zenith.',
          keeps:    'The fuller copy, as a safety copy on this device.',
          run:     sync.confirmShrink,
          confirm: 'Replace your fuller cloud copy with this smaller one?',
          yes:     'Yes, save the smaller copy',
        },
        {
          label: 'Decide later',
          what:  'Changes nothing. Nothing is uploaded, and sync stays paused until you choose.',
          run:   hide,
        },
      ],
    },
    'no-backup': {
      title: 'Couldn’t make a safety copy',
      body:  'Zenith keeps a copy of whatever it is about to replace, and this time it couldn’t save one — ' +
             'storage may be full. Nothing has been changed. Deleting old copies in Settings → Local snapshots frees space.',
      sides: [thisDevice, cloud],
      choices: [
        {
          label: `Load ${other}’s version without a safety copy`,
          replaces: 'Everything on this device, with the cloud copy.',
          keeps:    'Nothing. There is no copy to go back to — anything only on this device is lost.',
          run:     sync.loadAnyway,
          confirm: 'Replace this device’s data with no way to undo it?',
          yes:     'Yes, load without a safety copy',
        },
        {
          label: 'Not now',
          what:  'Changes nothing. Free some space and Zenith will try again with a safety copy.',
          run:   hide,
        },
      ],
    },
    busy: null,
    update: {
      title: `Newer changes from ${other}`,
      body:  'This device has nothing unsaved, so loading them loses nothing.',
      sides: [thisDevice, cloud],
      choices: [
        {
          label: 'Load now',
          replaces: `What’s on this device, with ${other}’s newer copy. The page reloads.`,
          keeps:    'This device’s version, as a safety copy on this device.',
          run:     sync.loadNow,
          primary: true,
        },
        {
          label: 'Not now',
          what:  'Changes nothing. The newer copy loads automatically the next time you open Zenith.',
          run:   hide,
        },
      ],
    },
  }

  const c = copy[key as SyncBlock | 'update']
  if (!c) return null

  const pending = c.choices.find(ch => ch.label === armed && ch.confirm)

  return (
    <div className={`${styles.banner} ${key === 'update' ? styles.info : styles.warn}`} role="alert">
      <div className={styles.text}>
        <p className={styles.title}>{c.title}</p>
        <p className={styles.body}>{c.body}</p>
      </div>

      {c.sides && (
        <div className={styles.sides} aria-label="What each version holds">
          {c.sides.map(side => (
            <div key={side.heading} className={styles.side}>
              <p className={styles.sideHeading}>{side.heading}</p>
              <p className={styles.sideSummary}>{side.none ?? describeSummary(side.summary)}</p>
              {!side.none && <p className={styles.sideWhen}>{side.when}</p>}
            </div>
          ))}
        </div>
      )}

      {pending ? (
        <div className={styles.confirm} role="group" aria-label="Confirm">
          <p className={styles.confirmQ}>{pending.confirm}</p>
          <Explain choice={pending} />
          <div className={styles.confirmBtns}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => { setArmed(null); void pending.run() }}
              disabled={busy}
            >
              {pending.yes ?? 'Yes'}
            </button>
            <button type="button" className={styles.btn} onClick={() => setArmed(null)} disabled={busy}>
              Go back
            </button>
          </div>
        </div>
      ) : (
        <ul className={styles.choices}>
          {c.choices.map(ch => (
            <li key={ch.label} className={styles.choice}>
              <button
                type="button"
                className={`${styles.btn} ${ch.primary ? styles.btnPrimary : ''}`}
                onClick={() => (ch.confirm ? setArmed(ch.label) : void ch.run())}
                disabled={busy}
              >
                {ch.label}
              </button>
              <Explain choice={ch} />
            </li>
          ))}
        </ul>
      )}

      {c.choices.some(ch => ch.keeps && !/^Nothing/.test(ch.keeps)) && (
        <p className={styles.footnote}>Safety copies are in Settings → Local snapshots, where any of them can be restored.</p>
      )}
    </div>
  )
}
