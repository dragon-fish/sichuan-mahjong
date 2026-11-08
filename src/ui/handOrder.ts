import { suitOf, type Suit, type Tile } from '../engine/tiles'

/** A tile in the player's hand with a stable identity, so it can be dragged around. */
export interface HandSlot {
  id: number
  tile: Tile
}

/**
 * Display order of the whole concealed hand, drawn tile included.
 * `apart`: id of the slot shown apart on the right (a fresh draw the player has not moved).
 * When set, it is always the last slot.
 */
export interface HandOrder {
  slots: HandSlot[]
  apart: number | null
}

let nextId = 1
const slot = (tile: Tile): HandSlot => ({ id: nextId++, tile })

/** Sort key: by suit then rank, with the 定缺 suit pushed to the right. */
const sortKey = (t: Tile, que: Suit | null) => (suitOf(t) === que ? 100 : 0) + t

export function sortSlots(slots: HandSlot[], que: Suit | null): HandSlot[] {
  return [...slots].sort((a, b) => sortKey(a.tile, que) - sortKey(b.tile, que))
}

/** Sort the hand; a tile still apart stays apart. */
export function tidyOrder(order: HandOrder, que: Suit | null): HandOrder {
  const rest = order.slots.filter((s) => s.id !== order.apart)
  const apart = order.slots.filter((s) => s.id === order.apart)
  return { slots: [...sortSlots(rest, que), ...apart], apart: order.apart }
}

/** Where a tile joining a hand the player may have rearranged goes. */
function insertAt(slots: HandSlot[], tile: Tile): number {
  const same = slots.map((s) => s.tile).lastIndexOf(tile)
  if (same >= 0) return same + 1
  const higher = slots.findIndex((s) => suitOf(s.tile) === suitOf(tile) && s.tile > tile)
  if (higher >= 0) return higher
  const lastOfSuit = slots.map((s) => suitOf(s.tile)).lastIndexOf(suitOf(tile))
  return lastOfSuit >= 0 ? lastOfSuit + 1 : slots.length
}

/**
 * Bring `prev` in line with the engine's hand + drawn tile: keep the player's order for tiles still held.
 * A fresh draw goes apart on the right; a tile still apart when the engine merges it slots in by kind;
 * a tile the player already placed stays put. A fresh deal (several new tiles at once) is simply sorted.
 * `gone`: slot the player just discarded from, removed in preference to other copies of its kind.
 */
export function reconcile(
  prev: HandOrder,
  hand: readonly Tile[],
  drawn: Tile | null,
  que: Suit | null,
  gone: number | null = null,
): HandOrder {
  const want = new Array<number>(27).fill(0)
  for (const t of hand) want[t]++
  if (drawn !== null) want[drawn]++

  const held = new Array<number>(27).fill(0)
  for (const s of prev.slots) held[s.tile]++
  const goneSlot = prev.slots.find((s) => s.id === gone)
  const dropFirst = goneSlot && held[goneSlot.tile] > want[goneSlot.tile] ? goneSlot.id : null

  const kept: HandSlot[] = []
  for (const s of prev.slots) {
    if (s.id === dropFirst) continue
    if (want[s.tile] > 0) {
      want[s.tile]--
      kept.push(s)
    }
  }
  const arrivals: Tile[] = []
  want.forEach((n, t) => {
    for (let i = 0; i < n; i++) arrivals.push(t)
  })

  if (arrivals.length > 1) {
    const sorted = sortSlots(hand.map(slot), que)
    if (drawn === null) return { slots: sorted, apart: null }
    const d = slot(drawn)
    return { slots: [...sorted, d], apart: d.id }
  }
  let slots = kept
  const apart = kept.find((s) => s.id === prev.apart)
  if (apart) {
    // Still a fresh draw: leave it apart.
    if (drawn !== null && arrivals.length === 0) return { slots: kept, apart: apart.id }
    // The engine merged a tile the player left apart: slot it in by kind.
    slots = kept.filter((s) => s !== apart)
    slots.splice(insertAt(slots, apart.tile), 0, apart)
  }
  if (arrivals.length === 1) {
    const s = slot(arrivals[0])
    if (drawn !== null) return { slots: [...slots, s], apart: s.id }
    slots.splice(insertAt(slots, s.tile), 0, s)
  }
  return { slots, apart: null }
}

/** Move a slot; dropping anything after the apart tile (or moving that tile) joins it to the hand. */
export function moveSlot(order: HandOrder, from: number, to: number): HandOrder {
  const slots = [...order.slots]
  const [s] = slots.splice(from, 1)
  slots.splice(to, 0, s)
  const apart = order.apart !== null && slots[slots.length - 1].id === order.apart && s.id !== order.apart ? order.apart : null
  return { slots, apart }
}
