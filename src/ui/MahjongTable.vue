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
      <RiverTiles class="r-top" :river="view.seats[2].river" :cols="10" :w="2.6" :hot-last="lastDiscarder === 2" />
      <RiverTiles class="r-left" :river="view.seats[3].river" :cols="4" :w="2.6" :hot-last="lastDiscarder === 3" />
      <RiverTiles class="r-right" :river="view.seats[1].river" :cols="4" :w="2.6" :hot-last="lastDiscarder === 1" />
      <RiverTiles class="r-bottom" :river="view.seats[0].river" :cols="10" :w="2.6" :hot-last="lastDiscarder === 0" />
      <div class="info">
        <div>第 {{ round }} 局 · 剩 {{ view.wallRemaining }} 张</div>
        <div class="status">{{ statusText }}</div>
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
        <div class="que-btns">
          <button v-for="s in [0, 1, 2] as Suit[]" :key="s" @click="respond({ type: 'que', suit: s })">
            缺{{ SUIT_NAMES[s] }}<small>{{ suitCounts[s] }} 张</small>
          </button>
        </div>
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
  background: radial-gradient(ellipse at center, #237a50 0%, #0f3d28 100%);
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
  padding-top: calc(var(--u) * 2.4);
}
.center {
  grid-column: 2;
  grid-row: 2;
  min-height: 0;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto 1fr auto;
  gap: calc(var(--u) * 0.6);
  padding: calc(var(--u) * 0.5) calc(var(--u) * 1);
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
.info {
  grid-column: 2;
  grid-row: 2;
  align-self: center;
  justify-self: center;
  text-align: center;
  color: #e8f5e9;
  font-size: calc(var(--u) * 1.5);
}
.status {
  font-size: calc(var(--u) * 1.8);
  color: #ffd84a;
}
.mine {
  grid-column: 1 / 4;
  grid-row: 3;
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: calc(var(--u) * 1.2);
  padding-bottom: calc(var(--u) * 1);
}
.mine > .badge {
  align-self: center;
}
.hand {
  display: flex;
  align-items: flex-end;
  gap: calc(var(--u) * 0.35);
}
.hand .tile {
  cursor: pointer;
  touch-action: none;
}
.waits {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: calc(var(--u) * 0.6);
  margin-top: calc(var(--u) * 0.4);
}
.ting-tag {
  align-self: center;
  padding: 0 calc(var(--u) * 0.5);
  border-radius: calc(var(--u) * 0.5);
  background: #27ae60;
  color: #fff;
  font-weight: bold;
}
.waits.gone .ting-tag {
  background: #c0392b;
}
.wait {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: calc(var(--u) * 1.4);
  line-height: 1.2;
}
.wait.dead {
  opacity: 0.5;
}
.wait.dead b {
  color: #ff6b6b;
}
.drawn {
  margin-left: calc(var(--u) * 1.2);
}
.actions {
  position: absolute;
  right: calc(var(--u) * 3);
  bottom: 100%;
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 1);
  padding: calc(var(--u) * 0.6) calc(var(--u) * 1);
  border-radius: calc(var(--u) * 1);
  background: rgba(0, 0, 0, 0.4);
  z-index: 5;
}
.actions button,
.que-btns button {
  font-size: calc(var(--u) * 2.4);
  padding: calc(var(--u) * 0.5) calc(var(--u) * 2);
  border: none;
  border-radius: calc(var(--u) * 0.8);
  color: #fff;
  font-weight: bold;
}
.hu {
  background: #e74c3c;
}
.peng {
  background: #2980b9;
}
.gang {
  background: #8e44ad;
}
.pass {
  background: #7f8c8d;
}
.que-mask {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.25);
  z-index: 10;
  pointer-events: none;
}
.que-box {
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: calc(var(--u) * 1.5) calc(var(--u) * 2.5);
  border-radius: calc(var(--u) * 1.2);
  text-align: center;
  font-size: calc(var(--u) * 2);
  /* keep the hand visible below */
  transform: translateY(-30%);
}
.que-btns {
  display: flex;
  gap: calc(var(--u) * 1.5);
  margin-top: calc(var(--u) * 1);
}
.que-btns button {
  background: #16a085;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.que-btns small {
  font-size: calc(var(--u) * 1.3);
  font-weight: normal;
}
.toolbar {
  position: fixed;
  left: 50%;
  top: calc(var(--u) * 0.5);
  transform: translateX(-50%);
  /* above the result panel, so a finished round can still be copied */
  z-index: 25;
  display: flex;
  gap: calc(var(--u) * 0.6);
}
.toolbar button {
  font-size: calc(var(--u) * 1.3);
  padding: calc(var(--u) * 0.3) calc(var(--u) * 1);
  border: none;
  border-radius: calc(var(--u) * 0.6);
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.7);
}
.toolbar button.warn {
  background: #c0392b;
  color: #fff;
}
.toolbar button.on {
  background: #27ae60;
  color: #fff;
}
.toast {
  position: fixed;
  left: 50%;
  top: 40%;
  transform: translateX(-50%);
  z-index: 30;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: calc(var(--u) * 0.8) calc(var(--u) * 2);
  border-radius: calc(var(--u) * 0.8);
  font-size: calc(var(--u) * 1.8);
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
  background: #fff;
  border-radius: calc(var(--u) * 1);
  padding: calc(var(--u) * 1);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.8);
  font-size: calc(var(--u) * 1.6);
}
.diag-box textarea {
  flex: 1;
  font-size: 12px;
  user-select: text;
  -webkit-user-select: text;
}
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
  text-align: center;
  animation: flash 1.6s ease-out forwards;
}
.flash-who {
  font-size: calc(var(--u) * 2.4);
  color: #fff;
  text-shadow: 0 0 calc(var(--u) * 0.5) #000;
}
.flash-text {
  font-size: calc(var(--u) * 13);
  line-height: 1;
  font-weight: 900;
  color: #fff;
  -webkit-text-stroke: calc(var(--u) * 0.25) rgba(0, 0, 0, 0.6);
}
.flash-peng .flash-text {
  text-shadow: 0 0 calc(var(--u) * 2) #2e86de, 0 0 calc(var(--u) * 5) #2e86de;
}
.flash-gang .flash-text {
  text-shadow: 0 0 calc(var(--u) * 2) #a55eea, 0 0 calc(var(--u) * 5) #a55eea;
}
.flash-hu .flash-text {
  color: #ffe066;
  text-shadow: 0 0 calc(var(--u) * 2) #ff4d4d, 0 0 calc(var(--u) * 6) #ff9f1a;
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
