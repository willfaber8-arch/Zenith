/* ════════════════════════════════════════════════════════════
   Phase 8 · Step 8.5 — Peer Game Finder
   Multi-property entity schema, display label maps, and
   the canonical 12-entry DEFAULT_PEER_GAMES seed dataset.
   ════════════════════════════════════════════════════════════ */

/* ── Enumerated value types ──────────────────────────────── */

export type CostCategory = 'FREE' | 'UNDER_15' | 'PREMIUM'
export type Platform     = 'WEB_BROWSER' | 'STEAM' | 'EPIC_GAMES' | 'CONSOLE'
export type Genre        = 'COZY' | 'TACTICAL' | 'TRIVIA' | 'BRACKET_BASED' | 'PARTY'

/* ── Core game entity ─────────────────────────────────────── */

export type PeerGame = {
  id:            string
  title:         string
  description:   string
  costCategory:  CostCategory
  platforms:     Platform[]
  genres:        Genre[]
  minPlayers:    number
  maxPlayers:    number
  externalLink?: string
}

/* ── Display label dictionaries ──────────────────────────── */

export const COST_LABELS: Record<CostCategory, string> = {
  FREE:     'Free to Play',
  UNDER_15: 'Under $15',
  PREMIUM:  'Premium ($15+)',
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  WEB_BROWSER: 'Browser',
  STEAM:       'Steam',
  EPIC_GAMES:  'Epic',
  CONSOLE:     'Console',
}

export const GENRE_LABELS: Record<Genre, string> = {
  COZY:          'Cozy',
  TACTICAL:      'Tactical',
  TRIVIA:        'Trivia',
  BRACKET_BASED: 'Bracket',
  PARTY:         'Party',
}

/* ── Ordered filter arrays (drives sidebar render order) ──── */

export const ALL_COST_CATEGORIES: CostCategory[] = ['FREE', 'UNDER_15', 'PREMIUM']
export const ALL_PLATFORMS:       Platform[]     = ['WEB_BROWSER', 'STEAM', 'EPIC_GAMES', 'CONSOLE']
export const ALL_GENRES:          Genre[]        = ['COZY', 'TACTICAL', 'TRIVIA', 'BRACKET_BASED', 'PARTY']

/* ── Seed dataset — 12 cross-platform multiplayer titles ─── */

