import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const ciWorkflow = read(".github/workflows/ci.yml");
const cdWorkflow = read(".github/workflows/cd.yml");
const releasePrepareWorkflow = read(".github/workflows/release-prepare.yml");
const npmConfig = read(".npmrc");

describe("release workflow trust boundaries", () => {
  it("runs pull-request validation only for same-repository heads", () => {
    expect(ciWorkflow).toMatch(/pull_request:\s*\n\s+branches: \[main\]/u);
    expect(ciWorkflow).not.toContain("pull_request_target:");
    expect(ciWorkflow).toContain("name: Trusted head admission");
    expect(ciWorkflow).toContain("External fork pull requests cannot be merged");
    expect(ciWorkflow.match(/needs: trusted_head/gu)).toHaveLength(2);
    expect(
      ciWorkflow.match(
        /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/gu,
      ),
    ).toHaveLength(2);
    expect(
      ciWorkflow.match(
        /runs-on: \$\{\{ fromJSON\(github\.event_name == 'pull_request' && '\["ubuntu-latest"\]' \|\| '\["self-hosted","Linux","X64"\]'\) \}\}/gu,
      ),
    ).toHaveLength(2);
  });

  it("binds a second publication run to the prepared main SHA and successful CI", () => {
    expect(cdWorkflow).toContain("- prepare");
    expect(cdWorkflow).toContain("- publish");
    expect(cdWorkflow).toContain("expected_commit_sha");
    expect(cdWorkflow).toContain('"ref": "main"');
    expect(cdWorkflow).toContain('"phase": "publish"');
    expect(cdWorkflow).toContain("actions/workflows/cd.yml/dispatches");
    expect(cdWorkflow).toContain('-f head_sha="${EXPECTED_SHA}"');
    expect(cdWorkflow).toContain("-f branch=main");
    expect(cdWorkflow).toContain("-f event=push");
    expect(cdWorkflow).toContain("refs/heads/main");
    expect(releasePrepareWorkflow).toContain("COMMIT_SHA=$(git rev-parse HEAD)");
  });

  it("uses supported phase-isolated concurrency", () => {
    expect(cdWorkflow).toContain(
      "group: npm-cd-${{ github.repository }}-${{ inputs.phase == 'publish'",
    );
    expect(cdWorkflow).toContain("inputs.expected_commit_sha");
    expect(cdWorkflow).toContain("cancel-in-progress: false");
    expect(cdWorkflow).not.toContain("queue:");
  });

  it("executes stable release identity derivation on the release runtime", () => {
    const scriptMatch = releasePrepareWorkflow.match(
      /EFFECTIVE_PREID=\$\(TARGET_VER="\$\{MAIN_VERSION\}" node -e '\n([\s\S]*?)\n\s+'\)/u,
    );
    expect(scriptMatch).not.toBeNull();

    const result = spawnSync(process.execPath, ["-e", scriptMatch?.[1] ?? ""], {
      encoding: "utf8",
      env: { ...process.env, TARGET_VER: "1.3.1" },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("uses hosted OIDC publication without npm write tokens", () => {
    expect(cdWorkflow).toContain("runs-on: ubuntu-latest");
    expect(cdWorkflow).toContain("environment: production");
    expect(cdWorkflow).toContain("id-token: write");
    expect(cdWorkflow).toContain("--provenance");
    expect(cdWorkflow).toContain("npm publish");
    expect(cdWorkflow).not.toContain("NPM_TOKEN");
    expect(cdWorkflow).not.toContain("NODE_AUTH_TOKEN");
    expect(npmConfig).not.toContain("_authToken");
    expect(npmConfig).not.toContain("NODE_AUTH_TOKEN");
  });

  it("keeps dependency code out of the OIDC mutation job", () => {
    const validationJob = cdWorkflow.slice(
      cdWorkflow.indexOf("\n  validate_and_pack:"),
      cdWorkflow.indexOf("\n  publish:"),
    );
    const publishJob = cdWorkflow.slice(cdWorkflow.indexOf("\n  publish:"));

    expect(validationJob).toContain("npm ci");
    expect(validationJob).toContain("npm pack --ignore-scripts --json");
    expect(validationJob).toContain("actions/upload-artifact@v7");
    expect(validationJob).not.toContain("environment: production");
    expect(validationJob).not.toContain("id-token: write");
    expect(publishJob).toContain("actions/download-artifact@v8");
    expect(publishJob).toContain("digest-mismatch: error");
    expect(publishJob).not.toContain("npm ci");
    expect(publishJob).not.toContain("npm run ");
  });

  it("reads the complete tar listing when pipefail is enabled", () => {
    expect(cdWorkflow).toContain(
      `tar -tzf "\${TARBALL}" | grep -E '^package/dist(/|$)' >/dev/null`,
    );
    expect(cdWorkflow).not.toContain(
      `tar -tzf "\${TARBALL}" | grep -Eq '^package/dist(/|$)'`,
    );
  });

  it("publishes the sealed artifact as an explicit local tarball", () => {
    expect(cdWorkflow).toContain(`npm publish "./\${TARBALL}"`);
    expect(cdWorkflow).not.toContain(`npm publish "\${TARBALL}"`);
  });

  it("lands release metadata through a unique non-force-pushed pull request", () => {
    expect(releasePrepareWorkflow).toMatch(
      /- name: Checkout main[\s\S]*?persist-credentials: false/u,
    );
    expect(releasePrepareWorkflow).toContain(
      'BRANCH="release/${TAG}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"',
    );
    expect(releasePrepareWorkflow).not.toContain(
      'git push origin "HEAD:${BASE_BRANCH}"',
    );
    expect(releasePrepareWorkflow).not.toContain("--force-with-lease");
    expect(releasePrepareWorkflow).not.toContain("secrets: inherit");
  });
});
