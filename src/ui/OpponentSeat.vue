<script setup lang="ts">
import { computed } from 'vue'
import type { SeatView } from '../engine/types'
import MeldRow from './MeldRow.vue'
import MjTile from './MjTile.vue'
import SeatBadge from './SeatBadge.vue'

const props = defineProps<{
  sv: SeatView
  pos: 'left' | 'top' | 'right'
  name: string
  total: number
  dealer: boolean
  turn: boolean
}>()

const vertical = computed(() => props.pos !== 'top')
const rot = computed(() => (props.pos === 'left' ? 90 : props.pos === 'right' ? 270 : 0))
const backs = computed(() => new Array(props.sv.handCount).fill(null))
const winIndex = computed(() => (props.sv.win && props.sv.winHand ? props.sv.winHand.lastIndexOf(props.sv.win.tile) : -1))
</script>

<template>
  <div class="opp" :class="pos">
    <SeatBadge :sv="sv" :name="name" :total="total" :dealer="dealer" :turn="turn" />
    <div v-if="sv.winHand" class="hand won">
      <MjTile
        v-for="(t, i) in sv.winHand"
        :key="i"
        :tile="t"
        :w="vertical ? 2.2 : 2.4"
        :hot="i === winIndex"
      />
    </div>
    <div v-else class="hand">
      <MjTile v-for="(t, i) in backs" :key="i" :tile="t" :w="vertical ? 2 : 2.4" :rot="rot" />
    </div>
    <MeldRow :melds="sv.melds" :w="vertical ? 2.2 : 2.6" :vertical="vertical" />
  </div>
</template>

<style scoped>
.opp {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 1);
}
.opp.top {
  flex-direction: row;
  justify-content: center;
}
.opp.left,
.opp.right {
  flex-direction: column;
  justify-content: flex-start;
  padding-top: calc(var(--u) * 1);
}
.hand {
  display: flex;
  gap: calc(var(--u) * 0.12);
}
.hand.won {
  gap: calc(var(--u) * 0.2);
}
.left .hand:not(.won),
.right .hand:not(.won) {
  flex-direction: column;
}
.left .hand.won,
.right .hand.won {
  flex-wrap: wrap;
  justify-content: center;
  width: calc(var(--u) * 11);
}
</style>
