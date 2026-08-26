import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, '../src'),
  build: {
    outDir: resolve(__dirname, '../src'),
    emptyOutDir: false,
    minify: 'esbuild',
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
});
