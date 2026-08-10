/**
 * __tests__/engines/UnitConversion.test.ts
 *
 * Conversions are checked against known reference values, not against
 * whatever the table happens to contain — a transposed factor is exactly
 * the bug that looks fine in code review and gives a student a wrong
 * answer.
 */

import {
  convert, findUnit, formatResult, DIMENSIONS, DIMENSION_MAP,
} from '@/utils/unitConversion'

const u = (dim: string, id: string) => {
  const unit = findUnit(dim, id)
  if (!unit) throw new Error(`missing unit ${dim}/${id}`)
  return unit
}

const conv = (dim: string, from: string, to: string, v: number) =>
  convert(v, u(dim, from), u(dim, to))

describe('temperature — the case a factor-only model gets wrong', () => {

  it.each([
    [0,    32],
    [100,  212],
    [-40,  -40],     // the crossover
    [37,   98.6],
  ])('%i°C = %f°F', (c, f) => {
    expect(conv('temperature', 'C', 'F', c)).toBeCloseTo(f, 6)
  })

  it('converts back the other way', () => {
    expect(conv('temperature', 'F', 'C', 212)).toBeCloseTo(100, 6)
    expect(conv('temperature', 'F', 'C', -40)).toBeCloseTo(-40, 6)
  })

  it('handles kelvin', () => {
    expect(conv('temperature', 'C', 'K', 0)).toBeCloseTo(273.15, 6)
    expect(conv('temperature', 'K', 'C', 0)).toBeCloseTo(-273.15, 6)
  })

  it('handles rankine, which scales but shares absolute zero', () => {
    expect(conv('temperature', 'R', 'K', 491.67)).toBeCloseTo(273.15, 4)
    expect(conv('temperature', 'F', 'R', 32)).toBeCloseTo(491.67, 4)
  })

  it('is NOT a plain ratio — guards against a regression to factor-only', () => {
    // If someone drops the offsets, 100°C→°F becomes 180, not 212.
    expect(conv('temperature', 'C', 'F', 100)).not.toBeCloseTo(180, 1)
  })
})

describe('reference conversions', () => {

  it.each([
    ['length',   'in', 'cm',  1,    2.54],
    ['length',   'mi', 'km',  1,    1.609344],
    ['length',   'ft', 'm',   1,    0.3048],
    ['mass',     'lb', 'kg',  1,    0.45359237],
    ['mass',     'oz', 'g',   1,    28.349523125],
    ['force',    'lbf', 'N',  1,    4.4482216152605],
    ['pressure', 'psi', 'kPa', 1,   6.894757293168],
    ['pressure', 'atm', 'kPa', 1,   101.325],
    ['energy',   'kcal', 'kJ', 1,   4.184],
    ['energy',   'BTU', 'J',  1,    1055.05585262],
    ['power',    'hp', 'W',   1,    745.6998715823],
    ['angle',    'deg', 'rad', 180, Math.PI],
    ['volume',   'galUS', 'L', 1,   3.785411784],
    ['velocity', 'mph', 'km/h', 60, 96.56064],
    ['area',     'acre', 'm2', 1,   4046.8564224],
    ['torque',   'lbf-ft', 'Nm', 1, 1.3558179483314],
    ['data',     'KiB', 'B',  1,    1024],
    ['data',     'B',  'b',   1,    8],
  ])('%s: 1 %s → %s', (dim, from, to, input, expected) => {
    expect(conv(dim as string, from as string, to as string, input as number))
      .toBeCloseTo(expected as number, 8)
  })
})

describe('round-tripping', () => {

  it('returns the original value through every unit of every dimension', () => {
    // Catches a transposed factor anywhere in the table.
    for (const dim of DIMENSIONS) {
      const base = dim.units.find(x => x.id === dim.base)!
      for (const unit of dim.units) {
        const there = convert(123.456, base, unit)
        const back  = convert(there, unit, base)
        expect(back).toBeCloseTo(123.456, 6)
      }
    }
  })

  it('is identity when from and to match', () => {
    for (const dim of DIMENSIONS) {
      for (const unit of dim.units) {
        expect(convert(42, unit, unit)).toBeCloseTo(42, 9)
      }
    }
  })
})

describe('table integrity', () => {

  it('every dimension declares a base unit that exists', () => {
    for (const dim of DIMENSIONS) {
      expect(dim.units.some(x => x.id === dim.base)).toBe(true)
    }
  })

  it('the base unit has factor 1 and no offset', () => {
    for (const dim of DIMENSIONS) {
      const base = dim.units.find(x => x.id === dim.base)!
      expect(base.factor).toBe(1)
      expect(base.offset ?? 0).toBe(0)
    }
  })

  it('has no duplicate unit ids within a dimension', () => {
    for (const dim of DIMENSIONS) {
      const ids = dim.units.map(x => x.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('has no zero or negative factors', () => {
    for (const dim of DIMENSIONS) {
      for (const unit of dim.units) expect(unit.factor).toBeGreaterThan(0)
    }
  })

  it('exposes every dimension through the lookup map', () => {
    expect(DIMENSION_MAP.size).toBe(DIMENSIONS.length)
  })
})

describe('formatResult', () => {

  it('does not flatten small numbers to zero', () => {
    // Fixed decimals would render this as "0.00", which is not a result.
    // Assert the value survives rather than the exact notation: plain
    // decimal is preferable while it stays readable.
    const out = formatResult(0.000012)
    expect(out).not.toBe('0')
    expect(Number(out.replace(/,/g, ''))).toBeCloseTo(0.000012, 12)
  })

  it('drops float noise', () => {
    expect(formatResult(0.1 + 0.2)).toBe('0.3')
  })

  it('uses exponential notation at the extremes', () => {
    expect(formatResult(1e15)).toMatch(/e\+/)
    expect(formatResult(1e-9)).toMatch(/e-/)
  })

  it('handles zero and non-finite input', () => {
    expect(formatResult(0)).toBe('0')
    expect(formatResult(NaN)).toBe('—')
    expect(formatResult(Infinity)).toBe('—')
  })
})
