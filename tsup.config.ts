import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/feedback-diagnostics.ts",
    "src/feedback-diagnostics-vocabulary.ts",
    "src/feedback-unicode-profile.ts",
  ],
  dts: true,
  sourcemap: true,
  clean: true,
  format: ["esm", "cjs"],
  target: "es2022",
});
