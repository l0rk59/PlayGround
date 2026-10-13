import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 2048,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Un seul fichier JS : moins de requetes sur un reseau mobile.
        manualChunks: undefined,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
