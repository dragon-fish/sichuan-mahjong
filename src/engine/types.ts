import type { Suit, Tile } from './tiles'

export type Seat = 0 | 1 | 2 | 3
export const SEATS: readonly Seat[] = [0, 1, 2, 3]
export const nextSeat = (s: Seat): Seat => ((s + 1) % 4) as Seat

export type MeldKind = 'peng' | 'minggang' | 'angang' | 'bugang'
export interface Meld {
  kind: MeldKind
  tile: Tile
  /** Seat that discarded the claimed tile (peng / minggang, and bugang's original peng). */
  from?: Seat
}
export const isGang = (m: Meld) => m.kind !== 'peng'

/** Concealed kong as seen by others: the tile is hidden. */
export type PublicMeld = Meld | { kind: 'angang'; tile: null }

export interface RiverTile {
  tile: Tile
  /** Taken by someone's peng / gang / hu. */
  claimed: boolean
}

export interface RuleConfig {
  baseScore: number
  fanCap: number
}
export const DEFAULT_RULES: RuleConfig = { baseScore: 1, fanCap: 4 }

export interface FanItem {
  name: string
  fan: number
}
export interface FanResult {
  items: FanItem[]
  /** Uncapped total. */
  total: number
}

export type WinKind = 'zimo' | 'dianpao' | 'qianggang'
export interface WinInfo {
  tile: Tile
  kind: WinKind
  /** Discarder / robbed seat; undefined for zimo. */
  from?: Seat
  fan: FanResult
  /** Order among winners of this round, 0-based. Simultaneous winners share an order. */
  order: number
}

export type PaymentReason =
  | 'hu'
  | 'minggang'
  | 'bugang'
  | 'angang'
  | 'huazhu'
  | 'dajiao'
  | 'refund'

export interface Payment {
  id: number
  from: Seat
  to: Seat
  amount: number
  reason: PaymentReason
  /** Human-readable explanation, e.g. 清一色 自摸 3番. */
  note: string
}

export type Action =
  | { type: 'que'; suit: Suit }
  | { type: 'discard'; tile: Tile }
  | { type: 'hu' }
  | { type: 'peng' }
  | { type: 'minggang' }
  | { type: 'angang'; tile: Tile }
  | { type: 'bugang'; tile: Tile }
  | { type: 'pass' }

export type GameEvent =
  | { type: 'start'; dealer: Seat; wall: number }
  | { type: 'que'; ques: Suit[] }
  | { type: 'draw'; seat: Seat; fromBack: boolean }
  | { type: 'discard'; seat: Seat; tile: Tile }
  | { type: 'peng'; seat: Seat; tile: Tile; from: Seat }
  | { type: 'gang'; seat: Seat; kind: 'minggang' | 'angang' | 'bugang'; tile: Tile | null; from?: Seat }
  | { type: 'hu'; seat: Seat; win: WinInfo }
  | { type: 'payment'; payment: Payment }
  | { type: 'end'; result: RoundResult }

export interface SeatView {
  seat: Seat
  handCount: number
  melds: PublicMeld[]
  river: RiverTile[]
  que: Suit | null
  /** Set once this seat has won; its hand becomes public. */
  win: WinInfo | null
  winHand: Tile[] | null
  /** Score change in this round so far. */
  delta: number
}

/** Everything one seat may legally know. */
export interface PlayerView {
  seat: Seat
  hand: Tile[]
  /** The tile just drawn, kept apart from `hand`. */
  drawn: Tile | null
  seats: SeatView[]
  dealer: Seat
  turn: Seat
  wallRemaining: number
  rules: RuleConfig
  /** The discard / bugang tile currently being decided on, if any. */
  pendingTile: Tile | null
  log: GameEvent[]
}

export interface RoundResult {
  /** Seats in the order they first won. */
  winners: Seat[]
  liuju: boolean
  payments: Payment[]
  deltas: number[]
  hands: Tile[][]
  melds: Meld[][]
}

export interface Player {
  /** Return one of `actions`. The engine throws on anything else. */
  decide(view: PlayerView, actions: Action[]): Promise<Action>
  onEvent?(event: GameEvent, view: PlayerView): void
}
