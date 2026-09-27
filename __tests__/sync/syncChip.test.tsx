/**
 * The old per-item sync chip only appears while changes are stuck.
 *
 * It used to sit in the top bar permanently ("saved", "local", "queue")
 * beside the whole-workspace sync dot — two sync icons that could say
 * different things. Now it shows only when the uploader stalled with
 * rows still waiting, and stays through the retry until they are sent.
 */
let mockStatus = 'SAVED_LOCALLY'
jest.mock('@/lib/SyncContext', () => ({
  useSyncStatus: () => ({ status: mockStatus, triggerSync: jest.fn() }),
}))

import { render, screen, act } from '@testing-library/react'
import { db } from '@/lib/db'
import { useSyncChipVisible } from '@/components/SyncIndicator'

function Probe() {
  return <span data-testid="chip">{useSyncChipVisible() ? 'shown' : 'hidden'}</span>
}
const chip = () => screen.getByTestId('chip').textContent
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 30)) })

beforeEach(async () => {
  mockStatus = 'SAVED_LOCALLY'
  await db.pendingSyncQueue.clear()
  await db.outboxMutations.clear()
})

async function stage(status: string) {
  mockStatus = status
  view.rerender(<Probe />)
  await settle()
}
let view: ReturnType<typeof render>

it('stays hidden in every ordinary state', async () => {
  view = render(<Probe />); await settle()
  for (const s of ['SAVED_LOCALLY', 'SYNCING', 'CLOUD_SYNCHRONIZED']) {
    await stage(s); expect(chip()).toBe('hidden')
  }
})

it('going offline with nothing waiting is not news', async () => {
  view = render(<Probe />); await settle()
  await stage('OFFLINE_QUEUED')
  expect(chip()).toBe('hidden')
})

it('shows while changes are stuck, stays through the retry, and goes once they are sent', async () => {
  await db.outboxMutations.put({ id: 'm1', tableName: 'habits', action: 'UPDATE',
    payload: {}, timestamp: 1, updatedAt: '' } as never)
  view = render(<Probe />); await settle()

  await stage('SYNCING')                       // the ordinary upload after an edit
  expect(chip()).toBe('hidden')

  await stage('OFFLINE_QUEUED')                // it could not send
  expect(chip()).toBe('shown')

  await stage('SYNCING')                       // retrying — no blink off and on
  expect(chip()).toBe('shown')

  await act(async () => { await db.outboxMutations.clear() })
  await stage('CLOUD_SYNCHRONIZED')
  expect(chip()).toBe('hidden')
})
