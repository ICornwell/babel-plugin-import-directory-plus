import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  test: {
    include: ['test/**/*.spec.js', 'test/**/*.test.js', 'testmuixdp/**/*.spec.js'],
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
