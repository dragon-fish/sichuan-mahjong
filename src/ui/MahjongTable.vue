<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SUIT_NAMES, suitOf, tileName, type Suit, type Tile } from '../engine/tiles'
import type { Action, Seat } from '../engine/types'
import MeldRow from './MeldRow.vue'
import MjTile from './MjTile.vue'
import OpponentSeat from './OpponentSeat.vue'
import ResultPanel from './ResultPanel.vue'
import RiverTiles from './RiverTiles.vue'
import SeatBadge from './SeatBadge.vue'
import { moveSlot, reconcile, sortSlots, type HandSlot } from './handOrder'
import { handCounts, provideTableUi, waitsWithLeft, type Wait } from './hints'
import { ME, SEAT_NAMES, type Session } from './session'

const props = defineProps<{ session: Session }>()
const { view, request, result, totals, startTotals, round, floats, startRound, abandonRound, diagnostics } = props.session

/** 重开 needs a second tap within 3s. */
const confirmRestart = ref(false)
let confirmTimer: ReturnType<typeof setTimeout> | undefined
function tapRestart() {
  clearTimeout(confirmTimer)
  if (confirmRestart.value) {
    confirmRestart.value = false
    abandonRound()
    return
  }
  confirmRestart.value = true
  confirmTimer = setTimeout(() => (confirmRestart.value = false), 3000)
}

const { focus, rankLabels } = provideTableUi()
const SUIT_CLASS = ['m', 's', 'p']

/** Table side of each seat, as seen from mine. */
const SIDES = ['e-bottom', 'e-right', 'e-top', 'e-left'] as const

const OPPONENTS = [
  { seat: 1 as Seat, pos: 'right' as const },
  { seat: 2 as Seat, pos: 'top' as const },
  { seat: 3 as Seat, pos: 'left' as const },
]

const me = computed(() => view.value!.seats[ME])
const actions = computed<Action[]>(() => request.value?.actions ?? [])
const queChoice = computed(() => actions.value[0]?.type === 'que')
const isClaim = computed(() => actions.value.some((a) => a.type === 'pass'))
/** The discard / bugang tile being decided on. Read from the request: the live view may predate it. */
const pendingTile = computed(() => request.value?.view.pendingTile ?? null)
/** My hand after winning, minus the winning tile (shown apart). */
const myRestHand = computed(() => {
  const w = me.value.win
  const hand = [...(me.value.winHand ?? [])]
  if (w) hand.splice(hand.lastIndexOf(w.tile), 1)
  return hand
})

