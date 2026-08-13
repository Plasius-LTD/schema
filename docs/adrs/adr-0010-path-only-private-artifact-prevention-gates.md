# ADR-0010: Path-Only Private-Artifact Prevention Gates

- Status: Accepted
- Date: 2026-08-11

## Context

`@plasius/schema` is the baseline for new `@plasius/*` packages. Public source
repositories and npm artifacts must never contain signed contributor
agreements, acceptance registries, or similar personal records. `.gitignore`
cannot reject an already tracked path, and package allowlists can drift.

The prevention control must not increase exposure while evaluating a candidate
repository. In particular, it must not open, hash, copy, diff, or log the
contents or path values of suspected private artifacts.

## Decision

Contributor agreements and acceptance records are stored only in an approved,
access-controlled system outside source control.

The package provides a zero-dependency Node.js policy at two boundaries:

1. `privacy:check` unions recursive filesystem path metadata with the current
   Git index without following symbolic links or reading file contents. It
   rejects every case variant of `.csv`, contributor/CLA registry variants,
   contributor acceptance/signature/submission record categories, signed
   CLA/contributor agreement storage, and paths containing both a privacy
   marker and a registry marker. Protected record terms are matched across
   adjacent normalized path segments while explicit public process, template,
   schema, validator, and policy artifacts remain allowed. Failures reveal only
   rule IDs and counts.
2. `pack:check` requires the exact `dist`, `THIRD_PARTY_NOTICES.md`, and
   `unicode` package-file entries. It applies the same private-path rules to the
   `npm pack --dry-run --json --ignore-scripts` manifest and requires an exact
   match with the final public-artifact path allowlist. The comparison retains
   prefix-stripped raw member identities and cardinality separately from the
   canonical policy paths, rejecting duplicate identities, aliases, and
   many-to-one normalization collisions without logging member values. The
   digest-verified sealed tarball repeats the same dependency-free exact
   inventory check before publication.

Paths apply Unicode compatibility normalization before folding Windows and
POSIX separators, then structurally normalize again. The optional literal npm
`package/` prefix is removed only from the retained raw identity, and protected
categories are matched case-insensitively. Dependency/tool directories are
excluded from the filesystem walk, but tracked paths remain covered by the Git
index. Symbolic links and non-regular filesystem entries fail closed without
being followed or logged. A valid Git worktree is mandatory and Git metadata
failures fail closed. The isolated npm cache is removed in a `finally` boundary
on success and failure.

CI executes the repository gate before dependency installation, then executes
policy tests, the package build, and the package gate. Release preparation runs
the repository gate before changing metadata; exact-main publication repeats it
before installing dependencies and repeats the exact inventory policy over the
sealed tarball after digest verification. `prepublishOnly` retains the package
gate as a final local defense.

Feature flags and capabilities do not apply: this is a mandatory build-time
privacy control and cannot be remotely bypassed.

## Consequences

- Repositories, package metadata, and npm manifests fail closed when a protected
  or non-allowlisted path is present.
- The same dependency-free policy can be reused by packages based on this
  template.
- Build-output changes require an explicit review of the exact package path
  allowlist.
- The policy is defense in depth, not a replacement for secret scanning,
  access controls, retention controls, or incident response.

## Alternatives considered

- `.gitignore` alone was rejected because it cannot govern tracked paths.
- Content scanning was rejected at this boundary because it can increase
  exposure and has false positives and false negatives.
- Package `files` metadata alone was rejected because it does not protect the
  source repository and can drift.

## Related decisions

- [ADR-0006: Privacy-Safe Feedback Contract Boundaries](./adr-0006-privacy-safe-feedback-contract-boundaries.md)
- [ADR-0008: Exact-main OIDC package publishing](./adr-0008-exact-main-oidc-package-publishing.md)
