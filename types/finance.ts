/* ── Subscription / Recurring Expense Types (Phase 8.4) ──── */

export type BillingCycle = 'MONTHLY' | 'ANNUAL'

/**
 * SubscriptionItem — one recurring expense entry.
 * `id` is a client-generated UUID string (explicit PK, no auto-increment).
 * `monthlyCost` stores the raw per-billing-period cost entered by the user:
 *   • MONTHLY → the monthly price (e.g. 9.99)
 *   • ANNUAL  → the annual price (e.g. 99.99); divide by 12 to get monthly equiv
 * Use `calculateTrueMonthlyCost()` to normalize both cycles to a monthly value.
 */
export interface SubscriptionItem {
  id:                 string        // UUID string — explicit PK
  name:               string        // e.g. 'Spotify Premium'
  monthlyCost:        number        // raw cost per billing period (see above)
  renewalDateString:  string        // ISO "YYYY-MM-DD" next renewal date
  categoryBundle:     string        // e.g. 'Entertainment Bundle', 'Academic Suite'
  billingCycle:       BillingCycle  // 'MONTHLY' | 'ANNUAL'
}

/**
 * Normalizes a raw per-period cost to a true monthly value.
 * ANNUAL costs are divided by 12; MONTHLY costs pass through unchanged.
 */
export function calculateTrueMonthlyCost(cost: number, cycle: BillingCycle): number {
  return cycle === 'ANNUAL' ? cost / 12 : cost
}

/* ── Delivery Types ─────────────────────────────────────── */

export type DeliveryStatus = 'in_transit' | 'arrived_at_mailroom' | 'active'

export interface DeliveryItem {
  id?: number
  carrier: string          // 'UPS', 'FedEx', 'USPS', 'Amazon', 'Spotify', etc.
  itemName: string
  estimatedArrival: string // 'YYYY-MM-DD', or '' for subscriptions
  status: DeliveryStatus
  notes?: string
  createdAt: number        // Unix ms
}
