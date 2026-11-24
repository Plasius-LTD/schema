import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("coverage command composition", () => {
  for (const helperStatus of [0, 17]) {
    it(`routes CI reporter arguments only to Vitest and propagates helper status ${helperStatus}`, () => {
      const directory = mkdtempSync(join(tmpdir(), "schema-coverage-command-"));
      try {
        mkdirSync(join(directory, "node_modules/.bin"), { recursive: true });
        writeFileSync(join(directory, "package.json"), JSON.stringify({
          scripts: {
            "test:coverage": manifest.scripts["test:coverage"],
            ...(manifest.scripts["posttest:coverage"] ? { "posttest:coverage": manifest.scripts["posttest:coverage"] } : {}),
            "test:first-publication": "node helper.cjs",
          },
        }));
        const runner = join(directory, "node_modules/.bin/vitest");
        writeFileSync(runner, `#!/usr/bin/env node\nconst fs = require('node:fs');\nfs.mkdirSync('coverage');\nfs.writeFileSync('coverage/lcov.info', 'unit-coverage\\n');\nfs.writeFileSync('arguments.json', JSON.stringify(process.argv.slice(2)));\n`);
        chmodSync(runner, 0o700);
        writeFileSync(join(directory, "helper.cjs"), `require('node:fs').writeFileSync('.first-publication-lcov.info', 'helper-coverage\\n'); process.exit(${helperStatus});\n`);
        const result = spawnSync("npm", ["run", "test:coverage", "--", "--coverage.reporter=lcov", "--coverage.reporter=text-summary"], {
          cwd: directory, encoding: "utf8", env: { ...process.env, npm_config_ignore_scripts: "false" },
        });
        expect(JSON.parse(readFileSync(join(directory, "arguments.json"), "utf8"))).toEqual([
          "run", "--coverage", "--coverage.reporter=lcov", "--coverage.reporter=text-summary",
        ]);
        expect(result.status, result.stderr).toBe(helperStatus);
        expect(readFileSync(join(directory, "coverage/lcov.info"), "utf8")).toBe(
          helperStatus === 0 ? "unit-coverage\nhelper-coverage\n" : "unit-coverage\n",
        );
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
});
