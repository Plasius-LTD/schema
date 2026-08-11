const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".cache",
  ".git",
  ".npm-cache-packcheck",
  ".turbo",
  "coverage",
  "node_modules",
]);

const CONTRIBUTOR_PRIVATE_RECORD_PATTERN =
  /(?:^|[/ ._-])(?:(?:contributors?[ ._-]*(?:\/[ ._-]*)?(?:acceptances?|signatures?|submissions?))|(?:signed[ ._-]*(?:\/[ ._-]*)?contributors?[ ._-]*(?:\/[ ._-]*)?(?:agreements?|clas?))|(?:contributors?[ ._-]*(?:\/[ ._-]*)?signed[ ._-]*(?:\/[ ._-]*)?(?:agreements?|clas?))|(?:contributors?[ ._-]*(?:\/[ ._-]*)?(?:agreements?|clas?)[ ._-]*(?:\/[ ._-]*)?(?:signed|signatures?)))(?=$|[/ ._-])/giu;

const PUBLIC_CONTRIBUTOR_DOCUMENT_QUALIFIER_PATTERNS = Object.freeze([
  /^[ ._-]+(?:process|template|policy|guides?|guidance|documentation|docs?|instructions?|examples?)(?:[ ._-]+v?[0-9]+(?:[ ._-][0-9]+)*)?\.(?:md|mdx|rst|adoc|txt|pdf)$/iu,
  /^[ ._-]+(?:schema|validator|formats?|spec(?:ification)?s?)(?:[ ._-]+v?[0-9]+(?:[ ._-][0-9]+)*)?\.(?:[cm]?[jt]sx?|d\.[cm]?[jt]s|mdx?|json|ya?ml)$/iu,
]);

const PRIVATE_ARTIFACT_RULES = Object.freeze([
  Object.freeze({
    id: "contributor-registry",
    description:
      "Contributor and CLA acceptance registries must remain in approved private systems.",
    pattern:
      /(?:^|\/)(?:cla|contributors?)[ ._-]*(?:\/[ ._-]*)?registry[ ._-]*(?:\.[^/]*)?(?:\/|$)/iu,
  }),
  Object.freeze({
    id: "contributor-record-storage",
    description:
      "Signed contributor agreements and contributor acceptance, signature, or submission records must remain in approved private systems.",
    matches: matchesContributorRecordStorage,
  }),
  Object.freeze({
    id: "signed-cla-storage",
    description:
      "Signed CLA submissions and signature records must remain in approved private systems.",
    pattern:
      /(?:^|\/)(?:signed[ ._-]*(?:\/[ ._-]*)?clas?|cla[ ._-]*(?:\/[ ._-]*)?(?:acceptances?|signatures?|submissions?))[ ._-]*(?:\.[^/]*)?(?:\/|$)/iu,
  }),
  Object.freeze({
    id: "csv-artifact",
    description:
      "CSV artifacts are not permitted because they can silently publish private registry data.",
    pattern: /\.csv(?:[ .]+)?$/iu,
  }),
  Object.freeze({
    id: "private-registry",
    description:
      "Paths combining privacy and registry markers must remain in approved private systems.",
    matches(artifactPath) {
      return (
        /(?:private|confidential|internal|personal|pii)/iu.test(artifactPath) &&
        /(?:registry|register|roster|ledger)/iu.test(artifactPath)
      );
    },
  }),
]);

const BROAD_PACKAGE_FILES_ENTRIES = new Set([".", "*", "**/*", "legal"]);

/**
 * Classify contributor record categories without treating explicit public
 * process, template, schema, validator, or policy artifacts as private data.
 * Category directories fail closed regardless of their child filename.
 *
 * @param {string} artifactPath
 * @returns {boolean}
 */
function matchesContributorRecordStorage(artifactPath) {
  for (const match of artifactPath.matchAll(CONTRIBUTOR_PRIVATE_RECORD_PATTERN)) {
    const phraseEnd = match.index + match[0].length;
    const nextSeparator = artifactPath.indexOf("/", phraseEnd);
    const componentSuffix = artifactPath.slice(
      phraseEnd,
      nextSeparator === -1 ? artifactPath.length : nextSeparator
    );
    const isPublicDocumentation =
      PUBLIC_CONTRIBUTOR_DOCUMENT_QUALIFIER_PATTERNS.some((pattern) =>
        pattern.test(componentSuffix)
      );
    if (!isPublicDocumentation) {
      return true;
    }
  }

  return false;
}

/**
 * Normalize a repository or package path without opening the referenced file.
 *
 * @param {string} artifactPath
 * @returns {string}
 */