const toast = ref('')
const diagText = ref('')
async function copyDiagnostics() {
  const text = diagnostics()
  if (await copyText(text)) {
    toast.value = '诊断数据已复制'
    setTimeout(() => (toast.value = ''), 1500)
  } else {
    diagText.value = text
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to execCommand; plain-http LAN pages have no async clipboard
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  ta.setSelectionRange(0, text.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  return ok
}

/** My concealed hand in the order I arranged it (the drawn tile stays apart). */
const slots = ref<HandSlot[]>([])
watch(
  () => view.value?.hand,
  (hand) => (slots.value = reconcile(slots.value, hand ?? [], view.value?.seats[ME].que ?? null)),
  { immediate: true },
)
// Once 定缺 is known, tidy so the 缺 suit moves to the right.
watch(
  () => view.value?.seats[ME].que,
  () => tidy(),
)
function tidy() {
  slots.value = sortSlots(slots.value, me.value.que)
}
const discardable = computed(() => new Set(actions.value.flatMap((a) => (a.type === 'discard' ? [a.tile] : []))))

const suitCounts = computed(() => {
  const c = [0, 0, 0]
  for (const t of view.value!.hand) c[suitOf(t)]++
  if (view.value!.drawn !== null) c[suitOf(view.value!.drawn)]++
  return c
})

/** A hand slot id, or the drawn tile. */
type TileKey = number | 'drawn'

/** Selected (raised) tile. */
const selected = ref<TileKey | null>(null)
watch(request, () => (selected.value = null))

/** Only a quick double tap discards; slower taps just inspect, so looking at a tile never throws it. */
const DOUBLE_TAP_MS = 300
let lastTap = { key: null as TileKey | null, at: 0 }

function tapTile(key: TileKey, tile: Tile) {
  if (gestured) {
    gestured = false
    return
  }
  if (!discardable.value.has(tile)) return
  const now = performance.now()
  const isDouble = lastTap.key === key && now - lastTap.at < DOUBLE_TAP_MS
  lastTap = { key, at: now }
  if (isDouble) respond({ type: 'discard', tile })
  else selected.value = key
}

/**
 * Press and move a hand tile: the first clear direction decides the gesture.
 * Up past ~60% of the tile height discards it; sideways rearranges the hand.
 */
const drag = ref<{
  key: TileKey
  tile: Tile
  startX: number
  startY: number
  dy: number
  limit: number
  mode: 'lift' | 'move' | null
} | null>(null)
/** Set when a gesture ends, so the click that may follow it is ignored. */
let gestured = false
const GESTURE_PX = 8

function dragStart(e: PointerEvent, key: TileKey, tile: Tile) {
  gestured = false
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  drag.value = { key, tile, startX: e.clientX, startY: e.clientY, dy: 0, limit: el.offsetHeight * 0.6, mode: null }
}

function dragMove(e: PointerEvent) {
  const d = drag.value
  if (!d) return
  const dx = e.clientX - d.startX
  const dy = e.clientY - d.startY
  if (d.mode === null) {
    if (Math.hypot(dx, dy) < GESTURE_PX) return
    if (Math.abs(dx) > Math.abs(dy) && d.key !== 'drawn') d.mode = 'move'
    else if (dy < 0 && discardable.value.has(d.tile)) d.mode = 'lift'
    else {
      drag.value = null
      return
    }
  }
  if (d.mode === 'lift') {
    drag.value = { ...d, dy: Math.min(0, dy) }
    return
  }
  // move: drop the tile in front of the first slot whose centre is right of the finger
  const els = [...document.querySelectorAll<HTMLElement>('.mine .hand [data-slot]')]
  const from = slots.value.findIndex((s) => s.id === d.key)
  let to = els.findIndex((el) => {
    const r = el.getBoundingClientRect()
    return e.clientX < r.left + r.width / 2
  })
  if (to < 0) to = els.length
  if (to > from) to--
  if (to !== from) slots.value = moveSlot(slots.value, from, to)
}

function dragEnd() {
  const d = drag.value
  drag.value = null
  if (!d || d.mode === null) return
  gestured = true
  if (d.mode === 'lift' && -d.dy > d.limit) respond({ type: 'discard', tile: d.tile })
}

const dragStyle = (key: TileKey) => {
  const d = drag.value
  if (d?.key !== key) return undefined
  if (d.mode === 'lift' && d.dy < 0) return { transform: `translateY(${d.dy}px)`, transition: 'none' }
  if (d.mode === 'move') return { transform: 'translateY(-12%)', opacity: 0.85 }
  return undefined
}

/** Tap any tile on the table to light up every visible copy; tap the felt to clear. */
function onTableTap(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tile]')
  focus.value = el ? Number(el.dataset.tile) : null
}

/** On my discard turn: what each discard would leave me waiting on. */
const discardWaits = computed(() => {
  const out = new Map<Tile, Wait[]>()
  if (discardable.value.size === 0 || me.value.win) return out
  const counts = handCounts(view.value!)
  for (const t of discardable.value) {
    counts[t]--
    const w = waitsWithLeft(view.value!, counts)
    counts[t]++
    if (w.length) out.set(t, w)
  }
  return out
})

/** Waits to show: for the raised tile on my turn, otherwise for my current 13-tile hand. */
const shownWaits = computed<Wait[]>(() => {
  if (me.value.win) return []
  if (discardable.value.size > 0) {
    if (selected.value === null) return []
    const key = selected.value
    const t = key === 'drawn' ? view.value!.drawn : slots.value.find((s) => s.id === key)?.tile
    return t === undefined || t === null ? [] : (discardWaits.value.get(t) ?? [])
  }
  if (view.value!.drawn !== null) return []
  return waitsWithLeft(view.value!, handCounts(view.value!))
})
const allGone = computed(() => shownWaits.value.length > 0 && shownWaits.value.every((w) => w.left === 0))

function respond(a: Action) {
  request.value?.respond(a)
}

const buttons = computed(() =>
  actions.value
    .filter((a) => a.type !== 'discard' && a.type !== 'que')
    .map((a) => {
      switch (a.type) {
        case 'hu':
          return { a, label: isClaim.value ? '胡' : '自摸', cls: 'hu' }
        case 'peng':
          return { a, label: '碰', cls: 'peng' }
        case 'minggang':
          return { a, label: '杠', cls: 'gang' }
        case 'angang':
          return { a, label: `暗杠 ${tileName(a.tile)}`, cls: 'gang' }
        case 'bugang':
          return { a, label: `补杠 ${tileName(a.tile)}`, cls: 'gang' }
        default:
          return { a, label: '过', cls: 'pass' }
      }
    }),
)

/** Seat whose latest discard is the most recent discard of the round. */
const lastDiscarder = computed(() => {
  const log = view.value!.log
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]
    if (e.type === 'discard') return e.seat
    if (e.type === 'draw') return null
  }
  return null
})

