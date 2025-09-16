
# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

- **Added**
  - (placeholder) Add new validators, field helpers, or PII utilities here.

- **Changed**
  - ./src/schema.ts Added comments defining functionality on all externally facing functions.

- **Fixed**
  - ./src/schema.ts Validation no longer mutates the input, internal system fields are set only on result if not previously present.

- **Security**
  - (placeholder)

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

[Unreleased]: https://github.com/Plasius-LTD/plasius-schema/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Plasius-LTD/plasius-schema/releases/tag/v1.0.0
