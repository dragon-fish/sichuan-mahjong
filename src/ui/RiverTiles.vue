<script setup lang="ts">
import { computed } from 'vue'
import type { RiverTile } from '../engine/types'
import MjTile from './MjTile.vue'

const props = defineProps<{ river: RiverTile[]; cols: number; w: number; hotLast: boolean }>()
const shown = computed(() => props.river.map((r, i) => ({ ...r, last: i === props.river.length - 1 })).filter((r) => !r.claimed))
</script>

<template>
  <div class="river" :style="{ gridTemplateColumns: `repeat(${cols}, auto)` }">
    <MjTile v-for="(r, i) in shown" :key="i" :tile="r.tile" :w="w" :hot="hotLast && r.last" />
  </div>
</template>

<style scoped>
.river {
  display: grid;
  gap: calc(var(--u) * 0.15);
  align-content: start;
}
</style>
