import { canHu, holdsSuit, maxWaitFan, winFan, type WinSituation } from './hand'
import { fullWall, shuffle, sortTiles, suitOf, tileName, toCounts, type Suit, type Tile } from './tiles'
import {
  DEFAULT_RULES,
  SEATS,
  nextSeat,
  type Action,
  type FanResult,
  type GameEvent,
  type Meld,
  type Payment,
  type PaymentReason,
  type Player,
  type PlayerView,
  type RiverTile,
  type RoundResult,
  type RuleConfig,
  type Seat,
  type WinInfo,
  type WinKind,
} from './types'

interface SeatState {
  /** Concealed tiles, excluding `drawn`. */
  hand: Tile[]
  drawn: Tile | null
  melds: Meld[]
  river: RiverTile[]
  que: Suit | null
  win: WinInfo | null
  delta: number
}

type Step =
  | { kind: 'draw'; seat: Seat }
  /** `afterPeng`: may only discard. `afterGang`: the drawn tile came from the back of the wall. */
  | { kind: 'act'; seat: Seat; afterGang: boolean; afterPeng: boolean }

const GANG_REASONS: PaymentReason[] = ['minggang', 'bugang', 'angang']

const sameAction = (a: Action, b: Action) =>
  a.type === b.type &&
  ('tile' in a ? a.tile : undefined) === ('tile' in b ? b.tile : undefined) &&
  ('suit' in a ? a.suit : undefined) === ('suit' in b ? b.suit : undefined)

export interface GameOptions {
  dealer: Seat
  rules?: RuleConfig
  rng?: () => number
}

export class Game {
  readonly rules: RuleConfig
  readonly dealer: Seat
  turn: Seat
  result: RoundResult | null = null

  private wall: Tile[]
  private seats: SeatState[]
  private log: GameEvent[] = []
  private payments: Payment[] = []
  private pendingTile: Tile | null = null
  private winOrder = 0
  private listeners = new Set<(e: GameEvent) => void>()
  private readonly players: readonly Player[]

  constructor(players: readonly Player[], opts: GameOptions) {
    if (players.length !== 4) throw new Error('need exactly 4 players')
    this.players = players
    this.rules = opts.rules ?? DEFAULT_RULES
    this.dealer = opts.dealer
    this.turn = opts.dealer
    this.wall = shuffle(fullWall(), opts.rng)
    this.seats = SEATS.map(() => ({ hand: [], drawn: null, melds: [], river: [], que: null, win: null, delta: 0 }))
  }

