# ADR-0002: Dual ESM and CJS Distribution

## Status

- Proposed -> Accepted
- Date: 2025-09-14
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

## Context

The schema library is consumed by both ESM-first tooling and CommonJS environments. We need to ship types and maintain compatibility without forcing downstream consumers to change their module system.

## Decision

We will publish dual ESM and CJS builds using `tsup`, with an exports map that provides:

- `import` -> `dist/index.js`
- `require` -> `dist/index.cjs`
- `types` -> `dist/index.d.ts`

## Consequences

- **Positive:** Broad compatibility and clear module resolution; first-class TypeScript support.
- **Negative:** Additional build outputs and the need to keep outputs aligned.
- **Neutral:** Consumers get the appropriate format automatically via Node/bundler resolution.

## Alternatives Considered

- **ESM-only:** Rejected due to existing CommonJS consumers.
- **CJS-only:** Rejected because ESM is the primary modern path.
- **No exports map:** Rejected due to ambiguous entrypoint resolution.
