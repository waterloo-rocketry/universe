import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/renderer/test/setup.ts'],
    include: [
      'src/renderer/**/*.test.{ts,tsx}',
      'src/mock-server/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/renderer/test/**',
        // Process and renderer bootstraps are integration-test concerns.
        'src/main/index.ts',
        'src/main/preload.ts',
        'src/mock-server/main.ts',
        'src/renderer/main.tsx',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
});
