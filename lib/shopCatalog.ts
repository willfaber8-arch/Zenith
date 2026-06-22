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
  /* ── Core Themes ─────────────────────────────────────────────── */
  { id: 'zenith_default',    name: 'Sage Studio',           tagline: 'Lightish green on dark grey — the Zenith default.',       category: 'theme', cost:   0, icon: '◈' },
  { id: 'zenith_periwinkle', name: 'Classic Periwinkle',    tagline: 'The original cosmos blue-purple aesthetic.',              category: 'theme', cost: 100, icon: '◈', tag: 'CLASSIC' },
  { id: 'zenith_crimson',    name: 'Crimson Core',          tagline: 'Deep crimson accent with warm contrast.',                 category: 'theme', cost: 150, icon: '◈' },
  { id: 'zenith_amber',      name: 'Solar Dusk',            tagline: 'Amber and ember tones across the interface.',             category: 'theme', cost: 200, icon: '◈' },
  { id: 'zenith_void',       name: 'Void Protocol',         tagline: 'Near-black monochrome — maximum focus.',                  category: 'theme', cost: 250, icon: '◈', tag: 'POPULAR' },
  { id: 'zenith_neon',       name: 'Neon Cascade',          tagline: 'Bright cyan-teal on deep navy.',                          category: 'theme', cost: 300, icon: '◈' },
  { id: 'zenith_cosmos',     name: 'Deep Cosmos',           tagline: 'Intensified galactic purple atmosphere.',                  category: 'theme', cost: 350, icon: '◈' },

  /* ── Expanded Themes ─────────────────────────────────────────── */
  { id: 'zenith_ocean',      name: 'Deep Ocean',            tagline: 'Teal-cyan on deep navy. Calm and fluid.',                 category: 'theme', cost: 200, icon: '◈' },
  { id: 'zenith_lavender',   name: 'Lavender Haze',         tagline: 'Soft lavender on dark purple-grey.',                     category: 'theme', cost: 200, icon: '◈' },
  { id: 'zenith_rose',       name: 'Dusty Rose',            tagline: 'Warm rose accent on a deep warm background.',            category: 'theme', cost: 200, icon: '◈' },
  { id: 'zenith_steel',      name: 'Steel Blue',            tagline: 'Industrial steel blue on slate-navy.',                   category: 'theme', cost: 200, icon: '◈' },
  { id: 'zenith_copper',     name: 'Copper Forge',          tagline: 'Hammered copper accent on dark mahogany.',               category: 'theme', cost: 250, icon: '◈' },
  { id: 'zenith_arctic',     name: 'Arctic',                tagline: 'Glacial blue-white on near-black. Crisp clarity.',       category: 'theme', cost: 250, icon: '◈' },
  { id: 'zenith_emerald',    name: 'Emerald City',          tagline: 'Rich emerald green on deep black.',                      category: 'theme', cost: 250, icon: '◈' },
  { id: 'zenith_sunset',     name: 'Sunset Drive',          tagline: 'Warm orange-coral on a dark twilight surface.',          category: 'theme', cost: 250, icon: '◈' },
  { id: 'zenith_gold',       name: 'Gilded',                tagline: 'Bright gold accent on near-black canvas.',               category: 'theme', cost: 300, icon: '◈' },
  { id: 'zenith_cyan',       name: 'Cyan Protocol',         tagline: 'Electric cyan on deep void black. Focused.',             category: 'theme', cost: 300, icon: '◈' },
  { id: 'zenith_sage',       name: 'Forest Sage',           tagline: 'Muted sage green on deep forest black.',                 category: 'theme', cost: 300, icon: '◈' },
  { id: 'zenith_indigo',     name: 'Midnight Indigo',       tagline: 'Deep indigo-violet on starless black.',                  category: 'theme', cost: 300, icon: '◈' },
  { id: 'zenith_mint',       name: 'Minty Fresh',           tagline: 'Vivid mint on cool dark canvas. Energising.',            category: 'theme', cost: 350, icon: '◈', tag: 'NEW' },
  { id: 'zenith_mauve',      name: 'Dusty Mauve',           tagline: 'Antique mauve on warm near-black.',                      category: 'theme', cost: 350, icon: '◈' },

  /* ── Light Themes ───────────────────────────────────────────── */
  { id: 'light_clean', name: 'Morning Studio',  tagline: 'Clean white canvas with sage accents. The light default.',  category: 'theme', cost:   0, icon: '◈', tag: 'LIGHT' },
  { id: 'light_warm',  name: 'Parchment Studio', tagline: 'Warm cream surface with amber warmth.',                    category: 'theme', cost:   0, icon: '◈', tag: 'LIGHT' },
  { id: 'light_rose',  name: 'Petal',            tagline: 'Pale blush canvas with deep rose accent.',                 category: 'theme', cost: 200, icon: '◈', tag: 'LIGHT' },
  { id: 'light_ocean', name: 'Coastal',          tagline: 'Pale seafoam surface with deep ocean teal.',               category: 'theme', cost: 250, icon: '◈', tag: 'LIGHT' },
  { id: 'light_dusk',  name: 'Golden Hour',      tagline: 'Warm ochre canvas with burnished amber accent.',           category: 'theme', cost: 300, icon: '◈', tag: 'LIGHT' },

  /* ── Packs ───────────────────────────────────────────────────── */
  { id: 'pack_study',        name: "Scholar's Focus Pack",  tagline: 'Enhanced study cockpit and academic overlays.',          category: 'pack',  cost:  75, icon: '◧' },
  { id: 'pack_midnight',     name: 'Midnight Terminal',     tagline: 'Terminal-style interface for late-night sessions.',      category: 'pack',  cost: 125, icon: '◧', tag: 'NEW' },
  { id: 'pack_flora',        name: 'Botanical Interface',   tagline: 'Organic botanical motifs across the workspace.',         category: 'pack',  cost: 175, icon: '◧' },
  { id: 'pack_elite',        name: 'Arcade Elite Badge',    tagline: 'Prestige badge and foil effects in the Arcade.',        category: 'pack',  cost: 225, icon: '✦', tag: 'POPULAR' },
  { id: 'pack_sakura',       name: 'Sakura Season',         tagline: 'Cherry blossom pink on warm dark canvas.',              category: 'pack',  cost: 175, icon: '◧' },
  { id: 'pack_citrus',       name: 'Citrus Rush',           tagline: 'Bold citrus yellow on dark warm brown.',                category: 'pack',  cost: 200, icon: '◧' },
  { id: 'pack_ocean_deep',   name: 'Ocean Depths',          tagline: 'Rich ocean blue gradient on abyssal black.',            category: 'pack',  cost: 225, icon: '◧', tag: 'NEW' },
  { id: 'pack_ash',          name: 'Ash & Ember',           tagline: 'Ember red on charcoal ash. Heat and restraint.',        category: 'pack',  cost: 250, icon: '◧' },
] as const
