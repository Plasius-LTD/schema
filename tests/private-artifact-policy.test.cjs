const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  collectRepositoryArtifactPaths,
  comparePackageArtifactAllowlist,
  findPrivateArtifactViolations,
  findPackageFilesPolicyViolations,
  normalizeArtifactPath,
  normalizePackageArtifactPath,
} = require("../scripts/private-artifact-policy.cjs");

test("normalizes artifact paths without reading their contents", () => {
  assert.equal(
    normalizeArtifactPath(".\\packages\\example\\legal\\CLA-REGISTRY.csv"),
    "packages/example/legal/CLA-REGISTRY.csv"
  );
  assert.equal(
    normalizeArtifactPath("./packages/example/../example/legal/CLA-REGISTRY.csv"),
    "packages/example/legal/CLA-REGISTRY.csv"
  );
  assert.equal(
    normalizeArtifactPath("legal/ＣＬＡ－ＲＥＧＩＳＴＲＹ．ｃｓｖ"),
    "legal/CLA-REGISTRY.csv"
  );
});

test("rejects CLA registries across platforms and package roots", () => {
  const violations = findPrivateArtifactViolations([
    "legal/CLA-REGISTRY.csv",
    "legal/contributors-registry/record.pdf",
    "packages/example/legal/contributor_registry.json",
    "packages\\example\\LEGAL\\cla registry.xlsx",
  ]);

  assert.deepEqual(
    violations.map(({ artifactPath, ruleId }) => ({ artifactPath, ruleId })),
    [
      {
        artifactPath: "legal/CLA-REGISTRY.csv",
        ruleId: "contributor-registry",
      },
      {
        artifactPath: "legal/contributors-registry/record.pdf",
        ruleId: "contributor-registry",
      },
      {
        artifactPath: "packages/example/LEGAL/cla registry.xlsx",
        ruleId: "contributor-registry",
      },
      {
        artifactPath: "packages/example/legal/contributor_registry.json",
        ruleId: "contributor-registry",
      },
    ]
  );
});

test("rejects directories used to store signed CLA submissions", () => {
  const violations = findPrivateArtifactViolations([
    "legal/signed-clas/example.pdf",
    "packages/example/legal/cla_submissions/example.pdf",
    "legal/cla-signatures/example.pdf",
  ]);

  assert.equal(violations.length, 3);
  assert.ok(violations.every(({ ruleId }) => ruleId === "signed-cla-storage"));
});

test("allows public CLA templates and contributor documentation", () => {
  assert.deepEqual(
    findPrivateArtifactViolations([
      "CONTRIBUTORS.md",
      "legal/CLA.md",
      "legal/INDIVIDUAL_CLA.md",
      "legal/CORPORATE_CLA.md",
      "docs/cla-signing-process.md",
    ]),
    []
  );
});

test("rejects every CSV extension case-insensitively", () => {
  const violations = findPrivateArtifactViolations([
    "reports/public-export.CsV",
    "reports/windows-alias.csv. ",
  ]);

  assert.deepEqual(
    violations.map(({ artifactPath, ruleId }) => ({ artifactPath, ruleId })),
    [
      {
        artifactPath: "reports/public-export.CsV",
        ruleId: "csv-artifact",
      },
      {
        artifactPath: "reports/windows-alias.csv. ",
        ruleId: "csv-artifact",
      },
    ]
  );
});

test("rejects registry variants while allowing a benign code registry", () => {
  const violations = findPrivateArtifactViolations([
    "legal/CLA-REGISTRY.json",
    "metadata/internal-contributor-registry.json",
    "src/mcp-admin-registry.ts",
  ]);

  assert.deepEqual(
    violations.map(({ artifactPath, ruleId }) => ({ artifactPath, ruleId })),
    [
      {
        artifactPath: "legal/CLA-REGISTRY.json",
        ruleId: "contributor-registry",
      },
      {
        artifactPath: "metadata/internal-contributor-registry.json",
        ruleId: "private-registry",
      },
    ]
  );
});

test("requires narrow, explicit package files entries", () => {
  assert.deepEqual(
    findPackageFilesPolicyViolations([], ["dist"]).map(
      ({ entry, ruleId }) => ({ entry, ruleId })
    ),
    [{ entry: "package.json#files", ruleId: "package-files-required" }]
  );

  for (const broadEntry of [".", "*", "**/*", "legal"]) {
    assert.deepEqual(
      findPackageFilesPolicyViolations(["dist", broadEntry], ["dist"]).map(
        ({ entry, ruleId }) => ({ entry, ruleId })
      ),
      [{ entry: broadEntry, ruleId: "broad-package-files-entry" }]
    );
  }

  assert.deepEqual(
    findPackageFilesPolicyViolations(["dist", "docs"], ["dist"]).map(
      ({ entry, ruleId }) => ({ entry, ruleId })
    ),
    [{ entry: "docs", ruleId: "unexpected-package-files-entry" }]
  );
});

