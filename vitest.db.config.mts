import path from "path";
import { defineConfig } from "vitest/config";

// Isolation tests against the real database (the single production DB —
// there is no other). Needs DATABASE_URL (local: `npm run db:tunnel` first).
// Every row they create is named "__test__…" and deleted in afterAll.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 60_000,
    fileParallelism: false,
    setupFiles: ["tests/db/setup.ts"],
  },
});
