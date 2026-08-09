/**
 * utils/unitConversion.ts — dimensional unit conversion.
 *
 * Pure, dependency-free, and deliberately explicit about the one case
 * that breaks naive implementations: temperature. °C → °F is not a ratio,
 * and a factor-only model silently produces nonsense for exactly the
 * conversion students reach for most.
 */

export interface Unit {
  id:     string
  label:  string
  /** Multiplier to the dimension's base unit. */
  factor: number
  /**
   * Additive offset in BASE units, applied after scaling.
   *
   *   base  = value * factor + offset
   *   value = (base - offset) / factor
   *
   * Only scales that do not share an origin need this. Kelvin is the base
   * for temperature precisely so the offsets stay small and legible.
   */
  offset?: number
}

export interface Dimension {
  id:    string
  label: string
  /** Unit id treated as the base — every factor is relative to it. */
  base:  string
  units: Unit[]
}

/* ── Conversion ────────────────────────────────────────────────────── */

export function toBase(value: number, unit: Unit): number {
  return value * unit.factor + (unit.offset ?? 0)
}

export function fromBase(base: number, unit: Unit): number {
  return (base - (unit.offset ?? 0)) / unit.factor
}

export function convert(value: number, from: Unit, to: Unit): number {
  return fromBase(toBase(value, from), to)
}

/* ── Display ───────────────────────────────────────────────────────── */

/**
 * Round for display without destroying small numbers.
 *
 * Fixed decimals are wrong here: `0.000012 m` in metres renders as
 * `0.00`, which is not a conversion result, it is a lie. Significant
 * figures keep small and large magnitudes both readable.
 */
export function formatResult(value: number, sigFigs = 6): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'

  const abs = Math.abs(value)
  // Scientific notation past the range where digits stay readable.
  if (abs >= 1e12 || abs < 1e-6) return value.toExponential(Math.max(0, sigFigs - 1))

  const rounded = Number(value.toPrecision(sigFigs))
  // toPrecision can re-introduce float noise (0.30000000000000004); the
  // round trip through Number() drops it, and toLocaleString groups.
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 10 })
}

/* ── Dimensions ────────────────────────────────────────────────────── */

