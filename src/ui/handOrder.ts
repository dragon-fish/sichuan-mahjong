import { suitOf, type Suit, type Tile } from '../engine/tiles'

/** A tile in the player's hand with a stable identity, so it can be dragged around. */
export interface HandSlot {
  id: number
  tile: Tile
}

let nextId = 1
const slot = (tile: Tile): HandSlot => ({ id: nextId++, tile })

/** Sort key: by suit then rank, with the 定缺 suit pushed to the right. */
const sortKey = (t: Tile, que: Suit | null) => (suitOf(t) === que ? 100 : 0) + t

export function sortSlots(slots: HandSlot[], que: Suit | null): HandSlot[] {
  return [...slots].sort((a, b) => sortKey(a.tile, que) - sortKey(b.tile, que))
}

/** Where a newly arrived tile goes in a hand the player may have rearranged. */
function insertAt(slots: HandSlot[], tile: Tile): number {
  const same = slots.map((s) => s.tile).lastIndexOf(tile)
  if (same >= 0) return same + 1
  const higher = slots.findIndex((s) => suitOf(s.tile) === suitOf(tile) && s.tile > tile)
  if (higher >= 0) return higher
  const lastOfSuit = slots.map((s) => suitOf(s.tile)).lastIndexOf(suitOf(tile))
  return lastOfSuit >= 0 ? lastOfSuit + 1 : slots.length
}

/**
 * Bring `prev` in line with the engine's hand: keep the player's order for tiles still held,
 * slot new arrivals in. A fresh deal (several new tiles at once) is simply sorted.
 */
export function reconcile(prev: HandSlot[], hand: readonly Tile[], que: Suit | null): HandSlot[] {
  const want = new Array<number>(27).fill(0)
  for (const t of hand) want[t]++
  const kept: HandSlot[] = []
  for (const s of prev) {
    if (want[s.tile] > 0) {
      want[s.tile]--
      kept.push(s)
    }
  }
  const arrivals: Tile[] = []
  want.forEach((n, t) => {
    for (let i = 0; i < n; i++) arrivals.push(t)
  })
  if (arrivals.length > 1) return sortSlots([...kept, ...arrivals.map(slot)], que)
  for (const t of arrivals) kept.splice(insertAt(kept, t), 0, slot(t))
  return kept
}

export function moveSlot(slots: HandSlot[], from: number, to: number): HandSlot[] {
  const out = [...slots]
  const [s] = out.splice(from, 1)
  out.splice(to, 0, s)
  return out
}
