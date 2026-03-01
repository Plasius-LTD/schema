import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
    coverage: {
      all: false,
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "tests/**",
        "dist/**",
        "coverage/**",
        "scripts/**",
        "**/*.config.{js,ts}",
        "**/.eslintrc.{js,cjs}",
        "eslint.config.js",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 75,
        branches: 60,
      },
    },
  },
});
