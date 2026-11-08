<script setup lang="ts">
import { onMounted } from 'vue'
import MahjongTable from './ui/MahjongTable.vue'
import { useSession } from './ui/session'

const session = useSession()
onMounted(() => session.startRound())
</script>

<template>
  <MahjongTable :session="session" />
  <div class="portrait-hint">请把手机横过来 📱↻</div>
</template>

<style>
:root {
  /* Table unit: everything scales with the smaller of width and height. */
  --u: min(1vw, 2.1dvh);
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: #0f3d28;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
button {
  cursor: pointer;
  font-family: inherit;
}
.portrait-hint {
  display: none;
}
@media (orientation: portrait) {
  .portrait-hint {
    display: grid;
    place-items: center;
    position: fixed;
    inset: 0;
    z-index: 100;
    background: #0f3d28;
    color: #fff;
    font-size: 6vw;
  }
}
</style>
