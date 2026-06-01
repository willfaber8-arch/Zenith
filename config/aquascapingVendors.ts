/* ════════════════════════════════════════════════════════════════
   Zenith OS — Aquascaping Vendor Configuration Registry
   Phase 4 · Step 4.2 — Supplier Cart Pricing Simulator
   ════════════════════════════════════════════════════════════════ */

export type ShippingType = 'flat_rate' | 'live_animal_express' | 'tier_based'

export interface VendorConfig {
  id: string
  name: string
  /** Abbreviated name used in compact UI slots */
  shortName: string
  shippingType: ShippingType
  /** Base shipping cost in USD applied when threshold is not met */
  baseShippingCost: number
  /** Subtotal (USD) the buyer must reach to unlock free shipping; null = never free */
  freeShippingThreshold: number | null
  /** Primary inventory categories this vendor specialises in */
  specialtyTags: string[]
}

export const VENDOR_REGISTRY: VendorConfig[] = [
  {
    id: 'aquarium-coop',
    name: 'Aquarium Co-Op',
    shortName: 'AQ Co-Op',
    shippingType: 'flat_rate',
    baseShippingCost: 8.99,
    freeShippingThreshold: 60.00,
    specialtyTags: ['plants', 'fish', 'supplies'],
  },
  {
    id: 'flip-aquatics',
    name: 'Flip Aquatics',
    shortName: 'Flip',
    shippingType: 'live_animal_express',
    baseShippingCost: 39.99,
    freeShippingThreshold: null,
    specialtyTags: ['fish', 'invertebrates'],
  },
  {
    id: 'wet-spot',
    name: 'The Wet Spot',
    shortName: 'Wet Spot',
    shippingType: 'live_animal_express',
    baseShippingCost: 29.99,
    freeShippingThreshold: 150.00,
    specialtyTags: ['fish', 'rare species'],
  },
  {
    id: 'aqua-swap',
    name: 'AquaSwap',
    shortName: 'AquaSwap',
    shippingType: 'tier_based',
    baseShippingCost: 15.00,
    freeShippingThreshold: 75.00,
    specialtyTags: ['plants', 'invertebrates', 'hardscape'],
  },
  {
    id: 'buceplant',
    name: 'Buceplant',
    shortName: 'Buce',
    shippingType: 'flat_rate',
    baseShippingCost: 12.99,
    freeShippingThreshold: 99.00,
    specialtyTags: ['rare plants', 'hardscape'],
  },
  {
    id: 'glass-aqua',
    name: 'Glass Aqua',
    shortName: 'Glass Aqua',
    shippingType: 'flat_rate',
    baseShippingCost: 9.99,
    freeShippingThreshold: 75.00,
    specialtyTags: ['hardscape', 'supplies', 'plants'],
  },
]

/** Lookup map for O(1) vendor resolution */
export const VENDOR_MAP = new Map<string, VendorConfig>(
  VENDOR_REGISTRY.map(v => [v.id, v]),
)

export const SHIPPING_TYPE_LABEL: Record<ShippingType, string> = {
  flat_rate:           'Flat Rate',
  live_animal_express: 'Overnight Express',
  tier_based:          'Tier Based',
}
