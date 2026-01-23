# ADR-0001: Schema Library Purpose and Scope

## Status

- Proposed -> Accepted
- Date: 2025-09-12
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

## Context

Managing consistent data structures across a distributed system is difficult. Without a central schema library, each service or package can diverge in how it defines and validates entities, leading to duplication, mismatches, and security gaps (especially around handling Personally Identifiable Information, or PII).

We need a way to:

- Define entities and fields in a consistent, strongly-typed way.
- Provide validation functions for standard data types and codes (ISO, RFC, OWASP, etc).
- Support annotation of PII fields so they can be masked or cleaned when logged or transmitted.
- Offer a foundation that other Plasius packages (e.g. entity-types, state, renderer) can depend upon.

## Decision

We will build a **schema library** (`@plasius/schema`) that:

- Provides a fluent builder API (`field().string().required()` etc.).
- Exposes reusable validators for standards like ISO-3166 country codes, ISO-4217 currency codes, RFC 5322 emails, etc.
- Implements utilities for PII handling (masking, redaction).
- Exports TypeScript types that infer entity structures from schema definitions.
- Is published as an open source package for transparency and reuse.

## Consequences

- **Positive:** Consistent validation, stronger typing, centralised handling of PII, reduced duplication across Plasius projects, easier onboarding of new developers.
- **Negative:** Adds a dependency layer that all other packages must import, requiring careful versioning and backward compatibility management.
- **Neutral:** External adopters may use the library without adopting the full Plasius ecosystem, which is acceptable and encouraged.

## Alternatives Considered

- **Do nothing:** Continue defining ad-hoc validation in each package. (Rejected: inconsistent and unsafe.)
- **Use an existing library (e.g. Zod, Yup, Joi):** These provide schema validation but lack PII auditing integration and may not align with our field-builder pattern. (Rejected for core use, though we may draw inspiration.)

## References

- [Architectural Decision Records (ADR) standard](https://adr.github.io/)