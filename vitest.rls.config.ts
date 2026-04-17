/**
 * Vitest config dedicated to RLS persona tests.
 * Runs in Node environment against a real Supabase project.
 * Opt-in: requires SUPABASE_SERVICE_ROLE_KEY in env.
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/rls/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
