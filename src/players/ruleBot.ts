import { holdsSuit } from '../engine/hand'
import { suitOf, toCounts, type Suit, type Tile } from '../engine/tiles'
import type { Action, Player, PlayerView } from '../engine/types'
import { shanten } from './shanten'

export interface RuleBotOptions {
  /** Delay before each decision so humans can follow along. */
  thinkMs?: number
  rng?: () => number
  /** Reserved for difficulty levels; only one level exists. */
  level?: number
}

/** Priority rules + random tie-breaks. Aims to play like an ordinary table mate, not to be strong. */
export class RuleBotPlayer implements Player {
  readonly level: number
  private readonly thinkMs: number
  private readonly rng: () => number

  constructor(opts: RuleBotOptions = {}) {
    this.thinkMs = opts.thinkMs ?? 600
    this.rng = opts.rng ?? Math.random
    this.level = opts.level ?? 1
  }

  async decide(view: PlayerView, actions: Action[]): Promise<Action> {
    if (this.thinkMs > 0) await new Promise((r) => setTimeout(r, this.thinkMs))
    return this.choose(view, actions)
  }

  private choose(view: PlayerView, actions: Action[]): Action {
    const find = (type: Action['type']) => actions.find((a) => a.type === type)
    const counts = toCounts(view.drawn === null ? view.hand : [...view.hand, view.drawn])
    const me = view.seats[view.seat]
    const meldCount = me.melds.length

    if (actions[0].type === 'que') {
      const sizes = ([0, 1, 2] as Suit[]).map((s) => counts.slice(s * 9, s * 9 + 9).reduce((a, b) => a + b, 0))
      const min = Math.min(...sizes)
      return this.pick(actions.filter((a) => a.type === 'que' && sizes[a.suit] === min))
    }

    const hu = find('hu')
    if (hu) return hu
    const gang = find('angang') ?? find('bugang')
    if (gang) return gang

    if (find('pass')) return this.claim(view, actions, counts, meldCount)
    return this.discard(view, actions, counts, meldCount)
  }

  private claim(view: PlayerView, actions: Action[], counts: number[], meldCount: number): Action {
    const tile = view.pendingTile!
    const cur = shanten(counts, meldCount)
    const minggang = actions.find((a) => a.type === 'minggang')
    if (minggang) {
      const c = [...counts]
      c[tile] -= 3
      if (shanten(c, meldCount + 1) <= cur) return minggang
    }
    const peng = actions.find((a) => a.type === 'peng')
    if (peng) {
      const c = [...counts]
      c[tile] -= 2
      let after = Infinity
      for (let d = 0; d < 27; d++) {
        if (c[d] === 0) continue
        c[d]--
        after = Math.min(after, shanten(c, meldCount + 1))
        c[d]++
      }
      if (after <= cur) return peng
    }
    return actions.find((a) => a.type === 'pass')!
  }

  private discard(view: PlayerView, actions: Action[], counts: number[], meldCount: number): Action {
    const discards = actions.filter((a): a is Extract<Action, { type: 'discard' }> => a.type === 'discard')
    const que = view.seats[view.seat].que
    if (que !== null && holdsSuit(counts, que)) return this.pick(discards)

    const unseen = this.unseen(view, counts)
    let best: Action[] = []
    let bestShanten = Infinity
    let bestUkeire = -1
    const c = [...counts]
    for (const a of discards) {
      c[a.tile]--
      const sh = shanten(c, meldCount)
      let ukeire = 0
      if (sh <= bestShanten) {
        for (let t = 0; t < 27; t++) {
          if (unseen[t] === 0 || suitOf(t) === que) continue
          c[t]++
          if (shanten(c, meldCount) < sh) ukeire += unseen[t]
          c[t]--
        }
      }
      c[a.tile]++
      if (sh < bestShanten || (sh === bestShanten && ukeire > bestUkeire)) {
        best = [a]
        bestShanten = sh
        bestUkeire = ukeire
      } else if (sh === bestShanten && ukeire === bestUkeire) {
        best.push(a)
      }
    }
    return this.pick(best)
  }

  /** Copies of each tile not visible to this seat. */
  private unseen(view: PlayerView, counts: number[]): number[] {
    const seen = [...counts]
    const add = (t: Tile, n: number) => (seen[t] += n)
    for (const s of view.seats) {
      for (const r of s.river) if (!r.claimed) add(r.tile, 1)
      for (const m of s.melds) if (m.tile !== null) add(m.tile, m.kind === 'peng' ? 3 : 4)
      if (s.winHand) s.winHand.forEach((t) => add(t, 1))
    }
    return seen.map((n) => Math.max(0, 4 - n))
  }

  private pick<T>(xs: T[]): T {
    return xs[Math.floor(this.rng() * xs.length)]
  }
}
