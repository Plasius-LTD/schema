#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
  collectRepositoryArtifactPaths,
  comparePackageArtifactAllowlist,
  findPackageFilesPolicyViolations,
  findPrivateArtifactViolations,
  normalizePackageArtifactPath,
} = require("./private-artifact-policy.cjs");

const EXPECTED_PACKAGE_FILES = Object.freeze([
  "dist",
  "THIRD_PARTY_NOTICES.md",
  "unicode",
]);

const EXPECTED_PACKED_PATHS = Object.freeze([
  "LICENSE",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "dist/chunk-6FE4FLKF.js",
  "dist/chunk-6FE4FLKF.js.map",
  "dist/chunk-AG2NAPDC.js",
  "dist/chunk-AG2NAPDC.js.map",
  "dist/chunk-UQHPDQZX.js",
  "dist/chunk-UQHPDQZX.js.map",
  "dist/feedback-diagnostics-BaniQAFS.d.cts",
  "dist/feedback-diagnostics-CnsI0B9-.d.ts",
  "dist/feedback-diagnostics-vocabulary.cjs",
  "dist/feedback-diagnostics-vocabulary.cjs.map",
  "dist/feedback-diagnostics-vocabulary.d.cts",
  "dist/feedback-diagnostics-vocabulary.d.ts",
  "dist/feedback-diagnostics-vocabulary.js",
  "dist/feedback-diagnostics-vocabulary.js.map",
  "dist/feedback-diagnostics.cjs",
  "dist/feedback-diagnostics.cjs.map",
  "dist/feedback-diagnostics.d.cts",
  "dist/feedback-diagnostics.d.ts",
  "dist/feedback-diagnostics.js",
  "dist/feedback-diagnostics.js.map",
  "dist/feedback-unicode-profile.cjs",
  "dist/feedback-unicode-profile.cjs.map",
  "dist/feedback-unicode-profile.d.cts",
  "dist/feedback-unicode-profile.d.ts",
  "dist/feedback-unicode-profile.js",
  "dist/feedback-unicode-profile.js.map",
  "dist/index.cjs",
  "dist/index.cjs.map",
  "dist/index.d.cts",
  "dist/index.d.ts",
  "dist/index.js",
  "dist/index.js.map",
  "package.json",
  "unicode/feedback-unicode-15.1.0-unassigned.json",
]);

const REQUIRED_THIRD_PARTY_NOTICE_FRAGMENTS = [
  "Copyright Mathias Bynens <https://mathiasbynens.be/>",
  "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction",
  "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.",
  "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED",
  "UNICODE LICENSE V3",
  "COPYRIGHT AND PERMISSION NOTICE",
  "Copyright © 2016-2025 Unicode, Inc.",
  "NOTICE TO USER: Carefully read the following legal agreement.",
  "Permission is hereby granted, free of charge, to any person obtaining a copy of data files and any associated documentation (the \"Data Files\")",
  "THE DATA FILES AND SOFTWARE ARE PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND",
  "IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS NOTICE BE LIABLE FOR ANY CLAIM",
  "Except as contained in this notice, the name of a copyright holder shall not be used in advertising",
  "SPDX-License-Identifier: Unicode-3.0",
];

