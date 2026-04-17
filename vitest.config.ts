import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // RLS persona tests live under tests/rls and run against a real Supabase
    // project — opt-in via the dedicated `test:rls` script.
    exclude: ["node_modules", "dist", "tests/rls/**", "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary", "html"],
      reportsDirectory: "coverage",
      all: true,
      include: ["src/services/**", "src/lib/**", "src/hooks/**"],
      exclude: ["src/**/*.test.*", "src/test/**", "src/tests/**"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
