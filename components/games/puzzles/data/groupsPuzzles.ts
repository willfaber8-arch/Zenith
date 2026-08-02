/**
 * Puzzle bank for the "Groups" game (Connections-style).
 *
 * Each puzzle holds exactly four hidden categories. Groups are authored in
 * ascending trickiness (index 0 = easiest / yellow, 3 = hardest / purple),
 * mirroring the colour-rank convention of the genre. Words are kept short so
 * they fit comfortably on a tile, and are unique within any single puzzle.
 */

import type { Difficulty } from '../types'

export interface GroupsGroup {
  /** Category label revealed when the group is solved. */
  name: string
  /** Exactly four member words (uppercase, tile-sized). */
  words: [string, string, string, string]
}

export interface GroupsPuzzle {
  /** Four categories, ordered easiest → hardest. */
  groups: [GroupsGroup, GroupsGroup, GroupsGroup, GroupsGroup]
}

/* ── EASY — crisp, well-separated categories ─────────────────────────── */
const EASY: GroupsPuzzle[] = [
  { groups: [
    { name: 'Colours',     words: ['RED', 'BLUE', 'GREEN', 'PINK'] },
    { name: 'Fruits',      words: ['APPLE', 'MANGO', 'GRAPE', 'LEMON'] },
    { name: 'Animals',     words: ['TIGER', 'HORSE', 'ZEBRA', 'KOALA'] },
    { name: 'Body parts',  words: ['ELBOW', 'ANKLE', 'WRIST', 'SHIN'] },
  ] },
  { groups: [
    { name: 'Planets',     words: ['MARS', 'VENUS', 'EARTH', 'PLUTO'] },
    { name: 'Metals',      words: ['IRON', 'GOLD', 'ZINC', 'LEAD'] },
    { name: 'Trees',       words: ['OAK', 'PINE', 'BIRCH', 'MAPLE'] },
    { name: 'Sports',      words: ['GOLF', 'POLO', 'RUGBY', 'JUDO'] },
  ] },
  { groups: [
    { name: 'At the sea',  words: ['WAVE', 'TIDE', 'REEF', 'SURF'] },
    { name: 'Tableware',   words: ['FORK', 'SPOON', 'PLATE', 'BOWL'] },
    { name: 'Weather',     words: ['RAIN', 'SNOW', 'WIND', 'HAIL'] },
    { name: 'Instruments', words: ['DRUM', 'FLUTE', 'PIANO', 'CELLO'] },
  ] },
  { groups: [
    { name: 'Card suits',   words: ['HEART', 'SPADE', 'CLUB', 'DIAMOND'] },
    { name: 'Chess pieces', words: ['KING', 'QUEEN', 'ROOK', 'PAWN'] },
    { name: 'Insects',      words: ['ANT', 'BEE', 'MOTH', 'WASP'] },
    { name: 'Shapes',       words: ['CIRCLE', 'SQUARE', 'OVAL', 'CONE'] },
  ] },
  { groups: [
    { name: 'Vegetables', words: ['PEA', 'CORN', 'KALE', 'BEAN'] },
    { name: 'Birds',      words: ['OWL', 'CROW', 'DOVE', 'SWAN'] },
    { name: 'Furniture',  words: ['SOFA', 'DESK', 'CHAIR', 'TABLE'] },
    { name: 'Drinks',     words: ['SODA', 'JUICE', 'WATER', 'COCOA'] },
  ] },
  { groups: [
    { name: 'Directions', words: ['NORTH', 'SOUTH', 'EAST', 'WEST'] },
    { name: 'Gemstones',  words: ['RUBY', 'PEARL', 'JADE', 'OPAL'] },
    { name: 'Tools',      words: ['DRILL', 'SAW', 'HAMMER', 'WRENCH'] },
    { name: 'Seasons',    words: ['SPRING', 'SUMMER', 'FALL', 'WINTER'] },
  ] },
  { groups: [
    { name: 'Farm animals', words: ['COW', 'PIG', 'HEN', 'GOAT'] },
    { name: 'Money',        words: ['CENT', 'COIN', 'CASH', 'BILL'] },
    { name: 'Footwear',     words: ['BOOT', 'CLOG', 'HEEL', 'SANDAL'] },
    { name: 'Pasta',        words: ['PENNE', 'ZITI', 'ORZO', 'SHELL'] },
  ] },
  { groups: [
    { name: 'Citrus fruit', words: ['LIME', 'ORANGE', 'YUZU', 'CITRON'] },
    { name: 'Dog breeds',   words: ['PUG', 'BOXER', 'HUSKY', 'CORGI'] },
    { name: 'Time spans',   words: ['HOUR', 'WEEK', 'MONTH', 'YEAR'] },
    { name: 'Rooms',        words: ['ATTIC', 'KITCHEN', 'DEN', 'FOYER'] },
  ] },
]

