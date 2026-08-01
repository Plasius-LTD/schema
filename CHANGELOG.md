
# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.3.1] - 2026-08-01

- **Added**
  - Added `validateDisplayName` so Unicode decimal digits can be accepted in
    display names without relaxing first, middle, or last-name validation for
    task #41.
  - Added strict, versioned privacy-safe feedback contracts for transient
    rich-text analysis, encrypted envelopes, capability-projected context,
    drafts, bug/review packets, game diagnostics, scheduled reports,
    checkpoints, reconstruction manifests, and public honesty snapshots.
  - Added opt-in recursive `unknownFields: "reject"` validation while
    preserving the historical stripping default for existing schemas.
  - Added opt-in exact schema type/version enforcement for closed trust
    boundaries while retaining compatible legacy behaviour by default.
  - Added directly composable child-contract identities, v4-only workflow
    identifiers, exact UTC report windows/rates, and closed renderer
    diagnostic vocabularies.
  - Added bounded draft/acceptance receipts and a closed structured-only
    analysis result for HTTP response contracts.
  - Added runtime-frozen feedback vocabularies, Unicode code-point narrative
    limits, canonical cryptographic identifiers, exact cooldown projections,
    and processor-bound replay manifests.
  - Added an isolated Unicode 15.1 feedback-profile helper and a
    language-neutral, digest-bound unassigned-code-point corpus generated from
    the exact reviewed Unicode data package.
  - Added the focused `@plasius/schema/feedback-diagnostics` entrypoint for
    canonical renderer feedback vocabulary and runtime validation.
  - Added the lightweight
    `@plasius/schema/feedback-diagnostics-vocabulary` entrypoint for
    browser/renderer consumers that must not load the schema builder.
  - Added `validateFeedbackGameDiagnostics()` so successful schema output
    retains its discriminated surface/provenance TypeScript type.
  - Added a frozen, presence-only `SchemaValidationContext` so schema-level
    validators can distinguish omission from explicit `null` without
    receiving raw input values.

- **Changed**
  - Prevented the read-only checkout credential from overriding the
    release-preparation GitHub App token when creating a protected release PR.
  - Aligned final feedback intake with header-only idempotency by removing the
    duplicate `submissionId` JSON field from bug and review request schemas;
    immutable packet shapes remain identifier-free and unchanged.
  - Discriminated transient analysis requests by purpose: bug analysis now
    requires a closed surface for pre-decryption authorisation while review
    analysis explicitly forbids one, with a typed validator preserving the
    union.
  - Extended recursive strict unknown-field rejection to direct and array
    references, treating unshaped references as exactly `type` plus `id`.
  - Preserved omission of absent optional nested objects across storage,
    read, and log preparation while retaining present optional encrypted and
    hashed values during read preparation.
  - Corrected the documented development runtime to Node.js 24, matching
    `.nvmrc` and repository guidance.
  - Refreshed compatible development tooling as part of the feedback Epic
    dependency audit; TypeScript 7 remains a separate major migration.
  - Split release preparation from SHA-bound publication so npm provenance,
    the release tag, package bytes, and successful `main` CI all identify the
    same immutable commit.

- **Fixed**
  - Bounded every strict input before recursive cloning, including malformed
    containers hidden under scalar fields, preventing validation stack
    exhaustion.
  - Bound context cooldowns and type-specific acceptance receipts to the exact
    bug ladder and 30-day review period.
  - Bound report advisory counts/recommendations to their triggers and public
    trend direction to a thresholded preceding-window comparison.
  - Runtime-froze the exported schema policy vocabularies.

- **Security**
  - Bound encrypted bug analysis to a closed surface that services must
    authorise before decryption and reject duplicate body correlation IDs,
    preventing control-plane identifiers from drifting toward feedback
    content storage.
  - Closed the review discriminator against explicit `surfaceId: null`, which
    optional-field normalisation would otherwise treat as omission.
  - Added fail-closed source and npm-package admission for the administrative contributor registry and pinned the CI/CD runtime to Node.js 24.18.0 LTS.
  - Moved pull-request validation to GitHub-hosted runners while retaining
    fail-closed same-repository admission and workflow-restricted self-hosted
    execution for protected `main`.
  - Replaced long-lived npm write-token configuration with workflow-bound OIDC
    trusted publishing and isolated dependency execution from the privileged
    production publication job.
  - Feedback storage schemas structurally reject narrative, identities,
    pseudonyms, client/network metadata, pixels, arbitrary classifier output,
    and unknown fields without reflecting attacker-controlled keys or values.
  - Public honesty snapshots now omit all sub-threshold counts and require 13
    canonical suppressed/published weekly slots; diagnostics reject arbitrary
    safe-looking IDs and cross-surface attachment.
  - Surface entries now bind IDs to canonical visibility and diagnostics
    metadata; envelope encodings and formatting-node overhead are bounded
    before private scanning.
  - Pinned the transient narrative boundary to the Unicode 15.1 normalization
    profile with exhaustive cross-runtime assignment data, lone-surrogate
    rejection, and pre-NFKC enforcement; rejected `data`, `blob`, `file`, and
    protocol-relative URL syntax alongside the existing closed link schemes.
  - Array-enum validation errors no longer echo rejected input values.
  - Nested PII audit paths now expose transient text annotations for review.
  - Pinned the transitive `esbuild` toolchain to a non-vulnerable compatible
    release; the complete dependency audit now reports zero vulnerabilities.

