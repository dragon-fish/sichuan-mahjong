<script setup lang="ts">
import { onMounted } from 'vue'
import MahjongTable from './ui/MahjongTable.vue'
import { useSession } from './ui/session'

const session = useSession()
onMounted(() => session.resume() || session.startRound())
</script>

<template>
  <MahjongTable :session="session" />
  <div class="portrait-hint">
    <div class="phone" />
    <div>请横屏</div>
  </div>
</template>

<style>
:root {
  /* Table unit: everything scales with the smaller of width and height. */
  --u: min(1vw, 2.1dvh);
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;

  --felt-hi: #1f6f58;
  --felt: #13493c;
  --felt-lo: #071f1a;
  --gold: #ecc36a;
  --gold-hi: #fff0c2;
  --gold-lo: #a9792b;
  --panel: rgba(6, 22, 19, 0.72);
  --panel-line: rgba(236, 195, 106, 0.28);
  --text: #f3efe2;
  --text-dim: rgba(243, 239, 226, 0.62);

  --ivory-hi: #fffdf6;
  --ivory: #f6efdf;
  --ivory-lo: #ddd0b4;
  --back-hi: #3d74c6;
  --back: #234f97;
  --back-lo: #142f62;

  --suit-m: #d9473f;
  --suit-s: #2f9a62;
  --suit-p: #3a6fd8;
  --seat-0: linear-gradient(150deg, #f2c25b, #b77a1d);
  --seat-1: linear-gradient(150deg, #43c3b0, #157466);
  --seat-2: linear-gradient(150deg, #ef7d8d, #a8334a);
  --seat-3: linear-gradient(150deg, #9c8af0, #5442b0);
  --up: #7ee2a0;
  --down: #ff8a7a;
}
html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: var(--felt-lo);
  color: var(--text);
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
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6vw;
    position: fixed;
    inset: 0;
    z-index: 100;
    background: radial-gradient(ellipse at 50% 40%, var(--felt-hi), var(--felt-lo) 75%);
    color: var(--gold-hi);
    font-size: 5vw;
    letter-spacing: 0.3em;
  }
  .portrait-hint .phone {
    width: 16vw;
    height: 28vw;
    border: 1.4vw solid var(--gold);
    border-radius: 3vw;
    animation: rotate-phone 2.4s ease-in-out infinite;
  }
}
@keyframes rotate-phone {
  0%,
  25% {
    transform: rotate(0);
  }
  55%,
  100% {
    transform: rotate(-90deg);
  }
}
</style>
