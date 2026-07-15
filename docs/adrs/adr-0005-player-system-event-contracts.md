# ADR-0005: Reusable Player-System Event Contracts

- Status: Accepted
- Date: 2026-07-15

## Context

The player-system event pipeline needs one schema boundary for raw observed
events, normalized projection batches, and curated Event Log/Achievement
snapshots. Defining these shapes in the consuming site makes it easy for
ingestion, projection, and read paths to drift and makes privacy review harder.

## Decision

Export three versioned schemas from `@plasius/schema`:

- `PlayerSystemObservedEventBatchSchema` for raw player-observable ingress;
- `PlayerSystemNormalizedEventBatchSchema` for deterministic projection output;
- `PlayerSystemCuratedSnapshotSchema` for per-player Event Log and
  Achievement read models.

All player-visible text uses the existing safe-text validator. `playerId` is
the only personal identifier in the contracts and is annotated as low PII with
stable pseudonymization for logs. Schema serialization retains only declared
fields, so hidden server truth or diagnostic over-posts cannot enter the blob
projection. The existing site feature flag and capability remain the rollout
controls; this package only defines portable contracts.

## Alternatives considered

- Keep schemas in the site backend: minimal immediate change, but duplicates
  contracts and prevents shared validation at other producers or consumers.
- Use untyped JSON: flexible, but loses version enforcement, safe-text checks,
  and privacy metadata at the storage boundary.

## Impact and verification

The public package gains reusable TypeScript types and schema instances without
new dependencies. Contract tests cover defaults, rejected categories and
unsafe text, serialization allowlisting, PII audit metadata, log
pseudonymization, achievements, and progress tracks. Consumers remain behind
the existing rollout flag and capability.