function normalizeArtifactPath(artifactPath) {
  if (typeof artifactPath !== "string") {
    throw new TypeError("Artifact paths must be strings.");
  }

  const compatibilityNormalized = artifactPath.normalize("NFKC");
  const normalized = path.posix.normalize(
    path.posix
      .normalize(compatibilityNormalized.replace(/\\/gu, "/"))
      .normalize("NFKC")
      .replace(/\\/gu, "/")
  );
  if (normalized === ".") {
    return "";
  }

  return normalized.startsWith("./") ? normalized.slice(2) : normalized;
}

/**
 * Find private-artifact policy violations using path metadata only.
 *
 * @param {Iterable<string>} artifactPaths
 * @returns {Array<{artifactPath: string, ruleId: string, description: string}>}
 */
function findPrivateArtifactViolations(artifactPaths) {
  const violations = new Map();

  for (const candidate of artifactPaths) {
    const artifactPath = normalizeArtifactPath(candidate);
    if (!artifactPath) {
      continue;
    }

    for (const rule of PRIVATE_ARTIFACT_RULES) {
      const matches = rule.pattern
        ? rule.pattern.test(artifactPath)
        : rule.matches(artifactPath);
      if (!matches) {
        continue;
      }

      const key = `${artifactPath.toLocaleLowerCase("en-US")}\0${rule.id}`;
      violations.set(key, {
        artifactPath,
        ruleId: rule.id,
        description: rule.description,
      });
      break;
    }
  }

  return [...violations.values()].sort((left, right) => {
    const pathOrder = compareArtifactPaths(left.artifactPath, right.artifactPath);
    return pathOrder || left.ruleId.localeCompare(right.ruleId, "en-US");
  });
}

/**
 * Normalize a path emitted by npm tooling. Tar listings may add a `package/`
 * prefix while `npm pack --json` reports paths relative to that directory.
 *
 * @param {string} artifactPath
 * @returns {string}
 */
function normalizePackageArtifactPath(artifactPath) {
  const normalized = normalizeArtifactPath(artifactPath);
  return normalized.startsWith("package/")
    ? normalized.slice("package/".length)
    : normalized;
}

/**
 * Validate that package.json has an explicit, narrow files allowlist.
 *
 * @param {unknown} packageFiles
 * @param {string[]} [expectedEntries]
 * @returns {Array<{entry: string, ruleId: string}>}
 */
function findPackageFilesPolicyViolations(packageFiles, expectedEntries = []) {
  if (!Array.isArray(packageFiles) || packageFiles.length === 0) {
    return [
      {
        entry: "package.json#files",
        ruleId: "package-files-required",
      },
    ];
  }

  const expected = new Set(
    expectedEntries.map((entry) => normalizePackageFilesEntry(entry))
  );
  const actual = new Set();
  const violations = [];

  for (const [index, entry] of packageFiles.entries()) {
    if (typeof entry !== "string" || entry.trim() === "") {
      violations.push({
        entry: `package.json#files[${index}]`,
        ruleId: "invalid-package-files-entry",
      });
      continue;
    }

    const normalized = normalizePackageFilesEntry(entry);
    if (BROAD_PACKAGE_FILES_ENTRIES.has(normalized.toLocaleLowerCase("en-US"))) {
      violations.push({
        entry,
        ruleId: "broad-package-files-entry",
      });
      continue;
    }

    if (actual.has(normalized)) {
      violations.push({
        entry,
        ruleId: "duplicate-package-files-entry",
      });
      continue;
    }
    actual.add(normalized);

    if (expected.size > 0 && !expected.has(normalized)) {
      violations.push({
        entry,
        ruleId: "unexpected-package-files-entry",
      });
    }
  }

  if (expected.size > 0) {
    for (const entry of expected) {
      if (!actual.has(entry)) {
        violations.push({
          entry,
          ruleId: "missing-package-files-entry",
        });
      }
    }
  }

  return violations;
}

/**
 * Compare normalized npm package paths with an exact allowlist.
 *
 * @param {Iterable<string>} artifactPaths
 * @param {Iterable<string>} allowedPaths
 * @returns {{missingPaths: string[], unexpectedPaths: string[]}}
 */
function comparePackageArtifactAllowlist(artifactPaths, allowedPaths) {
  const actualInventory = createPackageArtifactInventory(artifactPaths);
  const allowedInventory = createPackageArtifactInventory(allowedPaths);

  for (const [normalizedPath, rawPath] of actualInventory.rawByNormalizedPath) {
    if (
      allowedInventory.rawByNormalizedPath.has(normalizedPath) &&
      allowedInventory.rawByNormalizedPath.get(normalizedPath) !== rawPath
    ) {
      throwRawPackageIdentityError();
    }
  }

  const actual = new Set(actualInventory.rawByNormalizedPath.keys());
  const allowed = new Set(allowedInventory.rawByNormalizedPath.keys());

  return {
    missingPaths: [...allowed]
      .filter((entry) => !actual.has(entry))
      .sort(compareArtifactPaths),
    unexpectedPaths: [...actual]
      .filter((entry) => !allowed.has(entry))
      .sort(compareArtifactPaths),
  };
}

