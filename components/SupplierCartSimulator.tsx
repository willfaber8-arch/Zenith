'use client'

/* ════════════════════════════════════════════════════════════════
   Zenith OS — Supplier Cart Pricing Simulator
   Phase 4 · Step 4.2

   Two-section layout:
     Top    — Add item form (catalog autocomplete + manual fields)
     Bottom — Two columns: cart items list | live pricing breakdown
   ════════════════════════════════════════════════════════════════ */

import {
  useState, useMemo, useRef, useEffect, useCallback,
  type KeyboardEvent,
} from 'react'
import { VENDOR_REGISTRY, VENDOR_MAP, SHIPPING_TYPE_LABEL } from '@/config/aquascapingVendors'
import { calculatePricing, type CartItem, type ItemCategory } from '@/utils/pricingMath'
import styles from './SupplierCartSimulator.module.css'

/* ── Catalog ───────────────────────────────────────────────────── */

interface CatalogEntry {
  name: string
  unitPrice: number
  category: ItemCategory
  defaultVendorId: string
}

const CATALOG: CatalogEntry[] = [
  // Fish
  { name: 'Neon Tetra (×10)',       unitPrice: 24.99, category: 'fish',        defaultVendorId: 'aquarium-coop' },
  { name: 'Cardinal Tetra (×6)',    unitPrice: 29.99, category: 'fish',        defaultVendorId: 'wet-spot'      },
  { name: 'Honey Gourami (pair)',   unitPrice: 18.99, category: 'fish',        defaultVendorId: 'flip-aquatics' },
  { name: 'Corydoras Sterbai (×4)', unitPrice: 34.99, category: 'fish',        defaultVendorId: 'wet-spot'      },
  { name: 'Discus (single)',        unitPrice: 49.99, category: 'fish',        defaultVendorId: 'flip-aquatics' },
  { name: 'Harlequin Rasbora (×8)',unitPrice: 19.99, category: 'fish',        defaultVendorId: 'aquarium-coop' },
  // Invertebrates
  { name: 'Cherry Shrimp (×10)',   unitPrice: 29.99, category: 'invertebrate', defaultVendorId: 'aqua-swap'     },
  { name: 'Amano Shrimp (×6)',     unitPrice: 22.99, category: 'invertebrate', defaultVendorId: 'flip-aquatics' },
  { name: 'Crystal Red Shrimp (×5)', unitPrice: 39.99, category: 'invertebrate', defaultVendorId: 'aqua-swap'  },
  { name: 'Nerite Snail (×3)',     unitPrice: 11.99, category: 'invertebrate', defaultVendorId: 'aqua-swap'     },
  // Plants
  { name: 'Java Fern',             unitPrice:  7.99, category: 'plant',        defaultVendorId: 'aquarium-coop' },
  { name: 'Anubias Nana',          unitPrice:  9.99, category: 'plant',        defaultVendorId: 'buceplant'     },
  { name: 'Amazon Sword',          unitPrice: 11.99, category: 'plant',        defaultVendorId: 'aquarium-coop' },
  { name: 'Rotala Rotundifolia (bunch)', unitPrice: 5.99, category: 'plant',   defaultVendorId: 'buceplant'     },
  { name: 'Bucephalandra (rare)',  unitPrice: 24.99, category: 'plant',        defaultVendorId: 'buceplant'     },
  { name: 'Java Moss (portion)',   unitPrice:  8.99, category: 'plant',        defaultVendorId: 'aqua-swap'     },
  // Hardscape
  { name: 'Seiryu Stone (2 lb)',   unitPrice: 14.99, category: 'hardscape',    defaultVendorId: 'glass-aqua'    },
  { name: 'Dragon Stone (3 lb)',   unitPrice: 19.99, category: 'hardscape',    defaultVendorId: 'glass-aqua'    },
  { name: 'Spider Wood (medium)',  unitPrice: 22.99, category: 'hardscape',    defaultVendorId: 'glass-aqua'    },
  // Supplies
  { name: 'ADA Amazonia Soil (9L)', unitPrice: 44.99, category: 'supply',      defaultVendorId: 'aquarium-coop' },
  { name: 'Fluval Stratum (4 kg)', unitPrice: 34.99, category: 'supply',       defaultVendorId: 'aquarium-coop' },
  { name: 'CO2 Glass Diffuser',    unitPrice: 24.99, category: 'supply',       defaultVendorId: 'glass-aqua'    },
]

