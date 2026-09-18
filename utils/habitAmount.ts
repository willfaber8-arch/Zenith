/**
 * utils/habitAmount.ts — habit amounts that may not be whole numbers.
 *
 * Steps and goals used to be integers, so adding them up and printing
 * them needed no thought. They are not integers any more: half a mile,
 * 2.5 litres, 0.25 of an hour are all reasonable things to tick off in
 * one tap, and the form refused every one of them.
 *
 * Allowing them brings binary floating point with it, and two problems
 * that are not cosmetic:
 *
 *   A step of 0.1 taken ten times sums to 0.9999999999999999, which is
 *   less than a goal of 1. The habit would never complete, the streak
 *   would never increment, and the row would sit at what looks exactly
 *   like a finished goal while behaving as an unfinished one.
 *
 *   That same sum prints as "0.30000000000000004 / 1" after three taps.
 *
 * So every amount is rounded to a fixed precision the moment it is
 * stored, and printed through `formatAmount` rather than interpolated
 * directly. Three decimals is far finer than any unit a person tracks a
 * habit in, and coarse enough that accumulated error never survives it.
 */

/** Decimal places kept when an amount is stored. */
export const AMOUNT_PRECISION = 3

const FACTOR = 10 ** AMOUNT_PRECISION

/**
 * Snap an amount to the stored precision.
 *
 * Integers pass through unchanged, which is what keeps every habit that
 * existed before decimals were allowed behaving exactly as it did.
 */
export function roundAmount(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * FACTOR) / FACTOR
}

/**
 * An amount as a person would write it: "20", not "20.0"; "0.3", not
 * "0.30000000000000004".
 */
export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return '0'
  /* String() of a rounded number already drops a trailing ".0", so a
     whole amount prints whole and a fractional one keeps only the
     digits it needs. toFixed would pad every integer to "20.000". */
  return String(roundAmount(n))
}

/**
 * Read an amount out of a text field.
 *
 * Returns null for anything that is not a number yet — an empty field, a
 * lone "." or "0." mid-typing, a minus sign on its own. The caller keeps
 * showing the raw text in that case rather than substituting a value,
 * because substituting one is what made the field impossible to edit:
 * coercing "" to 1 on every keystroke put 1 straight back in as fast as
 * it could be deleted.
 */
export function parseAmount(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  /* Number('') is 0 and Number('  ') is 0, both already handled; this
     rejects the half-typed forms Number() would happily accept as NaN
     or as a value the user has not finished writing. */
  if (!/^\d*\.?\d*$/.test(t)) return null
  if (t === '.') return null
  const n = Number(t)
  return Number.isFinite(n) ? roundAmount(n) : null
}
