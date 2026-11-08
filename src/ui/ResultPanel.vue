<script setup lang="ts">
import type { RoundResult } from '../engine/types'
import MeldRow from './MeldRow.vue'
import MjTile from './MjTile.vue'
import { SEAT_NAMES } from './session'

defineProps<{ result: RoundResult; totals: number[] }>()
defineEmits<{ next: [] }>()

const REASON = { hu: '胡牌', minggang: '明杠', bugang: '补杠', angang: '暗杠', huazhu: '花猪', dajiao: '大叫', refund: '退杠' }
</script>

<template>
  <div class="mask">
    <div class="panel">
      <h2>{{ result.liuju ? '牌墙摸完 · 查叫结算' : '三家胡牌 · 本局结束' }}</h2>
      <div class="body">
        <div class="seats">
          <div v-for="(name, i) in SEAT_NAMES" :key="i" class="seat">
            <div class="head">
              <b>{{ name }}</b>
              <span v-if="result.winners.includes(i as 0)" class="won">第{{ result.winners.indexOf(i as 0) + 1 }}个胡</span>
              <span :class="result.deltas[i] >= 0 ? 'up' : 'down'">{{ result.deltas[i] > 0 ? '+' : '' }}{{ result.deltas[i] }}</span>
              <span class="total">累计 {{ totals[i] }}</span>
            </div>
            <div class="tiles">
              <span class="concealed"><MjTile v-for="(t, j) in result.hands[i]" :key="j" :tile="t" :w="2.3" /></span>
              <MeldRow :melds="result.melds[i]" :w="2.3" />
            </div>
          </div>
        </div>
        <ol class="payments">
          <li v-for="p in result.payments" :key="p.id">
            <span class="reason">{{ REASON[p.reason] }}</span>
            {{ SEAT_NAMES[p.from] }} → {{ SEAT_NAMES[p.to] }} <b>{{ p.amount }}</b>
            <small>{{ p.note }}</small>
          </li>
          <li v-if="result.payments.length === 0">没有任何支付</li>
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
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  z-index: 20;
}
.panel {
  width: 92vw;
  height: 90dvh;
  background: #fdf8ec;
  color: #333;
  border-radius: calc(var(--u) * 1.5);
  padding: calc(var(--u) * 1.2) calc(var(--u) * 2);
  display: flex;
  flex-direction: column;
  font-size: calc(var(--u) * 1.5);
}
h2 {
  margin: 0 0 calc(var(--u) * 0.8);
  font-size: calc(var(--u) * 2.2);
  text-align: center;
}
.body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: calc(var(--u) * 2);
}
.seats {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.head {
  display: flex;
  gap: calc(var(--u) * 1);
  align-items: baseline;
}
.won {
  color: #e67e22;
}
.total {
  color: #888;
  margin-left: auto;
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
.payments {
  overflow-y: auto;
  margin: 0;
  padding-left: calc(var(--u) * 2.5);
  font-size: calc(var(--u) * 1.4);
  line-height: 1.6;
}
.reason {
  display: inline-block;
  min-width: 3em;
  color: #c0392b;
}
small {
  color: #888;
}
.up {
  color: #27ae60;
  font-weight: bold;
}
.down {
  color: #c0392b;
  font-weight: bold;
}
.next {
  align-self: center;
  margin-top: calc(var(--u) * 1);
  font-size: calc(var(--u) * 2);
  padding: calc(var(--u) * 0.6) calc(var(--u) * 4);
  border: none;
  border-radius: calc(var(--u) * 1);
  background: #27ae60;
  color: #fff;
}
</style>
