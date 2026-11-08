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
const hiddenBacks = computed(() => new Array(Math.max(0, props.sv.handCount - 1)).fill(null))
</script>

<template>
  <div class="opp" :class="pos">
    <SeatBadge :sv="sv" :name="name" :total="total" :dealer="dealer" :turn="turn" />
    <div v-if="sv.win" class="hand">
      <MjTile v-for="(t, i) in hiddenBacks" :key="i" :tile="t" :w="vertical ? 2 : 2.4" :rot="rot" />
      <MjTile class="win-tile" :tile="sv.win.tile" :w="2.6" hot />
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
.left .hand,
.right .hand {
  flex-direction: column;
  align-items: center;
}
.win-tile {
  margin: calc(var(--u) * 0.6);
}
</style>
