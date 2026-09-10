/**
 * The crash screen's destructive button asks first.
 *
 * It used to be one unguarded press labelled "Flush State & Restart",
 * sitting under the sentence "Your locally stored data is intact" — a
 * button that deletes every note, task, habit and calendar entry, on a
 * card that had just promised the opposite, with no backup offered and
 * no way back.
 */

import { render, screen, fireEvent } from '@testing-library/react'

import ErrorBoundary from '@/components/ErrorBoundary'

/* A child that throws on demand, so the boundary has something to catch. */
function Boom({ crash }: { crash: boolean }) {
  if (crash) throw new Error('deliberate test crash')
  return <p>all fine</p>
}

/** Crash twice, which is what escalates to the destructive path. */
function escalate() {
  const view = render(<ErrorBoundary><Boom crash /></ErrorBoundary>)
  fireEvent.click(screen.getByRole('button', { name: /Reinitialize/i }))
  fireEvent.click(screen.getByRole('button', { name: /Reinitialize/i }))
  return view
}

describe('ErrorBoundary recovery card', () => {
  const realError = console.error
  beforeAll(() => { console.error = () => {} })  // React logs every caught crash
  afterAll(()  => { console.error = realError })

  it('renders its children when nothing throws', () => {
    render(<ErrorBoundary><Boom crash={false} /></ErrorBoundary>)
    expect(screen.getByText('all fine')).toBeInTheDocument()
  })

  it('offers a backup before it offers to delete anything', () => {
    escalate()
    expect(screen.getByRole('button', { name: /Download a backup first/i })).toBeInTheDocument()
  })

  it('does not delete on the first press', () => {
    escalate()
    fireEvent.click(screen.getByRole('button', { name: /^Delete my local data$/i }))
    expect(screen.getByRole('button', { name: /Delete everything permanently/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Keep my data/i })).toBeInTheDocument()
  })

  it('can be called off', () => {
    escalate()
    fireEvent.click(screen.getByRole('button', { name: /^Delete my local data$/i }))
    fireEvent.click(screen.getByRole('button', { name: /Keep my data/i }))
    expect(screen.queryByRole('button', { name: /Delete everything permanently/i })).toBeNull()
    expect(screen.getByRole('button', { name: /^Delete my local data$/i })).toBeInTheDocument()
  })

  it('never claims the data is intact next to the button that deletes it', () => {
    escalate()
    expect(screen.queryByText(/Your locally stored data is intact/i)).toBeNull()
    expect(screen.getByText(/every note, task, habit and calendar entry/i)).toBeInTheDocument()
  })
})