const CATEGORY_COLOR: Record<ItemCategory, string> = {
  fish:         '#52cca3',
  plant:        '#68c87a',
  invertebrate: '#f0a060',
  hardscape:    '#90b8c0',
  supply:       '#9ba3c4',
}

const CATEGORY_OPTIONS: ItemCategory[] = ['fish', 'plant', 'invertebrate', 'hardscape', 'supply']

/* ── Component ─────────────────────────────────────────────────── */

export default function SupplierCartSimulator() {

  /* Cart state */
  const [cartItems, setCartItems] = useState<CartItem[]>([])

  /* Form draft state */
  const [draftName,     setDraftName]     = useState('')
  const [draftPrice,    setDraftPrice]    = useState('')
  const [draftQty,      setDraftQty]      = useState(1)
  const [draftVendor,   setDraftVendor]   = useState(VENDOR_REGISTRY[0].id)
  const [draftCategory, setDraftCategory] = useState<ItemCategory>('fish')

  /* Catalog autocomplete */
  const [catalogQuery,  setCatalogQuery]  = useState('')
  const [catalogOpen,   setCatalogOpen]   = useState(false)
  const [highlightIdx,  setHighlightIdx]  = useState(0)

  const inputRef    = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  /* ── Pricing computation ─────────────────────────────────────── */
  const report = useMemo(
    () => calculatePricing(cartItems, VENDOR_MAP),
    [cartItems],
  )

  /* ── Filtered catalog ────────────────────────────────────────── */
  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.toLowerCase().trim()
    if (!q) return CATALOG
    return CATALOG.filter(e => e.name.toLowerCase().includes(q))
  }, [catalogQuery])

  /* ── Handlers ─────────────────────────────────────────────────── */

  const pickCatalogEntry = useCallback((entry: CatalogEntry) => {
    setDraftName(entry.name)
    setDraftPrice(entry.unitPrice.toFixed(2))
    setDraftVendor(entry.defaultVendorId)
    setDraftCategory(entry.category)
    setCatalogQuery(entry.name)
    setCatalogOpen(false)
    setHighlightIdx(0)
  }, [])

  const addItem = useCallback(() => {
    const price = parseFloat(draftPrice)
    if (!draftName.trim() || isNaN(price) || price <= 0 || draftQty < 1) return
    setCartItems(prev => [
      ...prev,
      {
        id:               crypto.randomUUID(),
        name:             draftName.trim(),
        unitPrice:        Math.round(price * 100) / 100,
        quantity:         draftQty,
        assignedVendorId: draftVendor,
        category:         draftCategory,
      },
    ])
    setDraftName('')
    setDraftPrice('')
    setDraftQty(1)
    setCatalogQuery('')
  }, [draftName, draftPrice, draftQty, draftVendor, draftCategory])

  const removeItem = useCallback((id: string) =>
    setCartItems(prev => prev.filter(i => i.id !== id)), [])

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty < 1) return
    setCartItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i))
  }, [])

  const updateVendor = useCallback((id: string, vendorId: string) =>
    setCartItems(prev => prev.map(i => i.id === id ? { ...i, assignedVendorId: vendorId } : i)), [])

  const clearCart = useCallback(() => setCartItems([]), [])

  /* ── Autocomplete keyboard nav ────────────────────────────────── */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (!catalogOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setCatalogOpen(true)
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIdx(i => Math.min(i + 1, filteredCatalog.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIdx(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCatalog[highlightIdx]) pickCatalogEntry(filteredCatalog[highlightIdx])
        break
      case 'Escape':
        setCatalogOpen(false)
        break
    }
  }, [catalogOpen, filteredCatalog, highlightIdx, pickCatalogEntry])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        inputRef.current    && !inputRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setCatalogOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => setHighlightIdx(0), [filteredCatalog])

  /* ── Helpers ─────────────────────────────────────────────────── */
  const fmt = (n: number) => `$${n.toFixed(2)}`
  const canAdd = draftName.trim().length > 0 && parseFloat(draftPrice) > 0

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className={styles.simulator}>

      {/* ══════════════════════════════════════════════════════════
          ADD ITEM PANEL
          ══════════════════════════════════════════════════════════ */}
      <div className={styles.addPanel}>
        <span className={styles.panelLabel}>Add Item</span>

        <div className={styles.formRow}>
          {/* Catalog autocomplete */}
          <div className={styles.catalogCombo}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search catalog or type a custom item…"
              value={catalogQuery}
              onChange={e => {
                setCatalogQuery(e.target.value)
                setDraftName(e.target.value)
                setCatalogOpen(true)
              }}
              onFocus={() => setCatalogOpen(true)}
              onKeyDown={handleKeyDown}
              className={styles.catalogInput}
              aria-label="Item name or catalog search"
              aria-haspopup="listbox"
              aria-expanded={catalogOpen}
              autoComplete="off"
            />
            {catalogOpen && filteredCatalog.length > 0 && (
              <div ref={dropdownRef} className={styles.catalogDropdown} role="listbox">
                {filteredCatalog.map((entry, idx) => (
                  <button
                    key={entry.name}
                    role="option"
                    className={`${styles.catalogItem} ${idx === highlightIdx ? styles.catalogItemActive : ''}`}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => pickCatalogEntry(entry)}
                  >
                    <span
                      className={styles.catalogItemType}
                      style={{ color: CATEGORY_COLOR[entry.category] }}
                    >
                      {entry.category}
                    </span>
                    <span className={styles.catalogItemName}>{entry.name}</span>
                    <span className={styles.catalogItemPrice}>{fmt(entry.unitPrice)}</span>
                    <span className={styles.catalogItemVendor}>
                      {VENDOR_MAP.get(entry.defaultVendorId)?.shortName ?? entry.defaultVendorId}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Unit price */}
          <input
            type="number"
            placeholder="Price"
            value={draftPrice}
            onChange={e => setDraftPrice(e.target.value)}
            className={styles.priceInput}
            min={0.01}
            step={0.01}
            aria-label="Unit price"
          />

          {/* Quantity */}
          <div className={styles.qtyField}>
            <button
              className={styles.qtyBtn}
              onClick={() => setDraftQty(q => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
            >−</button>
            <span className={styles.qtyNum}>{draftQty}</span>
            <button
              className={styles.qtyBtn}
              onClick={() => setDraftQty(q => q + 1)}
              aria-label="Increase quantity"
            >+</button>
          </div>

          {/* Category */}
          <select
            value={draftCategory}
            onChange={e => setDraftCategory(e.target.value as ItemCategory)}
            className={styles.categorySelect}
            aria-label="Item category"
          >
            {CATEGORY_OPTIONS.map(cat => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>

          {/* Vendor */}
          <select
            value={draftVendor}
            onChange={e => setDraftVendor(e.target.value)}
            className={styles.vendorSelect}
            aria-label="Assigned vendor"
          >
            {VENDOR_REGISTRY.map(v => (
              <option key={v.id} value={v.id}>{v.shortName}</option>
            ))}
          </select>

          {/* Add button */}
          <button
            className={styles.addBtn}
            onClick={addItem}
            disabled={!canAdd}
          >
            + Add
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MAIN CONTENT: CART LIST + PRICING BREAKDOWN
          ══════════════════════════════════════════════════════════ */}
      <div className={styles.mainLayout}>

        {/* ── LEFT: Cart items ─────────────────────────────────── */}
        <div className={styles.cartPanel}>
          <div className={styles.cartHeader}>
            <span className={styles.panelLabel}>
              Cart · {cartItems.length} line item{cartItems.length !== 1 ? 's' : ''}
            </span>
            {cartItems.length > 0 && (
              <button className={styles.clearBtn} onClick={clearCart}>
                Clear cart
              </button>
            )}
          </div>

          {cartItems.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>Your cart is empty</p>
              <p className={styles.emptyBody}>
                Search the catalog above or type a custom item name to begin building your shopping list.
              </p>
            </div>
          ) : (
            <div className={styles.cartList}>
              {cartItems.map((item, idx) => {
                const lineTotal = item.unitPrice * item.quantity
                return (
                  <div
                    key={item.id}
                    className={`${styles.cartRow} anim-slide-in`}
                    style={{ animationDelay: `${Math.min(idx, 8) * 30}ms` }}
                  >
                    {/* Name + category */}
                    <div className={styles.cartRowInfo}>
                      <span
                        className={styles.cartRowCategory}
                        style={{ color: CATEGORY_COLOR[item.category] }}
                      >
                        {item.category}
                      </span>
                      <span className={styles.cartRowName}>{item.name}</span>
                    </div>

                    {/* Controls cluster */}
                    <div className={styles.cartRowControls}>
                      {/* Inline vendor reassignment */}
                      <select
                        value={item.assignedVendorId}
                        onChange={e => updateVendor(item.id, e.target.value)}
                        className={styles.inlineVendorSelect}
                        aria-label={`Vendor for ${item.name}`}
                      >
                        {VENDOR_REGISTRY.map(v => (
                          <option key={v.id} value={v.id}>{v.shortName}</option>
                        ))}
                      </select>

                      <span className={styles.cartRowPrice}>{fmt(item.unitPrice)}</span>
                      <span className={styles.cartRowSep}>×</span>

                      <button
                        className={styles.cartQtyBtn}
                        onClick={() => updateQty(item.id, item.quantity - 1)}
                        aria-label="Decrease"
                      >−</button>
                      <span className={styles.cartQtyNum}>{item.quantity}</span>
                      <button
                        className={styles.cartQtyBtn}
                        onClick={() => updateQty(item.id, item.quantity + 1)}
                        aria-label="Increase"
                      >+</button>

                      <span className={styles.cartRowSep}>=</span>
                      <span className={styles.cartRowTotal}>{fmt(lineTotal)}</span>

                      <button
                        className={styles.removeBtn}
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove ${item.name}`}
                      >×</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: Pricing breakdown ─────────────────────────── */}
        <div className={styles.breakdownPanel}>
          <span className={styles.panelLabel}>Pricing Breakdown</span>

          {cartItems.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>No items</p>
              <p className={styles.emptyBody}>
                Add items to see your per-vendor shipping breakdown and estimated total.
              </p>
            </div>
          ) : (
            <>
              {/* Vendor buckets */}
              <div className={styles.buckets}>
                {report.vendorBuckets.map(bucket => (
                  <div
                    key={bucket.vendor.id}
                    className={`${styles.bucket} ${bucket.freeShippingUnlocked ? styles.bucketFree : ''}`}
                  >
                    {/* Bucket header */}
                    <div className={styles.bucketHeader}>
                      <span className={styles.bucketName}>{bucket.vendor.name}</span>
                      <div className={styles.bucketBadges}>
                        <span className={styles.shippingTypePill}>
                          {SHIPPING_TYPE_LABEL[bucket.vendor.shippingType]}
                        </span>
                        {bucket.freeShippingUnlocked && (
                          <span className={styles.freeBadge}>Free Shipping</span>
                        )}
                      </div>
                    </div>

                    {/* Bucket line rows */}
                    <div className={styles.bucketBody}>
                      <div className={styles.bucketRow}>
                        <span className={styles.bucketRowLabel}>
                          {bucket.items.length} item{bucket.items.length !== 1 ? 's' : ''}
                        </span>
                        <span className={styles.bucketRowValue}>{fmt(bucket.subtotal)}</span>
                      </div>

                      <div className={styles.bucketRow}>
                        <span className={styles.bucketRowLabel}>Shipping</span>
                        {bucket.freeShippingUnlocked ? (
                          <span className={styles.shippingFreeRow}>
                            <span className={styles.shippingStrike}>
                              {fmt(bucket.vendor.baseShippingCost)}
                            </span>
                            FREE
                          </span>
                        ) : (
                          <span className={styles.bucketRowValue}>
                            {fmt(bucket.shippingCost)}
                          </span>
                        )}
                      </div>

                      {bucket.amountToFreeShipping !== null && (
                        <p className={styles.freeHint}>
                          Add {fmt(bucket.amountToFreeShipping)} more to unlock free shipping
                        </p>
                      )}
                    </div>

                    {/* Bucket total footer */}
                    <div className={styles.bucketFooter}>
                      <span>Bucket Total</span>
                      <span>{fmt(bucket.totalForVendor)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grand total — re-animates on every value change */}
              <div
                key={report.estimatedGrandTotal + '-' + report.cumulativeShippingFees}
                className={`${styles.grandTotal} anim-slide-in`}
              >
                <div className={styles.grandRow}>
                  <span className={styles.grandLabel}>Items Subtotal</span>
                  <span className={styles.grandValue}>{fmt(report.totalItemsSubtotal)}</span>
                </div>
                <div className={styles.grandRow}>
                  <span className={styles.grandLabel}>Total Shipping</span>
                  <span className={styles.grandValue}>{fmt(report.cumulativeShippingFees)}</span>
                </div>
                {report.savingsFromFreeShipping > 0 && (
                  <div className={`${styles.grandRow} ${styles.savingsRow}`}>
                    <span className={styles.grandLabel}>Shipping Saved</span>
                    <span className={styles.savingsValue}>
                      −{fmt(report.savingsFromFreeShipping)}
                    </span>
                  </div>
                )}
                <div className={styles.grandDivider} />
                <div className={styles.grandFinal}>
                  <span className={styles.grandFinalLabel}>Estimated Total</span>
                  <span className={styles.grandAmount}>{fmt(report.estimatedGrandTotal)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
