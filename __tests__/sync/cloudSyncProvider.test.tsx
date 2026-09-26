/**
 * Cloud sync running by itself — the provider and its banner.
 *
 * The service tests (cloudSafety.test.ts) prove each safeguard in
 * isolation. These prove the app actually uses them without anyone
 * pressing a button: it loads a newer copy on opening, saves when you
 * leave, and stops and asks — on screen — whenever a safeguard trips.
 */

import { cloud, resetCloud } from './fakeCloud'
jest.mock('@/lib/supabase', () => require('./fakeCloud').supabaseModule)
jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ session: { sessionToken: 't', userHandle: 'Will' }, isReady: true }),
}))
jest.mock('@/lib/ToastContext', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('@/lib/reloadPage', () => ({ reloadPage: jest.fn() }))

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { db } from '@/lib/db'
import { CloudSyncProvider } from '@/lib/CloudSyncContext'
import CloudSyncBanner from '@/components/CloudSyncBanner'
import CloudSyncDot from '@/components/CloudSyncDot'
import { pushSnapshot, setSnapshotMeta, getSnapshotMeta } from '@/services/cloudSnapshot'

import { reloadPage } from '@/lib/reloadPage'
const reload = reloadPage as jest.Mock

const addNote = (title: string) =>
  db.quickNotes.add({ title, body: '', category: 'idea', createdAt: 1, updatedAt: 1 } as never)
const notes = async () => (await db.quickNotes.toArray()).map(n => n.title).sort()
const cloudNotes = () =>
  ((cloud.row?.payload as { tables: { quickNotes: { title: string }[] } } | undefined)
    ?.tables.quickNotes ?? []).map(n => n.title).sort()

function otherDeviceWrites(titles: string[]) {
  cloud.row = {
    user_id: cloud.signedIn!, device_label: 'Safari · iOS', schema_version: db.verno,
    payload: { version: 2, exportedAt: 1, schemaVersion: db.verno,
      tables: { quickNotes: titles.map((t, i) => ({ id: 100 + i, title: t, body: '', category: 'idea', createdAt: 1, updatedAt: 1 })) } },
    updated_at: cloud.stamp(),
  }
}

function mount() {
  return render(
    <CloudSyncProvider>
      <CloudSyncDot />
      <CloudSyncBanner />
    </CloudSyncProvider>,
  )
}

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  await db.quickNotes.clear()
  await db.db_snapshots.clear()
  await db.userProfile.clear()
  resetCloud()
  reload.mockClear()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

it('opening the app loads a newer copy from the other device, keeping a safety copy first', async () => {
  await addNote('laptop'); await pushSnapshot()
  otherDeviceWrites(['laptop', 'added on the phone'])

  mount()

  await waitFor(() => expect(reload).toHaveBeenCalled())
  expect(await notes()).toEqual(['added on the phone', 'laptop'])
  expect((await db.db_snapshots.toArray()).some(s => s.kind === 'before-cloud-load')).toBe(true)
})

it('leaving the app saves what changed, without anyone pressing anything', async () => {
  await addNote('one'); await pushSnapshot()
  mount()
  await waitFor(() => expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'In step with the cloud'))

  await addNote('added then left'); setSnapshotMeta({ lastLocalChangeAt: Date.now() })
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })

  await waitFor(() => expect(cloudNotes()).toEqual(['added then left', 'one']))
  expect(getSnapshotMeta().lastLocalChangeAt).toBeNull()
})

it('when both devices changed, it saves and loads nothing and asks which to keep', async () => {
  await addNote('laptop'); await pushSnapshot()
  otherDeviceWrites(['phone version'])
  await addNote('laptop edit'); setSnapshotMeta({ lastLocalChangeAt: Date.now() })

  mount()

  expect(await screen.findByText('Both devices changed since they last synced')).toBeInTheDocument()
  expect(reload).not.toHaveBeenCalled()
  expect(cloudNotes()).toEqual(['phone version'])
  expect(await notes()).toEqual(['laptop', 'laptop edit'])
  expect(screen.getByRole('status')).toHaveAttribute('aria-label', expect.stringContaining('paused'))

  fireEvent.click(screen.getByRole('button', { name: 'Keep this device’s version' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Yes, keep this device’s' }))

  await waitFor(() => expect(cloudNotes()).toEqual(['laptop', 'laptop edit']))
  const aside = (await db.db_snapshots.toArray()).filter(s => s.kind === 'cloud-copy')
  expect(aside[0].payload).toContain('phone version')
  await waitFor(() => expect(screen.queryByText('Both devices changed since they last synced')).toBeNull())
})

it('choosing the other device’s version keeps this one’s as a safety copy', async () => {
  await addNote('laptop'); await pushSnapshot()
  otherDeviceWrites(['phone version'])
  await addNote('laptop edit'); setSnapshotMeta({ lastLocalChangeAt: Date.now() })

  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Keep Safari · iOS’s version' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Yes, keep Safari · iOS’s' }))

  await waitFor(() => expect(reload).toHaveBeenCalled())
  expect(await notes()).toEqual(['phone version'])
  const kept = (await db.db_snapshots.toArray()).filter(s => s.kind === 'before-cloud-load')
  expect(kept[0].payload).toContain('laptop edit')
})

