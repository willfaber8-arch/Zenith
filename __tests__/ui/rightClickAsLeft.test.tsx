/**
 * Right-click acts as a left click — except where a right-click is wanted.
 */
import { render, screen, act } from '@testing-library/react'
import { useState } from 'react'
import {
  shouldActAsLeftClick, isEditableTarget, installRightClickAsLeft,
  saveRightClickMode, RIGHT_CLICK_KEY, type RightClickFacts,
} from '@/lib/rightClickAsLeft'

const base: RightClickFacts = {
  enabled: true, defaultPrevented: false, shiftKey: false,
  pointerType: 'mouse', editable: false, onSelection: false,
}

describe('the decision', () => {
  it('a plain mouse right-click becomes a click', () => {
    expect(shouldActAsLeftClick(base)).toBe(true)
  })
  it.each<[string, Partial<RightClickFacts>]>([
    ['switched off',                         { enabled: false }],
    ['a component already handled it',       { defaultPrevented: true }],
    ['Shift is held',                        { shiftKey: true }],
    ['a touchscreen long-press',             { pointerType: 'touch' }],
    ['a pen',                                { pointerType: 'pen' }],
    ['the keyboard menu key (no pointer)',   { pointerType: null }],
    ['a text field',                         { editable: true }],
    ['selected text',                        { onSelection: true }],
  ])('leaves it alone when %s', (_, patch) => {
    expect(shouldActAsLeftClick({ ...base, ...patch })).toBe(false)
  })
})

describe('what counts as a place to type', () => {
  it('text inputs, text areas, selects and editable notes', () => {
    const make = (html: string) => { document.body.innerHTML = html; return document.body.firstElementChild! }
    expect(isEditableTarget(make('<input type="text">'))).toBe(true)
    expect(isEditableTarget(make('<input>'))).toBe(true)
    expect(isEditableTarget(make('<textarea></textarea>'))).toBe(true)
    expect(isEditableTarget(make('<select></select>'))).toBe(true)
    const ce = make('<div contenteditable="true"><p><b>x</b></p></div>')
    expect(isEditableTarget(ce.querySelector('b'))).toBe(true)
    expect(isEditableTarget(make('<input type="checkbox">'))).toBe(false)
    expect(isEditableTarget(make('<button>x</button>'))).toBe(false)
  })
})

/* ── the listener, with real React handlers ────────────────────────── */

function press(el: Element, pointerType = 'mouse') {
  const pd = new Event('pointerdown', { bubbles: true })
  Object.defineProperty(pd, 'pointerType', { value: pointerType })
  el.dispatchEvent(pd)
  const cm = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })
  el.dispatchEvent(cm)
  return cm
}

function Board({ onClick }: { onClick: () => void }) {
  const [flags, setFlags] = useState(0)
  return (
    <>
      <button onClick={onClick}>Save</button>
      {/* The Minesweeper pattern: right-click means something here. */}
      <button
        onClick={onClick}
        onContextMenu={e => { e.preventDefault(); setFlags(f => f + 1) }}
      >Cell</button>
      <span data-testid="flags">{flags}</span>
      <input aria-label="Title" onClick={onClick} />
    </>
  )
}

let uninstall: () => void
beforeEach(() => { localStorage.clear(); uninstall = installRightClickAsLeft(window) })
afterEach(() => uninstall())

it('a right-click on a button presses it', () => {
  const onClick = jest.fn()
  render(<Board onClick={onClick} />)
  const cm = press(screen.getByText('Save'))
  expect(onClick).toHaveBeenCalledTimes(1)
  expect(cm.defaultPrevented).toBe(true)                // no browser menu
})

it('where right-click means something (Minesweeper flags), it keeps meaning it', () => {
  const onClick = jest.fn()
  render(<Board onClick={onClick} />)
  act(() => { press(screen.getByText('Cell')) })
  expect(screen.getByTestId('flags').textContent).toBe('1')
  expect(onClick).not.toHaveBeenCalled()                // not also revealed
})

it('a text field keeps the browser menu, for paste', () => {
  const onClick = jest.fn()
  render(<Board onClick={onClick} />)
  const cm = press(screen.getByLabelText('Title'))
  expect(onClick).not.toHaveBeenCalled()
  expect(cm.defaultPrevented).toBe(false)
})

it('a touchscreen long-press is left alone', () => {
  const onClick = jest.fn()
  render(<Board onClick={onClick} />)
  press(screen.getByText('Save'), 'touch')
  expect(onClick).not.toHaveBeenCalled()
})

it('switching it off in Settings takes effect at once, and is remembered', () => {
  const onClick = jest.fn()
  render(<Board onClick={onClick} />)
  act(() => saveRightClickMode('native'))
  const cm = press(screen.getByText('Save'))
  expect(onClick).not.toHaveBeenCalled()
  expect(cm.defaultPrevented).toBe(false)
  expect(localStorage.getItem(RIGHT_CLICK_KEY)).toBe('native')
})
