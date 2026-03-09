# ADR-0004: Field Exposure Metadata and Public Serialization

## Status

- Accepted
- Date: 2026-03-09
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

## Tags

schema, security, privacy, serialization, api

## Context

`@plasius/schema` validated entity payloads correctly, but it did not provide a first-class way to distinguish storage-only fields from client-safe fields. Downstream packages therefore reused validated persistence entities as API responses, which made it easy to leak internal metadata such as partition keys, audit actor identifiers, and storage-engine fields.

Validation and serialization are separate concerns. A field can be valid and required for server-side persistence while still being inappropriate for client responses. Relying on ad hoc response mappers in each consumer left too much room for drift and accidental disclosure.

## Decision

Add field-level exposure metadata to `@plasius/schema` and expose a schema-driven serializer:

- fields default to `public`
- fields can be marked `internal` using `.internal()` or `.exposure("internal")`
- schemas gain `serialize(input, options?)`
- `serialize()` strips unknown fields and excludes `internal` fields by default
- callers can opt in to `includeInternal: true` for trusted server-side projections

This keeps validation permissive enough for persistence while making client-facing serialization explicit and reusable.

## Alternatives Considered

- **Option A**: Keep per-route/manual DTO mappers only
  - Pros: no schema API change
  - Cons: duplicates logic, encourages drift, and makes accidental leaks more likely
- **Option B**: Treat `.system()` as implicitly non-public
  - Pros: minimal additional API surface
  - Cons: conflates lifecycle semantics with exposure semantics and would misclassify some fields
- **Option C**: Add schema-level exposure defaults without field overrides
  - Pros: simple
  - Cons: too coarse for mixed public/internal entities

## Consequences

- Positive outcomes
  - centralizes client-safe serialization policy in the schema layer
  - reduces accidental disclosure of persistence metadata
  - preserves compatibility for validation and storage paths
- Negative outcomes
  - requires downstream entity definitions to annotate internal fields deliberately
  - adds another schema metadata axis that maintainers need to understand
- Technical debt avoided
  - repeated hand-written mappers that fall out of sync with schema changes
- Impact on future decisions
  - persistence entities and public DTOs can now share one schema contract while still enforcing exposure boundaries

## Related Decisions

- [ADR-0001: Schema Library Purpose and Scope](./adr-0001:%20schema.md)

## References

- [Architectural Decision Records (ADR) standard](https://adr.github.io/)
