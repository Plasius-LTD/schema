import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const tsc = fileURLToPath(
  new URL("../node_modules/typescript/bin/tsc", import.meta.url),
);
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("classic TypeScript feedback subpath resolution", () => {
  it("resolves every typed feedback subpath through an installed package", () => {
    const consumerRoot = mkdtempSync(join(tmpdir(), "schema-classic-types-"));
    temporaryDirectories.push(consumerRoot);

    const installedPackage = join(
      consumerRoot,
      "node_modules",
      "@plasius",
      "schema",
    );
    mkdirSync(dirname(installedPackage), { recursive: true });
    symlinkSync(packageRoot, installedPackage, "dir");

    writeFileSync(
      join(consumerRoot, "consumer.ts"),
      [
        'import { FEEDBACK_CONTRACT_VERSION } from "@plasius/schema/feedback-diagnostics";',
        'import { FEEDBACK_RENDERER_BUCKETS } from "@plasius/schema/feedback-diagnostics-vocabulary";',
        'import { FEEDBACK_UNICODE_PROFILE_ID } from "@plasius/schema/feedback-unicode-profile";',
        "void [",
        "  FEEDBACK_CONTRACT_VERSION,",
        "  FEEDBACK_RENDERER_BUCKETS,",
        "  FEEDBACK_UNICODE_PROFILE_ID,",
        "];",
        "",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(consumerRoot, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            module: "commonjs",
            moduleResolution: "node",
            ignoreDeprecations: "6.0",
            noEmit: true,
            strict: true,
            target: "ES2022",
          },
          files: ["consumer.ts"],
        },
        null,
        2,
      ),
      "utf8",
    );

    const result = spawnSync(
      process.execPath,
      [tsc, "--project", join(consumerRoot, "tsconfig.json")],
      { encoding: "utf8" },
    );

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });
});
