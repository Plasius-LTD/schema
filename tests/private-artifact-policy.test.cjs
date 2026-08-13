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
const {
  EXPECTED_PACKED_PATHS,
} = require("../scripts/verify-public-package.cjs");

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

test("normalizes compatibility separators before structural path handling", () => {
  for (const candidate of [
    "legal/ＣＬＡ／ＲＥＧＩＳＴＲＹ．ｊｓｏｎ",
    "legal/ＣＬＡ＼ＲＥＧＩＳＴＲＹ．ｊｓｏｎ",
    "legal/ＣＬＡ﹨ＲＥＧＩＳＴＲＹ．ｊｓｏｎ",
  ]) {
    const normalized = normalizeArtifactPath(candidate);
    assert.equal(normalized, "legal/CLA/REGISTRY.json");
    assert.equal(normalizeArtifactPath(normalized), normalized);
  }
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

test("rejects hierarchical and compatibility-spelled CLA registries", () => {
  const protectedPaths = [
    "legal/CLA/REGISTRY.json",
    "legal/contributors/registry/record.pdf",
    "legal/CLA-REGISTRY .json",
    "legal/CLA-REGISTRY\u00a0.json",
    "legal/CLA-REGISTRY\u3000.json",
    "legal/ＣＬＡ／ＲＥＧＩＳＴＲＹ．ｊｓｏｎ",
    "legal/ＣＬＡ＼ＲＥＧＩＳＴＲＹ．ｊｓｏｎ",
    "legal/ＣＬＡ﹨ＲＥＧＩＳＴＲＹ．ｊｓｏｎ",
    "legal\\CLA\\REGISTRY.json",
  ];

  for (const candidate of protectedPaths) {
    const violations = findPrivateArtifactViolations([candidate]);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].ruleId, "contributor-registry");
  }
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

test("rejects hierarchical and compatibility-spelled signed CLA storage", () => {
  const protectedPaths = [
    "legal/signed/CLAs/record.pdf",
    "legal/signed＼clas/record.pdf",
    "legal/CLA/signatures/record.pdf",
    "legal/CLA/acceptances/record.pdf",
    "legal/CLA/submissions/record.pdf",
  ];

  for (const candidate of protectedPaths) {
    const violations = findPrivateArtifactViolations([candidate]);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].ruleId, "signed-cla-storage");
  }
});

test("rejects contributor record and signed agreement aliases", () => {
  const protectedPaths = [
    "legal/contributor-acceptances.json",
    "legal/contributor-signatures.json",
    "legal/contributor-submission.pdf",
    "legal/contributor/acceptances/record.json",
    "legal/contributors/signature/record.pdf",
    "legal/signed-contributor-agreement.pdf",
    "legal/signed/contributor/agreements/record.pdf",
    "legal/contributor-signed-agreement.pdf",
    "legal/contributor/agreement/signed.pdf",
    "legal/contributor-agreement-signature.pdf",
    "legal/contributor-acceptances-2026.json",
    "legal/contributor-signature-backup.json",
    "legal/signed-contributor-agreement-backup.pdf",
    "legal/contributor-acceptance-process.json",
    "legal/contributor-signature-schema.pdf",
    "legal/contributor-acceptance-process/SYNTHETIC-RECORD.pdf",
    "legal/ＣＯＮＴＲＩＢＵＴＯＲ／ＡＣＣＥＰＴＡＮＣＥＳ／record.json",
    "legal/signed＼contributor＼agreement.pdf",
    "docs/contributor-acceptance-process/legal/contributor-signatures.json",
  ];

  for (const candidate of protectedPaths) {
    const violations = findPrivateArtifactViolations([candidate]);
    assert.equal(violations.length, 1, candidate);
    assert.equal(violations[0].ruleId, "contributor-record-storage", candidate);
  }
});

test("allows public CLA templates and contributor documentation", () => {
  assert.deepEqual(
    findPrivateArtifactViolations([
      "CONTRIBUTORS.md",
      "legal/CLA.md",
      "legal/INDIVIDUAL_CLA.md",
      "legal/CORPORATE_CLA.md",
      "docs/cla-signing-process.md",
      "docs/contributor-acceptance-process.md",
      "docs/contributor-acceptance-process-v2.md",
      "docs/signed-contributor-agreement-template.md",
      "docs/contributor-submission-policy.md",
      "src/mcp-admin-registry.ts",
      "src/cla-signature-schema.ts",
      "src/contributor-signature-schema.ts",
      "src/contributor-signature-schema-v2.ts",
      "src/contributor-submission-validator.ts",
      "src/contributor-acceptance-format.ts",
    ]),
    []
  );
});

