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
  <span class="tile" :class="{ sideways, dim, raised, hot, que, focus, facedown: tile === null }" :style="{ '--w': w }" :data-tile="tile ?? undefined">
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
  --r: calc(var(--tw) * 0.13);
  /* visible tile edge below the face */
  --thick: calc(var(--tw) * 0.1);
  position: relative;
  display: inline-block;
  flex: none;
  width: var(--tw);
  height: var(--th);
  margin-bottom: var(--thick);
  transition: transform 0.16s cubic-bezier(0.3, 1.5, 0.6, 1);
}
.tile.sideways {
  width: var(--th);
  height: var(--tw);
}
/* Edge + cast shadow, always pointing down on screen, also for rotated tiles. */
.tile::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--r);
  transform: translateY(var(--thick));
  background: linear-gradient(to bottom, var(--ivory-lo) 0 calc(100% - var(--thick) * 0.55), var(--back-lo) 0);
  box-shadow: 0 calc(var(--thick) * 0.7) calc(var(--thick) * 1.4) rgba(0, 0, 0, 0.42);
  transition: box-shadow 0.16s;
}
.tile.facedown::before {
  background: linear-gradient(to bottom, var(--back-lo) 0 calc(100% - var(--thick) * 0.55), var(--ivory-lo) 0);
}
.body {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--tw);
  height: var(--th);
  transform: translate(-50%, -50%);
  border-radius: var(--r);
}
.front {
  background: linear-gradient(168deg, var(--ivory-hi) 0%, var(--ivory) 58%, #ece0c6 100%);
  box-shadow:
    inset 0 0 0 max(1px, calc(var(--tw) * 0.022)) rgba(150, 118, 60, 0.22),
    inset 0 calc(var(--tw) * -0.06) calc(var(--tw) * 0.08) rgba(150, 118, 60, 0.16);
}
.back {
  background:
    radial-gradient(ellipse at 28% 14%, rgba(255, 255, 255, 0.32), transparent 55%),
    radial-gradient(circle at 50% 50%, rgba(236, 195, 106, 0.28) 0 12%, transparent 13%),
    linear-gradient(160deg, var(--back-hi), var(--back) 55%, var(--back-lo));
  box-shadow: inset 0 calc(var(--tw) * -0.05) calc(var(--tw) * 0.08) rgba(0, 0, 0, 0.25);
}
/* thin gold inlay */
.back::after {
  content: '';
  position: absolute;
  inset: 11%;
  border: max(1px, calc(var(--tw) * 0.03)) solid rgba(236, 195, 106, 0.5);
  border-radius: calc(var(--tw) * 0.07);
}
.body img {
  position: absolute;
  inset: 2%;
  width: 96%;
  height: 96%;
  pointer-events: none;
}
.raised {
  transform: translateY(-22%);
}
.raised::before {
  box-shadow: 0 calc(var(--th) * 0.2) calc(var(--thick) * 3) rgba(0, 0, 0, 0.35);
}
.dim .body {
  filter: brightness(0.55) saturate(0.7);
}
.dim::before {
  filter: brightness(0.55);
}
.que .front {
  background: linear-gradient(168deg, #fff0ea 0%, #f9dcd1 58%, #efc6b7 100%);
}
.hot .body {
  outline: calc(var(--u) * 0.28) solid var(--gold);
  outline-offset: calc(var(--u) * 0.04);
  animation: hot-glow 1.6s ease-in-out infinite;
}
.focus .body {
  outline: calc(var(--u) * 0.3) solid #5fe3ff;
  outline-offset: calc(var(--u) * 0.02);
  filter: brightness(1.06) drop-shadow(0 0 calc(var(--u) * 0.7) rgba(95, 227, 255, 0.85));
  animation: none;
}
@keyframes hot-glow {
  50% {
    filter: drop-shadow(0 0 calc(var(--u) * 0.8) rgba(255, 214, 110, 0.95));
  }
}
.rank {
  position: absolute;
  left: 5%;
  top: 3%;
  min-width: 28%;
  padding: 0 4%;
  border-radius: calc(var(--tw) * 0.08);
  font: 700 calc(var(--tw) * 0.3) / 1.15 system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}
.rank.m {
  background: var(--suit-m);
}
.rank.s {
  background: var(--suit-s);
}
.rank.p {
  background: var(--suit-p);
}
.ting {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, -118%);
  padding: 0 calc(var(--tw) * 0.12);
  border-radius: 999px;
  background: linear-gradient(#5fd896, #1f955a);
  border: max(1px, calc(var(--tw) * 0.025)) solid rgba(255, 255, 255, 0.75);
  color: #fff;
  font: 700 calc(var(--tw) * 0.3) / 1.35 system-ui, sans-serif;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25);
  box-shadow: 0 calc(var(--u) * 0.2) calc(var(--u) * 0.4) rgba(0, 0, 0, 0.35);
  pointer-events: none;
  white-space: nowrap;
}
</style>
