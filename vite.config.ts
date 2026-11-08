import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs, so the build works under any path (GitHub Pages serves it at /<repo>/).
  base: './',
  plugins: [vue()],
})
