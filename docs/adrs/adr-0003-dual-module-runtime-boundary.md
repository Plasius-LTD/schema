# ADR-0003: Dual Module Runtime Boundary Enforcement

## Status

- Proposed -> Accepted
- Date: 2026-03-01
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

## Context

`@plasius/*` packages are published with dual ESM/CJS entrypoints. Some packages
emit CommonJS files as `dist-cjs/*.js` while package root remains
`type: module`. Without an explicit CommonJS boundary, Node may interpret those
files as ESM and fail for `require(...)` consumers at runtime.

## Decision

Template policy is:

- Preferred: emit CommonJS as `.cjs` (`dist/index.cjs`) alongside ESM.
- Allowed fallback (`dist-cjs/*.js`): generate `dist-cjs/package.json` with
  `{ "type": "commonjs" }` during build and enforce this in `pack:check`.
- `prepublishOnly` must execute both build and `pack:check`.

## Consequences

- Runtime compatibility is preserved for both ESM and CJS consumers.
- Packaging regressions are blocked before publish.
- Future `@plasius/*` package creation has a concrete, enforceable standard.