function main(argv = process.argv.slice(2)) {
  if (argv.length === 1 && argv[0] === "--inventory-stdin") {
    verifyStdinPackageInventory();
    return;
  }
  if (argv.length > 0) {
    throw new Error("Unsupported public package check arguments.");
  }

  const cacheDir = path.resolve(process.cwd(), ".npm-cache-packcheck");
  try {
    let repositoryPaths;
    try {
      repositoryPaths = collectRepositoryArtifactPaths(process.cwd());
    } catch {
      throw new Error(
        "Repository path metadata could not be evaluated; details were not logged."
      );
    }
    const repositoryViolations =
      findPrivateArtifactViolations(repositoryPaths);
    if (repositoryViolations.length > 0) {
      throw new Error(
        `Prohibited private artifact path metadata was found (${summarizePrivateArtifactViolations(repositoryViolations)}); values were not logged.`
      );
    }

    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
    );
    const packageFilesViolations = findPackageFilesPolicyViolations(
      packageJson.files,
      EXPECTED_PACKAGE_FILES
    );
    if (packageFilesViolations.length > 0) {
      const ruleIds = [
        ...new Set(packageFilesViolations.map(({ ruleId }) => ruleId)),
      ].sort();
      throw new Error(
        `package.json files policy failed (${ruleIds.join(", ")}).`
      );
    }

    execFileSync(
      process.execPath,
      ["scripts/generate-feedback-unicode-profile.cjs", "--check"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let output;
    try {
      output = runNpmPack(cacheDir);
    } catch {
      throw new Error(
        "npm package inventory could not be produced; details were not logged."
      );
    }
    const parsed = parseNpmPackJson(output);
    const files =
      Array.isArray(parsed) && Array.isArray(parsed[0]?.files)
        ? parsed[0].files
        : [];
    const paths = files
      .map((entry) => entry?.path)
      .filter((entry) => typeof entry === "string");

    verifyPackagePathInventory(paths);

    verifyPackageContents({ packageJson, paths });
  } finally {
    fs.rmSync(cacheDir, { force: true, recursive: true });
  }
}

function verifyStdinPackageInventory() {
  const input = fs.readFileSync(0);
  if (input.byteLength > 16 * 1024 * 1024) {
    throw new Error("Packed path inventory exceeds the 16 MiB limit.");
  }

  const paths = input
    .toString("utf8")
    .split("\n")
    .filter((entry) => entry.length > 0);
  verifyPackagePathInventory(paths);
  console.log("Sealed package inventory check passed.");
}

function verifyPackagePathInventory(paths) {
  const privateArtifactViolations = findPrivateArtifactViolations(paths);
  if (privateArtifactViolations.length > 0) {
    throw new Error(
      `Packed output contains prohibited private artifact path metadata (${summarizePrivateArtifactViolations(privateArtifactViolations)}); values were not logged.`
    );
  }

  const packageAllowlist = comparePackageArtifactAllowlist(
    paths,
    EXPECTED_PACKED_PATHS
  );
  if (
    packageAllowlist.missingPaths.length > 0 ||
    packageAllowlist.unexpectedPaths.length > 0
  ) {
    throw new Error(
      `Packed paths differ from the exact allowlist (${packageAllowlist.missingPaths.length} missing, ${packageAllowlist.unexpectedPaths.length} unexpected); values were not logged.`
    );
  }
}

function verifyPackageContents({ packageJson, paths }) {
  const normalizedPaths = paths.map(normalizePackageArtifactPath);
  const expectedUnicodePaths = [
    "unicode/feedback-unicode-15.1.0-unassigned.json",
  ];
  const unexpectedUnicodePaths = normalizedPaths.filter(
    (filePath) =>
      filePath.startsWith("unicode/") &&
      !expectedUnicodePaths.includes(filePath)
  );
  if (unexpectedUnicodePaths.length > 0) {
    throw new Error(
      `Unexpected Unicode files are present (${unexpectedUnicodePaths.length}); values were not logged.`
    );
  }

  const notices = fs
    .readFileSync(
      path.resolve(process.cwd(), "THIRD_PARTY_NOTICES.md"),
      "utf8"
    )
    .replace(/\s+/gu, " ")
    .trim();
  const missingNoticeFragments = REQUIRED_THIRD_PARTY_NOTICE_FRAGMENTS.filter(
    (fragment) => !notices.includes(fragment)
  );
  if (missingNoticeFragments.length > 0) {
    throw new Error(
      "Third-party license notices are incomplete."
    );
  }
  const expectedExports = {
    "./feedback-diagnostics": {
      types: "./dist/feedback-diagnostics.d.ts",
      import: "./dist/feedback-diagnostics.js",
      require: "./dist/feedback-diagnostics.cjs",
    },
    "./feedback-diagnostics-vocabulary": {
      types: "./dist/feedback-diagnostics-vocabulary.d.ts",
      import: "./dist/feedback-diagnostics-vocabulary.js",
      require: "./dist/feedback-diagnostics-vocabulary.cjs",
    },
    "./feedback-unicode-profile": {
      types: "./dist/feedback-unicode-profile.d.ts",
      import: "./dist/feedback-unicode-profile.js",
      require: "./dist/feedback-unicode-profile.cjs",
    },
    "./unicode/feedback-unicode-15.1.0-unassigned.json":
      "./unicode/feedback-unicode-15.1.0-unassigned.json",
  };
  for (const [exportPath, expected] of Object.entries(expectedExports)) {
    if (
      JSON.stringify(packageJson.exports?.[exportPath]) !==
      JSON.stringify(expected)
    ) {
      throw new Error(`Export ${exportPath} is incorrect.`);
    }
  }

  const vocabularyBundle = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "dist/feedback-diagnostics-vocabulary.cjs"
    ),
    "utf8"
  );
  if (Buffer.byteLength(vocabularyBundle, "utf8") > 16 * 1024) {
    throw new Error(
      "Diagnostics vocabulary bundle exceeds 16 KiB."
    );
  }
  if (
    /\b(?:createSchema|FeedbackGameDiagnosticsSchema|FeedbackRichTextAstSchema|feedback-encrypted-narrative-envelope)\b/u.test(
      vocabularyBundle
    )
  ) {
    throw new Error(
      "Diagnostics vocabulary bundle includes schema-builder or narrative code."
    );
  }

  const rootCjs = require(path.resolve(process.cwd(), "dist/index.cjs"));
  const diagnosticsCjs = require(
    path.resolve(process.cwd(), "dist/feedback-diagnostics.cjs")
  );
  const vocabularyCjs = require(
    path.resolve(
      process.cwd(),
      "dist/feedback-diagnostics-vocabulary.cjs"
    )
  );
  for (const exportName of [
    "FEEDBACK_BACKEND_BUCKETS",
    "FEEDBACK_FRAME_RATE_BUCKETS",
    "FEEDBACK_FRAME_TIME_BUCKETS",
    "FEEDBACK_GAME_COUNTER_CODES",
    "FEEDBACK_GAME_ERROR_CODES",
    "FEEDBACK_GAME_FEATURE_IDS",
    "FEEDBACK_GAME_PROVENANCE_CONTRACTS",
    "FEEDBACK_GAME_SURFACE_IDS",
    "FEEDBACK_RENDERER_BUCKETS",
    "FEEDBACK_VIEWPORT_BUCKETS",
  ]) {
    const rootValue = JSON.stringify(rootCjs[exportName]);
    if (
      rootValue !== JSON.stringify(diagnosticsCjs[exportName]) ||
      rootValue !== JSON.stringify(vocabularyCjs[exportName])
    ) {
      throw new Error(`CommonJS diagnostics export ${exportName} drifted.`);
    }
  }
  const cjsProbe = {
    type: "feedback-game-diagnostics",
    version: "1.0.0",
    surfaceId: "site.generator",
    consentConfirmed: true,
    provenanceContractId: "generator.renderer-diagnostics.v1",
    renderer: "canvas2d",
    backend: "browser",
    viewportBucket: "small-landscape",
    frameRateBucket: "30-59",
    frameTimeBucket: "17-33ms",
    featureIds: [],
    counters: [],
    errorCodes: [],
  };
  if (
    rootCjs.FeedbackGameDiagnosticsSchema.validate(cjsProbe).valid !== true ||
    diagnosticsCjs.FeedbackGameDiagnosticsSchema.validate(cjsProbe).valid !==
      true
  ) {
    throw new Error(
      "CommonJS diagnostics schemas are not behaviorally equivalent."
    );
  }

  const forbiddenTarballPathPatterns = [
    {
      label: "private monorepo path",
      regex: /(?:^|\/)plasius-ltd-site(?:\/|$)/i,
    },
    {
      label: "private app runtime path",
      regex: /(?:^|\/)(frontend|backend|dashboard|infra)(?:\/|$)/i,
    },
    {
      label: "local settings artifact",
      regex: /(?:^|\/)local\.settings(?:\.[^/]+)?\.json$/i,
    },
    {
      label: "azure host artifact",
      regex: /(?:^|\/)host\.json$/i,
    },
    {
      label: "generated tsp artifact",
      regex: /(?:^|\/)tsp-output(?:\/|$)/i,
    },
  ];

  const forbiddenPaths = normalizedPaths.filter((filePath) =>
    forbiddenTarballPathPatterns.some(({ regex }) => regex.test(filePath))
  );

  if (forbiddenPaths.length > 0) {
    throw new Error(
      `Forbidden publish paths were found (${forbiddenPaths.length}); values were not logged.`
    );
  }

  const forbiddenCodeReferencePatterns = [
    {
      label: "private monorepo reference",
      regex: /\bplasius-ltd-site\b/i,
    },
    {
      label: "Plasius Ltd private reference",
      regex: /\bplasius(?:\s+|-)ltd\b/i,
    },
    {
      label: "proprietary PGP artifact reference",
      regex: /\bpgp[-_a-z0-9]*\b/i,
    },
    {
      label: "proprietary Lunari artifact reference",
      regex: /\blunari\b/i,
    },
    {
      label: "proprietary Pixelverse artifact reference",
      regex: /\bpixelverse\b/i,
    },
  ];

  const codeRoots = ["src", "tests", "demo", "unicode"];
  const codeExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]);
  const violations = scanCodeReferences(
    codeRoots,
    codeExtensions,
    forbiddenCodeReferencePatterns
  );

  if (violations.length > 0) {
    const labels = [...new Set(violations.map(({ label }) => label))].sort();
    throw new Error(
      `Forbidden private/product code references were found (${violations.length}; ${labels.join(", ")}); path and content values were not logged.`
    );
  }

  console.log("Public package check passed.");
}

