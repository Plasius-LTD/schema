#!/usr/bin/env node
const { execFileSync, execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

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

function main() {
  execFileSync(
    process.execPath,
    ["scripts/generate-feedback-unicode-profile.cjs", "--check"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  const cacheDir = path.resolve(process.cwd(), ".npm-cache-packcheck");
  const output = execSync(
    `npm pack --dry-run --json --ignore-scripts --cache "${cacheDir}"`,
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  const parsed = parseNpmPackJson(output);
  const files = Array.isArray(parsed) && parsed[0]?.files ? parsed[0].files : [];
  const paths = files.map((entry) => entry.path);
  const requiredPaths = [
    "THIRD_PARTY_NOTICES.md",
    "dist/feedback-diagnostics.cjs",
    "dist/feedback-diagnostics.d.ts",
    "dist/feedback-diagnostics.js",
    "dist/feedback-diagnostics-vocabulary.cjs",
    "dist/feedback-diagnostics-vocabulary.d.ts",
    "dist/feedback-diagnostics-vocabulary.js",
    "dist/feedback-unicode-profile.cjs",
    "dist/feedback-unicode-profile.d.ts",
    "dist/feedback-unicode-profile.js",
    "unicode/feedback-unicode-15.1.0-unassigned.json",
  ];
  const missingPaths = requiredPaths.filter(
    (requiredPath) => !paths.includes(requiredPath)
  );
  if (missingPaths.length > 0) {
    console.error("Public package check failed. Required files are missing:");
    for (const filePath of missingPaths) {
      console.error(`- ${filePath}`);
    }
    process.exit(1);
  }
  const expectedUnicodePaths = [
    "unicode/feedback-unicode-15.1.0-unassigned.json",
  ];
  const unexpectedUnicodePaths = paths.filter(
    (filePath) =>
      filePath.startsWith("unicode/") &&
      !expectedUnicodePaths.includes(filePath)
  );
  if (unexpectedUnicodePaths.length > 0) {
    console.error(
      "Public package check failed. Unexpected Unicode files are present:"
    );
    for (const filePath of unexpectedUnicodePaths) {
      console.error(`- ${filePath}`);
    }
    process.exit(1);
  }

  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
  );
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
    console.error(
      "Public package check failed. Third-party license notices are incomplete."
    );
    process.exit(1);
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
      console.error(
        `Public package check failed. Export ${exportPath} is incorrect.`
      );
      process.exit(1);
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
    console.error(
      "Public package check failed. Diagnostics vocabulary bundle exceeds 16 KiB."
    );
    process.exit(1);
  }
  if (
    /\b(?:createSchema|FeedbackGameDiagnosticsSchema|FeedbackRichTextAstSchema|feedback-encrypted-narrative-envelope)\b/u.test(
      vocabularyBundle
    )
  ) {
    console.error(
      "Public package check failed. Diagnostics vocabulary bundle includes schema-builder or narrative code."
    );
    process.exit(1);
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
      console.error(
        `Public package check failed. CommonJS diagnostics export ${exportName} drifted.`
      );
      process.exit(1);
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
    console.error(
      "Public package check failed. CommonJS diagnostics schemas are not behaviorally equivalent."
    );
    process.exit(1);
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

  const forbiddenPaths = paths.filter((filePath) =>
    forbiddenTarballPathPatterns.some(({ regex }) => regex.test(filePath))
  );

  if (forbiddenPaths.length > 0) {
    console.error("Public package check failed. Forbidden publish paths found:");
    for (const filePath of forbiddenPaths) {
      console.error(`- ${filePath}`);
    }
    process.exit(1);
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
    console.error(
      "Public package check failed. Forbidden private/product code references found:"
    );
    for (const violation of violations) {
      console.error(`- ${violation.file}:${violation.line} (${violation.label})`);
    }
    process.exit(1);
  }

  console.log("Public package check passed.");
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

main();
