<script setup lang="ts">
import type { PublicMeld } from '../engine/types'
import MjTile from './MjTile.vue'

defineProps<{ melds: PublicMeld[]; w: number; vertical?: boolean }>()

function tilesOf(m: PublicMeld) {
  if (m.kind === 'angang') return m.tile === null ? [null, null, null, null] : [null, m.tile, m.tile, null]
  return new Array(m.kind === 'peng' ? 3 : 4).fill(m.tile)
}
</script>

<template>
  <div class="melds" :class="{ vertical }">
    <div v-for="(m, i) in melds" :key="i" class="meld">
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
  gap: calc(var(--u) * 0.5);
}
.meld {
  display: flex;
  gap: calc(var(--u) * 0.12);
}
</style>
