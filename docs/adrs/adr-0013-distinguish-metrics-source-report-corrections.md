# ADR-0013: Distinguish metrics-source report corrections

- Status: Accepted
- Date: 2026-08-30

## Context

Feedback reports can be corrected because packets arrived after an earlier
materialization, or because a separately finalized identifier-free metrics
source changed. The original manifest contract represented every correction
as a positive late-arrival count. A metrics-only correction therefore had to
lie about packet arrivals or remain unpublished.

## Decision

Add the optional closed `correctionReason` field to feedback materialization
manifests. Existing corrected manifests with a positive `lateArrivalCount`
remain valid. `late-arrival` explicitly requires a positive count, while
`metrics-source` requires exactly zero. Published revision-one manifests and
commit-reconciliation manifests cannot carry a correction reason.

No narrative, identifier, source locator, hash, timestamp, or open-ended reason
is introduced. The manifest continues to bind processor, window, revision,
bounded counts, report identity, and status.

## Consequences

- Processors can publish truthful metrics-only revisions.
- Existing positive late-arrival correction packets remain compatible.
- Unknown or contradictory correction reasons fail closed.
- Consumers must set `metrics-source` explicitly rather than infer it from a
  zero count.
