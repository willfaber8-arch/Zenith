export type BurnRateStatus = 'healthy' | 'caution' | 'critical'

export interface BurnRateInput {
  currentBalance: number
  targetEndDate:  string | Date
  bufferReserve?: number
}

export interface BurnRateAnalysis {
  daysRemaining:  number
  availableFunds: number
  safeDailyLimit: number
  status:         BurnRateStatus
  statusLabel:    string
}

/**
 * Computes a safe daily spending limit (burn rate) for a campus dining
 * balance.
 *
 * Algorithm:
 *   availableFunds = currentBalance − bufferReserve
 *   safeDailyLimit = availableFunds / daysRemaining
 *
 * Status thresholds (Cornell BRB scale):
 *   healthy  — ≥ $10 / day   (comfortable margin)
 *   caution  — $7 – $10 / day (moderate spend only)
 *   critical — < $7  / day   (limit discretionary spend)
 */
export function computeBurnRate({
  currentBalance,
  targetEndDate,
  bufferReserve = 0,
}: BurnRateInput): BurnRateAnalysis {
  const now = new Date()
  const end = new Date(targetEndDate)

  // Normalise to midnight so day boundaries are calendar-accurate
  now.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const MS_PER_DAY   = 86_400_000
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY))
  const availableFunds = Math.max(0, currentBalance - bufferReserve)
  const safeDailyLimit = daysRemaining > 0 ? availableFunds / daysRemaining : 0

  let status: BurnRateStatus
  let statusLabel: string

  if (daysRemaining === 0) {
    status      = 'critical'
    statusLabel = 'End date reached — balance should be exhausted'
  } else if (safeDailyLimit >= 10) {
    status      = 'healthy'
    statusLabel = 'Sustainable — comfortable daily velocity'
  } else if (safeDailyLimit >= 7) {
    status      = 'caution'
    statusLabel = 'Caution — limit to moderate discretionary spend'
  } else {
    status      = 'critical'
    statusLabel = 'Critical — restrict all non-essential purchases'
  }

  return { daysRemaining, availableFunds, safeDailyLimit, status, statusLabel }
}

/** Formats a dollar amount for display: "$7.14" */
export function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}
