<script setup lang="ts">
import { SUIT_NAMES } from '../engine/tiles'
import type { SeatView } from '../engine/types'

defineProps<{ sv: SeatView; name: string; total: number; dealer: boolean; turn: boolean }>()
</script>

<template>
  <div class="badge" :class="{ turn }">
    <div class="name">
      {{ name }}
      <span v-if="dealer" class="tag dealer">庄</span>
      <span v-if="sv.que !== null" class="tag que">缺{{ SUIT_NAMES[sv.que] }}</span>
      <span v-if="sv.win" class="tag win">胡</span>
    </div>
    <div class="score">
      {{ total + sv.delta }}
      <span v-if="sv.delta" :class="sv.delta > 0 ? 'up' : 'down'">({{ sv.delta > 0 ? '+' : '' }}{{ sv.delta }})</span>
    </div>
  </div>
</template>

<style scoped>
.badge {
  padding: calc(var(--u) * 0.4) calc(var(--u) * 0.8);
  border-radius: calc(var(--u) * 0.8);
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: calc(var(--u) * 1.6);
  line-height: 1.3;
  white-space: nowrap;
  border: calc(var(--u) * 0.2) solid transparent;
}
.badge.turn {
  border-color: #ffd84a;
}
.tag {
  display: inline-block;
  padding: 0 calc(var(--u) * 0.4);
  border-radius: calc(var(--u) * 0.4);
  font-size: calc(var(--u) * 1.3);
  margin-left: calc(var(--u) * 0.2);
}
.dealer {
  background: #c0392b;
}
.que {
  background: #34495e;
}
.win {
  background: #e67e22;
}
.score {
  font-size: calc(var(--u) * 1.4);
  opacity: 0.9;
}
.up {
  color: #7dff9a;
}
.down {
  color: #ff8a80;
}
</style>
