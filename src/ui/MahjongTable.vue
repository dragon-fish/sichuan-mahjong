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
import { ME, SEAT_NAMES, type Session } from './session'

const props = defineProps<{ session: Session }>()
const { view, request, result, totals, round, floats, startRound } = props.session

const OPPONENTS = [
  { seat: 1 as Seat, pos: 'right' as const },
  { seat: 2 as Seat, pos: 'top' as const },
  { seat: 3 as Seat, pos: 'left' as const },
]

const me = computed(() => view.value!.seats[ME])
const actions = computed<Action[]>(() => request.value?.actions ?? [])
const queChoice = computed(() => actions.value[0]?.type === 'que')
const isClaim = computed(() => actions.value.some((a) => a.type === 'pass'))

/** Hand sorted with the 定缺 suit pushed to the right. */
const myHand = computed(() => {
  const que = me.value.que
  const key = (t: Tile) => (suitOf(t) === que ? 100 : 0) + t
  return [...view.value!.hand].sort((a, b) => key(a) - key(b))
})
const discardable = computed(() => new Set(actions.value.flatMap((a) => (a.type === 'discard' ? [a.tile] : []))))

const suitCounts = computed(() => {
  const c = [0, 0, 0]
  for (const t of view.value!.hand) c[suitOf(t)]++
  if (view.value!.drawn !== null) c[suitOf(view.value!.drawn)]++
  return c
})

/** Selected tile: index into myHand, or 'drawn'. Tap once to raise, again to discard. */
const selected = ref<number | 'drawn' | null>(null)
watch(request, () => (selected.value = null))

function tapTile(key: number | 'drawn', tile: Tile) {
  if (!discardable.value.has(tile)) return
  if (selected.value === key) respond({ type: 'discard', tile })
  else selected.value = key
}

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
  if (queChoice.value) return '请选择定缺'
  if (isClaim.value) return `${tileName(view.value!.pendingTile!)}：要吗？`
  if (request.value) return me.value.win ? '' : '轮到你出牌，点两下打出'
  if (me.value.win) return '你已胡牌，观战中'
  return `${SEAT_NAMES[view.value!.turn]}思考中…`
})
</script>

<template>
  <div v-if="view" class="table">
    <OpponentSeat
      v-for="o in OPPONENTS"
      :key="o.seat"
      :class="o.pos"
      :sv="view.seats[o.seat]"
      :pos="o.pos"
      :name="SEAT_NAMES[o.seat]"
      :total="totals[o.seat]"
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
      </div>
    </div>

    <div class="mine">
      <SeatBadge :sv="me" :name="SEAT_NAMES[ME]" :total="totals[ME]" :dealer="view.dealer === ME" :turn="view.turn === ME" />
      <MeldRow :melds="me.melds" :w="3.6" />
      <div class="hand">
        <template v-if="me.winHand">
          <MjTile v-for="(t, i) in me.winHand" :key="i" :tile="t" :w="5" :hot="t === me.win?.tile" />
        </template>
        <template v-else>
          <MjTile
            v-for="(t, i) in myHand"
            :key="i"
            :tile="t"
            :w="5.4"
            :que="suitOf(t) === me.que"
            :dim="discardable.size > 0 && !discardable.has(t)"
            :raised="selected === i"
            @click="tapTile(i, t)"
          />
          <MjTile
            v-if="view.drawn !== null"
            class="drawn"
            :tile="view.drawn"
            :w="5.4"
            :que="suitOf(view.drawn) === me.que"
            :dim="discardable.size > 0 && !discardable.has(view.drawn)"
            :raised="selected === 'drawn'"
            @click="tapTile('drawn', view.drawn)"
          />
        </template>
      </div>

      <div v-if="buttons.length" class="actions">
        <MjTile v-if="isClaim && view.pendingTile !== null" :tile="view.pendingTile" :w="3.6" />
        <button v-for="(b, i) in buttons" :key="i" :class="b.cls" @click="respond(b.a)">{{ b.label }}</button>
      </div>
    </div>

    <div v-if="queChoice" class="que-mask">
      <div class="que-box">
        <div>选一门不要（定缺）</div>
        <div class="que-btns">
          <button v-for="s in [0, 1, 2] as Suit[]" :key="s" @click="respond({ type: 'que', suit: s })">
            缺{{ SUIT_NAMES[s] }}<small>手里 {{ suitCounts[s] }} 张</small>
          </button>
        </div>
      </div>
    </div>

    <div v-for="f in floats" :key="f.id" class="float" :class="`seat${f.seat}`">{{ f.text }}</div>

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
  grid-template-rows: calc(var(--u) * 8.5) 1fr calc(var(--u) * 12.5);
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
}
.hand .tile {
  cursor: pointer;
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
.float {
  position: fixed;
  z-index: 15;
  font-size: calc(var(--u) * 6);
  font-weight: 900;
  color: #ffd84a;
  text-shadow: 0 0 calc(var(--u) * 0.6) #000, 0 0 calc(var(--u) * 1.2) #c0392b;
  animation: pop 1.4s ease-out forwards;
  pointer-events: none;
  transform: translate(-50%, -50%);
}
.seat0 {
  left: 50%;
  top: 62%;
}
.seat1 {
  left: 80%;
  top: 45%;
}
.seat2 {
  left: 50%;
  top: 25%;
}
.seat3 {
  left: 20%;
  top: 45%;
}
@keyframes pop {
  0% {
    opacity: 0;
    scale: 0.5;
  }
  15% {
    opacity: 1;
    scale: 1.15;
  }
  30% {
    scale: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
