/**
 * Shared cosmetic shop catalog — single source of truth for item definitions.
 * Consumed by GamesTabShell (shop tab) and SettingsView (appearance section).
 */

export interface ShopCatalogItem {
  readonly id:       string
  readonly name:     string
  readonly tagline:  string
  readonly category: 'theme' | 'pack'
  readonly cost:     number
  readonly icon:     string
  readonly tag?:     string
}

export const SHOP_CATALOG_STATIC: readonly ShopCatalogItem[] = [
  /* ── Themes ──────────────────────────────────────────────── */
  { id: 'zenith_default', name: 'Zenith Classic',        tagline: 'The original periwinkle cosmos aesthetic.',         category: 'theme', cost:   0, icon: '◈' },
  { id: 'zenith_crimson', name: 'Crimson Core',          tagline: 'Deep crimson accent with warm contrast.',           category: 'theme', cost: 150, icon: '◈', tag: 'NEW' },
  { id: 'zenith_amber',   name: 'Solar Dusk',            tagline: 'Amber and ember tones across the interface.',       category: 'theme', cost: 200, icon: '◈' },
  { id: 'zenith_void',    name: 'Void Protocol',         tagline: 'Near-black monochrome — maximum focus.',            category: 'theme', cost: 250, icon: '◈', tag: 'POPULAR' },
  { id: 'zenith_neon',    name: 'Neon Cascade',          tagline: 'Bright cyan-teal on deep navy.',                    category: 'theme', cost: 300, icon: '◈' },
  { id: 'zenith_cosmos',  name: 'Deep Cosmos',           tagline: 'Intensified galactic purple atmosphere.',           category: 'theme', cost: 350, icon: '◈' },
  /* ── Packs ───────────────────────────────────────────────── */
  { id: 'pack_study',     name: "Scholar's Focus Pack",  tagline: 'Enhanced study cockpit and academic overlays.',     category: 'pack',  cost:  75, icon: '◧' },
  { id: 'pack_midnight',  name: 'Midnight Terminal',     tagline: 'Terminal-style interface for late-night sessions.', category: 'pack',  cost: 125, icon: '◧', tag: 'NEW' },
  { id: 'pack_flora',     name: 'Botanical Interface',   tagline: 'Organic botanical motifs across the workspace.',    category: 'pack',  cost: 175, icon: '◧' },
  { id: 'pack_elite',     name: 'Arcade Elite Badge',    tagline: 'Prestige badge and foil effects in the Arcade.',   category: 'pack',  cost: 225, icon: '✦', tag: 'POPULAR' },
] as const
