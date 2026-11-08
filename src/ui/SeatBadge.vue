<script setup lang="ts">
import { computed } from 'vue'
import { SUIT_NAMES, tileName } from '../engine/tiles'
import type { SeatView } from '../engine/types'
import { SEAT_NAMES } from './session'

const props = defineProps<{ sv: SeatView; name: string; total: number; dealer: boolean; turn: boolean }>()

const winText = computed(() => {
  const w = props.sv.win
  if (!w) return ''
  const how = w.kind === 'zimo' ? '自摸' : w.kind === 'qianggang' ? `抢${SEAT_NAMES[w.from!]}的杠` : `${SEAT_NAMES[w.from!]}点炮`
  const fan = w.fan ? ` · ${w.fan.items.map((it) => it.name).join(' ')} ${w.fan.total}番` : ''
  return `胡${tileName(w.tile)} · ${how}${fan}`
})
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
    <div v-if="winText" class="how">{{ winText }}</div>
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
.how {
  font-size: calc(var(--u) * 1.2);
  color: #ffd84a;
  white-space: normal;
  max-width: calc(var(--u) * 16);
}
.up {
  color: #7dff9a;
}
.down {
  color: #ff8a80;
}
</style>