const statusText = computed(() => {
  if (result.value) return '本局结束'
  if (queChoice.value) return '定缺'
  if (isClaim.value) return ''
  if (request.value) return '出牌'
  if (me.value.win) return '观战'
  return `${SEAT_NAMES[view.value!.turn]}…`
})
</script>

<template>
  <div v-if="view" class="table" @click="onTableTap">
    <OpponentSeat
      v-for="o in OPPONENTS"
      :key="o.seat"
      :class="o.pos"
      :sv="view.seats[o.seat]"
      :pos="o.pos"
      :name="SEAT_NAMES[o.seat]"
      :total="startTotals[o.seat]"
      :dealer="view.dealer === o.seat"
      :turn="view.turn === o.seat"
    />

    <div class="center">
      <RiverTiles class="r-top" :river="view.seats[2].river" :cols="10" :w="2.6" :hot-last="lastDiscarder === 2" from="top" />
      <RiverTiles class="r-left" :river="view.seats[3].river" :cols="4" :w="2.6" :hot-last="lastDiscarder === 3" from="left" />
      <RiverTiles class="r-right" :river="view.seats[1].river" :cols="4" :w="2.6" :hot-last="lastDiscarder === 1" from="right" />
      <RiverTiles class="r-bottom" :river="view.seats[0].river" :cols="10" :w="2.6" :hot-last="lastDiscarder === 0" from="bottom" />
      <div class="info">
        <div class="status">{{ statusText }}</div>
        <div class="console">
          <span v-for="(side, s) in SIDES" :key="s" class="edge" :class="[side, { on: !result && view.turn === s }]" />
          <div class="round">第{{ round }}局</div>
          <div class="wall"><small>剩</small>{{ view.wallRemaining }}</div>
        </div>
        <div v-if="shownWaits.length" class="waits" :class="{ gone: allGone }">
          <span class="ting-tag">听</span>
          <span v-for="w in shownWaits" :key="w.tile" class="wait" :class="{ dead: w.left === 0 }">
            <MjTile :tile="w.tile" :w="2.6" />
            <b>{{ w.left }}</b>
          </span>
        </div>
      </div>
    </div>

    <div class="mine">
      <SeatBadge :sv="me" :name="SEAT_NAMES[ME]" :total="startTotals[ME]" :dealer="view.dealer === ME" :turn="view.turn === ME" />
      <MeldRow :melds="me.melds" :w="3.6" />
      <div class="hand">
        <template v-if="me.win">
          <MjTile v-for="(t, i) in myRestHand" :key="i" :tile="t" :w="5" />
          <MjTile class="drawn" :tile="me.win.tile" :w="5" hot />
        </template>
        <template v-else>
          <MjTile
            v-for="s in slots"
            :key="s.id"
            :data-slot="s.id"
            :tile="s.tile"
            :w="5.4"
            :que="suitOf(s.tile) === me.que"
            :dim="discardable.size > 0 && !discardable.has(s.tile)"
            :raised="selected === s.id"
            :ting="discardWaits.has(s.tile)"
            :style="dragStyle(s.id)"
            @click="tapTile(s.id, s.tile)"
            @pointerdown="dragStart($event, s.id, s.tile)"
            @pointermove="dragMove"
            @pointerup="dragEnd"
            @pointercancel="drag = null"
          />
          <MjTile
            v-if="view.drawn !== null"
            class="drawn"
            :tile="view.drawn"
            :w="5.4"
            :que="suitOf(view.drawn) === me.que"
            :dim="discardable.size > 0 && !discardable.has(view.drawn)"
            :raised="selected === 'drawn'"
            :ting="discardWaits.has(view.drawn)"
            :style="dragStyle('drawn')"
            @click="tapTile('drawn', view.drawn)"
            @pointerdown="dragStart($event, 'drawn', view.drawn)"
            @pointermove="dragMove"
            @pointerup="dragEnd"
            @pointercancel="drag = null"
          />
        </template>
      </div>

      <div v-if="buttons.length" class="actions">
        <MjTile v-if="isClaim && pendingTile !== null" :tile="pendingTile" :w="3.6" />
        <button v-for="(b, i) in buttons" :key="i" :class="b.cls" @click="respond(b.a)">{{ b.label }}</button>
      </div>
    </div>

    <div v-if="queChoice" class="que-mask">
      <div class="que-box">
        <button v-for="s in [0, 1, 2] as Suit[]" :key="s" :class="SUIT_CLASS[s]" @click.stop="respond({ type: 'que', suit: s })">
          <MjTile :tile="s * 9 + 4" :w="3.2" />
          <span class="que-name">缺{{ SUIT_NAMES[s] }}</span>
          <small>{{ suitCounts[s] }} 张</small>
        </button>
      </div>
    </div>

    <div v-if="floats.length" class="flash-layer">
      <div v-for="f in floats" :key="f.id" class="flash" :class="`flash-${f.kind}`">
        <div class="flash-who">{{ SEAT_NAMES[f.seat] }}</div>
        <div class="flash-text">{{ f.text }}</div>
      </div>
    </div>

    <div class="toolbar">
      <button v-if="!me.win" @click="tidy">整理</button>
      <button :class="{ on: rankLabels }" @click="rankLabels = !rankLabels">数字</button>
      <button v-if="!result" :class="{ warn: confirmRestart }" @click="tapRestart">{{ confirmRestart ? '确认？' : '重开' }}</button>
      <button @click="copyDiagnostics">诊断</button>
    </div>
    <div v-if="toast" class="toast">{{ toast }}</div>
    <div v-if="diagText" class="diag-mask" @click.self="diagText = ''">
      <div class="diag-box">
        <div>自动复制失败，请长按全选复制</div>
        <textarea readonly :value="diagText" />
        <button @click="diagText = ''">关闭</button>
      </div>
    </div>

    <ResultPanel v-if="result" :result="result" :totals="totals" @next="startRound" />
  </div>