/* ── MEDIUM — a wildcard or two, a little wordplay ───────────────────── */
const MEDIUM: GroupsPuzzle[] = [
  { groups: [
    { name: '___ ball',       words: ['BASE', 'FOOT', 'BASKET', 'MEAT'] },
    { name: 'Types of bear',  words: ['POLAR', 'PANDA', 'BROWN', 'SUN'] },
    { name: 'Shades of blue', words: ['NAVY', 'TEAL', 'SKY', 'ROYAL'] },
    { name: 'Coffee orders',  words: ['MOCHA', 'LATTE', 'BREW', 'DRIP'] },
  ] },
  { groups: [
    { name: 'Homophones',    words: ['PEAR', 'PLANE', 'SOLE', 'MOOSE'] },
    { name: 'Board games',   words: ['CLUE', 'RISK', 'SORRY', 'LIFE'] },
    { name: '___ light',     words: ['SUN', 'SPOT', 'FLASH', 'MOON'] },
    { name: 'Kinds of bread',words: ['RYE', 'NAAN', 'PITA', 'TOAST'] },
  ] },
  { groups: [
    { name: 'Nuts',         words: ['PECAN', 'CASHEW', 'WALNUT', 'ALMOND'] },
    { name: '___ house',    words: ['GREEN', 'LIGHT', 'TREE', 'WARE'] },
    { name: 'Dance styles', words: ['SALSA', 'TANGO', 'WALTZ', 'SWING'] },
    { name: 'Dips & sauces',words: ['RANCH', 'QUESO', 'GRAVY', 'PESTO'] },
  ] },
  { groups: [
    { name: 'Pasta shapes', words: ['PENNE', 'ZITI', 'ORZO', 'GNOCCHI'] },
    { name: 'Greek letters',words: ['ALPHA', 'BETA', 'DELTA', 'OMEGA'] },
    { name: 'Martial arts', words: ['KARATE', 'JUDO', 'SUMO', 'BOXING'] },
    { name: 'Poker moves',  words: ['FOLD', 'RAISE', 'CALL', 'BLUFF'] },
  ] },
  { groups: [
    { name: 'Card ranks', words: ['JACK', 'QUEEN', 'KING', 'ACE'] },
    { name: '___ fish',   words: ['CAT', 'JELLY', 'STAR', 'SWORD'] },
    { name: '___ berry',  words: ['BLACK', 'BLUE', 'STRAW', 'RASP'] },
    { name: 'Types of tea',words: ['CHAI', 'OOLONG', 'HERBAL', 'MINT'] },
  ] },
  { groups: [
    { name: 'Constellations', words: ['ORION', 'LYRA', 'DRACO', 'CYGNUS'] },
    { name: 'Zodiac signs',   words: ['LEO', 'ARIES', 'VIRGO', 'LIBRA'] },
    { name: '___ stone',      words: ['LIME', 'CORNER', 'MILE', 'BRIM'] },
    { name: 'Currencies',     words: ['EURO', 'YEN', 'PESO', 'RUPEE'] },
  ] },
  { groups: [
    { name: 'Cocktails',     words: ['MOJITO', 'MARTINI', 'MULE', 'SOUR'] },
    { name: 'Units of length',words: ['INCH', 'FOOT', 'MILE', 'YARD'] },
    { name: '___ work',      words: ['NET', 'HOME', 'FRAME', 'TEAM'] },
    { name: 'Cheeses',       words: ['BRIE', 'FETA', 'GOUDA', 'SWISS'] },
  ] },
  { groups: [
    { name: 'Feelings',     words: ['HAPPY', 'ANGRY', 'SAD', 'PROUD'] },
    { name: '___ port',     words: ['AIR', 'SEA', 'PASS', 'CAR'] },
    { name: 'Herbs',        words: ['BASIL', 'THYME', 'SAGE', 'MINT'] },
    { name: 'Bodies of water',words: ['LAKE', 'POND', 'GULF', 'BAY'] },
  ] },
]

