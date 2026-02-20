import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    include: [
      'packages/**/src/**/*.test.ts',
      'packages/**/src/**/*.test.tsx',
    ],
    environment: 'node',
    environmentMatchGlobs: [
      ['packages/react/**', 'jsdom'],
      ['packages/vue/**', 'jsdom'],
    ],
  },
});
