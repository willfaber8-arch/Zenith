/**
 * The delete button that asks first.
 *
 * The behaviour worth pinning is the one that made extracting this
 * worthwhile: with the pattern hand-written per component, arming a
 * second row left the first row armed too — two live triggers at once,
 * and the next click lands on whichever the hand is over. A confirmation
 * that can be satisfied by a click aimed somewhere else is not a
 * confirmation.
 */

import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ConfirmDelete from '@/components/ui/ConfirmDelete'

afterEach(cleanup)

const trigger = (name: string) => screen.getByRole('button', { name: `Delete ${name}` })
const confirmBtn = (name: string) =>
  screen.getByRole('button', { name: `Confirm deleting ${name}` })

describe('arming', () => {
  it('does not delete on the first press', () => {
    const onConfirm = jest.fn()
    render(<ConfirmDelete label="Note A" onConfirm={onConfirm} />)

    fireEvent.click(trigger('Note A'))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(confirmBtn('Note A')).toBeTruthy()
  })

  it('deletes on the second press', () => {
    const onConfirm = jest.fn()
    render(<ConfirmDelete label="Note A" onConfirm={onConfirm} />)

    fireEvent.click(trigger('Note A'))
    fireEvent.click(confirmBtn('Note A'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('can be called off, leaving nothing deleted', () => {
    const onConfirm = jest.fn()
    render(<ConfirmDelete label="Note A" onConfirm={onConfirm} />)

    fireEvent.click(trigger('Note A'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(trigger('Note A')).toBeTruthy()   // back to resting
  })

  it('disarms on Escape', () => {
    const onConfirm = jest.fn()
    render(<ConfirmDelete label="Note A" onConfirm={onConfirm} />)

    fireEvent.click(trigger('Note A'))
    fireEvent.keyDown(screen.getByRole('alert'), { key: 'Escape' })
    expect(onConfirm).not.toHaveBeenCalled()
    expect(trigger('Note A')).toBeTruthy()
  })

  it('says what else goes, when there is more than the row', () => {
    render(
      <ConfirmDelete
        label="Short Term"
        question="Its tasks become unfiled."
        onConfirm={() => {}}
      />,
    )
    fireEvent.click(trigger('Short Term'))
    expect(screen.getByText('Its tasks become unfiled.')).toBeTruthy()
  })
})

describe('only one armed at a time', () => {
  /*
   * The reason this component exists rather than three copies of the
   * pattern. Two armed rows means the confirmation no longer names one
   * target.
   */
  it('disarms the first when a second is armed', () => {
    const a = jest.fn(), b = jest.fn()
    render(
      <>
        <ConfirmDelete label="Note A" onConfirm={a} />
        <ConfirmDelete label="Note B" onConfirm={b} />
      </>,
    )

    fireEvent.click(trigger('Note A'))
    expect(confirmBtn('Note A')).toBeTruthy()

    fireEvent.click(trigger('Note B'))
    expect(confirmBtn('Note B')).toBeTruthy()
    /* A is back to resting — its confirm button is gone. */
    expect(screen.queryByRole('button', { name: 'Confirm deleting Note A' })).toBeNull()
    expect(trigger('Note A')).toBeTruthy()
  })

  it('leaves the second one working after the first disarms', () => {
    const a = jest.fn(), b = jest.fn()
    render(
      <>
        <ConfirmDelete label="Note A" onConfirm={a} />
        <ConfirmDelete label="Note B" onConfirm={b} />
      </>,
    )

    fireEvent.click(trigger('Note A'))
    fireEvent.click(trigger('Note B'))
    fireEvent.click(confirmBtn('Note B'))

    expect(b).toHaveBeenCalledTimes(1)
    expect(a).not.toHaveBeenCalled()   // the one that was disarmed stays untouched
  })
})

describe('reachability', () => {
  it('names its target for screen readers', () => {
    render(<ConfirmDelete label="Read chapter 3" onConfirm={() => {}} />)
    expect(screen.getByRole('button', { name: 'Delete Read chapter 3' })).toBeTruthy()
  })

  it('refuses to arm when disabled', () => {
    const onConfirm = jest.fn()
    render(<ConfirmDelete label="Note A" onConfirm={onConfirm} disabled />)
    fireEvent.click(trigger('Note A'))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
