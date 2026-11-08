import { inject, provide, ref, watch, type InjectionKey, type Ref } from 'vue'
import { waits } from '../engine/hand'
import { toCounts, type Tile } from '../engine/tiles'
import type { Meld, PlayerView } from '../engine/types'

/** Copies of each tile kind visible on the table to `view.seat`, excluding its own concealed hand. */
export function tableCounts(view: PlayerView): number[] {
  const c = new Array<number>(27).fill(0)
  for (const s of view.seats) {
    for (const r of s.river) if (!r.claimed) c[r.tile]++
    for (const m of s.melds) if (m.tile !== null) c[m.tile] += m.kind === 'peng' ? 3 : 4
    if (s.seat !== view.seat && s.win) c[s.win.tile]++
  }
  return c
}

export const handCounts = (view: PlayerView) => toCounts(view.drawn === null ? view.hand : [...view.hand, view.drawn])

export interface Wait {
  tile: Tile
  /** Copies not visible to me: still possibly in the wall or other hands. */
  left: number
}

/** What a 13-tile shape (melds excluded) waits on, with how many copies may still come. */
export function waitsWithLeft(view: PlayerView, counts: number[]): Wait[] {
  const me = view.seats[view.seat]
  const melds = me.melds as Meld[] // own melds are never redacted
  const table = tableCounts(view)
  return waits(counts, melds, me.que).map((tile) => ({ tile, left: Math.max(0, 4 - counts[tile] - table[tile]) }))
}

// ---------------------------------------------------------------- shared UI state

/** Tile kind the player tapped; every copy on the table lights up. */
export const FOCUS_KEY: InjectionKey<Ref<Tile | null>> = Symbol('focus-tile')
export const RANK_LABELS_KEY: InjectionKey<Ref<boolean>> = Symbol('rank-labels')

const SETTINGS_KEY = 'sichuan-mahjong:settings:v1'

export function provideTableUi() {
  const focus = ref<Tile | null>(null)
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as { rankLabels?: boolean }
  const rankLabels = ref(saved.rankLabels ?? false)
  watch(rankLabels, (v) => localStorage.setItem(SETTINGS_KEY, JSON.stringify({ rankLabels: v })))
  provide(FOCUS_KEY, focus)
  provide(RANK_LABELS_KEY, rankLabels)
  return { focus, rankLabels }
}

export const useFocus = () => inject(FOCUS_KEY, ref(null))
export const useRankLabels = () => inject(RANK_LABELS_KEY, ref(false))
