import { suitOf, type Suit, type Tile } from './tiles'
import type { FanItem, FanResult, Meld } from './types'

const sum = (c: readonly number[]) => c.reduce((a, b) => a + b, 0)

/** Can `c` be split entirely into triplets and sequences? Mutates and restores `c`. */
function allMelds(c: number[]): boolean {
  let i = 0
  while (i < 27 && c[i] === 0) i++
  if (i === 27) return true
  if (c[i] >= 3) {
    c[i] -= 3
    const ok = allMelds(c)
    c[i] += 3
    if (ok) return true
  }
  if (i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--, c[i + 1]--, c[i + 2]--
    const ok = allMelds(c)
    c[i]++, c[i + 1]++, c[i + 2]++
    if (ok) return true
  }
  return false
}

/** Four sets + a pair (melds already removed from `counts`). */
export function isStandardWin(counts: readonly number[]): boolean {
  if (sum(counts) % 3 !== 2) return false
  const c = [...counts]
  for (let i = 0; i < 27; i++) {
    if (c[i] < 2) continue
    c[i] -= 2
    const ok = allMelds(c)
    c[i] += 2
    if (ok) return true
  }
  return false
}

/** Seven pairs; four of a kind counts as two pairs. Concealed only. */
export function isQiDui(counts: readonly number[], meldCount: number): boolean {
  return meldCount === 0 && sum(counts) === 14 && counts.every((n) => n % 2 === 0)
}

export const holdsSuit = (counts: readonly number[], suit: Suit) =>
  counts.slice(suit * 9, suit * 9 + 9).some((n) => n > 0)

export function canHu(counts: readonly number[], melds: readonly Meld[], que: Suit | null): boolean {
  if (que !== null && holdsSuit(counts, que)) return false
  return isStandardWin(counts) || isQiDui(counts, melds.length)
}

function totalCounts(counts: readonly number[], melds: readonly Meld[]): number[] {
  const all = [...counts]
  for (const m of melds) all[m.tile] += m.kind === 'peng' ? 3 : 4
  return all
}

/**
 * Pattern fan of a complete hand: 对对胡 / 七对 / 清一色 / 金钩钓 / 根.
 * Returns null when the hand is not a win (ignores 定缺; check that with canHu).
 */
export function patternFan(counts: readonly number[], melds: readonly Meld[]): FanResult | null {
  const all = totalCounts(counts, melds)
  const suits = new Set<number>()
  all.forEach((n, t) => n > 0 && suits.add(suitOf(t)))
  const roots = all.filter((n) => n === 4).length

  const common: FanItem[] = []
  if (suits.size === 1) common.push({ name: '清一色', fan: 2 })
  if (roots > 0) common.push({ name: roots > 1 ? `根×${roots}` : '根', fan: roots })

  const candidates: FanItem[][] = []
  if (isStandardWin(counts)) {
    const items = [...common]
    const allTriplets = counts.filter((n) => n === 2).length === 1 && counts.every((n) => n === 0 || n === 2 || n === 3)
    if (allTriplets) items.unshift({ name: '对对胡', fan: 1 })
    if (sum(counts) === 2) items.push({ name: '金钩钓', fan: 1 })
    candidates.push(items)
  }
  if (isQiDui(counts, melds.length)) candidates.push([{ name: '七对', fan: 2 }, ...common])
  if (candidates.length === 0) return null

  let best: FanResult | null = null
  for (const items of candidates) {
    const total = items.reduce((a, it) => a + it.fan, 0)
    if (!best || total > best.total) best = { items: items.length ? items : [{ name: '平胡', fan: 0 }], total }
  }
  return best
}

export interface WinSituation {
  zimo: boolean
  gangShangKaiHua: boolean
  gangShangPao: boolean
  qiangGang: boolean
  haiDi: boolean
}

export function winFan(counts: readonly number[], melds: readonly Meld[], s: WinSituation): FanResult {
  const base = patternFan(counts, melds)
  if (!base) throw new Error('winFan called on a non-winning hand')
  const items = base.items.filter((it) => it.fan > 0)
  if (s.zimo) items.push({ name: '自摸', fan: 1 })
  if (s.gangShangKaiHua) items.push({ name: '杠上开花', fan: 1 })
  if (s.gangShangPao) items.push({ name: '杠上炮', fan: 1 })
  if (s.qiangGang) items.push({ name: '抢杠胡', fan: 1 })
  if (s.haiDi) items.push({ name: '海底捞月', fan: 1 })
  if (items.length === 0) items.push({ name: '平胡', fan: 0 })
  return { items, total: items.reduce((a, it) => a + it.fan, 0) }
}

/** Tiles that would complete a waiting hand (13-tile shape, melds removed). */
export function waits(counts: readonly number[], melds: readonly Meld[], que: Suit | null): Tile[] {
  const all = totalCounts(counts, melds)
  const out: Tile[] = []
  const c = [...counts]
  for (let t = 0; t < 27; t++) {
    if (all[t] >= 4 || (que !== null && suitOf(t) === que)) continue
    c[t]++
    if (canHu(c, melds, que)) out.push(t)
    c[t]--
  }
  return out
}

/** Highest pattern fan over all waits, or null when not waiting. Used by 查大叫. */
export function maxWaitFan(counts: readonly number[], melds: readonly Meld[], que: Suit | null): FanResult | null {
  let best: FanResult | null = null
  const c = [...counts]
  for (const t of waits(counts, melds, que)) {
    c[t]++
    const f = patternFan(c, melds)
    c[t]--
    if (f && (!best || f.total > best.total)) best = f
  }
  return best
}
