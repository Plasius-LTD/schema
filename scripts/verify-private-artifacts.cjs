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
    console.error(
      "Private artifact policy failed. Prohibited paths were found; file contents were not inspected:"
    );
    for (const violation of violations) {
      console.error(`- ${violation.artifactPath} (${violation.ruleId})`);
    }
    return 1;
  }

  console.log(
    `Private artifact policy passed (${artifactPaths.length} paths inspected; contents not read).`
  );
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { main };
