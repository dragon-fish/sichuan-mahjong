<script setup lang="ts">
import { computed } from 'vue'
import { SUIT_NAMES, tileName } from '../engine/tiles'
import type { SeatView } from '../engine/types'
import { SEAT_NAMES } from './session'

const props = defineProps<{ sv: SeatView; name: string; total: number; dealer: boolean; turn: boolean }>()

const SUIT_CLASS = ['m', 's', 'p']

const winText = computed(() => {
  const w = props.sv.win
  if (!w) return ''
  const how = w.kind === 'zimo' ? '自摸' : w.kind === 'qianggang' ? `抢${SEAT_NAMES[w.from!]}的杠` : `${SEAT_NAMES[w.from!]}点炮`
  const fan = w.fan ? ` · ${w.fan.items.map((it) => it.name).join(' ')} ${w.fan.total}番` : ''
  return `胡${tileName(w.tile)} · ${how}${fan}`
})
</script>

<template>
  <div class="badge" :class="{ turn, won: !!sv.win }">
    <div class="avatar" :class="`seat${sv.seat}`">
      {{ name[0] }}
      <span v-if="dealer" class="seal dealer">庄</span>
      <span v-if="sv.win" class="seal win">胡</span>
    </div>
    <div class="info">
      <div class="name">
        {{ name }}
        <span v-if="sv.que !== null" class="que" :class="SUIT_CLASS[sv.que]">缺{{ SUIT_NAMES[sv.que] }}</span>
      </div>
      <div class="score">
        {{ total + sv.delta }}
        <span v-if="sv.delta" class="delta" :class="sv.delta > 0 ? 'up' : 'down'">{{ sv.delta > 0 ? '+' : '' }}{{ sv.delta }}</span>
      </div>
    </div>
    <div v-if="winText" class="how">{{ winText }}</div>
  </div>
</template>

<style scoped>
.badge {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  column-gap: calc(var(--u) * 0.6);
  padding: calc(var(--u) * 0.45) calc(var(--u) * 0.9) calc(var(--u) * 0.45) calc(var(--u) * 0.45);
  border-radius: calc(var(--u) * 3);
  background: linear-gradient(180deg, rgba(10, 34, 29, 0.82), rgba(4, 16, 14, 0.82));
  border: calc(var(--u) * 0.15) solid var(--panel-line);
  box-shadow: 0 calc(var(--u) * 0.4) calc(var(--u) * 1) rgba(0, 0, 0, 0.35);
  color: var(--text);
  font-size: calc(var(--u) * 1.5);
  line-height: 1.25;
  white-space: nowrap;
  transition:
    border-color 0.25s,
    box-shadow 0.25s;
}
.badge.turn {
  border-color: var(--gold);
  box-shadow:
    0 0 calc(var(--u) * 1.2) rgba(236, 195, 106, 0.55),
    0 calc(var(--u) * 0.4) calc(var(--u) * 1) rgba(0, 0, 0, 0.35);
}
.avatar {
  --d: calc(var(--u) * 3.4);
  position: relative;
  width: var(--d);
  height: var(--d);
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: calc(var(--u) * 1.7);
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
  box-shadow:
    inset 0 calc(var(--u) * 0.25) calc(var(--u) * 0.3) rgba(255, 255, 255, 0.35),
    inset 0 calc(var(--u) * -0.3) calc(var(--u) * 0.4) rgba(0, 0, 0, 0.3);
}
.seat0 {
  background: var(--seat-0);
}
.seat1 {
  background: var(--seat-1);
}
.seat2 {
  background: var(--seat-2);
}
.seat3 {
  background: var(--seat-3);
}
/* spinning ring around the avatar of the seat to act */
.turn .avatar::after {
  content: '';
  position: absolute;
  inset: calc(var(--u) * -0.4);
  border-radius: 50%;
  background: conic-gradient(var(--gold-hi), var(--gold) 25%, transparent 45%, transparent 55%, var(--gold) 75%, var(--gold-hi));
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - var(--u) * 0.3), #000 calc(100% - var(--u) * 0.25));
  mask: radial-gradient(farthest-side, transparent calc(100% - var(--u) * 0.3), #000 calc(100% - var(--u) * 0.25));
  animation: spin 1.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(1turn);
  }
}
.seal {
  position: absolute;
  display: grid;
  place-items: center;
  width: calc(var(--u) * 1.8);
  height: calc(var(--u) * 1.8);
  border-radius: calc(var(--u) * 0.4);
  font-size: calc(var(--u) * 1.15);
  font-weight: 700;
  line-height: 1;
  color: #fff;
  box-shadow: 0 0 0 calc(var(--u) * 0.15) rgba(4, 16, 14, 0.9);
  z-index: 1;
}
.seal.dealer {
  left: calc(var(--u) * -0.7);
  top: calc(var(--u) * -0.7);
  background: linear-gradient(#e2483c, #a51f17);
}
.seal.win {
  left: calc(var(--u) * -0.7);
  bottom: calc(var(--u) * -0.7);
  background: linear-gradient(var(--gold-hi), var(--gold) 45%, var(--gold-lo));
  color: #5a3a00;
}
.name {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.4);
  font-weight: 600;
}
.que {
  padding: 0 calc(var(--u) * 0.4);
  border-radius: calc(var(--u) * 0.4);
  font-size: calc(var(--u) * 1.15);
  line-height: 1.45;
  font-weight: 600;
  color: #fff;
}
.que.m {
  background: color-mix(in srgb, var(--suit-m) 80%, #000);
}
.que.s {
  background: color-mix(in srgb, var(--suit-s) 80%, #000);
}
.que.p {
  background: color-mix(in srgb, var(--suit-p) 80%, #000);
}
.score {
  font-size: calc(var(--u) * 1.4);
  font-variant-numeric: tabular-nums;
  color: var(--gold-hi);
}
.delta {
  margin-left: calc(var(--u) * 0.2);
  font-size: calc(var(--u) * 1.2);
}
.up {
  color: var(--up);
}
.down {
  color: var(--down);
}
.how {
  grid-column: 1 / -1;
  /* clear the 胡 seal hanging below the avatar */
  margin-top: calc(var(--u) * 0.8);
  padding-left: calc(var(--u) * 0.3);
  font-size: calc(var(--u) * 1.2);
  color: var(--gold);
  white-space: normal;
  max-width: calc(var(--u) * 15);
}
.badge.won {
  border-radius: calc(var(--u) * 1.6);
}
</style>
