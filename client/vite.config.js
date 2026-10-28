import { defineConfig } from 'vite';

export default defineConfig({
  base: '/satisfy/',
  server: {
    host: '0.0.0.0'
  },
  build: {
    outDir: 'dist'
  }
});
