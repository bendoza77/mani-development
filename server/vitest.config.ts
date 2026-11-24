import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: ["test/**/*.test.ts"],
          environment: "node",
          // One file at a time: integration tests share one database (docs/TESTING_STRATEGY.md §3).
          fileParallelism: false,
          globalSetup: ["test/setup/global-setup.ts"],
          testTimeout: 15_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
