'use client'

import { useState } from 'react'
import { useNav } from '@/lib/NavContext'
import styles from './CozyBiomeWidget.module.css'
import wStyles from './Widget.module.css'

const BIOME_KEY = 'zenith_cozy_biome_v1'
const VP_KEY    = 'zenith_vitality_v1'

interface BiomeStore    { purchased: string[]; activeBiome: 'aquarium' | 'zoo' }
interface VitalityStore { balance: number; lifetime: number }

/* Items that appear in the mini preview */
interface PreviewItem { id: string; emoji: string; category: 'fish' | 'animal' | 'decor' }

const PREVIEW_MAP: Record<string, PreviewItem> = {
  neon_tetra:  { id: 'neon_tetra',  emoji: '🐟', category: 'fish'   },
  goldfish:    { id: 'goldfish',    emoji: '🐠', category: 'fish'   },
  betta:       { id: 'betta',      emoji: '🐡', category: 'fish'   },
  clownfish:   { id: 'clownfish',  emoji: '🐠', category: 'fish'   },
  guppy:       { id: 'guppy',      emoji: '🐟', category: 'fish'   },
  plants:      { id: 'plants',     emoji: '🌿', category: 'decor'  },
  coral:       { id: 'coral',      emoji: '🪸', category: 'decor'  },
  castle:      { id: 'castle',     emoji: '🏰', category: 'decor'  },
  shell:       { id: 'shell',      emoji: '🐚', category: 'decor'  },
  bunny:       { id: 'bunny',      emoji: '🐰', category: 'animal' },
  penguin:     { id: 'penguin',    emoji: '🐧', category: 'animal' },
  turtle:      { id: 'turtle',     emoji: '🐢', category: 'animal' },
  red_panda:   { id: 'red_panda',  emoji: '🦊', category: 'animal' },
  deer:        { id: 'deer',       emoji: '🦌', category: 'animal' },
  hedgehog:    { id: 'hedgehog',   emoji: '🦔', category: 'animal' },
  flowers:     { id: 'flowers',    emoji: '🌸', category: 'decor'  },
  pond:        { id: 'pond',       emoji: '🪷', category: 'decor'  },
  cherry_tree: { id: 'cherry_tree',emoji: '🌳', category: 'decor'  },
}

const AQUA_IDS = ['neon_tetra','goldfish','betta','clownfish','guppy','plants','coral','castle','shell']
const ZOO_IDS  = ['bunny','penguin','turtle','red_panda','deer','hedgehog','flowers','pond','cherry_tree']

function readBiome(): BiomeStore {
  try {
    const raw = localStorage.getItem(BIOME_KEY)
    return raw ? JSON.parse(raw) as BiomeStore : { purchased: [], activeBiome: 'aquarium' }
  } catch { return { purchased: [], activeBiome: 'aquarium' } }
}

function readVp(): VitalityStore {
  try {
    const raw = localStorage.getItem(VP_KEY)
    return raw ? JSON.parse(raw) as VitalityStore : { balance: 0, lifetime: 0 }
  } catch { return { balance: 0, lifetime: 0 } }
}

export default function CozyBiomeWidget() {
  const { navigate } = useNav()
  const [biome] = useState<BiomeStore>(readBiome)
  const [vp]    = useState<VitalityStore>(readVp)

  const activeBiome = biome?.activeBiome ?? 'aquarium'
  const validIds    = activeBiome === 'aquarium' ? AQUA_IDS : ZOO_IDS
  const purchased   = (biome?.purchased ?? []).filter(id => validIds.includes(id))

  const creatures = purchased
    .map(id => PREVIEW_MAP[id])
    .filter(Boolean)
    .filter(p => p.category === 'fish' || p.category === 'animal')

  const decor = purchased
    .map(id => PREVIEW_MAP[id])
    .filter(Boolean)
    .filter(p => p.category === 'decor')

  const isEmpty = purchased.length === 0

  return (
    <div
      className={`${wStyles.card} ${wStyles.clickable} ${styles.root}`}
      role="button"
      tabIndex={0}
      onClick={() => navigate('workouts', 'essentials')}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('workouts', 'essentials') }}
      aria-label="Open Cozy Biome"
    >
      <div className={wStyles.cardHeader}>
        <span className={wStyles.cardEyebrow}>Cozy {activeBiome === 'aquarium' ? 'Aquarium' : 'Zoo'}</span>
        <span className={wStyles.navArrow}>→</span>
      </div>

      {/* Scene */}
      <div className={`${styles.scene} ${activeBiome === 'aquarium' ? styles.sceneAqua : styles.sceneZoo}`}>
        {isEmpty ? (
          <div className={styles.sceneEmpty}>
            <span className={styles.sceneEmptyIcon}>{activeBiome === 'aquarium' ? '🐟' : '🐰'}</span>
            <span className={styles.sceneEmptyText}>Log cardio to earn VP and populate your {activeBiome}!</span>
          </div>
        ) : (
          <>
            <div className={styles.creatureLayer}>
              {creatures.slice(0, 5).map((c, i) => (
                <span
                  key={c.id}
                  className={`${styles.creature} ${c.category === 'fish' ? styles.fish : styles.animal}`}
                  style={{ '--ci': i } as React.CSSProperties}
                >
                  {c.emoji}
                </span>
              ))}
            </div>
            <div className={styles.decorLayer}>
              {decor.slice(0, 3).map((d, i) => (
                <span key={d.id} className={styles.decor} style={{ '--di': i } as React.CSSProperties}>
                  {d.emoji}
                </span>
              ))}
            </div>
            <div className={styles.surface}>
              {activeBiome === 'aquarium' ? '· · · · · · · · ·' : '~ ~ ~ ~ ~ ~ ~ ~ ~'}
            </div>
          </>
        )}
      </div>

      {/* VP footer */}
      <div className={styles.footer}>
        <span className={styles.count}>
          {purchased.length} item{purchased.length !== 1 ? 's' : ''} unlocked
        </span>
        {vp && (
          <span className={styles.vpBadge}>⚡ {vp.balance} VP</span>
        )}
      </div>
    </div>
  )
}
