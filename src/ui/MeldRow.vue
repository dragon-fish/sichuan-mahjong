<script setup lang="ts">
import { ref, watch } from 'vue'
import type { PublicMeld } from '../engine/types'
import MjTile from './MjTile.vue'

const props = defineProps<{ melds: PublicMeld[]; w: number; vertical?: boolean }>()

/** Melds at or beyond this index were claimed after mount and pop in. */
const fresh = ref(props.melds.length)
watch(
  () => props.melds.length,
  (n, o) => {
    if (n < o) fresh.value = 0
  },
)

function tilesOf(m: PublicMeld) {
  if (m.kind === 'angang') return m.tile === null ? [null, null, null, null] : [null, m.tile, m.tile, null]
  return new Array(m.kind === 'peng' ? 3 : 4).fill(m.tile)
}
</script>

<template>
  <div class="melds" :class="{ vertical }">
    <div v-for="(m, i) in melds" :key="i" class="meld" :class="{ fresh: i >= fresh }">
      <MjTile v-for="(t, j) in tilesOf(m)" :key="j" :tile="t" :w="w" />
    </div>
  </div>
</template>

<style scoped>
.melds {
  display: flex;
  gap: calc(var(--u) * 0.8);
  align-items: flex-end;
}
.melds.vertical {
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.4);
}
.meld {
  display: flex;
  gap: calc(var(--u) * 0.12);
}
.fresh {
  animation: meld-in 0.38s cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
}
@keyframes meld-in {
  from {
    scale: 1.5;
    opacity: 0;
  }
}
</style>
