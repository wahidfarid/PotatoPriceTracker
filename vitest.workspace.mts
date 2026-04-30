import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vitest.config.mts",
    test: {
      name: "unit-node",
      environment: "node",
      include: [
        "src/lib/**/*.test.ts",
        "src/scraper/**/*.test.ts",
        "src/app/api/**/*.test.ts",
      ],
      setupFiles: ["./tests/setup.node.ts"],
    },
  },
  {
    extends: "./vitest.config.mts",
    test: {
      name: "unit-jsdom",
      environment: "jsdom",
      include: ["src/components/**/*.test.{ts,tsx}"],
      setupFiles: ["./tests/setup.jsdom.ts"],
      globals: true,
    },
  },
]);