</template>


<style scoped>
.table {
  position: fixed;
  inset: 0;
  padding: 0 env(safe-area-inset-right) 0 env(safe-area-inset-left);
  display: grid;
  grid-template-columns: calc(var(--u) * 12) 1fr calc(var(--u) * 12);
  grid-template-rows: calc(var(--u) * 9.5) 1fr calc(var(--u) * 12.5);
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E"),
    radial-gradient(ellipse 75% 70% at 50% 46%, var(--felt-hi) 0%, var(--felt) 52%, var(--felt-lo) 100%);
  overflow: hidden;
}
.left {
  grid-column: 1;
  grid-row: 1 / 3;
}
.right {
  grid-column: 3;
  grid-row: 1 / 3;
}
.top {
  grid-column: 2;
  grid-row: 1;
  padding-top: calc(var(--u) * 2.6);
}
.center {
  position: relative;
  grid-column: 2;
  grid-row: 2;
  min-height: 0;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto 1fr auto;
  gap: calc(var(--u) * 0.6);
  padding: calc(var(--u) * 0.5) calc(var(--u) * 1);
}
/* faint ring printed on the felt */
.center::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(var(--u) * 30);
  height: calc(var(--u) * 30);
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: calc(var(--u) * 0.15) solid rgba(236, 195, 106, 0.08);
  box-shadow:
    0 0 0 calc(var(--u) * 1.2) rgba(236, 195, 106, 0.025),
    inset 0 0 0 calc(var(--u) * 1.2) rgba(236, 195, 106, 0.025);
  pointer-events: none;
}
.r-top {
  grid-column: 2;
  grid-row: 1;
  justify-self: center;
}
.r-left {
  grid-column: 1;
  grid-row: 1 / 4;
}
.r-right {
  grid-column: 3;
  grid-row: 1 / 4;
}
.r-bottom {
  grid-column: 2;
  grid-row: 3;
  justify-self: center;
}

