import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, 'src/engine'),
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@mods': path.resolve(__dirname, 'mods'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    target: 'ES2022',
  },
});