/* ── HARD — overlapping traps, red-herring members ───────────────────── */
const HARD: GroupsPuzzle[] = [
  { groups: [
    { name: 'Flowers',      words: ['TULIP', 'DAISY', 'IRIS', 'ROSE'] },
    { name: '___ pad',      words: ['LILY', 'LAUNCH', 'NOTE', 'KEY'] },
    { name: 'Virtue names', words: ['GRACE', 'HOPE', 'FAITH', 'JOY'] },
    { name: 'Boxing moves', words: ['JAB', 'HOOK', 'CROSS', 'DUCK'] },
  ] },
  { groups: [
    { name: '___ cut',    words: ['SHORT', 'WOOD', 'CLEAR', 'PAPER'] },
    { name: '___ line',   words: ['HAIR', 'SHORE', 'DEAD', 'BASE'] },
    { name: 'Sewing',     words: ['HEM', 'SEAM', 'STITCH', 'PLEAT'] },
    { name: 'Card games', words: ['HEARTS', 'SPADES', 'BRIDGE', 'EUCHRE'] },
  ] },
  { groups: [
    { name: 'Chess pieces',   words: ['KNIGHT', 'ROOK', 'PAWN', 'QUEEN'] },
    { name: 'Clergy',         words: ['BISHOP', 'DEACON', 'PASTOR', 'VICAR'] },
    { name: 'Monopoly tokens',words: ['BOOT', 'IRON', 'HAT', 'THIMBLE'] },
    { name: '___ mate',       words: ['CHECK', 'ROOM', 'CLASS', 'SHIP'] },
  ] },
  { groups: [
    { name: 'Rivers',      words: ['NILE', 'CONGO', 'VOLGA', 'RHINE'] },
    { name: 'Countries',   words: ['JORDAN', 'CHAD', 'CHINA', 'PERU'] },
    { name: 'NBA legends', words: ['BIRD', 'MAGIC', 'KOBE', 'SHAQ'] },
    { name: 'Songbirds',   words: ['WREN', 'FINCH', 'ROBIN', 'RAVEN'] },
  ] },
  { groups: [
    { name: '___ fire',  words: ['CAMP', 'BON', 'CROSS', 'WILD'] },
    { name: '___ house', words: ['FARM', 'DOLL', 'WARE', 'LIGHT'] },
    { name: '___ berry', words: ['BLACK', 'BLUE', 'GOOSE', 'STRAW'] },
    { name: '___ fly',   words: ['BUTTER', 'DRAGON', 'MAY', 'HORSE'] },
  ] },
  { groups: [
    { name: 'Shades of green', words: ['OLIVE', 'LIME', 'JADE', 'MINT'] },
    { name: 'Herbs',           words: ['BASIL', 'SAGE', 'THYME', 'DILL'] },
    { name: 'Cocktails',       words: ['MOJITO', 'MARTINI', 'NEGRONI', 'GIMLET'] },
    { name: 'Italian dishes',  words: ['PIZZA', 'PESTO', 'RISOTTO', 'GELATO'] },
  ] },
  { groups: [
    { name: '___ tape',    words: ['DUCT', 'SCOTCH', 'MASK', 'WASHI'] },
    { name: '___ carpet',  words: ['RED', 'MAGIC', 'FLYING', 'WELCOME'] },
    { name: 'Whiskies',    words: ['RYE', 'BOURBON', 'IRISH', 'MALT'] },
    { name: 'Fury',        words: ['RAGE', 'WRATH', 'IRE', 'STORM'] },
  ] },
  { groups: [
    { name: 'Palindromes',  words: ['KAYAK', 'LEVEL', 'RADAR', 'CIVIC'] },
    { name: '___ up',       words: ['WARM', 'MAKE', 'SET', 'PUSH'] },
    { name: 'Boats',        words: ['CANOE', 'YACHT', 'FERRY', 'RAFT'] },
    { name: '___ detector', words: ['SMOKE', 'METAL', 'LIE', 'MOTION'] },
  ] },
]

export const GROUPS_PUZZLES: Record<Difficulty, GroupsPuzzle[]> = {
  easy:   EASY,
  medium: MEDIUM,
  hard:   HARD,
}

export const GROUPS_PUZZLE_COUNT: Record<Difficulty, number> = {
  easy:   EASY.length,
  medium: MEDIUM.length,
  hard:   HARD.length,
}

/**
 * Pick a random puzzle for the given difficulty. When `exclude` is supplied,
 * the picker avoids returning that index (so "Play again" always feels fresh)
 * unless the bank has only a single entry.
 */
export function pickGroupsPuzzle(
  difficulty: Difficulty,
  exclude?: number,
): { puzzle: GroupsPuzzle; index: number } {
  const bank = GROUPS_PUZZLES[difficulty]
  if (bank.length === 1) return { puzzle: bank[0], index: 0 }

  let index = Math.floor(Math.random() * bank.length)
  if (exclude != null && index === exclude) {
    index = (index + 1 + Math.floor(Math.random() * (bank.length - 1))) % bank.length
  }
  return { puzzle: bank[index], index }
}
