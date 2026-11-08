<script setup lang="ts">
import { computed } from 'vue'
import { rankOf, suitOf, type Tile } from '../engine/tiles'
import { useFocus, useRankLabels } from './hints'

const props = defineProps<{
  /** null renders the tile back. */
  tile: Tile | null
  /** Width in table units (--u). */
  w: number
  rot?: 0 | 90 | 180 | 270
  dim?: boolean
  raised?: boolean
  /** Highlight, e.g. the latest discard or the winning tile. */
  hot?: boolean
  /** Tint for 定缺 tiles. */
  que?: boolean
  /** Discarding this tile leaves the hand waiting (听牌). */
  ting?: boolean
}>()

const focusTile = useFocus()
const rankLabels = useRankLabels()
const focus = computed(() => props.tile !== null && props.tile === focusTile.value)
const SUIT_CLASS = ['m', 's', 'p']

const base = import.meta.env.BASE_URL
const FILE_SUITS = ['Man', 'Sou', 'Pin']
const face = computed(() => (props.tile === null ? null : `${base}tiles/${FILE_SUITS[suitOf(props.tile)]}${rankOf(props.tile)}.svg`))
const sideways = computed(() => props.rot === 90 || props.rot === 270)
</script>

<template>
  <span class="tile" :class="{ sideways, dim, raised, hot, que, focus }" :style="{ '--w': w }" :data-tile="tile ?? undefined">
    <span
      class="body"
      :class="tile === null ? 'back' : 'front'"
      :style="rot ? { transform: `translate(-50%, -50%) rotate(${rot}deg)` } : undefined"
    >
      <img v-if="face" :src="face" alt="" draggable="false" />
      <span v-if="rankLabels && tile !== null" class="rank" :class="SUIT_CLASS[suitOf(tile)]">{{ rankOf(tile) }}</span>
    </span>
    <span v-if="ting" class="ting">听</span>
  </span>
</template>

<style scoped>
.tile {
  --tw: calc(var(--w) * var(--u));
  --th: calc(var(--tw) * 4 / 3);
  position: relative;
  display: inline-block;
  flex: none;
  width: var(--tw);
  height: var(--th);
  transition: transform 0.12s;
}
.tile.sideways {
  width: var(--th);
  height: var(--tw);
}
.body {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--tw);
  height: var(--th);
  transform: translate(-50%, -50%);
  background-size: 100% 100%;
  border-radius: calc(var(--tw) * 0.1);
}
.front {
  background-image: url('/tiles/Front.svg');
}
.back {
  background-image: url('/tiles/Back.svg');
  filter: hue-rotate(205deg) saturate(0.8) brightness(0.85);
}
.body img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.raised {
  transform: translateY(-22%);
}
.dim .body {
  filter: brightness(0.55);
}
.que .body {
  box-shadow: inset 0 0 0 999px rgba(255, 90, 60, 0.18);
}
.focus .body {
  outline: calc(var(--u) * 0.3) solid #36d1ff;
  outline-offset: calc(var(--u) * -0.05);
  filter: brightness(1.08);
}
.rank {
  position: absolute;
  left: 4%;
  top: 2%;
  min-width: 28%;
  padding: 0 4%;
  border-radius: calc(var(--tw) * 0.08);
  font: bold calc(var(--tw) * 0.3) / 1.15 system-ui, sans-serif;
  text-align: center;
  color: #fff;
  pointer-events: none;
}
.rank.m {
  background: #c0392b;
}
.rank.s {
  background: #1e8449;
}
.rank.p {
  background: #1f4e9c;
}
.ting {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, -110%);
  padding: 0 calc(var(--tw) * 0.08);
  border-radius: calc(var(--tw) * 0.2);
  background: #27ae60;
  color: #fff;
  font: bold calc(var(--tw) * 0.3) / 1.3 system-ui, sans-serif;
  pointer-events: none;
  white-space: nowrap;
}
.hot .body {
  box-shadow: 0 0 0 calc(var(--u) * 0.25) #ffd84a;
}
</style>
