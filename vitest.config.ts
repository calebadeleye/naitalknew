import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Route-level code splitting means some tests wait on a lazy chunk's
    // dynamic import() to resolve before content appears -- under load this
    // can take longer than Vitest's 5s default, well before anything is
    // actually wrong.
    testTimeout: 20000,
  },
});
