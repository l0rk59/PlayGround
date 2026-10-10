import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./core', import.meta.url)),
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: { host: '0.0.0.0', port: 5173 },
  test: {
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    reporters: ['default'],
    passWithNoTests: false,
  },
})