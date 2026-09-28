import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = [".github/workflows/ci.yml"];
const policy = "cache: ${{ runner.environment == 'github-hosted' && 'npm' || '' }}";

test("persistent self-hosted jobs do not export the global npm cache", () => {
  for (const file of files) {
    const workflow = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(workflow).toContain(policy);
    expect(workflow).not.toMatch(/cache:\s*['"]?npm['"]?\s*$/m);
  }
});
