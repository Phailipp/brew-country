import { defineConfig } from 'vitest/config';

// Firestore security-rules tests. Run via `npm run test:rules`
// (starts the Firestore emulator on 127.0.0.1:8080 around vitest).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    // the Firestore SDK logs every PERMISSION_DENIED; only show logs of failing tests
    silent: 'passed-only',
  },
});