/* ------------------------------------------------------------ centre console */
.info {
  grid-column: 2;
  grid-row: 2;
  align-self: center;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: calc(var(--u) * 1.6);
  min-height: 0;
}
.status {
  justify-self: end;
  font-size: calc(var(--u) * 1.8);
  font-weight: 600;
  letter-spacing: 0.15em;
  color: var(--gold);
  text-shadow: 0 0 calc(var(--u) * 1) rgba(236, 195, 106, 0.35);
  white-space: nowrap;
}
.console {
  position: relative;
  width: calc(var(--u) * 8.6);
  height: calc(var(--u) * 6.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: calc(var(--u) * 1.4);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.07), transparent 45%),
    linear-gradient(180deg, #0c2a24, #051512);
  border: calc(var(--u) * 0.12) solid var(--panel-line);
  box-shadow:
    0 calc(var(--u) * 0.5) calc(var(--u) * 1.4) rgba(0, 0, 0, 0.45),
    inset 0 0 calc(var(--u) * 1) rgba(0, 0, 0, 0.6);
}
.round {
  font-size: calc(var(--u) * 1.1);
  letter-spacing: 0.1em;
  color: var(--text-dim);
}
.wall {
  font-size: calc(var(--u) * 2.8);
  font-weight: 700;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  color: var(--gold-hi);
}
.wall small {
  margin-right: calc(var(--u) * 0.2);
  font-size: calc(var(--u) * 1.1);
  font-weight: 400;
  color: var(--text-dim);
}
/* the console edge facing the seat to act lights up */
.edge {
  position: absolute;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  transition:
    background 0.25s,
    box-shadow 0.25s;
}
.edge.e-bottom,
.edge.e-top {
  left: 22%;
  right: 22%;
  height: calc(var(--u) * 0.35);
}
.edge.e-left,
.edge.e-right {
  top: 24%;
  bottom: 24%;
  width: calc(var(--u) * 0.35);
}
.edge.e-bottom {
  bottom: calc(var(--u) * 0.35);
}
.edge.e-top {
  top: calc(var(--u) * 0.35);
}
.edge.e-left {
  left: calc(var(--u) * 0.35);
}
.edge.e-right {
  right: calc(var(--u) * 0.35);
}
.edge.on {
  background: var(--gold);
  box-shadow: 0 0 calc(var(--u) * 0.8) var(--gold);
  animation: edge-pulse 1.2s ease-in-out infinite;
}
@keyframes edge-pulse {
  50% {
    opacity: 0.55;
  }
}
.waits {
  justify-self: start;
  display: flex;
  align-items: flex-end;
  gap: calc(var(--u) * 0.6);
  padding: calc(var(--u) * 0.5) calc(var(--u) * 0.8) calc(var(--u) * 0.3);
  border-radius: calc(var(--u) * 1);
  background: rgba(4, 16, 14, 0.55);
  border: calc(var(--u) * 0.12) solid rgba(95, 216, 150, 0.35);
}
.waits.gone {
  border-color: rgba(255, 110, 90, 0.45);
}
.ting-tag {
  align-self: center;
  padding: 0 calc(var(--u) * 0.5);
  border-radius: 999px;
  background: linear-gradient(#5fd896, #1f955a);
  color: #fff;
  font-size: calc(var(--u) * 1.4);
  font-weight: 700;
}
.waits.gone .ting-tag {
  background: linear-gradient(#ff7a6a, #c0392b);
}
.wait {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: calc(var(--u) * 1.3);
  line-height: 1.1;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.wait.dead {
  opacity: 0.45;
}
.wait.dead b {
  color: var(--down);
}

/* ------------------------------------------------------------ my seat */
.mine {
  grid-column: 1 / 4;
  grid-row: 3;
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: calc(var(--u) * 1.2);
  padding-bottom: calc(var(--u) * 0.8);
  background: linear-gradient(to top, rgba(0, 0, 0, 0.32), transparent 70%);
}
.mine > .badge {
  align-self: center;
}
.hand {
  display: flex;
  align-items: flex-end;
  gap: calc(var(--u) * 0.4);
}
.hand .tile {
  cursor: pointer;
  touch-action: none;
}
.drawn {
  margin-left: calc(var(--u) * 1.2);
  animation: draw-in 0.3s cubic-bezier(0.2, 0.8, 0.3, 1.15) both;
}
@keyframes draw-in {
  from {
    translate: 60% -30%;
    opacity: 0;
  }
}

/* ------------------------------------------------------------ buttons */
.actions {
  position: absolute;
  right: calc(var(--u) * 3);
  bottom: 100%;
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 1);
  padding: calc(var(--u) * 0.7) calc(var(--u) * 1.1) calc(var(--u) * 0.9);
  border-radius: calc(var(--u) * 1.4);
  background: linear-gradient(180deg, rgba(12, 40, 34, 0.9), rgba(4, 16, 14, 0.9));
  border: calc(var(--u) * 0.12) solid var(--panel-line);
  box-shadow: 0 calc(var(--u) * 0.6) calc(var(--u) * 1.6) rgba(0, 0, 0, 0.5);
  z-index: 5;
  animation: rise 0.22s cubic-bezier(0.2, 0.8, 0.3, 1.2) both;
}
@keyframes rise {
  from {
    translate: 0 40%;
    opacity: 0;
  }
}
.actions .tile {
  margin-right: calc(var(--u) * 0.4);
}
.actions button,
.que-box button {
  --c1: #7d8b90;
  --c2: #4b585d;
  --c3: #2e383c;
  position: relative;
  border: none;
  color: #fff;
  font-weight: 800;
  text-shadow: 0 calc(var(--u) * 0.12) 0 rgba(0, 0, 0, 0.35);
  background: linear-gradient(180deg, var(--c1), var(--c2));
  box-shadow:
    inset 0 calc(var(--u) * 0.15) 0 rgba(255, 255, 255, 0.35),
    0 calc(var(--u) * 0.45) 0 var(--c3),
    0 calc(var(--u) * 0.7) calc(var(--u) * 1) rgba(0, 0, 0, 0.45);
  transition:
    translate 0.06s,
    box-shadow 0.06s;
}
.actions button:active,
.que-box button:active {
  translate: 0 calc(var(--u) * 0.35);
  box-shadow:
    inset 0 calc(var(--u) * 0.15) 0 rgba(255, 255, 255, 0.35),
    0 calc(var(--u) * 0.1) 0 var(--c3),
    0 calc(var(--u) * 0.3) calc(var(--u) * 0.6) rgba(0, 0, 0, 0.45);
}
.actions button {
  min-width: calc(var(--u) * 6.4);
  font-size: calc(var(--u) * 2.4);
  padding: calc(var(--u) * 0.5) calc(var(--u) * 1.6);
  border-radius: calc(var(--u) * 1);
}
.actions .hu {
  --c1: #ff7d4d;
  --c2: #d8262a;
  --c3: #861518;
  color: var(--gold-hi);
  outline: calc(var(--u) * 0.15) solid rgba(255, 220, 140, 0.8);
  outline-offset: calc(var(--u) * -0.35);
}
.actions .peng {
  --c1: #4fa2ff;
  --c2: #2163c9;
  --c3: #133b7a;
}
.actions .gang {
  --c1: #b17cff;
  --c2: #6d3bd0;
  --c3: #3f1f80;
}

/* ------------------------------------------------------------ 定缺 picker */
.que-mask {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: radial-gradient(ellipse at 50% 40%, rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.4));
  z-index: 10;
  pointer-events: none;
}
.que-box {
  pointer-events: auto;
  display: flex;
  gap: calc(var(--u) * 1.6);
  padding: calc(var(--u) * 1.2) calc(var(--u) * 1.6);
  border-radius: calc(var(--u) * 1.8);
  background: linear-gradient(180deg, rgba(12, 40, 34, 0.94), rgba(4, 16, 14, 0.94));
  border: calc(var(--u) * 0.12) solid var(--panel-line);
  box-shadow: 0 calc(var(--u) * 1) calc(var(--u) * 3) rgba(0, 0, 0, 0.55);
  /* keep the hand visible below */
  transform: translateY(-30%);
  animation: rise 0.25s cubic-bezier(0.2, 0.8, 0.3, 1.2) both;
}
.que-box button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.3);
  min-width: calc(var(--u) * 9);
  padding: calc(var(--u) * 1) calc(var(--u) * 1.4) calc(var(--u) * 0.7);
  border-radius: calc(var(--u) * 1.2);
}
.que-box button.m {
  --c1: #e8615a;
  --c2: #a8261f;
  --c3: #5e1410;
}
.que-box button.s {
  --c1: #45b27a;
  --c2: #1d6d44;
  --c3: #0e3b24;
}
.que-box button.p {
  --c1: #5a8ae8;
  --c2: #2449a3;
  --c3: #132a5f;
}
.que-name {
  font-size: calc(var(--u) * 2.2);
}
.que-box small {
  font-size: calc(var(--u) * 1.2);
  font-weight: 500;
  opacity: 0.85;
}

