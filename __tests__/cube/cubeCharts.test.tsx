/**
 * Reading individual solves off the chart, and the personal scoreboard.
 *
 * Both are read-only views over solves the timer already recorded; these
 * tests pin what they show and that they hand the right solve back to the
 * timer when one is picked.
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import CubeStatsChart from '@/components/CubeStatsChart'
import CubeScoreboard, { type ScoreSolve } from '@/components/CubeScoreboard'

const T0 = new Date(2026, 8, 20, 15, 30).getTime()
const solve = (i: number, secs: number, penalty: ScoreSolve['penalty'] = 'OK'): ScoreSolve => ({
  id: `s${i}`, timeMs: secs * 1000, penalty, createdAt: T0 + i * 60_000, puzzle: '333',
})
const SOLVES = [12.5, 11.2, 13.9, 10.4, 12.0, 11.8, 9.87, 12.2].map((t, i) => solve(i, t))

beforeEach(() => localStorage.clear())

describe('reading a solve off the chart', () => {
  async function mountChart(extra: Partial<Parameters<typeof CubeStatsChart>[0]> = {}) {
    const onSelect = jest.fn()
    render(<CubeStatsChart solves={SOLVES} onSelect={onSelect} {...extra} />)
    await act(async () => {})                              // client mount
    return { onSelect, plot: screen.getByRole('group') }
  }

  it('focusing the chart shows the latest solve; arrows move solve by solve', async () => {
    const { plot } = await mountChart()
    fireEvent.focus(plot)
    expect(screen.getByText('Solve #8')).toBeInTheDocument()
    expect(screen.getByText('12.20')).toBeInTheDocument()

    fireEvent.keyDown(plot, { key: 'ArrowLeft' })
    expect(screen.getByText('Solve #7')).toBeInTheDocument()
    expect(screen.getByText('9.87')).toBeInTheDocument()
    expect(screen.getByText('best')).toBeInTheDocument()      // the fastest on the chart

    fireEvent.keyDown(plot, { key: 'Home' })
    expect(screen.getByText('Solve #1')).toBeInTheDocument()
  })

  it('shows the ao5 and ao12 ending at that solve, and when it happened', async () => {
    const { plot } = await mountChart()
    fireEvent.focus(plot)
    expect(screen.getByText(/ao5 11\.40/)).toBeInTheDocument()   // 10.40, 12.00, 11.80 once 9.87 & 12.20 are trimmed
    expect(screen.getByText(/ao12 —/)).toBeInTheDocument()
    expect(screen.getByText(new Date(T0 + 7 * 60_000).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }))).toBeInTheDocument()
  })

  it('says +2 and DNF plainly', async () => {
    render(<CubeStatsChart solves={[solve(0, 10), solve(1, 11, 'PLUS2'), solve(2, 12, 'DNF')]} />)
    await act(async () => {})
    const plot = screen.getByRole('group')
    fireEvent.focus(plot)
    expect(screen.getByText('DNF')).toBeInTheDocument()
    fireEvent.keyDown(plot, { key: 'ArrowLeft' })
    expect(screen.getByText('13.00+')).toBeInTheDocument()
    expect(screen.getByText('+2 penalty')).toBeInTheDocument()
  })

  it('Enter hands the solve back by its place in the list', async () => {
    const { plot, onSelect } = await mountChart()
    fireEvent.focus(plot)
    fireEvent.keyDown(plot, { key: 'ArrowLeft' })
    fireEvent.keyDown(plot, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(6)
  })

  it('numbers solves by their place in the whole list when only the latest are plotted', async () => {
    const { plot } = await mountChart({ limit: 3 })
    fireEvent.focus(plot)
    fireEvent.keyDown(plot, { key: 'Home' })
    expect(screen.getByText('Solve #6')).toBeInTheDocument()
  })
})

describe('the personal scoreboard', () => {
  const mountBoard = () => {
    const onOpen = jest.fn()
    render(<CubeScoreboard solves={SOLVES} decimals={2} scopeLabel="This session" onOpen={onOpen} />)
    return onOpen
  }

  it('lists the fastest singles, fastest first, and opens one when clicked', () => {
    const onOpen = mountBoard()
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('1')
    expect(rows[0]).toHaveTextContent('9.87')
    expect(rows[0]).toHaveTextContent('Solve #7')
    expect(rows[1]).toHaveTextContent('10.40')
    fireEvent.click(screen.getByText('9.87'))
    expect(onOpen).toHaveBeenCalledWith('s6')
  })

  it('ranks ao5s and shows each one’s solves, trimmed ones in parentheses', () => {
    mountBoard()
    fireEvent.click(screen.getByRole('radio', { name: 'ao5' }))
    fireEvent.click(screen.getAllByRole('button', { expanded: false })[0])
    expect(screen.getByText('(9.87)')).toBeInTheDocument()
    expect(screen.getByText(/Each solve counts toward one ranked average/)).toBeInTheDocument()
  })

  it('says how many more solves an average needs', () => {
    mountBoard()
    fireEvent.click(screen.getByRole('radio', { name: 'ao12' }))
    expect(screen.getByText('An ao12 needs 12 solves — 4 to go.')).toBeInTheDocument()
  })

  it('remembers which board you chose', () => {
    mountBoard()
    fireEvent.click(screen.getByRole('radio', { name: 'ao5' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '25' } })
    expect(JSON.parse(localStorage.getItem('zenith_cube_scoreboard_v1')!)).toEqual({ metric: 'ao5', count: 25 })
  })
})
