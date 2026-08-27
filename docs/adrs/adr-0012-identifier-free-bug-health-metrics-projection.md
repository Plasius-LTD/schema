# ADR-0012: Identifier-Free Bug-Health Metrics Projection

- Status: Accepted
- Date: 2026-08-27

## Context

Hourly bug-health reports combine accepted, evidence-backed bug packets with
operational facts that those packets cannot contain: rejected intake counts,
privacy-safe traffic denominators, and abuse-control block bands. Deriving
these facts from packet enumeration would omit rejected and edge-blocked
requests. Reading raw edge, WAF, request, or control telemetry inside the
report processor would cross privacy and authorization boundaries. Treating a
missing source as zero would publish false operational assurance.

The reporting boundary therefore needs one immutable, aggregate-only input per
UTC hour, without retaining an event stream or a reporter join surface.

## Decision

Add `FeedbackBugHealthMetricsProjectionSchema` as a closed, additive contract.
Its complete business shape is:

- `projectionId`: canonical lowercase UUIDv4, deterministically derived by the
  trusted producer from the UTC hour;
- `windowStart` and `windowEnd`: one exact aligned UTC hour;
- `observedAt`: canonical server UTC at or after the window end;
- `finalized`: literal `true`;
- `rejectedCount`: bounded application rejection count;
- `trafficDenominator`: bounded privacy-safe traffic denominator;
- `abuseBlockBands`: unique positive counts in the frozen
  `FEEDBACK_ABUSE_BLOCK_BANDS` order.

The standard exact `type` and `version` fields identify the contract. Strict
PII enforcement, recursive unknown-field rejection, exact identity, bounded
integer counts, and an empty PII audit apply. Application rejections and
edge/control blocks are independent facts and are not forced to sum.

The schema validates the UUID representation but does not perform hashing.
The trusted producer must derive the ID from the canonical hour, and every
consumer must independently verify that binding before use. The projection is
written immutably to a separate private storage boundary. Its producer may
read only already-aggregated safe platform metrics; the report reader receives
no access to raw WAF, request, network, or abuse-control events.

The contract cannot express a reporter, pseudonym, account, reservation,
request/correlation/session identifier, IP address, user agent, locale,
client timestamp, header, route/URL/referrer, narrative, ciphertext, pixels,
Blob locator, content hash, log, or raw telemetry. Report materialization must
fail closed when the exact projection is absent, malformed, non-final,
duplicated, or mismatched. It must never substitute zeroes.

## Consequences

- Hourly reports can include defensible rejection, traffic, and block facts
  without joining accepted feedback to raw operational telemetry.
- Separate producer and reader identities preserve least privilege and make
  the private metrics boundary independently auditable.
- Late/replayed materialization remains deterministic because one canonical
  hour maps to one immutable projection.
- The package validates shape only. Deterministic ID derivation, conditional
  creation, storage isolation, retention, RBAC, and source aggregation remain
  host and infrastructure responsibilities.
- Deployments without the complete producer/storage/reader chain must keep
  bug reporting materialization and dependent public/Admin/MCP views off.

## Alternatives considered

- Read raw WAF or request logs from the report processor: rejected because it
  expands access to network and request data and risks privacy joins.
- Infer rejection and traffic counts from accepted packets: rejected because
  those packets cannot represent rejected or edge-blocked requests.
- Publish missing inputs as zero: rejected because it produces misleading
  enterprise reporting and hides broken telemetry.
- Store each blocked event in the feedback boundary: rejected because the
  report needs only bounded aggregates and event retention increases privacy
  and abuse risk.

## Related decisions

- [ADR-0006: Privacy-Safe Feedback Contract Boundaries](./adr-0006-privacy-safe-feedback-contract-boundaries.md)
- [ADR-0011: Identifier-Free Feedback Acceptance Evidence](./adr-0011-identifier-free-feedback-acceptance-evidence.md)
- [Feedback contract design](../design/feedback-contracts.md)
