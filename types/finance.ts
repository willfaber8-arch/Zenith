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
