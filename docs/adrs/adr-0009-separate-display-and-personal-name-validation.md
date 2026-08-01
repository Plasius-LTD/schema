# ADR-0009: Separate display-name and personal-name validation

- Status: Accepted
- Date: 2026-08-01

## Context

The package exposes `validateName` for personal names. Consumers also used it
for public display names, even though display names legitimately contain
digits and are not necessarily legal or personal-name components. Relaxing the
existing validator would silently change first, middle, and last-name rules.

## Decision

Keep `validateName` unchanged and export `validateDisplayName` as a separate
validator. Display names accept Unicode letters, combining marks, and decimal
digits plus apostrophes, hyphens, periods, and spaces. Both validators retain
the same non-empty, 256-character, control-character, and unsupported-symbol
guards.

## Consequences

- Consumers select validation based on field semantics.
- Digit-bearing display names no longer require weakening personal-name
  validation.
- Existing `validateName` consumers retain their current behavior.
- The new validator is a backwards-compatible public API addition.

## Rollout

Task Plasius-LTD/schema#41 inherits Feature #1642 and
`admin.identity-governance.enabled`. The validator ships through the approved
package CD workflow before downstream packages consume it.

