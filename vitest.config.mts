import path from "path";
import { defineConfig } from "vitest/config";

// Unit + video pipeline tests: `npm test`. They never touch the database.
// DB-backed isolation tests (tests/db) run only with `npm run test:db` —
// see vitest.db.config.mts.
const alias = {
  "@": path.resolve(__dirname, "src"),
  // "server-only" throws outside a React Server Components bundle.
  "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/db/**", "node_modules/**"],
    testTimeout: 60_000,
    env: { ENCRYPTION_SECRET: "test-only-secret-not-used-in-production" },
  },
});
