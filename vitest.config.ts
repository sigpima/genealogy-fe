import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }, // same as tsconfig's "@/*" paths
  },
  test: {
    environment: 'node',
  },
});