it('nothing is replaced until the choice is confirmed, and going back changes nothing', async () => {
  await addNote('laptop'); await pushSnapshot()
  otherDeviceWrites(['phone version'])
  await addNote('laptop edit'); setSnapshotMeta({ lastLocalChangeAt: Date.now() })
  const before = cloud.row!.updated_at

  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Keep this device’s version' }))

  /* The question names what is about to be replaced… */
  expect(screen.getByText('Replace Safari · iOS’s changes with this device’s?')).toBeInTheDocument()
  await act(async () => { await new Promise(r => setTimeout(r, 50)) })
  /* …and nothing has happened yet. */
  expect(cloud.row!.updated_at).toBe(before)
  expect(cloudNotes()).toEqual(['phone version'])

  fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
  expect(screen.getByRole('button', { name: 'Keep this device’s version' })).toBeInTheDocument()
  await act(async () => { await new Promise(r => setTimeout(r, 50)) })
  expect(cloudNotes()).toEqual(['phone version'])
  expect(await notes()).toEqual(['laptop', 'laptop edit'])
  expect(reload).not.toHaveBeenCalled()
})

it('shows what each version holds before asking, and every choice says what it does', async () => {
  await addNote('laptop'); await pushSnapshot()                 // cloud copy recorded as 1 note
  otherDeviceWrites(['p1', 'p2', 'p3'])                         // written by the "phone"
  ;(cloud.row!.payload as Record<string, unknown>).summary = { notes: 3, tasks: 0, habits: 0, events: 0 }
  await addNote('laptop edit'); setSnapshotMeta({ lastLocalChangeAt: Date.now() })

  mount()

  expect(await screen.findByText('2 notes · 0 tasks · 0 habits · 0 events')).toBeInTheDocument()
  expect(screen.getByText('3 notes · 0 tasks · 0 habits · 0 events')).toBeInTheDocument()
  expect(screen.getByText(/Changes nothing\. Sync stays paused/)).toBeInTheDocument()
  expect(screen.getAllByText(/as a safety copy on this device/)).toHaveLength(2)   // both replacing choices say what they keep

  fireEvent.click(screen.getByRole('button', { name: 'Decide later' }))
  await waitFor(() => expect(screen.queryByText('Both devices changed since they last synced')).toBeNull())
  expect(cloudNotes()).toEqual(['p1', 'p2', 'p3'])
})

it('a copy saved before counts were recorded says so, instead of showing zeros', async () => {
  await addNote('laptop'); await pushSnapshot()
  otherDeviceWrites(['phone version'])                          // no summary on this one
  await addNote('laptop edit'); setSnapshotMeta({ lastLocalChangeAt: Date.now() })

  mount()
  expect(await screen.findByText(/Contents not recorded/)).toBeInTheDocument()
})

it('another account on this browser: sync pauses, nothing crosses, and only loading is offered', async () => {
  await addNote('A’s note'); await pushSnapshot()          // belongs to user-A now
  resetCloud('user-B')
  setSnapshotMeta({ lastLocalChangeAt: Date.now() })

  mount()

  expect(await screen.findByText('This device’s data belongs to a different account')).toBeInTheDocument()
  expect(cloud.row).toBeNull()                              // nothing of A's pushed into B
  expect(screen.queryByRole('button', { name: /upload|save/i })).toBeNull()
  /* Account B has nothing in the cloud: nothing to load is offered, and it says why. */
  expect(screen.queryByRole('button', { name: 'Load this account’s data' })).toBeNull()
  expect(screen.getByText('Nothing saved in the cloud yet')).toBeInTheDocument()
})

it('does nothing at all when cloud sync is not available', async () => {
  resetCloud(null)                                          // offline-only session
  await addNote('local only')
  mount()
  await act(async () => { await new Promise(r => setTimeout(r, 50)) })
  expect(screen.queryByRole('status')).toBeNull()           // no dot
  expect(screen.queryByRole('alert')).toBeNull()            // no banner
  expect(cloud.row).toBeNull()
})