/* ------------------------------------------------------------ toolbar */
.toolbar {
  position: fixed;
  left: 50%;
  top: calc(var(--u) * 0.5);
  transform: translateX(-50%);
  /* above the result panel, so a finished round can still be copied */
  z-index: 25;
  display: flex;
  padding: calc(var(--u) * 0.2);
  border-radius: 999px;
  background: rgba(4, 16, 14, 0.66);
  border: calc(var(--u) * 0.1) solid rgba(236, 195, 106, 0.2);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.toolbar button {
  font-size: calc(var(--u) * 1.3);
  padding: calc(var(--u) * 0.25) calc(var(--u) * 1.1);
  border: none;
  border-radius: 999px;
  background: transparent;
  color: rgba(243, 239, 226, 0.88);
  letter-spacing: 0.05em;
}
.toolbar button + button {
  box-shadow: inset calc(var(--u) * 0.1) 0 0 rgba(236, 195, 106, 0.18);
}
.toolbar button:active {
  background: rgba(255, 255, 255, 0.1);
}
.toolbar button.on {
  color: var(--gold);
  font-weight: 700;
}
.toolbar button.warn {
  background: linear-gradient(#e2483c, #a51f17);
  color: #fff;
  box-shadow: none;
}
.toast {
  position: fixed;
  left: 50%;
  top: 40%;
  transform: translateX(-50%);
  z-index: 30;
  background: rgba(4, 16, 14, 0.88);
  border: calc(var(--u) * 0.1) solid var(--panel-line);
  color: var(--gold-hi);
  padding: calc(var(--u) * 0.8) calc(var(--u) * 2);
  border-radius: 999px;
  font-size: calc(var(--u) * 1.7);
}
.diag-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
}
.diag-box {
  width: 85vw;
  height: 80dvh;
  background: #0c2621;
  border: calc(var(--u) * 0.12) solid var(--panel-line);
  border-radius: calc(var(--u) * 1.2);
  padding: calc(var(--u) * 1);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.8);
  font-size: calc(var(--u) * 1.6);
}
.diag-box textarea {
  flex: 1;
  font-size: 12px;
  background: #051512;
  color: var(--text);
  border: none;
  border-radius: calc(var(--u) * 0.6);
  user-select: text;
  -webkit-user-select: text;
}
.diag-box button {
  align-self: center;
  padding: calc(var(--u) * 0.4) calc(var(--u) * 3);
  border: none;
  border-radius: 999px;
  background: var(--gold);
  color: #3a2600;
  font-size: calc(var(--u) * 1.6);
  font-weight: 700;
}