export const DIMENSIONS: readonly Dimension[] = [
  {
    id: 'length', label: 'Length', base: 'm',
    units: [
      { id: 'nm', label: 'nanometre',  factor: 1e-9 },
      { id: 'um', label: 'micrometre', factor: 1e-6 },
      { id: 'mm', label: 'millimetre', factor: 1e-3 },
      { id: 'cm', label: 'centimetre', factor: 1e-2 },
      { id: 'm',  label: 'metre',      factor: 1 },
      { id: 'km', label: 'kilometre',  factor: 1e3 },
      { id: 'in', label: 'inch',       factor: 0.0254 },
      { id: 'ft', label: 'foot',       factor: 0.3048 },
      { id: 'yd', label: 'yard',       factor: 0.9144 },
      { id: 'mi', label: 'mile',       factor: 1609.344 },
      { id: 'thou', label: 'thou (mil)', factor: 2.54e-5 },
    ],
  },
  {
    id: 'mass', label: 'Mass', base: 'kg',
    units: [
      { id: 'mg',   label: 'milligram', factor: 1e-6 },
      { id: 'g',    label: 'gram',      factor: 1e-3 },
      { id: 'kg',   label: 'kilogram',  factor: 1 },
      { id: 't',    label: 'tonne',     factor: 1e3 },
      { id: 'oz',   label: 'ounce',     factor: 0.028349523125 },
      { id: 'lb',   label: 'pound',     factor: 0.45359237 },
      { id: 'slug', label: 'slug',      factor: 14.5939029372 },
    ],
  },
  {
    id: 'force', label: 'Force', base: 'N',
    units: [
      { id: 'N',    label: 'newton',     factor: 1 },
      { id: 'kN',   label: 'kilonewton', factor: 1e3 },
      { id: 'lbf',  label: 'pound-force', factor: 4.4482216152605 },
      { id: 'kgf',  label: 'kilogram-force', factor: 9.80665 },
      { id: 'dyn',  label: 'dyne',       factor: 1e-5 },
    ],
  },
  {
    id: 'pressure', label: 'Pressure', base: 'Pa',
    units: [
      { id: 'Pa',   label: 'pascal',     factor: 1 },
      { id: 'kPa',  label: 'kilopascal', factor: 1e3 },
      { id: 'MPa',  label: 'megapascal', factor: 1e6 },
      { id: 'bar',  label: 'bar',        factor: 1e5 },
      { id: 'psi',  label: 'psi',        factor: 6894.757293168 },
      { id: 'atm',  label: 'atmosphere', factor: 101325 },
      { id: 'mmHg', label: 'mmHg (torr)', factor: 133.322387415 },
    ],
  },
  {
    id: 'energy', label: 'Energy', base: 'J',
    units: [
      { id: 'J',    label: 'joule',       factor: 1 },
      { id: 'kJ',   label: 'kilojoule',   factor: 1e3 },
      { id: 'cal',  label: 'calorie',     factor: 4.184 },
      { id: 'kcal', label: 'kilocalorie', factor: 4184 },
      { id: 'Wh',   label: 'watt-hour',   factor: 3600 },
      { id: 'kWh',  label: 'kilowatt-hour', factor: 3.6e6 },
      { id: 'BTU',  label: 'BTU',         factor: 1055.05585262 },
      { id: 'eV',   label: 'electronvolt', factor: 1.602176634e-19 },
    ],
  },
  {
    id: 'power', label: 'Power', base: 'W',
    units: [
      { id: 'W',   label: 'watt',       factor: 1 },
      { id: 'kW',  label: 'kilowatt',   factor: 1e3 },
      { id: 'MW',  label: 'megawatt',   factor: 1e6 },
      { id: 'hp',  label: 'horsepower (mech)', factor: 745.6998715823 },
      { id: 'BTUh', label: 'BTU/hour',  factor: 0.29307107 },
    ],
  },
  {
    /* Kelvin is the base so both offsets stay simple and inspectable. */
    id: 'temperature', label: 'Temperature', base: 'K',
    units: [
      { id: 'K',  label: 'kelvin',     factor: 1 },
      { id: 'C',  label: 'celsius',    factor: 1,   offset: 273.15 },
      { id: 'F',  label: 'fahrenheit', factor: 5 / 9, offset: 273.15 - 32 * 5 / 9 },
      { id: 'R',  label: 'rankine',    factor: 5 / 9 },
    ],
  },
  {
    id: 'angle', label: 'Angle', base: 'rad',
    units: [
      { id: 'rad',  label: 'radian', factor: 1 },
      { id: 'deg',  label: 'degree', factor: Math.PI / 180 },
      { id: 'grad', label: 'gradian', factor: Math.PI / 200 },
      { id: 'rev',  label: 'revolution', factor: 2 * Math.PI },
    ],
  },
  {
    id: 'volume', label: 'Volume', base: 'm3',
    units: [
      { id: 'mL',   label: 'millilitre', factor: 1e-6 },
      { id: 'L',    label: 'litre',      factor: 1e-3 },
      { id: 'm3',   label: 'cubic metre', factor: 1 },
      { id: 'in3',  label: 'cubic inch', factor: 1.6387064e-5 },
      { id: 'ft3',  label: 'cubic foot', factor: 0.028316846592 },
      { id: 'galUS', label: 'gallon (US)', factor: 0.003785411784 },
      { id: 'galUK', label: 'gallon (imp)', factor: 0.00454609 },
    ],
  },
  {
    id: 'velocity', label: 'Velocity', base: 'm/s',
    units: [
      { id: 'm/s',  label: 'metre/second', factor: 1 },
      { id: 'km/h', label: 'km/hour',      factor: 1 / 3.6 },
      { id: 'mph',  label: 'mile/hour',    factor: 0.44704 },
      { id: 'ft/s', label: 'foot/second',  factor: 0.3048 },
      { id: 'kn',   label: 'knot',         factor: 0.514444444444 },
    ],
  },
  {
    id: 'area', label: 'Area', base: 'm2',
    units: [
      { id: 'mm2', label: 'square millimetre', factor: 1e-6 },
      { id: 'cm2', label: 'square centimetre', factor: 1e-4 },
      { id: 'm2',  label: 'square metre',      factor: 1 },
      { id: 'km2', label: 'square kilometre',  factor: 1e6 },
      { id: 'in2', label: 'square inch',       factor: 6.4516e-4 },
      { id: 'ft2', label: 'square foot',       factor: 0.09290304 },
      { id: 'acre', label: 'acre',             factor: 4046.8564224 },
    ],
  },
  {
    id: 'torque', label: 'Torque', base: 'Nm',
    units: [
      { id: 'Nm',    label: 'newton-metre', factor: 1 },
      { id: 'lbf-ft', label: 'pound-foot',  factor: 1.3558179483314 },
      { id: 'lbf-in', label: 'pound-inch',  factor: 0.1129848290276 },
      { id: 'kgf-m',  label: 'kilogram-metre', factor: 9.80665 },
    ],
  },
  {
    id: 'data', label: 'Data', base: 'B',
    units: [
      { id: 'b',   label: 'bit',      factor: 0.125 },
      { id: 'B',   label: 'byte',     factor: 1 },
      { id: 'KiB', label: 'kibibyte', factor: 1024 },
      { id: 'MiB', label: 'mebibyte', factor: 1024 ** 2 },
      { id: 'GiB', label: 'gibibyte', factor: 1024 ** 3 },
      { id: 'kB',  label: 'kilobyte (SI)', factor: 1000 },
      { id: 'MB',  label: 'megabyte (SI)', factor: 1000 ** 2 },
      { id: 'GB',  label: 'gigabyte (SI)', factor: 1000 ** 3 },
    ],
  },
]

export const DIMENSION_MAP: ReadonlyMap<string, Dimension> =
  new Map(DIMENSIONS.map(d => [d.id, d]))

export function findUnit(dimensionId: string, unitId: string): Unit | undefined {
  return DIMENSION_MAP.get(dimensionId)?.units.find(u => u.id === unitId)
}
