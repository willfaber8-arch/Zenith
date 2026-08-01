/**
 * Mini Crossword puzzle bank (5×5, NYT-Mini style).
 *
 * Each puzzle is defined by its SOLUTION grid: five rows of five characters.
 * A '#' marks a BLOCKED (black) cell; any other character is the uppercase
 * solution letter for that white cell.
 *
 * Clue numbers are assigned by the standard crossword rule (see
 * `deriveNumbering` in MiniCrossword.tsx): scanning row-by-row, left-to-right,
 * a white cell gets the next number if it begins an Across run (≥2 cells) or a
 * Down run (≥2 cells). The `num` on every clue below matches that derivation
 * exactly — verified against the numbering algorithm.
 *
 * Every Across/Down run of two or more white cells is a real word with a clue.
 */

export interface MiniClue {
  num: number
  clue: string
}

export interface MiniPuzzle {
  /** Five strings, five chars each. '#' = blocked cell. */
  grid: string[]
  across: MiniClue[]
  down: MiniClue[]
}

/* ───────────────────────── EASY ───────────────────────── */

const EASY: MiniPuzzle[] = [
  {
    grid: ['BEAST', 'EARTH', 'ARMOR', 'STONE', 'THREE'],
    across: [
      { num: 1, clue: 'Wild, ferocious animal' },
      { num: 6, clue: 'Third planet from the sun' },
      { num: 7, clue: "Knight's protective plating" },
      { num: 8, clue: "Rock, or a gem's weight" },
      { num: 9, clue: 'Number after two' },
    ],
    down: [
      { num: 1, clue: 'Monster of a creature' },
      { num: 2, clue: 'Our home planet' },
      { num: 3, clue: "Tank's metal shell" },
      { num: 4, clue: 'Pebble, scaled up' },
      { num: 5, clue: "A trio's count" },
    ],
  },
  {
    grid: ['CHEAP', 'HELLO', 'ELBOW', 'ALONE', 'TOWER'],
    across: [
      { num: 1, clue: 'Inexpensive' },
      { num: 6, clue: 'Friendly greeting' },
      { num: 7, clue: "The arm's middle joint" },
      { num: 8, clue: 'By oneself' },
      { num: 9, clue: 'Tall, narrow structure' },
    ],
    down: [
      { num: 1, clue: 'Break the rules of a game' },
      { num: 2, clue: 'Phone opener' },
      { num: 3, clue: 'Nudge with the arm' },
      { num: 4, clue: 'Solo, with no one else' },
      { num: 5, clue: 'Electrical energy' },
    ],
  },
  {
    grid: ['MARSH', 'ALONE', 'ROYAL', 'SNAIL', 'HELLO'],
    across: [
      { num: 1, clue: 'Soggy wetland' },
      { num: 6, clue: "On one's own" },
      { num: 7, clue: 'Fit for a king' },
      { num: 8, clue: 'Slow, shelled garden crawler' },
      { num: 9, clue: 'Casual hi' },
    ],
    down: [
      { num: 1, clue: 'Swampy ground' },
      { num: 2, clue: 'Without any company' },
      { num: 3, clue: 'Regal and grand' },
      { num: 4, clue: 'Gastropod with a spiral home' },
      { num: 5, clue: 'Doorway greeting' },
    ],
  },
  {
    grid: ['PASTA', 'ARMOR', 'SMOKE', 'TOKEN', 'ARENA'],
    across: [
      { num: 1, clue: 'Spaghetti or penne' },
      { num: 6, clue: 'Suit of body protection' },
      { num: 7, clue: 'It rises from a campfire' },
      { num: 8, clue: 'Arcade coin' },
      { num: 9, clue: 'Big sports venue' },
    ],
    down: [
      { num: 1, clue: 'Italian noodle dish' },
      { num: 2, clue: 'Knight in shining ___' },
      { num: 3, clue: 'Where there is fire, there is this' },
      { num: 4, clue: 'Old-style subway fare piece' },
      { num: 5, clue: 'Concert or basketball setting' },
    ],
  },
  {
    grid: ['START', 'MOWER', 'AWARE', 'RERUN', 'TREND'],
    across: [
      { num: 1, clue: 'Begin' },
      { num: 6, clue: 'Lawn-cutting machine' },
      { num: 7, clue: 'Conscious of, in the know' },
      { num: 8, clue: 'TV episode shown again' },
      { num: 9, clue: 'Popular fad' },
    ],
    down: [
      { num: 1, clue: 'Clever and bright' },
      { num: 2, clue: 'Skyscraper, essentially' },
      { num: 3, clue: 'Alert and mindful' },
      { num: 4, clue: 'Syndicated repeat' },
      { num: 5, clue: 'Direction things are heading' },
    ],
  },
  {
    grid: ['#MEN#', 'FIXED', 'ENTER', 'WORDY', '#RAY#'],
    across: [
      { num: 1, clue: 'Gentlemen' },
      { num: 4, clue: 'Repaired' },
      { num: 6, clue: 'Go in, or the confirm key' },
      { num: 7, clue: 'Using far too many words' },
      { num: 8, clue: 'Beam of light' },
    ],
    down: [
      { num: 1, clue: 'Not major' },
      { num: 2, clue: 'Additional; a bit more' },
      { num: 3, clue: 'Requiring lots of help' },
      { num: 4, clue: 'Not many' },
      { num: 5, clue: 'Not wet' },
    ],
  },
]

