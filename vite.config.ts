import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  base: './',
  server: { hmr: mode !== 'qa' },
  build: {
    chunkSizeWarningLimit: 1700,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
}))
