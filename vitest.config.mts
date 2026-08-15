import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    testTimeout: 10000,
  },
});