export const DEFAULT_PEER_GAMES: PeerGame[] = [
  {
    id:           'jackbox-party-pack',
    title:        'Jackbox Party Pack',
    description:
      'A collection of hilariously creative party games playable via smartphones — no controllers needed. One person owns the game and streams it; everyone else joins through a phone browser. Includes Quiplash, Drawful, and Fibbage across multiple packs.',
    costCategory: 'PREMIUM',
    platforms:    ['STEAM', 'CONSOLE'],
    genres:       ['PARTY', 'TRIVIA'],
    minPlayers:   2,
    maxPlayers:   8,
    externalLink: 'https://www.jackboxgames.com/',
  },
  {
    id:           'among-us',
    title:        'Among Us',
    description:
      'A social deduction game of betrayal aboard a spaceship. Crewmates complete tasks while Impostors sabotage and eliminate them. Works best with voice chat and groups of 6–10 players arguing over who the traitor is.',
    costCategory: 'UNDER_15',
    platforms:    ['STEAM', 'EPIC_GAMES', 'CONSOLE', 'WEB_BROWSER'],
    genres:       ['TACTICAL', 'PARTY'],
    minPlayers:   4,
    maxPlayers:   15,
    externalLink: 'https://www.innersloth.com/games/among-us/',
  },
  {
    id:           'gartic-phone',
    title:        'Gartic Phone',
    description:
      'Browser-based cross between Telephone and Pictionary. Players alternate between writing prompts and drawing them — the results are always absurd. Multiple modes including Animations and Secret. Free with no account required.',
    costCategory: 'FREE',
    platforms:    ['WEB_BROWSER'],
    genres:       ['PARTY', 'COZY'],
    minPlayers:   4,
    maxPlayers:   16,
    externalLink: 'https://garticphone.com/',
  },
  {
    id:           'codenames-online',
    title:        'Codenames Online',
    description:
      'A cooperative word-association spy game. Two team captains give one-word clues to help teammates identify secret agents on a 5×5 word grid. Works great with large groups split into two competing teams.',
    costCategory: 'FREE',
    platforms:    ['WEB_BROWSER'],
    genres:       ['TRIVIA', 'PARTY'],
    minPlayers:   2,
    maxPlayers:   8,
    externalLink: 'https://codenames.game/',
  },
  {
    id:           'overcooked-2',
    title:        'Overcooked! 2',
    description:
      'Chaotic co-op cooking that requires tight real-time coordination to prepare and serve meals in increasingly absurd kitchens — some of which are on moving platforms or split across disconnected spaces.',
    costCategory: 'UNDER_15',
    platforms:    ['STEAM', 'CONSOLE'],
    genres:       ['COZY', 'PARTY'],
    minPlayers:   2,
    maxPlayers:   4,
    externalLink: 'https://www.team17.com/games/overcooked-2/',
  },
  {
    id:           'terraria',
    title:        'Terraria',
    description:
      'A 2D sandbox adventure combining exploration, crafting, and combat across procedurally generated worlds. Multiplayer lets friends collaboratively build bases, defeat bosses, and progress through a deep content tree.',
    costCategory: 'UNDER_15',
    platforms:    ['STEAM', 'CONSOLE'],
    genres:       ['COZY', 'TACTICAL'],
    minPlayers:   2,
    maxPlayers:   8,
    externalLink: 'https://www.terraria.org/',
  },
  {
    id:           'fall-guys',
    title:        'Fall Guys',
    description:
      'Colorful battle-royale featuring jelly-bean characters competing in chaotic obstacle courses and physics-based mini-games. Free-to-play with full crossplay across all platforms. Best enjoyed with a squad in a private show.',
    costCategory: 'FREE',
    platforms:    ['STEAM', 'EPIC_GAMES', 'CONSOLE'],
    genres:       ['PARTY', 'BRACKET_BASED'],
    minPlayers:   2,
    maxPlayers:   60,
    externalLink: 'https://www.fallguys.com/',
  },
  {
    id:           'skribbl-io',
    title:        'Skribbl.io',
    description:
      'Free browser-based multiplayer drawing and guessing game. One player draws a prompted word while others race to type the correct guess for points. Custom word lists let you theme the game to anything.',
    costCategory: 'FREE',
    platforms:    ['WEB_BROWSER'],
    genres:       ['PARTY', 'TRIVIA'],
    minPlayers:   2,
    maxPlayers:   12,
    externalLink: 'https://skribbl.io/',
  },
  {
    id:           'pummel-party',
    title:        'Pummel Party',
    description:
      'A chaotic digital board game that blends classic party board-game mechanics with 40+ brutally creative mini-games. Up to 8 players traverse randomized boards, collect items, and end friendships.',
    costCategory: 'UNDER_15',
    platforms:    ['STEAM'],
    genres:       ['PARTY', 'BRACKET_BASED'],
    minPlayers:   2,
    maxPlayers:   8,
    externalLink: 'https://store.steampowered.com/app/704580/Pummel_Party/',
  },
  {
    id:           'it-takes-two',
    title:        'It Takes Two',
    description:
      'Award-winning co-op adventure designed exclusively for two players. Every chapter introduces a completely new gameplay mechanic. Includes a free Friend Pass — one purchase covers both players.',
    costCategory: 'UNDER_15',
    platforms:    ['STEAM', 'CONSOLE', 'EPIC_GAMES'],
    genres:       ['COZY'],
    minPlayers:   2,
    maxPlayers:   2,
    externalLink: 'https://www.ea.com/games/it-takes-two',
  },
  {
    id:           'golf-with-friends',
    title:        'Golf With Your Friends',
    description:
      'Multiplayer mini-golf for up to 12 players across courses with moving obstacles, power-ups, and multiple ball shapes. Low-stakes competitive fun that scales from casual to surprisingly intense.',
    costCategory: 'UNDER_15',
    platforms:    ['STEAM', 'CONSOLE'],
    genres:       ['COZY', 'PARTY'],
    minPlayers:   2,
    maxPlayers:   12,
    externalLink: 'https://www.team17.com/games/golf-with-your-friends/',
  },
  {
    id:           'rocket-league',
    title:        'Rocket League',
    description:
      'Rocket-powered cars playing soccer in an arena — deceptively simple to learn, deeply technical to master. Free-to-play with full crossplay. Ranked, casual, and private match modes for all skill levels.',
    costCategory: 'FREE',
    platforms:    ['STEAM', 'EPIC_GAMES', 'CONSOLE'],
    genres:       ['TACTICAL', 'BRACKET_BASED'],
    minPlayers:   2,
    maxPlayers:   8,
    externalLink: 'https://www.rocketleague.com/',
  },
]
