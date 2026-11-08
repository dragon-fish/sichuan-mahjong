/** Tile kind: suit * 9 + (rank - 1), 0..26. Suits: 0 = 万, 1 = 条, 2 = 筒. */
export type Tile = number
export type Suit = 0 | 1 | 2

export const SUITS: readonly Suit[] = [0, 1, 2]
export const SUIT_NAMES = ['万', '条', '筒'] as const
const RANK_NAMES = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
const SUIT_CODES = ['m', 's', 'p']

export const suitOf = (t: Tile): Suit => Math.floor(t / 9) as Suit
export const rankOf = (t: Tile): number => (t % 9) + 1
export const tile = (suit: Suit, rank: number): Tile => suit * 9 + rank - 1

/** Human-readable name, e.g. 三万. */
export const tileName = (t: Tile): string => RANK_NAMES[t % 9] + SUIT_NAMES[suitOf(t)]

/** Compact code, e.g. 3m. Handy for logs and LLM prompts. */
export const tileCode = (t: Tile): string => `${rankOf(t)}${SUIT_CODES[suitOf(t)]}`

/** Standard mahjong notation: digits then suit letter, e.g. 2468m3556s or 123m 55p. */
export function tilesCode(tiles: readonly Tile[]): string {
  let out = ''
  tiles.forEach((t, i) => {
    out += rankOf(t)
    if (i === tiles.length - 1 || suitOf(tiles[i + 1]) !== suitOf(t)) out += SUIT_CODES[suitOf(t)]
  })
  return out
}

export function parseTiles(codes: string): Tile[] {
  const compact = codes.replace(/\s+/g, '')
  if (!/^(\d+[msp])*$/.test(compact)) throw new Error(`bad tile notation: ${codes}`)
  const out: Tile[] = []
  for (const [, digits, s] of compact.matchAll(/(\d+)([msp])/g)) {
    for (const ch of digits) out.push(tile(SUIT_CODES.indexOf(s) as Suit, Number(ch)))
  }
  return out
}

export function fullWall(): Tile[] {
  const wall: Tile[] = []
  for (let t = 0; t < 27; t++) for (let i = 0; i < 4; i++) wall.push(t)
  return wall
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function toCounts(tiles: readonly Tile[]): number[] {
  const c = new Array<number>(27).fill(0)
  for (const t of tiles) c[t]++
  return c
}

export const sortTiles = (tiles: Tile[]): Tile[] => tiles.sort((a, b) => a - b)