  /** Subscribe to public events. Returns an unsubscribe function. */
  on(listener: (e: GameEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  viewFor(seat: Seat): PlayerView {
    const me = this.seats[seat]
    return {
      seat,
      hand: [...me.hand],
      drawn: me.drawn,
      seats: this.seats.map((s, i) => ({
        seat: i as Seat,
        handCount: s.hand.length + (s.drawn === null ? 0 : 1),
        melds: s.melds.map((m) => (i !== seat && m.kind === 'angang' ? { kind: 'angang', tile: null } : { ...m })),
        river: s.river.map((r) => ({ ...r })),
        que: s.que,
        win: s.win,
        winHand: s.win ? [...s.hand] : null,
        delta: s.delta,
      })),
      dealer: this.dealer,
      turn: this.turn,
      wallRemaining: this.wall.length,
      rules: this.rules,
      pendingTile: this.pendingTile,
      log: [...this.log],
    }
  }

  async run(): Promise<RoundResult> {
    for (const s of this.seats) s.hand = sortTiles(this.wall.splice(0, 13))
    this.emit({ type: 'start', dealer: this.dealer, wall: this.wall.length })

    const quePicks = await Promise.all(
      SEATS.map((seat) => this.ask(seat, ([0, 1, 2] as Suit[]).map((suit) => ({ type: 'que', suit }) as Action))),
    )
    quePicks.forEach((a, i) => (this.seats[i].que = (a as { suit: Suit }).suit))
    this.emit({ type: 'que', ques: this.seats.map((s) => s.que!) })

    this.draw(this.dealer, false)
    let step: Step = { kind: 'act', seat: this.dealer, afterGang: false, afterPeng: false }
    while (this.winnerCount() < 3) {
      if (step.kind === 'draw') {
        if (this.wall.length === 0) break
        this.draw(step.seat, false)
        step = { kind: 'act', seat: step.seat, afterGang: false, afterPeng: false }
      } else {
        step = await this.act(step.seat, step.afterGang, step.afterPeng)
      }
    }
    return this.finish()
  }

  // ---------------------------------------------------------------- turns

  private async act(seat: Seat, afterGang: boolean, afterPeng: boolean): Promise<Step> {
    this.turn = seat
    const s = this.seats[seat]
    const counts = this.counts(seat)
    const actions: Action[] = []
    if (!afterPeng) {
      if (canHu(counts, s.melds, s.que)) actions.push({ type: 'hu' })
      if (this.wall.length > 0) {
        for (let t = 0; t < 27; t++) if (counts[t] === 4 && suitOf(t) !== s.que) actions.push({ type: 'angang', tile: t })
        for (const m of s.melds) if (m.kind === 'peng' && counts[m.tile] > 0) actions.push({ type: 'bugang', tile: m.tile })
      }
    }
    const mustQue = s.que !== null && holdsSuit(counts, s.que)
    for (let t = 0; t < 27; t++) {
      if (counts[t] > 0 && (!mustQue || suitOf(t) === s.que)) actions.push({ type: 'discard', tile: t })
    }

    const a = await this.ask(seat, actions)
    switch (a.type) {
      case 'hu': {
        const tile = s.drawn
        if (tile === null) throw new Error('zimo without a drawn tile')
        const fan = winFan(counts, s.melds, this.situation({ zimo: true, gangShangKaiHua: afterGang, haiDi: this.wall.length === 0 }))
        const payers = this.activeSeats().filter((o) => o !== seat)
        this.declareWins([{ seat, tile, kind: 'zimo', fan }])
        for (const p of payers) this.pay(p, seat, this.score(fan), 'hu', fanNote(fan))
        return { kind: 'draw', seat: this.nextActive(seat) }
      }
      case 'angang': {
        this.take(seat, a.tile, 4)
        s.melds.push({ kind: 'angang', tile: a.tile })
        this.emit({ type: 'gang', seat, kind: 'angang', tile: null })
        for (const o of this.activeSeats()) if (o !== seat) this.pay(o, seat, 2 * this.rules.baseScore, 'angang', '暗杠（下雨）')
        this.draw(seat, true)
        return { kind: 'act', seat, afterGang: true, afterPeng: false }
      }
      case 'bugang': {
        this.take(seat, a.tile, 1)
        this.pendingTile = a.tile
        const robbers = await this.claimQiangGang(seat, a.tile)
        this.pendingTile = null
        if (robbers.length > 0) return { kind: 'draw', seat: this.nextActive(this.farthest(seat, robbers)) }
        const meld = s.melds.find((m) => m.kind === 'peng' && m.tile === a.tile)!
        meld.kind = 'bugang'
        this.emit({ type: 'gang', seat, kind: 'bugang', tile: a.tile, from: meld.from })
        for (const o of this.activeSeats()) if (o !== seat) this.pay(o, seat, this.rules.baseScore, 'bugang', '补杠（刮风）')
        this.draw(seat, true)
        return { kind: 'act', seat, afterGang: true, afterPeng: false }
      }
      case 'discard': {
        this.take(seat, a.tile, 1)
        s.river.push({ tile: a.tile, claimed: false })
        this.emit({ type: 'discard', seat, tile: a.tile })
        this.pendingTile = a.tile
        const next = await this.claims(seat, a.tile, afterGang)
        this.pendingTile = null
        return next
      }
      default:
        throw new Error(`unexpected action ${a.type}`)
    }
  }

  /** Others react to a discard: 胡 > 杠/碰 > 过. */
  private async claims(from: Seat, tile: Tile, afterGang: boolean): Promise<Step> {
    const options = new Map<Seat, Action[]>()
    for (const seat of this.activeSeats()) {
      if (seat === from) continue
      const s = this.seats[seat]
      const c = this.counts(seat)
      const acts: Action[] = []
      c[tile]++
      if (canHu(c, s.melds, s.que)) acts.push({ type: 'hu' })
      c[tile]--
      if (suitOf(tile) !== s.que) {
        if (c[tile] >= 2) acts.push({ type: 'peng' })
        if (c[tile] === 3 && this.wall.length > 0) acts.push({ type: 'minggang' })
      }
      if (acts.length > 0) options.set(seat, [...acts, { type: 'pass' }])
    }
    if (options.size === 0) return { kind: 'draw', seat: this.nextActive(from) }

    const entries = [...options.entries()]
    const answers = await Promise.all(entries.map(([seat, acts]) => this.ask(seat, acts)))
    const chosen = entries.map(([seat], i) => ({ seat, action: answers[i] }))
    const river = this.seats[from].river
    const last = river[river.length - 1]

    const huSeats = chosen.filter((c) => c.action.type === 'hu').map((c) => c.seat)
    if (huSeats.length > 0) {
      last.claimed = true
      this.settleDiscardWins(from, tile, huSeats, 'dianpao', afterGang)
      return { kind: 'draw', seat: this.nextActive(this.farthest(from, huSeats)) }
    }

    const claim = chosen.find((c) => c.action.type === 'peng' || c.action.type === 'minggang')
    if (!claim) return { kind: 'draw', seat: this.nextActive(from) }
    last.claimed = true
    const s = this.seats[claim.seat]
    if (claim.action.type === 'peng') {
      this.take(claim.seat, tile, 2)
      s.melds.push({ kind: 'peng', tile, from })
      this.emit({ type: 'peng', seat: claim.seat, tile, from })
      return { kind: 'act', seat: claim.seat, afterGang: false, afterPeng: true }
    }
    this.take(claim.seat, tile, 3)
    s.melds.push({ kind: 'minggang', tile, from })
    this.emit({ type: 'gang', seat: claim.seat, kind: 'minggang', tile, from })
    this.pay(from, claim.seat, 2 * this.rules.baseScore, 'minggang', '明杠')
    this.draw(claim.seat, true)
    return { kind: 'act', seat: claim.seat, afterGang: true, afterPeng: false }
  }

  /** Offer 抢杠胡 on a bugang tile. Returns the seats that robbed it. */
  private async claimQiangGang(from: Seat, tile: Tile): Promise<Seat[]> {
    const eligible = this.activeSeats().filter((seat) => {
      if (seat === from) return false
      const c = this.counts(seat)
      c[tile]++
      return canHu(c, this.seats[seat].melds, this.seats[seat].que)
    })
    if (eligible.length === 0) return []
    const answers = await Promise.all(eligible.map((seat) => this.ask(seat, [{ type: 'hu' }, { type: 'pass' }])))
    const huSeats = eligible.filter((_, i) => answers[i].type === 'hu')
    if (huSeats.length > 0) this.settleDiscardWins(from, tile, huSeats, 'qianggang', false)
    return huSeats
  }

  private settleDiscardWins(from: Seat, tile: Tile, huSeats: Seat[], kind: WinKind, afterGang: boolean) {
    const wins = huSeats.map((seat) => {
      const c = this.counts(seat)
      c[tile]++
      const fan = winFan(c, this.seats[seat].melds, this.situation({ gangShangPao: afterGang, qiangGang: kind === 'qianggang' }))
      return { seat, tile, kind, from, fan }
    })
    this.declareWins(wins)
    for (const w of wins) {
      this.pay(from, w.seat, this.score(w.fan), 'hu', kind === 'qianggang' ? fanNote(w.fan) : `${fanNote(w.fan)} 点炮`)
    }
  }

  // ---------------------------------------------------------------- end of round

  private finish(): RoundResult {
    const winners = this.seats
      .map((s, i) => ({ s, i: i as Seat }))
      .filter((x) => x.s.win)
      .sort((a, b) => a.s.win!.order - b.s.win!.order)
      .map((x) => x.i)
    const liuju = winners.length < 3
    if (liuju) this.settleExhausted()

    this.result = {
      winners,
      liuju,
      payments: [...this.payments],
      deltas: this.seats.map((s) => s.delta),
      hands: this.seats.map((s) => sortTiles([...s.hand, ...(s.drawn === null ? [] : [s.drawn])])),
      melds: this.seats.map((s) => s.melds.map((m) => ({ ...m }))),
    }
    this.emit({ type: 'end', result: this.result })
    return this.result
  }

  /** 查花猪、查大叫、退杠钱 among seats that have not won. */
  private settleExhausted() {
    const active = this.activeSeats()
    const huazhu = active.filter((seat) => holdsSuit(this.counts(seat), this.seats[seat].que!))
    const tenpai = new Map<Seat, FanResult>()
    const notTenpai: Seat[] = []
    for (const seat of active) {
      if (huazhu.includes(seat)) continue
      const s = this.seats[seat]
      const fan = maxWaitFan(this.counts(seat), s.melds, s.que)
      if (fan) tenpai.set(seat, fan)
      else notTenpai.push(seat)
    }

    const capScore = this.rules.baseScore * 2 ** this.rules.fanCap
    for (const h of huazhu) {
      for (const o of active) if (!huazhu.includes(o)) this.pay(h, o, capScore, 'huazhu', '查花猪')
    }
    for (const n of notTenpai) {
      for (const [t, fan] of tenpai) this.pay(n, t, this.score(fan), 'dajiao', `查大叫 ${fanNote(fan)}`)
    }
    const gangIncome = [...this.payments]
    for (const seat of [...huazhu, ...notTenpai]) {
      for (const p of gangIncome) {
        if (p.to === seat && GANG_REASONS.includes(p.reason)) this.pay(seat, p.from, p.amount, 'refund', `未听牌退杠钱`)
      }
    }
  }

  // ---------------------------------------------------------------- helpers

  private emit(e: GameEvent) {
    this.log.push(e)
    this.players.forEach((p, i) => p.onEvent?.(e, this.viewFor(i as Seat)))
    for (const l of this.listeners) l(e)
  }

  private async ask(seat: Seat, actions: Action[]): Promise<Action> {
    const a = await this.players[seat].decide(this.viewFor(seat), actions)
    const match = actions.find((x) => sameAction(x, a))
    if (!match) throw new Error(`seat ${seat} returned illegal action ${JSON.stringify(a)}`)
    return match
  }

  private draw(seat: Seat, fromBack: boolean) {
    const t = fromBack ? this.wall.pop() : this.wall.shift()
    if (t === undefined) throw new Error('draw from empty wall')
    this.seats[seat].drawn = t
    this.turn = seat
    this.emit({ type: 'draw', seat, fromBack })
  }

  /** Remove `n` copies of `tile` from hand + drawn; the drawn tile joins the hand. */
  private take(seat: Seat, tile: Tile, n: number) {
    const s = this.seats[seat]
    if (s.drawn !== null) s.hand.push(s.drawn)
    s.drawn = null
    for (let i = 0; i < n; i++) {
      const idx = s.hand.indexOf(tile)
      if (idx < 0) throw new Error(`seat ${seat} lacks ${tileName(tile)}`)
      s.hand.splice(idx, 1)
    }
    sortTiles(s.hand)
  }

  private counts(seat: Seat): number[] {
    const s = this.seats[seat]
    return toCounts(s.drawn === null ? s.hand : [...s.hand, s.drawn])
  }

  private declareWins(wins: { seat: Seat; tile: Tile; kind: WinKind; from?: Seat; fan: FanResult }[]) {
    const order = this.winOrder++
    for (const w of wins) {
      const s = this.seats[w.seat]
      if (s.drawn !== null) s.hand.push(s.drawn)
      else s.hand.push(w.tile)
      s.drawn = null
      sortTiles(s.hand)
      s.win = { tile: w.tile, kind: w.kind, from: w.from, fan: w.fan, order }
      this.emit({ type: 'hu', seat: w.seat, win: s.win })
    }
  }

  private pay(from: Seat, to: Seat, amount: number, reason: PaymentReason, note: string) {
    const payment: Payment = { id: this.payments.length, from, to, amount, reason, note }
    this.payments.push(payment)
    this.seats[from].delta -= amount
    this.seats[to].delta += amount
    this.emit({ type: 'payment', payment })
  }

  private score(fan: FanResult) {
    return this.rules.baseScore * 2 ** Math.min(fan.total, this.rules.fanCap)
  }

  private situation(s: Partial<WinSituation>): WinSituation {
    return { zimo: false, gangShangKaiHua: false, gangShangPao: false, qiangGang: false, haiDi: false, ...s }
  }

  private activeSeats(): Seat[] {
    return SEATS.filter((s) => !this.seats[s].win)
  }

  private winnerCount() {
    return this.seats.filter((s) => s.win).length
  }

  private nextActive(seat: Seat): Seat {
    let s = nextSeat(seat)
    for (let i = 0; i < 4 && this.seats[s].win; i++) s = nextSeat(s)
    return s
  }

  /** The winner furthest along the turn order from `from`. */
  private farthest(from: Seat, winners: Seat[]): Seat {
    return winners.reduce((a, b) => ((b - from + 4) % 4 > (a - from + 4) % 4 ? b : a))
  }
}

export function fanNote(fan: FanResult): string {
  return `${fan.items.map((it) => it.name).join(' ')} ${fan.total}番`
}