## [1.3.0] - 2026-07-15

- **Added**
  - Added versioned player-system observed-event, normalized-batch, and curated
    Event Log/Achievement schemas with strict safe-text validation and
    privacy-safe `playerId` metadata.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.18] - 2026-07-12

- **Added**
  - (placeholder)

- **Changed**
  - Expanded the documented BCP 47 subset with case-insensitive subtags,
    extlangs, private-use-only and grandfathered tags, and duplicate rejection.
  - Updated UUID validation from obsolete RFC 4122 claims to RFC 9562 versions
    1-8, Nil, and Max while retaining the compatibility filename.
  - Documented email validation as a pragmatic product subset rather than full
    RFC 5322 mailbox conformance.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.17] - 2026-06-28

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.16] - 2026-06-22

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.15] - 2026-06-22

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.12] - 2026-06-01

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.11] - 2026-05-13

- **Added**
  - (placeholder)

- **Changed**
  - Refreshed development dependencies to the latest stable published versions.
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.10] - 2026-04-21

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.9] - 2026-04-21

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.8] - 2026-04-02

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.7] - 2026-03-27

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.6] - 2026-03-09

- **Added**
  - Added field exposure metadata (`.exposure(...)`, `.internal()`, `.public()`) for separating validation/storage concerns from client-facing serialization.
  - Added schema-driven `serialize()` support that strips unknown fields and omits `internal` fields by default.

- **Changed**
  - Schema descriptions and rendered schema metadata now include field exposure information.

- **Fixed**
  - Prevented server-only fields from being treated as implicitly safe for client responses when callers serialize entities through the schema contract.

- **Security**
  - (placeholder)

## [1.2.5] - 2026-03-04

- **Added**
  - (placeholder)

- **Changed**
  - Added template-level dual-module packaging policy that mandates runtime-safe CommonJS boundaries when emitting `dist-cjs/*.js` under `type: module`.

- **Fixed**
  - Established publish-time guardrails (`build` + `pack:check`) in template governance to prevent dual-module regressions in downstream `@plasius/*` packages.

- **Security**
  - (placeholder)

## [1.2.2] - 2026-02-28

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.1] - 2026-01-22

- **Added**
  - Monthly GitHub Actions workflow to run `npm audit fix` on a schedule and open a PR with the results.

- **Changed**
  - Restore `main`, `module`, and `types` fields alongside the export map for broader CJS/ESM tool compatibility.
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.0] - 2025-12-31

- **Added**
  - Additional validator coverage for names, safe text, percentages, rich text, user IDs, languages (BCP47), and ISO country/currency codes.

- **Changed**
  - README usage examples refreshed to match current `createSchema` signature, field helpers, and default-handling behavior.
  - Optionality tracking consolidated to a single flag (`isRequired`, default `true`) used across validation, descriptions, and type inference; `.optional()`/`.default()` set `isRequired` to `false`.
  - Validation helpers re-export `validateLanguage` (BCP 47).

- **Fixed**
  - Ref logging keeps `type/id` when no nested shape is provided.
  - Optional PII fields no longer emit null/undefined artifacts when absent during storage/read/scrub.
  - Validation deep-clone now preserves non-JSON-safe values (e.g., `Date`) without mutating caller data.
  - PII helpers align array item encryption/hashing across storage/read/scrub, including nested object items.
  - Defaults are now applied during validation for top-level fields, nested objects, and array items.
  - `prepareForRead` now returns hashed values written by `prepareForStorage`, preventing loss of hash-only PII fields.
  - Composition validation now uses the item ref type for array-of-ref fields, correctly resolving and validating referenced entities.
  - Arrays of primitives now run their item validators (e.g., `.pattern()`, `.min()`) for every element instead of accepting invalid values.
  - Arrays of refs now validate nested ref shapes (defaults, required fields, and validators) instead of only checking `type/id`.
  - Single ref fields now enforce `refType` during validation, preventing mismatched entity links earlier.
  - PII helpers (`prepareForStorage`, `prepareForRead`, `sanitizeForLog`, `scrubPiiForDelete`) now recurse through nested objects, arrays, and refs so nested PII is transformed/sanitized/scrubbed correctly.
  - Validation now deep-clones inputs before applying defaults to avoid mutating caller-owned objects.
  - Schema descriptions now surface optionality, system/immutable flags, deprecation metadata, and normalize nullable fields (`enum`, `refType`, `pii`, `deprecatedVersion`) to `null`.
  - Composition validation rejects mismatched reference types before resolution.
  - Numeric enums are enforced during validation instead of accepting out-of-range values.
  - Immutable flags are honored for nested object/array/ref children when validating updates against an existing entity.
  - PII strict/warn enforcement now applies to nested fields (objects, arrays, refs), blocking empty high-PII subfields.
  - ISO 3166-1 list updated to include `PS`; ISO 4217 list updated to include `SLE` (while retaining `SLL` for legacy data).