/**
 * Retain collision-free, prefix-stripped raw npm member identities alongside
 * the canonical paths used by policy matching. Raw values are deliberately
 * never included in errors because a rejected member may itself be sensitive.
 *
 * @param {Iterable<string>} artifactPaths
 * @returns {{rawPaths: Set<string>, rawByNormalizedPath: Map<string, string>}}
 */
function createPackageArtifactInventory(artifactPaths) {
  const rawPaths = new Set();
  const rawByNormalizedPath = new Map();

  for (const entry of artifactPaths) {
    if (typeof entry !== "string") {
      throw new TypeError("Artifact paths must be strings.");
    }

    const rawPath = entry.startsWith("package/")
      ? entry.slice("package/".length)
      : entry;
    if (rawPaths.has(rawPath)) {
      throwRawPackageIdentityError();
    }
    rawPaths.add(rawPath);

    const normalizedPath = normalizePackageArtifactPath(entry);
    if (
      rawByNormalizedPath.has(normalizedPath) &&
      rawByNormalizedPath.get(normalizedPath) !== rawPath
    ) {
      throwRawPackageIdentityError();
    }
    rawByNormalizedPath.set(normalizedPath, rawPath);
  }

  return { rawPaths, rawByNormalizedPath };
}

function throwRawPackageIdentityError() {
  throw new Error(
    "Packed paths failed raw package member identity or cardinality checks; values were not logged."
  );
}

function normalizePackageFilesEntry(entry) {
  const trimmed = entry.trim();
  if (trimmed === ".") {
    return ".";
  }

  return normalizeArtifactPath(trimmed).replace(/\/+$/u, "");
}

/**
 * Enumerate repository filesystem and Git-index paths without reading file
 * contents or following symbolic links. Dependency and tool metadata
 * directories are excluded from the filesystem walk.
 *
 * @param {string} rootDirectory
 * @returns {string[]}
 */
function collectRepositoryArtifactPaths(rootDirectory = process.cwd()) {
  const root = path.resolve(rootDirectory);
  const artifactPaths = new Set(collectGitIndexArtifactPaths(root));

  function visit(directory, relativeDirectory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        EXCLUDED_DIRECTORY_NAMES.has(entry.name.toLocaleLowerCase("en-US"))
      ) {
        continue;
      }

      const relativePath = normalizeArtifactPath(
        path.posix.join(relativeDirectory, entry.name)
      );
      const absolutePath = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) {
        throw new Error(
          "Private-artifact policy rejects symbolic links without following or logging them."
        );
      }

      if (entry.isDirectory()) {
        visit(absolutePath, relativePath);
        continue;
      }

      if (!entry.isFile()) {
        throw new Error(
          "Private-artifact policy rejects non-regular filesystem entries without opening or logging them."
        );
      }

      artifactPaths.add(relativePath);
    }
  }

  visit(root, "");
  return [...artifactPaths].sort(compareArtifactPaths);
}

/**
 * Enumerate paths represented by the current Git index. Git metadata is a
 * required enforcement boundary, so non-Git and broken worktrees fail closed.
 *
 * @param {string} rootDirectory
 * @returns {string[]}
 */
function collectGitIndexArtifactPaths(rootDirectory) {
  const probe = spawnSync(
    "git",
    ["-C", rootDirectory, "rev-parse", "--is-inside-work-tree"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  if (probe.error) {
    throw new Error("Could not determine whether the policy root is a Git worktree.", {
      cause: probe.error,
    });
  }
  if (probe.status !== 0 || probe.stdout.trim() !== "true") {
    throw new Error("Private-artifact policy requires a valid Git worktree.");
  }

  const result = spawnSync("git", ["-C", rootDirectory, "ls-files", "-z"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error || result.status !== 0) {
    throw new Error("Could not enumerate Git index paths for private-artifact policy.", {
      cause: result.error,
    });
  }

  return result.stdout
    .split("\0")
    .filter(Boolean)
    .map(normalizeArtifactPath);
}

function compareArtifactPaths(left, right) {
  const leftPath = left.toLocaleLowerCase("en-US");
  const rightPath = right.toLocaleLowerCase("en-US");
  if (leftPath < rightPath) return -1;
  if (leftPath > rightPath) return 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

module.exports = {
  collectRepositoryArtifactPaths,
  collectGitIndexArtifactPaths,
  comparePackageArtifactAllowlist,
  findPackageFilesPolicyViolations,
  findPrivateArtifactViolations,
  normalizeArtifactPath,
  normalizePackageArtifactPath,
  PRIVATE_ARTIFACT_RULES,
};
