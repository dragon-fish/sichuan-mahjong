<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RiverTile } from '../engine/types'
import MjTile from './MjTile.vue'

const props = defineProps<{
  river: RiverTile[]
  cols: number
  w: number
  hotLast: boolean
  /** Side of the table the discarder sits on; new tiles slide in from there. */
  from: 'bottom' | 'right' | 'top' | 'left'
}>()

/** Tiles at or beyond this river index arrived after mount and get the slide-in. */
const fresh = ref(props.river.length)
watch(
  () => props.river.length,
  (n, o) => {
    if (n < o) fresh.value = 0
  },
)

const shown = computed(() =>
  props.river.map((r, i) => ({ ...r, i, last: i === props.river.length - 1 })).filter((r) => !r.claimed),
)
</script>

<template>
  <div class="river" :class="`from-${from}`" :style="{ gridTemplateColumns: `repeat(${cols}, auto)` }">
    <MjTile v-for="r in shown" :key="r.i" :class="{ fresh: r.i >= fresh }" :tile="r.tile" :w="w" :hot="hotLast && r.last" />
  </div>
</template>

<style scoped>
.river {
  display: grid;
  gap: calc(var(--u) * 0.3);
  align-content: start;
}
.from-bottom {
  --fx: 0;
  --fy: 260%;
}
.from-top {
  --fx: 0;
  --fy: -260%;
}
.from-left {
  --fx: -260%;
  --fy: 0;
}
.from-right {
  --fx: 260%;
  --fy: 0;
}
.fresh {
  animation: slide-in 0.32s cubic-bezier(0.2, 0.8, 0.3, 1.1) both;
}
@keyframes slide-in {
  from {
    translate: var(--fx) var(--fy);
    scale: 1.7;
    opacity: 0;
  }
  60% {
    opacity: 1;
  }
}
</style>
