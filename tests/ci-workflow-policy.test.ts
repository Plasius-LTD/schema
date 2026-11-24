import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const ciWorkflow = read(".github/workflows/ci.yml");
const cdWorkflow = read(".github/workflows/cd.yml");
const releasePrepareWorkflow = read(".github/workflows/release-prepare.yml");
const feedbackReleaseReadiness = read(
  "docs/design/feedback-contracts-1.4.0-release.md",
);
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

  it("pins the approved npm client before checking both release runtimes", () => {
    expect(cdWorkflow.match(/npm install --global npm@11\.6\.2 --ignore-scripts --registry https:\/\/registry\.npmjs\.org/gu)).toHaveLength(2);
  });

  it("rejects malformed npm versions before applying the minimum-version gate", () => {
    const guards = [...cdWorkflow.matchAll(/node - "\$\{ACTUAL_NPM\}" <<'NODE'\n([\s\S]*?)\n\s+NODE/gu)];
    expect(guards).toHaveLength(2);
    for (const [, guard] of guards) {
      for (const [version, status] of [["11.6.2", 0], ["11.5.1", 0], ["11.4.9", 1], ["10.9.0", 1], ["invalid", 1], ["11.x.2", 1], ["11.6", 1]] as const) {
        const result = spawnSync(process.execPath, ["-", version], { input: guard, encoding: "utf8" });
        expect(result.status, version).toBe(status);
      }
    }
  });

  it("rechecks current main immediately before npm and propagates fetch failures", () => {
    const stepName = "\n      - name: Revalidate exact main immediately before npm publication\n";
    const step = cdWorkflow.split(stepName)[1]?.split("\n      - name:")[0] ?? "";
    const body = step.split("        run: |\n")[1]?.split("\n").map(line => line.replace(/^ {10}/u, "")).join("\n");
    expect(body).toBeTruthy();
    expect(cdWorkflow.indexOf(stepName)).toBeLessThan(cdWorkflow.indexOf("\n      - name: Publish package through npm OIDC\n"));
    for (const [fetchStatus, remote, expected] of [[0, "a", 0], [0, "b", 1], [7, "a", 7]] as const) {
      const mocks = `git() { if [ "$1" = fetch ]; then return ${fetchStatus}; elif [ "$1" = rev-parse ]; then printf '%s' '${remote.repeat(40)}'; else return 99; fi; }\n`;
      const result = spawnSync("bash", ["-c", mocks + body], {
        encoding: "utf8", env: { PATH: process.env.PATH, EXPECTED_SHA: "a".repeat(40) },
      });
      expect(result.status, result.stderr).toBe(expected);
    }
  });

  it("uses tokenless hosted OIDC and confines registration to the reviewed separate step", () => {
    expect(cdWorkflow).toContain("runs-on: ubuntu-latest");
    expect(cdWorkflow).toContain("environment: production");
    expect(cdWorkflow).toContain("id-token: write");
    expect(cdWorkflow).toContain("--provenance");
    expect(cdWorkflow).toContain("npm publish");
    const name = "      - name: Register new package with standard npm credential\n";
    const registration = cdWorkflow.split(name)[1]?.split("\n      - name:")[0];
    expect(registration).toBeTruthy();
    expect(cdWorkflow.replace(name + registration, "")).not.toContain("NPM_TOKEN");
    expect(registration).toContain("if: steps.release.outputs.should_publish_npm == 'true' && inputs.first_publication");
    expect(registration).toContain("node scripts/verify-first-publication.mjs");
    expect(existsSync(new URL("../.github/npm-first-publication.json", import.meta.url))).toBe(false);
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

  it("rechecks the sealed tarball with the shared exact inventory policy", () => {
    const digestVerification = cdWorkflow.indexOf(
      'TARBALL_SHA256="$(sha256sum "${TARBALL}"',
    );
    const inventoryVerification = cdWorkflow.indexOf(
      'tar -tzf "${TARBALL}" | node scripts/verify-public-package.cjs --inventory-stdin',
    );
    const publish = cdWorkflow.indexOf('npm publish "./${TARBALL}"');

    expect(digestVerification).toBeGreaterThan(-1);
    expect(inventoryVerification).toBeGreaterThan(digestVerification);
    expect(publish).toBeGreaterThan(inventoryVerification);
    expect(cdWorkflow).not.toContain('const prohibited = "legal/cla-registry.csv"');
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

  it("fails closed on private paths before dependency or release metadata mutation", () => {
    const ciPrivacy = ciWorkflow.indexOf("run: npm run privacy:check");
    const ciInstall = ciWorkflow.indexOf(
      "run: npm ci --no-fund --no-audit --legacy-peer-deps",
    );
    const ciPackage = ciWorkflow.indexOf("run: npm run pack:check");
    expect(ciPrivacy).toBeGreaterThan(-1);
    expect(ciInstall).toBeGreaterThan(ciPrivacy);
    expect(ciPackage).toBeGreaterThan(ciInstall);

    const prepareCheckout = releasePrepareWorkflow.indexOf(
      'git checkout -B "${BASE_BRANCH}" "origin/${BASE_BRANCH}"',
    );
    const preparePrivacy = releasePrepareWorkflow.indexOf(
      'npm --prefix "${PACKAGE_DIRECTORY}" run privacy:check',
    );
    const prepareVersion = releasePrepareWorkflow.indexOf(
      'npm version "${TARGET_VER}"',
    );
    expect(prepareCheckout).toBeGreaterThan(-1);
    expect(preparePrivacy).toBeGreaterThan(prepareCheckout);
    expect(prepareVersion).toBeGreaterThan(preparePrivacy);

    const validationJob = cdWorkflow.slice(
      cdWorkflow.indexOf("\n  validate_and_pack:"),
      cdWorkflow.indexOf("\n  publish:"),
    );
    const publicationPrivacy = validationJob.indexOf("npm run privacy:check");
    const publicationInstall = validationJob.indexOf("npm ci");
    expect(publicationPrivacy).toBeGreaterThan(-1);
    expect(publicationInstall).toBeGreaterThan(publicationPrivacy);
  });

  it("records a pipeline-owned minor bump from 1.3.1 to 1.4.0", () => {
    expect(feedbackReleaseReadiness).toContain(
      "approved stable target is `@plasius/schema@1.4.0`",
    );
    expect(feedbackReleaseReadiness).toContain("- `bump`: `minor`");
    expect(feedbackReleaseReadiness).toContain(
      "Release metadata must not be edited manually.",
    );
  });
});
