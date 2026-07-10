import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, 'src/engine'),
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@mods': path.resolve(__dirname, 'mods'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
