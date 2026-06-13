'use client'

import { useEffect, useState } from 'react'

const BIOME_KEY = 'zenith_cozy_biome_v1'

export type BiomeEnv = 'aquarium' | 'zoo'

export interface BiomeAsset {
  id:       string
  name:     string
  emoji:    string
  category: 'fish' | 'animal' | 'decor'
  biome:    'aquarium' | 'zoo' | 'both'
}

export interface ActiveBiomeLayout {
  activeBiome: BiomeEnv
  creatures:   BiomeAsset[]  // fish + animals for the active env
  decor:       BiomeAsset[]  // decor for the active env
  isEmpty:     boolean       // true when nothing is purchased for this env
  mounted:     boolean       // false during SSR — guards localStorage access
  switchBiome: (env: BiomeEnv) => void
}

/* Static catalog mirrors BIOME_CATALOG in WorkoutsView.tsx */
const BIOME_CATALOG: BiomeAsset[] = [
  { id: 'neon_tetra',  name: 'Neon Tetra',      emoji: '🐟', category: 'fish',   biome: 'aquarium' },
  { id: 'goldfish',    name: 'Goldfish',         emoji: '🐠', category: 'fish',   biome: 'aquarium' },
  { id: 'betta',       name: 'Betta Fish',       emoji: '🐡', category: 'fish',   biome: 'aquarium' },
  { id: 'clownfish',   name: 'Clownfish',        emoji: '🐠', category: 'fish',   biome: 'aquarium' },
  { id: 'guppy',       name: 'Guppy',            emoji: '🐟', category: 'fish',   biome: 'aquarium' },
  { id: 'plants',      name: 'Aquatic Plants',   emoji: '🌿', category: 'decor',  biome: 'aquarium' },
  { id: 'coral',       name: 'Coral Formation',  emoji: '🪸', category: 'decor',  biome: 'aquarium' },
  { id: 'castle',      name: 'Mini Castle',      emoji: '🏰', category: 'decor',  biome: 'aquarium' },
  { id: 'shell',       name: 'Treasure Shell',   emoji: '🐚', category: 'decor',  biome: 'aquarium' },
  { id: 'bunny',       name: 'Bunny',            emoji: '🐰', category: 'animal', biome: 'zoo'      },
  { id: 'penguin',     name: 'Penguin',          emoji: '🐧', category: 'animal', biome: 'zoo'      },
  { id: 'turtle',      name: 'Turtle',           emoji: '🐢', category: 'animal', biome: 'zoo'      },
  { id: 'red_panda',   name: 'Red Panda',        emoji: '🦊', category: 'animal', biome: 'zoo'      },
  { id: 'deer',        name: 'Deer',             emoji: '🦌', category: 'animal', biome: 'zoo'      },
  { id: 'hedgehog',    name: 'Hedgehog',         emoji: '🦔', category: 'animal', biome: 'zoo'      },
  { id: 'flowers',     name: 'Flower Garden',    emoji: '🌸', category: 'decor',  biome: 'zoo'      },
  { id: 'pond',        name: 'Lily Pond',        emoji: '🪷', category: 'decor',  biome: 'zoo'      },
  { id: 'cherry_tree', name: 'Cherry Tree',      emoji: '🌳', category: 'decor',  biome: 'zoo'      },
]

function readStore(): { purchased: string[]; activeBiome: BiomeEnv } {
  try {
    const raw = localStorage.getItem(BIOME_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* noop */ }
  return { purchased: [], activeBiome: 'aquarium' }
}

function writeActiveBiome(env: BiomeEnv, currentPurchased: string[]) {
  try {
    const current = readStore()
    localStorage.setItem(BIOME_KEY, JSON.stringify({
      ...current,
      purchased:   currentPurchased,
      activeBiome: env,
    }))
  } catch { /* noop */ }
}

export function useActiveBiomeLayout(): ActiveBiomeLayout {
  const [activeBiome, setActiveBiome] = useState<BiomeEnv>('aquarium')
  const [purchased,   setPurchased]   = useState<string[]>([])
  const [mounted,     setMounted]     = useState(false)

  /* Initial read — safe because this only runs client-side */
  useEffect(() => {
    const store = readStore()
    setActiveBiome(store.activeBiome)
    setPurchased(store.purchased)
    setMounted(true)
  }, [])

  /*
   * Cross-tab sync: when the user opens WorkoutsView in another tab and
   * purchases a new creature, StorageEvent fires here and the widget
   * re-renders without any polling or manual refresh.
   */
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== BIOME_KEY || !e.newValue) return
      try {
        const store = JSON.parse(e.newValue)
        setActiveBiome(store.activeBiome ?? 'aquarium')
        setPurchased(store.purchased ?? [])
      } catch { /* noop */ }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const active = BIOME_CATALOG.filter(
    c => purchased.includes(c.id) && (c.biome === activeBiome || c.biome === 'both'),
  )

  function switchBiome(env: BiomeEnv) {
    setActiveBiome(env)
    writeActiveBiome(env, purchased)
  }

  return {
    activeBiome,
    creatures:   active.filter(c => c.category !== 'decor'),
    decor:       active.filter(c => c.category === 'decor'),
    isEmpty:     active.length === 0,
    mounted,
    switchBiome,
  }
}