/* ------------------------------------------------------------ 碰 / 杠 / 胡 callouts */
.flash-layer {
  position: fixed;
  inset: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * 6);
  pointer-events: none;
}
.flash {
  --glow: #2e86de;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: flash 1.6s ease-out forwards;
}
.flash-gang {
  --glow: #a55eea;
}
.flash-hu {
  --glow: #ff6a2a;
}
/* burst of light behind the glyph */
.flash::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 58%;
  width: calc(var(--u) * 26);
  height: calc(var(--u) * 26);
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background:
    repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--glow) 40%, transparent) 0 6deg, transparent 6deg 18deg),
    radial-gradient(circle, color-mix(in srgb, var(--glow) 70%, transparent), transparent 62%);
  -webkit-mask: radial-gradient(circle, #000 25%, transparent 68%);
  mask: radial-gradient(circle, #000 25%, transparent 68%);
  z-index: -1;
  animation: burst 1.6s linear forwards;
}
@keyframes burst {
  to {
    transform: translate(-50%, -50%) rotate(40deg);
  }
}
.flash-who {
  padding: calc(var(--u) * 0.1) calc(var(--u) * 1.2);
  border-radius: 999px;
  background: rgba(4, 16, 14, 0.75);
  border: calc(var(--u) * 0.1) solid var(--panel-line);
  font-size: calc(var(--u) * 1.8);
  color: var(--gold-hi);
}
.flash-text {
  font-family: 'Kaiti SC', 'STKaiti', 'KaiTi', 'BiauKai', serif;
  font-size: calc(var(--u) * 13);
  line-height: 1.05;
  font-weight: 900;
  background: linear-gradient(180deg, #ffffff 15%, color-mix(in srgb, var(--glow) 35%, #fff) 60%, var(--glow) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: calc(var(--u) * 0.2) rgba(0, 0, 0, 0.55);
  filter: drop-shadow(0 0 calc(var(--u) * 1.4) var(--glow)) drop-shadow(0 calc(var(--u) * 0.4) calc(var(--u) * 0.3) rgba(0, 0, 0, 0.6));
}
.flash-hu .flash-text {
  background-image: linear-gradient(180deg, #fffbe6 10%, #ffd65a 50%, #ff8a1e 100%);
}
@keyframes flash {
  0% {
    opacity: 0;
    transform: scale(2.2);
  }
  12% {
    opacity: 1;
    transform: scale(0.92);
  }
  22% {
    transform: scale(1.05);
  }
  32% {
    transform: scale(1);
  }
  78% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: scale(1.1);
  }
}
</style>
