import { defineConfig } from 'vite';

export default defineConfig({
  base: '/faraway/',
  build: { target: 'es2022', outDir: 'dist' },
});
