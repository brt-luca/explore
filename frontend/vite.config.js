import { defineConfig } from 'vite'

export default defineConfig({
  base: '/explore/',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },

  server: {
    port: 5173,
    open: true,
  },

  assetsInclude: ['**/*.pbf'],
})
