#!/usr/bin/env node
const path = require("node:path");

const {
  collectRepositoryArtifactPaths,
  findPrivateArtifactViolations,
} = require("./private-artifact-policy.cjs");

function main(argv = process.argv.slice(2)) {
  if (argv.length > 1) {
    console.error("Usage: verify-private-artifacts.cjs [repository-root]");
    return 2;
  }

  const root = path.resolve(argv[0] || process.cwd());
  const artifactPaths = collectRepositoryArtifactPaths(root);
  const violations = findPrivateArtifactViolations(artifactPaths);

  if (violations.length > 0) {
    const counts = new Map();
    for (const violation of violations) {
      counts.set(violation.ruleId, (counts.get(violation.ruleId) || 0) + 1);
    }
    console.error(
      "Private artifact policy failed. Prohibited paths were found; file contents were not inspected:"
    );
    for (const [ruleId, count] of [...counts].sort(([left], [right]) =>
      left.localeCompare(right, "en-US")
    )) {
      console.error(`- ${ruleId}: ${count}`);
    }
    return 1;
  }

  console.log(
    `Private artifact policy passed (${artifactPaths.length} paths inspected; contents not read).`
  );
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch {
    console.error(
      "Private artifact policy failed closed because path metadata could not be evaluated; details were not logged."
    );
    process.exitCode = 1;
  }
}

module.exports = { main };