- **Security**
  - (placeholder)

## [1.1.1] - 2025-09-24

- **Added**
  - new Schema upgrade pathway

- **Changed**
  - package.json update to include:
    - "sideEffects": false,
    - "files": ["dist"],
  - package.json removed:
    - "main": "./dist/index.cjs",
    - "module": "./dist/index.js",
    - "types": "./dist/index.d.ts",

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0] - 2025-09-18

- **Added**
  - field().upgrade() function now added to allow upgrades of older data sets to newer data.
  - min/max/pattern/default FieldBuilder elements added for validation.
  - Added new validator for language code BCP 47 format.
  - Added new validator options for ISO DATE TIME filtering to Date or Time or Both
  - Added new pre-built field() types including PII flags and validators for:
    - email
    - phone
    - url
    - uuid
    - dateTimeISO
    - dateISO
    - timeISO
    - richText
    - generalText
    - latitude
    - longitude
    - version
    - countryCode
    - languageCode
  - New field().xxx tests for the above types.

- **Changed**
  - Updated CD Pipeline to accept a new param for version Major, Minor or Patch update

- **Fixed**
  - validateISODateTime for dateTime now accepts string matches that might not be the same as the date.toISOString() return value but are still valid ISO Date Time Strings.

- **Security**
  - (placeholder)

## [1.0.18] - 2025-09-17

- **Fixed**
  - CD pipeline reorder fix to restore CHANGELOG.md versions

## [1.0.17] - 2025-09-17

- **Added**
  - chore: Code coverage added

## [1.0.13] - 2025-09-16

- **Changed**
  - ./src/schema.ts Added comments defining functionality on all externally facing functions.

- **Fixed**
  - ./src/schema.ts Validation no longer mutates the input, internal system fields are set only on result if not previously present.

---

## [1.0.0] - 2025-09-16

- **Added**
  - Initial public release of `@plasius/schema`.
  - Fluent field builder API: `field().string().required()`, `field().number().min()`, etc.
  - Type inference utilities to derive TypeScript types from schema definitions.
  - Built-in validators for common standards:
    - ISO-3166 country codes
    - ISO-4217 currency codes
    - RFC 5322 email format
    - E.164 phone format
    - WHATWG URL format
    - ISO 8601 date/time
    - OWASP-guided text/name constraints
    - UUID (RFC 4122) and SemVer 2.0.0
  - PII annotations and helpers for redaction/masking before logging.
  - Lightweight validation runner with success/error result types.

- **Changed**
  - N/A (initial release)

- **Fixed**
  - N/A (initial release)

---

## Release process (maintainers)

1. Update `CHANGELOG.md` under **Unreleased** with user‑visible changes.
2. Bump version in `package.json` following SemVer (major/minor/patch).
3. Move entries from **Unreleased** to a new version section with the current date.
4. Tag the release in Git (`vX.Y.Z`) and push tags.
5. Publish to npm (via CI/CD or `npm publish`).

> Tip: Use Conventional Commits in PR titles/bodies to make changelog updates easier.

---

[Unreleased]: https://github.com/Plasius-LTD/schema/compare/v1.3.1...HEAD
[1.0.0]: https://github.com/Plasius-LTD/schema/releases/tag/v1.0.0
[1.0.13]: https://github.com/Plasius-LTD/schema/releases/tag/v1.0.13
[1.0.17]: https://github.com/Plasius-LTD/schema/releases/tag/v1.0.17
[1.0.18]: https://github.com/Plasius-LTD/schema/releases/tag/v1.0.18
[1.1.0]: https://github.com/Plasius-LTD/schema/releases/tag/v1.1.0
[1.1.1]: https://github.com/Plasius-LTD/schema/releases/tag/v1.1.1
[1.2.0]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.0
[1.2.1]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.1

## [1.2.1] - 2026-02-11

- **Added**
  - Initial release.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)
[1.2.2]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.2
[1.2.5]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.5
[1.2.6]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.6
[1.2.7]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.7
[1.2.8]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.8
[1.2.9]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.9
[1.2.10]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.10
[1.2.11]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.11
[1.2.12]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.12
[1.2.15]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.15
[1.2.16]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.16
[1.2.17]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.17
[1.2.18]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.18
[1.3.0]: https://github.com/Plasius-LTD/schema/releases/tag/v1.3.0
[1.3.1]: https://github.com/Plasius-LTD/schema/releases/tag/v1.3.1