/* ──────────────────────── MEDIUM ──────────────────────── */

const MEDIUM: MiniPuzzle[] = [
  {
    grid: ['PHONE', 'HERON', 'ORBIT', 'NOISE', 'ENTER'],
    across: [
      { num: 1, clue: 'Device you take calls on' },
      { num: 6, clue: 'Long-legged marsh wader' },
      { num: 7, clue: 'Curved path around a planet' },
      { num: 8, clue: 'Unwanted racket' },
      { num: 9, clue: 'Walk into a room' },
    ],
    down: [
      { num: 1, clue: 'Smartphone, for one' },
      { num: 2, clue: 'Bird with an S-shaped neck' },
      { num: 3, clue: "Satellite's route" },
      { num: 4, clue: 'Static on the line' },
      { num: 5, clue: 'Key pressed to submit' },
    ],
  },
  {
    grid: ['CHASE', 'HERON', 'ARENA', 'SONIC', 'ENACT'],
    across: [
      { num: 1, clue: 'Pursue at speed' },
      { num: 6, clue: 'Great blue ___ (wading bird)' },
      { num: 7, clue: 'Gladiators fought here' },
      { num: 8, clue: 'Faster than sound' },
      { num: 9, clue: 'Pass into law' },
    ],
    down: [
      { num: 1, clue: 'Run after' },
      { num: 2, clue: 'Riverbank stalker' },
      { num: 3, clue: 'Venue for a big event' },
      { num: 4, clue: 'Of sound waves' },
      { num: 5, clue: 'Perform, as a scene' },
    ],
  },
  {
    grid: ['TRACK', 'ROBIN', 'ABOVE', 'CIVIL', 'KNELT'],
    across: [
      { num: 1, clue: "Runner's oval" },
      { num: 6, clue: 'Red-breasted spring bird' },
      { num: 7, clue: 'Directly overhead' },
      { num: 8, clue: 'Polite, or a kind of war' },
      { num: 9, clue: 'Got down on one knee' },
    ],
    down: [
      { num: 1, clue: 'Follow the trail of' },
      { num: 2, clue: "Batman's sidekick" },
      { num: 3, clue: 'Higher than' },
      { num: 4, clue: 'Courteous and respectful' },
      { num: 5, clue: 'Bowed on bended knee' },
    ],
  },
  {
    grid: ['SNARE', 'NAVAL', 'AVOID', 'RAISE', 'ELDER'],
    across: [
      { num: 1, clue: 'Trap, or a rattling drum' },
      { num: 6, clue: 'Relating to the navy' },
      { num: 7, clue: 'Steer clear of' },
      { num: 8, clue: 'Lift up, or a pay bump' },
      { num: 9, clue: 'Senior of the group' },
    ],
    down: [
      { num: 1, clue: 'Catch in a trap' },
      { num: 2, clue: 'Of the fleet' },
      { num: 3, clue: 'Dodge entirely' },
      { num: 4, clue: 'Bring up, as children' },
      { num: 5, clue: 'The older one' },
    ],
  },
  {
    grid: ['SNIT#', 'HERON', 'AWAKE', 'METER', '#REND'],
    across: [
      { num: 1, clue: 'Fit of irritation' },
      { num: 5, clue: "Stork's marsh relative" },
      { num: 7, clue: 'Not sleeping' },
      { num: 8, clue: 'Parking ___' },
      { num: 9, clue: 'Violently tear apart' },
    ],
    down: [
      { num: 1, clue: 'Complete fake' },
      { num: 2, clue: 'More recent' },
      { num: 3, clue: 'Absolutely furious' },
      { num: 4, clue: 'Small symbolic gesture' },
      { num: 6, clue: 'Bookish, brainy sort' },
    ],
  },
  {
    grid: ['CRANE', 'RIVAL', 'AVOID', 'NAIVE', 'ELDER'],
    across: [
      { num: 1, clue: 'Construction lifter, or a bird' },
      { num: 6, clue: 'Head-to-head competitor' },
      { num: 7, clue: 'Sidestep and shun' },
      { num: 8, clue: 'Innocently trusting' },
      { num: 9, clue: 'Wise village ___' },
    ],
    down: [
      { num: 1, clue: 'Stretch your neck to see' },
      { num: 2, clue: 'Sporting opponent' },
      { num: 3, clue: 'Keep well away from' },
      { num: 4, clue: 'Green, as a newcomer' },
      { num: 5, clue: 'Grandparent, e.g.' },
    ],
  },
]

/* ───────────────────────── HARD ───────────────────────── */

