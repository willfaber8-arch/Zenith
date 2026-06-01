/* ════════════════════════════════════════════════════════════════
   Zenith OS — Aquascaping Cart Pricing Engine
   Phase 4 · Step 4.2

   Exports:
     CartItem       — line-item type consumed by the UI
     VendorBucket   — per-vendor aggregation result
     PricingReport  — complete pricing summary
     calculatePricing(items, vendorMap) → PricingReport
   ════════════════════════════════════════════════════════════════ */

import type { VendorConfig } from '@/config/aquascapingVendors'

export type ItemCategory = 'fish' | 'plant' | 'invertebrate' | 'hardscape' | 'supply'

export interface CartItem {
  id: string
  name: string
  unitPrice: number
  quantity: number
  assignedVendorId: string
  category: ItemCategory
}

export interface VendorBucket {
  vendor: VendorConfig
  items: CartItem[]
  /** Raw sum of (unitPrice × quantity) for all items in this bucket */
  subtotal: number
  /** Effective shipping cost after threshold evaluation — 0 if free */
  shippingCost: number
  /** subtotal + shippingCost */
  totalForVendor: number
  /** True when subtotal ≥ vendor.freeShippingThreshold */
  freeShippingUnlocked: boolean
  /** Additional spend (USD) needed to reach free shipping; null if not applicable */
  amountToFreeShipping: number | null
}

export interface PricingReport {
  vendorBuckets: VendorBucket[]
  /** Sum of all item subtotals across every vendor bucket */
  totalItemsSubtotal: number
  /** Sum of all effective shipping charges */
  cumulativeShippingFees: number
  /** totalItemsSubtotal + cumulativeShippingFees */
  estimatedGrandTotal: number
  /** Total shipping fees avoided by crossing free-shipping thresholds */
  savingsFromFreeShipping: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Groups cart items by vendor, evaluates shipping thresholds, and returns
 * a fully aggregated pricing report.
 */
export function calculatePricing(
  items: CartItem[],
  vendorMap: Map<string, VendorConfig>,
): PricingReport {
  if (items.length === 0) {
    return {
      vendorBuckets:         [],
      totalItemsSubtotal:    0,
      cumulativeShippingFees: 0,
      estimatedGrandTotal:   0,
      savingsFromFreeShipping: 0,
    }
  }

  // ── Group items by assignedVendorId ──────────────────────────
  const grouped = new Map<string, CartItem[]>()
  for (const item of items) {
    const bucket = grouped.get(item.assignedVendorId) ?? []
    bucket.push(item)
    grouped.set(item.assignedVendorId, bucket)
  }

  const vendorBuckets: VendorBucket[] = []
  let totalItemsSubtotal      = 0
  let cumulativeShippingFees  = 0
  let savingsFromFreeShipping = 0

  for (const [vendorId, vendorItems] of grouped) {
    const vendor = vendorMap.get(vendorId)
    if (!vendor) continue

    // ── Subtotal for this bucket ─────────────────────────────
    const subtotal = vendorItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    )

    // ── Evaluate free-shipping threshold ─────────────────────
    const hasThreshold         = vendor.freeShippingThreshold !== null
    const freeShippingUnlocked = hasThreshold && subtotal >= vendor.freeShippingThreshold!
    const shippingCost         = freeShippingUnlocked ? 0 : vendor.baseShippingCost

    // Track savings for the summary line
    if (freeShippingUnlocked) savingsFromFreeShipping += vendor.baseShippingCost

    // Remaining spend to unlock free shipping
    const amountToFreeShipping =
      hasThreshold && !freeShippingUnlocked
        ? round2(vendor.freeShippingThreshold! - subtotal)
        : null

    vendorBuckets.push({
      vendor,
      items: vendorItems,
      subtotal:             round2(subtotal),
      shippingCost:         round2(shippingCost),
      totalForVendor:       round2(subtotal + shippingCost),
      freeShippingUnlocked,
      amountToFreeShipping,
    })

    totalItemsSubtotal     += subtotal
    cumulativeShippingFees += shippingCost
  }

  // Sort buckets: free-shipping-unlocked first, then alphabetically
  vendorBuckets.sort((a, b) => {
    if (a.freeShippingUnlocked !== b.freeShippingUnlocked) {
      return a.freeShippingUnlocked ? -1 : 1
    }
    return a.vendor.name.localeCompare(b.vendor.name)
  })

  return {
    vendorBuckets,
    totalItemsSubtotal:      round2(totalItemsSubtotal),
    cumulativeShippingFees:  round2(cumulativeShippingFees),
    estimatedGrandTotal:     round2(totalItemsSubtotal + cumulativeShippingFees),
    savingsFromFreeShipping: round2(savingsFromFreeShipping),
  }
}
