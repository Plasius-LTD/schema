import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { readFirstPublicationDescriptor, runFirstPublication, verifyFirstPublication } from "../scripts/verify-first-publication.mjs";

const sha = "a".repeat(40);
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const organization = new URL(manifest.repository.url.replace(/^git\+/u, "")).pathname.split("/")[1];
const descriptor = { repository: `${organization}/glob`, packageName: "@plasius/glob", version: "1.0.2" };
const valid = { ...descriptor, descriptor, optIn: "true", credentialPresent: true,
  ref: "refs/heads/main", workflowRef: `${organization}/glob/.github/workflows/cd.yml@refs/heads/main`,
  eventName: "workflow_dispatch", expectedCommitSha: sha, checkedOutSha: sha, workflowSha: sha };
const environment = { GITHUB_REPOSITORY: valid.repository, PACKAGE_NAME: valid.packageName,
  PACKAGE_VERSION: valid.version, FIRST_PUBLICATION: "true", NPM_TOKEN: "synthetic-test-credential",
  GITHUB_REF: valid.ref, GITHUB_WORKFLOW_REF: valid.workflowRef, GITHUB_EVENT_NAME: valid.eventName,
  EXPECTED_SHA: sha, ACTUAL_SHA: sha, GITHUB_SHA: sha };