test("rejects public-document qualifiers used as private-record directories", () => {
  const protectedPaths = [
    "docs/contributor-acceptance-process.md/SYNTHETIC-RECORD.pdf",
    "docs/contributor-acceptance-process-v2.md/SYNTHETIC-RECORD.pdf",
    "docs/signed-contributor-agreement-template.md/SYNTHETIC-RECORD.pdf",
    "docs/contributor-submission-policy.md/SYNTHETIC-RECORD.pdf",
    "src/contributor-signature-schema.ts/SYNTHETIC-RECORD.pdf",
    "src/contributor-signature-schema-v2.ts/SYNTHETIC-RECORD.pdf",
    "src/contributor-submission-validator.ts/SYNTHETIC-RECORD.pdf",
    "src/contributor-acceptance-format.ts/SYNTHETIC-RECORD.pdf",
  ];

  for (const candidate of protectedPaths) {
    const violations = findPrivateArtifactViolations([candidate]);
    assert.equal(violations.length, 1, candidate);
    assert.equal(violations[0].ruleId, "contributor-record-storage", candidate);
  }
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

test("rejects duplicate and normalization-colliding raw package members", () => {
  const collisionPairs = [
    ["README.md", "ＲEADME.md"],
    ["dist/index.js", "ｄist/index.js"],
    [
      "unicode/feedback-unicode-15.1.0-unassigned.json",
      "unicode/ｆeedback-unicode-15.1.0-unassigned.json",
    ],
  ];

  for (const [canonical, compatibilitySpelling] of collisionPairs) {
    assert.throws(
      () =>
        comparePackageArtifactAllowlist(
          [canonical, compatibilitySpelling],
          [canonical]
        ),
      /raw package member identity or cardinality/u
    );
    assert.throws(
      () =>
        comparePackageArtifactAllowlist(
          [compatibilitySpelling],
          [canonical]
        ),
      /raw package member identity or cardinality/u
    );
  }

  const canonical = "unicode/feedback-unicode-15.1.0-unassigned.json";
  const compatibilitySpelling =
    "unicode/ｆeedback-unicode-15.1.0-unassigned.json";
  assert.throws(
    () => comparePackageArtifactAllowlist([canonical, canonical], [canonical]),
    /raw package member identity or cardinality/u
  );
  assert.throws(
    () =>
      comparePackageArtifactAllowlist(
        [`package/${canonical}`, canonical],
        [canonical]
      ),
    /raw package member identity or cardinality/u
  );
  assert.throws(
    () =>
      comparePackageArtifactAllowlist(
        [canonical],
        [canonical, compatibilitySpelling]
    ),
    /raw package member identity or cardinality/u
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

test("sealed inventory mode rejects raw collisions without logging member names", () => {
  const canonical =
    "package/unicode/feedback-unicode-15.1.0-unassigned.json";
  const compatibilitySpelling =
    "package/unicode/ｆeedback-unicode-15.1.0-unassigned.json";
  const verifier = path.resolve(
    __dirname,
    "../scripts/verify-public-package.cjs"
  );
  const result = spawnSync(process.execPath, [verifier, "--inventory-stdin"], {
    encoding: "utf8",
    input: `${canonical}\n${compatibilitySpelling}\n`,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /raw package member identity or cardinality/u);
  assert.doesNotMatch(result.stderr, /feedback-unicode|\uff46eedback/u);
});

test("sealed inventory mode preserves exact raw line identities", () => {
  const verifier = path.resolve(
    __dirname,
    "../scripts/verify-public-package.cjs"
  );
  const exactInventory = EXPECTED_PACKED_PATHS.map(
    (member) => `package/${member}`
  );
  const accepted = spawnSync(
    process.execPath,
    [verifier, "--inventory-stdin"],
    {
      encoding: "utf8",
      input: `${exactInventory.join("\n")}\n`,
    }
  );
  assert.equal(accepted.status, 0, accepted.stderr);

  const carriageReturnAlias = [...exactInventory];
  carriageReturnAlias[0] += "\r";
  const rejected = spawnSync(
    process.execPath,
    [verifier, "--inventory-stdin"],
    {
      encoding: "utf8",
      input: `${carriageReturnAlias.join("\n")}\n`,
    }
  );
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /exact allowlist/u);
  assert.doesNotMatch(rejected.stderr, /LICENSE/u);
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

test("repository gate rejects hierarchical CLA registries without logging paths", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "private-artifact-hierarchy-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const init = spawnSync("git", ["init", "--quiet", root], { encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);

  const hierarchicalDirectory = path.join(root, "legal", "CLA");
  fs.mkdirSync(hierarchicalDirectory, { recursive: true });
  fs.closeSync(fs.openSync(path.join(hierarchicalDirectory, "REGISTRY.json"), "w"));
  fs.closeSync(fs.openSync(path.join(root, "legal", "CLA-REGISTRY .json"), "w"));
  const add = spawnSync("git", ["-C", root, "add", "-f", "--all"], {
    encoding: "utf8",
  });
  assert.equal(add.status, 0, add.stderr);

  const verifier = path.resolve(
    __dirname,
    "../scripts/verify-private-artifacts.cjs"
  );
  const result = spawnSync(process.execPath, [verifier, root], {
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /contributor-registry: 2/u);
  assert.doesNotMatch(result.stderr, /CLA|REGISTRY|\.json/u);
});

test("repository gate rejects staged contributor record aliases without logging paths", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "private-artifact-alias-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const init = spawnSync("git", ["init", "--quiet", root], { encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);

  const protectedAliases = [
    "legal/contributor-acceptances.json",
    "legal/contributor-signatures.json",
    "legal/signed-contributor-agreement.pdf",
    "evidence/contributor-acceptance-process.md/SYNTHETIC-RECORD.pdf",
  ];
  const legitimateControls = [
    "docs/contributor-acceptance-process.md",
    "docs/signed-contributor-agreement-template.md",
    "src/contributor-signature-schema.ts",
  ];
  for (const artifactPath of [...protectedAliases, ...legitimateControls]) {
    const absolutePath = path.join(root, artifactPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.closeSync(fs.openSync(absolutePath, "w"));
  }
  const add = spawnSync("git", ["-C", root, "add", "-f", "--all"], {
    encoding: "utf8",
  });
  assert.equal(add.status, 0, add.stderr);

  const verifier = path.resolve(
    __dirname,
    "../scripts/verify-private-artifacts.cjs"
  );
  const result = spawnSync(process.execPath, [verifier, root], {
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /contributor-record-storage: 4/u);
  assert.doesNotMatch(
    result.stderr,
    /legal\/|acceptances|signatures|agreement|SYNTHETIC|\.json|\.pdf/u
  );
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