function runNpmPack(cacheDir) {
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath ? process.execPath : "npm";
  const args = npmExecPath
    ? [npmExecPath, "pack", "--dry-run", "--json", "--ignore-scripts"]
    : ["pack", "--dry-run", "--json", "--ignore-scripts"];
  args.push("--cache", cacheDir);

  return execFileSync(command, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function summarizePrivateArtifactViolations(violations) {
  const counts = new Map();
  for (const violation of violations) {
    counts.set(violation.ruleId, (counts.get(violation.ruleId) || 0) + 1);
  }
  return [...counts]
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([ruleId, count]) => `${ruleId}: ${count}`)
    .join(", ");
}

function parseNpmPackJson(rawOutput) {
  const start = rawOutput.indexOf("[");
  const end = rawOutput.lastIndexOf("]");

  if (start < 0 || end < start) {
    throw new Error("Could not find npm pack JSON payload in command output.");
  }

  const jsonSlice = rawOutput.slice(start, end + 1);
  return JSON.parse(jsonSlice);
}

function scanCodeReferences(roots, extensions, patterns) {
  const allFiles = [];
  for (const root of roots) {
    allFiles.push(...collectFiles(path.resolve(process.cwd(), root), extensions));
  }

  const violations = [];
  for (const file of allFiles) {
    const contents = fs.readFileSync(file, "utf8");

    for (const pattern of patterns) {
      const matchIndex = contents.search(pattern.regex);
      if (matchIndex < 0) {
        continue;
      }

      const beforeMatch = contents.slice(0, matchIndex);
      const line = beforeMatch.split(/\r?\n/u).length;
      violations.push({
        file: path.relative(process.cwd(), file),
        line,
        label: pattern.label,
      });
      break;
    }
  }

  return violations;
}

function collectFiles(root, extensions) {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "dist-cjs") {
        continue;
      }
      files.push(...collectFiles(fullPath, extensions));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (extensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Public package check failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  EXPECTED_PACKED_PATHS,
  main,
  verifyPackagePathInventory,
};
