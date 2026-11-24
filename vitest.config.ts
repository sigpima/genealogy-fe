import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } }, // tsconfig has jsx: preserve (Next compiles it); tests need it turned into calls (Vite 8 uses oxc, not esbuild)
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }, // same as tsconfig's "@/*" paths
  },
  test: {
    environment: 'node',
  },
});
