import { ref, shallowRef } from 'vue'
import { Game } from '../engine/game'
import type { GameEvent, Player, PlayerView, RoundResult, Seat } from '../engine/types'
import { HumanPlayer, type HumanRequest } from '../players/human'
import { RuleBotPlayer } from '../players/ruleBot'

export const ME: Seat = 0
export const SEAT_NAMES = ['你', '下家', '对家', '上家'] as const

export interface FloatText {
  id: number
  seat: Seat
  text: string
}

function floatFor(e: GameEvent): { seat: Seat; text: string } | null {
  switch (e.type) {
    case 'peng':
      return { seat: e.seat, text: '碰' }
    case 'gang':
      return { seat: e.seat, text: e.kind === 'angang' ? '暗杠' : e.kind === 'bugang' ? '补杠' : '杠' }
    case 'hu':
      return { seat: e.seat, text: e.win.kind === 'zimo' ? '自摸' : e.win.kind === 'qianggang' ? '抢杠胡' : '胡' }
    default:
      return null
  }
}

/** One sitting: consecutive rounds with running totals. */
export function useSession() {
  const human = new HumanPlayer()
  const view = shallowRef<PlayerView | null>(null)
  const request = shallowRef<HumanRequest | null>(null)
  const result = shallowRef<RoundResult | null>(null)
  const totals = ref([0, 0, 0, 0])
  const round = ref(0)
  const floats = ref<FloatText[]>([])
  let floatId = 0
  let dealer = Math.floor(Math.random() * 4) as Seat

  human.connect((req) => (request.value = req))

  async function startRound() {
    result.value = null
    round.value++
    // Seat lineup: swap any entry for another Player implementation (e.g. an LLM player).
    const players: Player[] = [human, new RuleBotPlayer(), new RuleBotPlayer(), new RuleBotPlayer()]
    const game = new Game(players, { dealer })
    view.value = game.viewFor(ME)
    game.on((e) => {
      view.value = game.viewFor(ME)
      const f = floatFor(e)
      if (f) {
        const item = { id: floatId++, ...f }
        floats.value = [...floats.value, item]
        setTimeout(() => (floats.value = floats.value.filter((x) => x.id !== item.id)), 1400)
      }
    })
    const r = await game.run()
    totals.value = totals.value.map((t, i) => t + r.deltas[i])
    dealer = r.winners[0] ?? dealer
    result.value = r
  }

  return { view, request, result, totals, round, floats, startRound }
}

export type Session = ReturnType<typeof useSession>
