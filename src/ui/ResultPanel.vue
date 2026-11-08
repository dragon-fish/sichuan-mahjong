<script setup lang="ts">
import type { RoundResult, Seat } from '../engine/types'
import MeldRow from './MeldRow.vue'
import MjTile from './MjTile.vue'
import { ME, SEAT_NAMES } from './session'

defineProps<{ result: RoundResult; totals: number[] }>()
defineEmits<{ next: [] }>()

const REASON = { hu: '胡牌', minggang: '明杠', bugang: '补杠', angang: '暗杠', huazhu: '花猪', dajiao: '大叫', refund: '退杠' }
const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`)
</script>

<template>
  <div class="mask">
    <div class="panel">
      <h2>{{ result.liuju ? '牌墙摸完 · 查叫结算' : '三家胡牌 · 本局结束' }}</h2>
      <div class="body">
        <div class="seats">
          <div v-for="(name, i) in SEAT_NAMES" :key="i" class="seat" :class="{ won: result.winners.includes(i as Seat) }">
            <span class="avatar" :style="{ background: `var(--seat-${i})` }">{{ name[0] }}</span>
            <div class="mid">
              <div class="head">
                <b>{{ name }}</b>
                <span v-if="result.winners.includes(i as Seat)" class="won-tag">第{{ result.winners.indexOf(i as Seat) + 1 }}个胡</span>
              </div>
              <div class="tiles">
                <span class="concealed"><MjTile v-for="(t, j) in result.hands[i]" :key="j" :tile="t" :w="2.3" /></span>
                <MeldRow :melds="result.melds[i]" :w="2.3" />
              </div>
            </div>
            <div class="score">
              <span class="delta" :class="result.deltas[i] > 0 ? 'up' : result.deltas[i] < 0 ? 'down' : ''">{{ sign(result.deltas[i]) }}</span>
              <small>累计 {{ totals[i] }}</small>
            </div>
          </div>
        </div>
        <ol class="payments">
          <li v-for="p in result.payments" :key="p.id">
            <span class="reason" :class="p.reason">{{ REASON[p.reason] }}</span>
            <span class="flow">{{ SEAT_NAMES[p.from] }} → {{ SEAT_NAMES[p.to] }}</span>
            <b :class="p.to === ME ? 'up' : p.from === ME ? 'down' : ''">{{ p.amount }}</b>
            <small>{{ p.note }}</small>
          </li>
          <li v-if="result.payments.length === 0" class="none">没有任何支付</li>
        </ol>
      </div>
      <button class="next" @click="$emit('next')">下一局</button>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(2, 10, 8, 0.6);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  z-index: 20;
}
.panel {
  width: 92vw;
  height: 90dvh;
  box-sizing: border-box;
  background:
    radial-gradient(ellipse at 50% -20%, rgba(236, 195, 106, 0.16), transparent 60%),
    linear-gradient(180deg, #123630, #071a16);
  border: calc(var(--u) * 0.15) solid var(--panel-line);
  box-shadow:
    0 calc(var(--u) * 1.5) calc(var(--u) * 4) rgba(0, 0, 0, 0.6),
    inset 0 0 0 calc(var(--u) * 0.5) rgba(0, 0, 0, 0.25);
  color: var(--text);
  border-radius: calc(var(--u) * 1.8);
  padding: calc(var(--u) * 1.2) calc(var(--u) * 2);
  display: flex;
  flex-direction: column;
  font-size: calc(var(--u) * 1.5);
  animation: pop 0.3s cubic-bezier(0.2, 0.8, 0.3, 1.15) both;
}
@keyframes pop {
  from {
    scale: 0.92;
    opacity: 0;
  }
}
h2 {
  margin: 0 0 calc(var(--u) * 0.8);
  font-size: calc(var(--u) * 2.1);
  letter-spacing: 0.1em;
  color: var(--gold);
  /* the toolbar sits top-centre over this panel */
  text-align: left;
}
.body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  gap: calc(var(--u) * 1.6);
}
.seats {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.6);
  min-height: 0;
}
.seat {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: calc(var(--u) * 1);
  padding: calc(var(--u) * 0.4) calc(var(--u) * 1);
  border-radius: calc(var(--u) * 1);
  background: rgba(255, 255, 255, 0.04);
  border: calc(var(--u) * 0.1) solid rgba(255, 255, 255, 0.05);
}
.seat.won {
  background: linear-gradient(90deg, rgba(236, 195, 106, 0.14), rgba(236, 195, 106, 0.03));
  border-color: rgba(236, 195, 106, 0.3);
}
.avatar {
  width: calc(var(--u) * 3);
  height: calc(var(--u) * 3);
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: calc(var(--u) * 1.5);
  font-weight: 700;
  color: #fff;
  box-shadow: inset 0 calc(var(--u) * 0.2) calc(var(--u) * 0.3) rgba(255, 255, 255, 0.35);
}
.head {
  display: flex;
  gap: calc(var(--u) * 0.8);
  align-items: center;
  margin-bottom: calc(var(--u) * 0.3);
  font-size: calc(var(--u) * 1.4);
}
.won-tag {
  padding: 0 calc(var(--u) * 0.5);
  border-radius: calc(var(--u) * 0.4);
  background: linear-gradient(var(--gold-hi), var(--gold) 50%, var(--gold-lo));
  color: #4a3000;
  font-size: calc(var(--u) * 1.1);
  font-weight: 700;
  line-height: 1.5;
}
.tiles {
  display: flex;
  gap: calc(var(--u) * 0.8);
  align-items: flex-end;
}
.concealed {
  display: flex;
  gap: calc(var(--u) * 0.2);
}
.score {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-variant-numeric: tabular-nums;
}
.delta {
  font-size: calc(var(--u) * 2.4);
  font-weight: 800;
  line-height: 1.1;
  color: var(--text-dim);
}
.score small {
  font-size: calc(var(--u) * 1.15);
  color: var(--text-dim);
}
.payments {
  overflow-y: auto;
  margin: 0;
  padding: calc(var(--u) * 0.8) calc(var(--u) * 1);
  list-style: none;
  border-radius: calc(var(--u) * 1);
  background: rgba(0, 0, 0, 0.25);
  font-size: calc(var(--u) * 1.35);
  line-height: 1.5;
}
.payments li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: calc(var(--u) * 0.6);
  padding: calc(var(--u) * 0.35) 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.payments li:last-child {
  border-bottom: none;
}
.reason {
  padding: 0 calc(var(--u) * 0.4);
  border-radius: calc(var(--u) * 0.35);
  font-size: calc(var(--u) * 1.15);
  background: rgba(165, 94, 234, 0.35);
  color: #e6d6ff;
}
.reason.hu {
  background: rgba(236, 195, 106, 0.25);
  color: var(--gold-hi);
}
.reason.huazhu,
.reason.dajiao {
  background: rgba(217, 71, 63, 0.35);
  color: #ffd2cc;
}
.reason.refund {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-dim);
}
.flow {
  color: var(--text);
}
.payments b {
  font-variant-numeric: tabular-nums;
}
.payments small {
  color: var(--text-dim);
  font-size: calc(var(--u) * 1.15);
}
.none {
  color: var(--text-dim);
}
.up {
  color: var(--up);
}
.down {
  color: var(--down);
}
.next {
  align-self: center;
  margin-top: calc(var(--u) * 1);
  font-size: calc(var(--u) * 2);
  font-weight: 800;
  letter-spacing: 0.2em;
  padding: calc(var(--u) * 0.6) calc(var(--u) * 4.5);
  border: none;
  border-radius: 999px;
  color: #4a3000;
  background: linear-gradient(180deg, var(--gold-hi), var(--gold) 45%, #d39b3a);
  box-shadow:
    inset 0 calc(var(--u) * 0.15) 0 rgba(255, 255, 255, 0.6),
    0 calc(var(--u) * 0.45) 0 #7a5418,
    0 calc(var(--u) * 0.8) calc(var(--u) * 1.4) rgba(0, 0, 0, 0.5);
}
.next:active {
  translate: 0 calc(var(--u) * 0.35);
  box-shadow:
    inset 0 calc(var(--u) * 0.15) 0 rgba(255, 255, 255, 0.6),
    0 calc(var(--u) * 0.1) 0 #7a5418;
}
</style>
