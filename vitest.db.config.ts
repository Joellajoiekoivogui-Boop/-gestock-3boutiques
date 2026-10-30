import { defineConfig } from 'vitest/config';

// Tests d'intégration PostgreSQL : lancés par `npm run test:db`.
export default defineConfig({
  test: {
    include: ['tests/db/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
