import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/types.ts', 'src/**/*.d.ts'],
      all: true,
      lines: 90,
      functions: 90,
      branches: 88,
      statements: 90,
    },
  },
});