const HARD: MiniPuzzle[] = [
  {
    grid: ['CRUST', 'RULER', 'ULTRA', 'SERUM', 'TRAMP'],
    across: [
      { num: 1, clue: 'Pizza edge' },
      { num: 6, clue: 'Straightedge, or a monarch' },
      { num: 7, clue: 'Prefix meaning "extreme"' },
      { num: 8, clue: 'Blood fluid; vaccine base' },
      { num: 9, clue: 'Wander on foot, or a vagabond' },
    ],
    down: [
      { num: 1, clue: "Bread's hard outer layer" },
      { num: 2, clue: 'Reigning sovereign' },
      { num: 3, clue: 'Extremely, informally' },
      { num: 4, clue: 'Antivenom liquid' },
      { num: 5, clue: 'Roaming hobo' },
    ],
  },
  {
    grid: ['GRUFF', 'RUMOR', 'UMBRA', 'FORUM', 'FRAME'],
    across: [
      { num: 1, clue: 'Brusque and hoarse' },
      { num: 6, clue: 'Unverified bit of gossip' },
      { num: 7, clue: "A shadow's darkest core" },
      { num: 8, clue: 'Online discussion board' },
      { num: 9, clue: 'Picture border' },
    ],
    down: [
      { num: 1, clue: 'Curt and grumpy in manner' },
      { num: 2, clue: 'Word on the street' },
      { num: 3, clue: "The moon's deep eclipse shadow" },
      { num: 4, clue: 'Roman public square' },
      { num: 5, clue: 'Set up, as a fall guy' },
    ],
  },
  {
    grid: ['SPOUT', 'PRUNE', 'OUNCE', 'UNCUT', 'TEETH'],
    across: [
      { num: 1, clue: "A teapot's pourer" },
      { num: 6, clue: 'Trim back, or a dried plum' },
      { num: 7, clue: 'One-sixteenth of a pound' },
      { num: 8, clue: 'Not edited down' },
      { num: 9, clue: 'Mouthful of enamel' },
    ],
    down: [
      { num: 1, clue: 'Gush forth' },
      { num: 2, clue: 'Snip back a shrub' },
      { num: 3, clue: 'Tiny unit of weight' },
      { num: 4, clue: 'Full-length, as a film' },
      { num: 5, clue: "A comb's points" },
    ],
  },
  {
    grid: ['THREW', 'HYENA', 'RENAL', 'ENACT', 'WALTZ'],
    across: [
      { num: 1, clue: 'Tossed a ball' },
      { num: 6, clue: 'Laughing savanna scavenger' },
      { num: 7, clue: 'Of the kidneys' },
      { num: 8, clue: 'Make into law' },
      { num: 9, clue: 'Ballroom dance in 3/4 time' },
    ],
    down: [
      { num: 1, clue: 'Pitched, as a fastball' },
      { num: 2, clue: 'Cackling African mammal' },
      { num: 3, clue: 'Kidney-related' },
      { num: 4, clue: 'Put into effect' },
      { num: 5, clue: 'Viennese three-step' },
    ],
  },
  {
    grid: ['SCOUR', 'CAUSE', 'OUGHT', 'USHER', 'RETRO'],
    across: [
      { num: 1, clue: 'Scrub hard' },
      { num: 6, clue: 'Bring about' },
      { num: 7, clue: 'Really should' },
      { num: 8, clue: 'Show to a seat' },
      { num: 9, clue: 'Nostalgically old-fashioned' },
    ],
    down: [
      { num: 1, clue: 'Search thoroughly' },
      { num: 2, clue: 'A worthy ___' },
      { num: 3, clue: 'Is duty-bound to' },
      { num: 4, clue: 'Theater aisle guide' },
      { num: 5, clue: 'Vintage-inspired' },
    ],
  },
  {
    grid: ['#SLAG', 'STALE', 'MANIA', 'ULCER', 'GLEN#'],
    across: [
      { num: 1, clue: 'Waste left over from smelting' },
      { num: 5, clue: 'No longer fresh' },
      { num: 6, clue: 'A frenzied craze' },
      { num: 7, clue: 'Painful stomach sore' },
      { num: 8, clue: 'Narrow wooded valley' },
    ],
    down: [
      { num: 1, clue: 'Delay to buy time' },
      { num: 2, clue: "A knight's long spear" },
      { num: 3, clue: 'Extraterrestrial being' },
      { num: 4, clue: 'Equipment and kit' },
      { num: 5, clue: 'Annoyingly self-satisfied' },
    ],
  },
]

export const MINI_CROSSWORDS: Record<'easy' | 'medium' | 'hard', MiniPuzzle[]> = {
  easy: EASY,
  medium: MEDIUM,
  hard: HARD,
}

/** Pick a random puzzle of the given difficulty, avoiding `avoidIndex` if possible. */
export function pickPuzzle(
  difficulty: 'easy' | 'medium' | 'hard',
  avoidIndex = -1,
): { puzzle: MiniPuzzle; index: number } {
  const pool = MINI_CROSSWORDS[difficulty]
  if (pool.length === 1) return { puzzle: pool[0], index: 0 }
  let index = Math.floor(Math.random() * pool.length)
  if (index === avoidIndex) index = (index + 1) % pool.length
  return { puzzle: pool[index], index }
}