describe("shared first-registration admission", () => {
  for (const [name, version] of [["glob", "1.0.2"], ["learning-runtime", "0.1.2"],
    ["game-runtime", "0.1.0"], ["game-multiplayer", "0.1.0"], ["arcade-games", "0.1.0"]]) {
    it(`registers only the exact enrolled ${name} after anonymous 404`, async () => {
      const enrollment = { repository: `${organization}/${name}`, packageName: `@plasius/${name}`, version };
      let requests = 0;
      await verifyFirstPublication({ ...valid, ...enrollment, descriptor: enrollment,
        workflowRef: `${enrollment.repository}/.github/workflows/cd.yml@refs/heads/main` }, async (url, options) => {
        requests++;
        assert.equal(url, `https://registry.npmjs.org/@plasius%2f${name}`);
        assert.equal(options.redirect, "error");
        assert.deepEqual(options.headers, { accept: "application/json" });
        assert.ok(options.signal instanceof AbortSignal);
        assert.equal(options.signal.aborted, false);
        return { status: 404 };
      });
      assert.equal(requests, 1);
    });
  }

  for (const override of [
    { descriptor: undefined }, { descriptor: null }, { descriptor: [] }, { descriptor: "bad" },
    { descriptor: {} }, { descriptor: { ...descriptor, extra: true } },
    { descriptor: { ...descriptor, repository: "another-owner/glob" } },
    { descriptor: { ...descriptor, repository: `${organization}/../glob` } },
    { descriptor: { ...descriptor, packageName: "@plasius/other" } },
    { descriptor: { ...descriptor, version: "1.0.3" } },
    { descriptor: { ...descriptor, version: "01.0.2" } },
    { descriptor: { ...descriptor, version: "1.0.2-beta.0" } },
    { repository: `${organization}/schema` }, { packageName: "@plasius/schema" }, { version: "1.0.3" },
    { optIn: "false" }, { optIn: true }, { credentialPresent: false }, { credentialPresent: "true" },
    { ref: "refs/heads/feature" }, { eventName: "push" }, { workflowRef: "other.yml" },
    { expectedCommitSha: "short" }, { expectedCommitSha: undefined },
    { checkedOutSha: "b".repeat(40) }, { workflowSha: "b".repeat(40) },
  ]) {
    it(`rejects invalid admission without a registry request: ${JSON.stringify(override)}`, async () => {
      let requested = false;
      await assert.rejects(verifyFirstPublication({ ...valid, ...override }, async () => {
        requested = true; return { status: 404 };
      }), /admission/u);
      assert.equal(requested, false);
    });
  }

  for (const status of [200, 301, 302, 401, 403, 410, 429, 500, undefined]) {
    it(`refuses registry status ${status}`, async () => {
      await assert.rejects(verifyFirstPublication(valid, async () => ({ status })), /confirmed absent/u);
    });
  }

  it("bounds requests and refuses network, redirect and timeout failures", async () => {
    const original = AbortSignal.timeout;
    const deadlines = [];
    AbortSignal.timeout = value => { deadlines.push(value); return original(value); };
    try {
      for (const error of [new TypeError("network"), new TypeError("redirect"), new DOMException("timeout", "TimeoutError")]) {
        await assert.rejects(verifyFirstPublication(valid, async () => { throw error; }));
      }
      assert.deepEqual(deadlines, [10_000, 10_000, 10_000]);
    } finally { AbortSignal.timeout = original; }
  });

  it("loads only a bounded regular enrollment file and closes it on failure", () => {
    const directory = mkdtempSync(join(tmpdir(), "first-publication-descriptor-"));
    const file = join(directory, "descriptor.json");
    try {
      assert.throws(() => readFirstPublicationDescriptor(file));
      writeFileSync(file, JSON.stringify(descriptor));
      assert.deepEqual(readFirstPublicationDescriptor(file), descriptor);
      symlinkSync(file, join(directory, "link.json"));
      assert.throws(() => readFirstPublicationDescriptor(join(directory, "link.json")));
      assert.throws(() => readFirstPublicationDescriptor(directory));
      writeFileSync(file, " ".repeat(2049));
      assert.throws(() => readFirstPublicationDescriptor(file));
      writeFileSync(file, "{");
      assert.throws(() => readFirstPublicationDescriptor(file));
      writeFileSync(file, JSON.stringify(descriptor));
      assert.deepEqual(readFirstPublicationDescriptor(file), descriptor);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("passes credential presence only and redacts every failure", async () => {
    let received;
    const reports = [];
    const options = { readDescriptor: () => descriptor, verify: async input => { received = input; },
      report: message => reports.push(message) };
    assert.equal(await runFirstPublication(environment, options), 0);
    assert.deepEqual(received, valid);
    assert.deepEqual(reports, []);
    assert.equal(await runFirstPublication({ ...environment, NPM_TOKEN: "" }, options), 0);
    assert.equal(received.credentialPresent, false);
    assert.equal(await runFirstPublication({}, options), 0);
    assert.equal(received.credentialPresent, false);
    options.verify = async () => { throw new Error("synthetic private credential detail"); };
    assert.equal(await runFirstPublication(environment, options), 1);
    options.readDescriptor = () => { throw new Error("synthetic private path detail"); };
    assert.equal(await runFirstPublication(environment, options), 1);
    assert.deepEqual(reports, Array(2).fill("First-publication verification failed; check enrollment, exact main and registry absence.\n"));
  });

  it("actual CLI rejects an unenrolled package before network access", () => {
    const directory = mkdtempSync(join(tmpdir(), "first-publication-cli-"));
    try {
      const result = spawnSync(process.execPath, [new URL("../scripts/verify-first-publication.mjs", import.meta.url).pathname], {
        cwd: directory, encoding: "utf8", env: { PATH: process.env.PATH, NPM_TOKEN: "" },
      });
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /^First-publication verification failed;/u);
      assert.doesNotMatch(result.stderr, /ENOENT|npmrc|synthetic/u);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});

const workflow = readFileSync(new URL("../.github/workflows/cd.yml", import.meta.url), "utf8");
const stepName = "      - name: Register new package with standard npm credential\n";
const step = workflow.split(stepName)[1]?.split("\n      - name:")[0] ?? "";
const body = step.split("        run: |\n")[1]?.split("\n").map(line => line.replace(/^ {10}/u, "")).join("\n");

describe("shared registration workflow isolation", () => {
  it("requires explicit default-off registration and confines NPM_TOKEN to one step", () => {
    assert.match(workflow, /first_publication:\n\s+description:[^\n]+\n\s+required: false\n\s+type: boolean\n\s+default: false/u);
    assert.ok(workflow.includes('FIRST_PUBLICATION: ${{ inputs.first_publication }}'));
    assert.ok(workflow.includes('--arg first_publication "${FIRST_PUBLICATION}"'));
    assert.ok(workflow.includes('"first_publication": $first_publication'));
    assert.ok(workflow.includes("if: steps.release.outputs.should_publish_npm == 'true' && !inputs.first_publication"));
    assert.ok(step.includes("if: steps.release.outputs.should_publish_npm == 'true' && inputs.first_publication"));
    assert.ok(step.includes("NPM_TOKEN: ${{ secrets.NPM_TOKEN }}"));
    assert.doesNotMatch(step, /continue-on-error/u);
    assert.doesNotMatch(workflow.replace(stepName + step, ""), /secrets\.NPM_TOKEN|_authToken|NPM_BOOTSTRAP/u);
  });

  for (const optIn of ["false", "true"]) {
    it(`forwards explicit ${optIn} through the actual dispatch shell`, () => {
      const dispatch = workflow.split("      - name: Dispatch exact-main publish run\n")[1]?.split("\n  validate_and_pack:")[0] ?? "";
      const script = dispatch.split("        run: |\n")[1]?.split("\n").map(line => line.replace(/^ {10}/u, "")).join("\n");
      assert.ok(script);
      const directory = mkdtempSync(join(tmpdir(), "first-publication-dispatch-"));
      const marker = join(directory, "dispatch.json");
      try {
        const mocks = `git() { if [ "$1" = fetch ]; then return 0; elif [ "$1" = rev-parse ]; then printf '%s' "$EXPECTED_SHA"; else return 99; fi; }\ngh() { [ "$1" = api ] && [ "$2" = -X ] && [ "$3" = POST ] || return 99; cat > "$DISPATCH_MARKER"; }\n`;
        const result = spawnSync("bash", ["-c", mocks + script], { encoding: "utf8", env: {
          PATH: process.env.PATH, EXPECTED_SHA: sha, RELEASE_TAG: "v1.0.2", PREID: "",
          FIRST_PUBLICATION: optIn, GITHUB_REPOSITORY: descriptor.repository, DISPATCH_MARKER: marker,
        } });
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(JSON.parse(readFileSync(marker, "utf8")), { ref: "main", inputs: {
          phase: "publish", bump: "none", preid: "", first_publication: optIn,
          expected_commit_sha: sha, release_tag: "v1.0.2",
        } });
      } finally { rmSync(directory, { recursive: true, force: true }); }
    });
  }

  for (const [guard, fetch, publish, remote, status, published] of [
    ["0", "0", "0", sha, 0, true], ["0", "0", "17", sha, 17, true],
    ["1", "0", "0", sha, 1, false], ["0", "1", "0", sha, 1, false],
    ["0", "0", "0", "b".repeat(40), 1, false],
  ]) {
    it(`cleans credentials after guard=${guard}, fetch=${fetch}, publish=${publish}, main=${remote}`, () => {
      assert.ok(body, "shared registration shell must exist");
      const directory = mkdtempSync(join(tmpdir(), "first-publication-shell-"));
      const marker = join(directory, "published");
      const mocks = `
node() { [ "$1" = scripts/verify-first-publication.mjs ] || return 99; return "$GUARD_STATUS"; }
git() { if [ "$1" = fetch ]; then return "$FETCH_STATUS"; elif [ "$1" = rev-parse ]; then if [ "$2" = HEAD ]; then printf '%s' "$EXPECTED_SHA"; else printf '%s' "$REMOTE_SHA"; fi; else return 99; fi; }
npm() {
  [ "$1" = publish ] && [ "$2" = ./sealed.tgz ] && [ "$3" = --ignore-scripts ] || return 98
  [ "$NPM_TOKEN" = synthetic-test-credential ] || return 97
  [ "$(cat "$NPM_CONFIG_USERCONFIG")" = '//registry.npmjs.org/:_authToken=\${NPM_TOKEN}' ] || return 96
  case "$(ls -l "$NPM_CONFIG_USERCONFIG")" in -rw-------*) ;; *) return 95 ;; esac
  printf '%s' "$*" > "$PUBLISH_MARKER"
  return "$PUBLISH_STATUS"
}
`;
      try {
        const result = spawnSync("bash", ["-c", mocks + body], { encoding: "utf8", env: {
          ...process.env, RUNNER_TEMP: directory, EXPECTED_SHA: sha, REMOTE_SHA: remote,
          GUARD_STATUS: guard, FETCH_STATUS: fetch, PUBLISH_STATUS: publish,
          NPM_TOKEN: "synthetic-test-credential", TARBALL: "sealed.tgz", DIST_TAG: "latest", PUBLISH_MARKER: marker,
        } });
        assert.equal(result.status, status, result.stderr);
        assert.equal(existsSync(marker), published);
        if (published) assert.match(readFileSync(marker, "utf8"), /--access public --provenance --registry https:\/\/registry\.npmjs\.org --tag latest/u);
        assert.deepEqual(readdirSync(directory).filter(name => name !== "published"), []);
        assert.doesNotMatch(result.stdout + result.stderr, /synthetic-test-credential/u);
      } finally { rmSync(directory, { recursive: true, force: true }); }
    });
  }
});
