# ADR-0006: Path-Only Private-Artifact Prevention Gates

## Status

- Accepted
- Date: 2026-07-15
- Version: 1.0

## Tags

security, privacy, packaging, ci, compliance

## Context

`@plasius/schema` is the baseline for new `@plasius/*` packages. Public source
repositories and npm artifacts must never contain signed contributor
agreements, acceptance registries, or similar personal records. `.gitignore`
alone cannot reject a path that was already tracked, and package allowlists can
drift as package manifests evolve.

The prevention control must also avoid increasing exposure while it evaluates a
candidate repository. In particular, it must not open, hash, copy, diff, or log
the contents of a suspected private artifact.

## Decision

Contributor agreements and acceptance records are stored only in an approved,
access-controlled system outside source control.

The package template provides a zero-dependency Node.js policy with two
enforcement boundaries:

1. `privacy:check` unions recursive filesystem path metadata with the current
   Git index, without following symbolic links or reading file contents. It
   rejects every case variant of the `.csv` extension, contributor/CLA registry
   variants, signed-CLA storage directories, and any path containing both a
   privacy marker (`private`, `confidential`, `internal`, `personal`, or `pii`)
   and a registry marker (`registry`, `register`, `roster`, or `ledger`). A
   registry used in ordinary code remains allowed when no privacy marker is
   present.
2. `pack:check` first requires a non-empty, explicit `package.json.files`
   allowlist and rejects broad entries such as `.`, `*`, `**/*`, and `legal`.
   For this package, `dist` is the only accepted files entry. The gate then
   applies the private-path rules to the path manifest returned by
   `npm pack --dry-run --json --ignore-scripts` and requires an exact match with
   the package's final public-artifact allowlist.

The rules normalize Windows and POSIX separators, an optional npm `package/`
tar prefix, and protected path categories case-insensitively so workspace and
package nesting cannot bypass the policy. Dependency and tool metadata
directories are excluded from the filesystem walk, while their tracked paths
remain covered by the Git index. Package output is independently covered by the
a valid Git worktree is mandatory and Git metadata failures fail closed. The
temporary `.npm-cache-packcheck` directory is removed in
a `finally` boundary on both success and failure.

The policy and its tests use only Node.js built-ins. CI executes the repository
gate before dependency installation, then executes its tests and the package
gate. Release preparation checks the source tree before changing release
metadata, and CD checks the prepared release commit before install or publish.
The existing `prepublishOnly` lifecycle remains a final local defense by calling
`pack:check` after build.

`.gitignore` entries provide an additional accidental-add safeguard, but they
are not treated as the enforcement boundary.

Feature flags and capabilities do not apply to this decision: this is a
mandatory build-time privacy control and must not be remotely bypassable.

## Alternatives Considered

- **Rely on `.gitignore` only**: rejected because ignore rules do not remove or
  reject already tracked files and do not validate package manifests.
- **Scan file contents for personal data**: rejected for this boundary because
  reading and reporting suspected records can increase exposure and content
  heuristics produce both false positives and false negatives.
- **Rely on the package `files` allowlist only**: rejected because it does not
  protect the source repository and can regress when package metadata changes.

## Consequences

- Repositories, package metadata, and npm package manifests fail closed when a
  protected or non-allowlisted path is present.
- The same dependency-free policy can be copied with the package template and
  run before dependency installation.
- New private-artifact path categories require an explicit policy and test
  update.
- The targeted path policy is defense in depth, not a replacement for secret
  scanning, access controls, retention controls, or incident response.

## Related Decisions

- [ADR-0002: Dual ESM and CJS Distribution](./adr-0002:%20Dual%20ESM%20and%20CJS%20Distribution.md)
- [ADR-0003: Dual Module Runtime Boundary Enforcement](./adr-0003-dual-module-runtime-boundary.md)