test("normalizes npm tar prefixes and rejects unexpected packed paths", () => {
  assert.equal(
    normalizePackageArtifactPath("package/dist/index.js"),
    "dist/index.js"
  );

  assert.deepEqual(
    comparePackageArtifactAllowlist(
      ["package/LICENSE", "package/dist/index.js", "package/docs/extra.md"],
      ["LICENSE", "dist/index.js"]
    ),
    {
      missingPaths: [],
      unexpectedPaths: ["docs/extra.md"],
    }
  );
});

test("public package verification cleans its cache after a policy failure", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "private-artifact-pack-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ files: ["**/*"] }, null, 2)}\n`,
    "utf8"
  );
  const cacheDirectory = path.join(root, ".npm-cache-packcheck");
  fs.mkdirSync(cacheDirectory);

  const verifier = path.resolve(
    __dirname,
    "../scripts/verify-public-package.cjs"
  );
  const result = spawnSync(process.execPath, [verifier], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 1, result.stderr);
  assert.equal(fs.existsSync(cacheDirectory), false);
});

test("repository discovery is path-only and skips dependency metadata", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "private-artifact-policy-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const init = spawnSync("git", ["init", "--quiet", root], { encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);

  fs.mkdirSync(path.join(root, "legal"), { recursive: true });
  fs.closeSync(fs.openSync(path.join(root, "legal", "CLA-REGISTRY.csv"), "w"));
  fs.mkdirSync(path.join(root, "node_modules", "example"), { recursive: true });
  fs.closeSync(
    fs.openSync(
      path.join(root, "node_modules", "example", "CLA-REGISTRY.csv"),
      "w"
    )
  );

  assert.deepEqual(collectRepositoryArtifactPaths(root), [
    "legal/CLA-REGISTRY.csv",
  ]);
});

test("repository discovery fails closed without valid Git metadata", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "private-artifact-nongit-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => collectRepositoryArtifactPaths(root),
    /requires a valid Git worktree/u
  );
});

test("repository discovery rejects symbolic links without following them", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "private-artifact-link-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const init = spawnSync("git", ["init", "--quiet", root], { encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  fs.symlinkSync("missing-private-target", path.join(root, "public-name"));

  assert.throws(
    () => collectRepositoryArtifactPaths(root),
    /rejects symbolic links without following or logging them/u
  );

  const verifier = path.resolve(
    __dirname,
    "../scripts/verify-private-artifacts.cjs"
  );
  const result = spawnSync(process.execPath, [verifier, root], {
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /details were not logged/u);
  assert.doesNotMatch(result.stderr, /public-name|missing-private-target/u);
});

test("repository gate reports only rule counts, never suspected path values", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "private-artifact-output-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const init = spawnSync("git", ["init", "--quiet", root], { encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);

  const canary = "SYNTHETIC-PERSON-001";
  const protectedDirectory = path.join(root, "legal", "signed-clas");
  fs.mkdirSync(protectedDirectory, { recursive: true });
  fs.closeSync(fs.openSync(path.join(protectedDirectory, `${canary}.pdf`), "w"));

  const verifier = path.resolve(
    __dirname,
    "../scripts/verify-private-artifacts.cjs"
  );
  const result = spawnSync(process.execPath, [verifier, root], {
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /signed-cla-storage: 1/u);
  assert.doesNotMatch(result.stderr, new RegExp(canary, "u"));
});

test("tracked paths remain governed until their deletion is staged", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "private-artifact-index-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const init = spawnSync("git", ["init", "--quiet", root], { encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);

  fs.mkdirSync(path.join(root, "legal"), { recursive: true });
  const registryPath = path.join(root, "legal", "CLA-REGISTRY.csv");
  fs.closeSync(fs.openSync(registryPath, "w"));
  const add = spawnSync("git", ["-C", root, "add", "legal/CLA-REGISTRY.csv"], {
    encoding: "utf8",
  });
  assert.equal(add.status, 0, add.stderr);
  fs.unlinkSync(registryPath);

  const violations = findPrivateArtifactViolations(
    collectRepositoryArtifactPaths(root)
  );
  assert.deepEqual(
    violations.map(({ artifactPath, ruleId }) => ({ artifactPath, ruleId })),
    [
      {
        artifactPath: "legal/CLA-REGISTRY.csv",
        ruleId: "contributor-registry",
      },
    ]
  );
});
