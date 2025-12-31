
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

[Unreleased]: https://github.com/Plasius-LTD/schema/compare/v1.2.0...HEAD
[1.0.0]: https://github.com/Plasius-LTD/schema/releases/tag/v1.0.0
[1.0.13]: https://github.com/Plasius-LTD/schema/releases/tag/v1.0.13
[1.0.17]: https://github.com/Plasius-LTD/schema/releases/tag/v1.0.17
[1.0.18]: https://github.com/Plasius-LTD/schema/releases/tag/v1.0.18
[1.1.0]: https://github.com/Plasius-LTD/schema/releases/tag/v1.1.0
[1.1.1]: https://github.com/Plasius-LTD/schema/releases/tag/v1.1.1
[1.2.0]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.0
