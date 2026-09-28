/**
 * Multi-phase splits and typed-in times — the rules the timer relies on.
 */
import {
  parseTypedTime, phaseDurations, normalisePhaseConfig, resizePhases,
  DEFAULT_PHASE_CONFIG, MAX_PHASES,
} from '@/utils/cubePhases'

describe('typed times', () => {
  it.each([
    ['12.34',     12_340, 'OK'],
    ['12.3',      12_300, 'OK'],
    ['12',        12_000, 'OK'],
    ['9.876',      9_876, 'OK'],
    ['1:02.34',   62_340, 'OK'],
    ['1:02',      62_000, 'OK'],
    [' 12.34 ',   12_340, 'OK'],
    ['12.34+',    12_340, 'PLUS2'],
    ['DNF',            0, 'DNF'],
    ['dnf(14.20)', 14_200, 'DNF'],
  ])('%s', (input, timeMs, penalty) => {
    expect(parseTypedTime(input)).toEqual({ timeMs, penalty })
  })

  it.each(['', 'abc', '1:75', '12..3', '-5', '0', '0.00', '99:00:00', '1234.5678', '+'])(
    'refuses %p rather than guessing', input => {
      expect(parseTypedTime(input)).toBeNull()
    })
})

describe('phase durations from cumulative splits', () => {
  it('turns end-of-phase marks into time spent in each phase', () => {
    expect(phaseDurations([2100, 9400, 11800, 13950])).toEqual([2100, 7300, 2400, 2150])
  })
  it('reads a malformed list as no phases, never a negative phase', () => {
    expect(phaseDurations(undefined)).toBeNull()
    expect(phaseDurations([5000])).toBeNull()
    expect(phaseDurations([3000, 2000])).toBeNull()
    expect(phaseDurations([0, 2000])).toBeNull()
    expect(phaseDurations([1000, NaN])).toBeNull()
  })
})

describe('phase settings', () => {
  it('start off, with CFOP ready to switch on', () => {
    expect(DEFAULT_PHASE_CONFIG).toEqual({ enabled: false, names: ['Cross', 'F2L', 'OLL', 'PLL'] })
  })
  it('a corrupt setting falls back instead of breaking the timer', () => {
    expect(normalisePhaseConfig('nonsense')).toEqual(DEFAULT_PHASE_CONFIG)
    expect(normalisePhaseConfig({ enabled: true, names: ['', 'x'.repeat(40)] }))
      .toEqual({ enabled: true, names: ['Phase 1', 'x'.repeat(16)] })
    expect(normalisePhaseConfig({ enabled: true, names: ['Only'] }).names).toEqual(['Only', 'Phase 2'])
    expect(normalisePhaseConfig({ names: Array(10).fill('a') }).names).toHaveLength(MAX_PHASES)
  })
  it('resizing keeps the names already typed', () => {
    const roux = { enabled: true, names: ['FB', 'SB', 'CMLL', 'LSE'] }
    expect(resizePhases(roux, 2).names).toEqual(['FB', 'SB'])
    expect(resizePhases(roux, 5).names).toEqual(['FB', 'SB', 'CMLL', 'LSE', 'Phase 5'])
    expect(resizePhases(roux, 99).names).toHaveLength(MAX_PHASES)
  })
})
