import { ref, shallowRef } from 'vue'
import { Game, type GameSnapshot } from '../engine/game'
import type { GameEvent, Player, PlayerView, RoundResult, Seat } from '../engine/types'
import { HumanPlayer, type HumanRequest } from '../players/human'
import { RuleBotPlayer } from '../players/ruleBot'

export const ME: Seat = 0
export const SEAT_NAMES = ['你', '下家', '对家', '上家'] as const

/** Big centre-screen callout for 碰 / 杠 / 胡. */
export interface FloatText {
  id: number
  seat: Seat
  kind: 'peng' | 'gang' | 'hu'
  text: string
}

function floatFor(e: GameEvent): Omit<FloatText, 'id'> | null {
  switch (e.type) {
    case 'peng':
      return { seat: e.seat, kind: 'peng', text: '碰' }
    case 'gang':
      return { seat: e.seat, kind: 'gang', text: e.kind === 'angang' ? '暗杠' : e.kind === 'bugang' ? '补杠' : '杠' }
    case 'hu':
      return { seat: e.seat, kind: 'hu', text: e.win.kind === 'zimo' ? '自摸' : e.win.kind === 'qianggang' ? '抢杠胡' : '胡' }
    default:
      return null
  }
}

const STORAGE_KEY = 'sichuan-mahjong:session:v1'

interface SavedSession {
  round: number
  totals: number[]
  startTotals: number[]
  /** Dealer of the next round. */
  dealer: Seat
  game: GameSnapshot
}

/** One sitting: consecutive rounds with running totals, saved to localStorage at every engine step. */
export function useSession() {
  const human = new HumanPlayer()
  const view = shallowRef<PlayerView | null>(null)
  const request = shallowRef<HumanRequest | null>(null)
  const result = shallowRef<RoundResult | null>(null)
  const totals = ref([0, 0, 0, 0])
  /** Totals before the current round; seat badges add the live round delta to these. */
  const startTotals = ref([0, 0, 0, 0])
  const round = ref(0)
  const floats = ref<FloatText[]>([])
  let floatId = 0
  let dealer = Math.floor(Math.random() * 4) as Seat
  let game: Game | null = null

  human.connect((req) => (request.value = req))

  // Seat lineup: swap any entry for another Player implementation (e.g. an LLM player).
  const lineup = (): Player[] => [human, new RuleBotPlayer(), new RuleBotPlayer(), new RuleBotPlayer()]

  function save(snap: GameSnapshot) {
    const data: SavedSession = { round: round.value, totals: totals.value, startTotals: startTotals.value, dealer, game: snap }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  function attach(g: Game) {
    game = g
    view.value = g.viewFor(ME)
    g.on((e) => {
      view.value = g.viewFor(ME)
      const f = floatFor(e)
      if (f) {
        const item = { id: floatId++, ...f }
        floats.value = [...floats.value, item]
        setTimeout(() => (floats.value = floats.value.filter((x) => x.id !== item.id)), 1600)
      }
    })
  }

  async function play(g: Game) {
    const r = await g.run()
    totals.value = totals.value.map((t, i) => t + r.deltas[i])
    dealer = nextDealer(g, r) ?? dealer
    result.value = r
    save(g.snapshot())
  }

  async function startRound() {
    result.value = null
    round.value++
    startTotals.value = [...totals.value]
    const g = new Game(lineup(), { dealer, onCheckpoint: save })
    attach(g)
    await play(g)
  }

  /** Continue the saved sitting, if any. Returns false when there is nothing usable to resume. */
  function resume(): boolean {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    let saved: SavedSession
    let g: Game
    try {
      saved = JSON.parse(raw)
      g = Game.restore(lineup(), saved.game, { onCheckpoint: save })
    } catch (err) {
      console.warn('discarding unreadable saved session', err)
      localStorage.removeItem(STORAGE_KEY)
      return false
    }
    round.value = saved.round
    totals.value = saved.totals
    startTotals.value = saved.startTotals
    dealer = saved.dealer
    attach(g)
    if (g.finished) result.value = g.result
    else void play(g)
    return true
  }

  /** Header + full engine dump, for pasting into a bug report. */
  function diagnostics(): string {
    if (!game) return '还没有开局'
    const seats = SEAT_NAMES.map((n, i) => `P${i}=${n}`).join(' ')
    return [`四川麻将诊断 · 第${round.value}局 · ${seats} · 累计 ${totals.value.join(' ')}`, game.dump()].join('\n')
  }

  return { view, request, result, totals, startTotals, round, floats, startRound, resume, diagnostics }
}

/** First winner deals next; when the first win was 一炮多响, the discarder deals. */
function nextDealer(g: Game, r: RoundResult): Seat | undefined {
  const first = r.winners[0]
  if (first === undefined) return undefined
  const seats = g.viewFor(ME).seats
  const win = seats[first].win!
  const shared = seats.filter((s) => s.win && s.win.order === win.order)
  return shared.length > 1 ? win.from : first
}

export type Session = ReturnType<typeof useSession>
