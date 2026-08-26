# ADR-0011: Identifier-Free Feedback Acceptance Evidence

- Status: Accepted
- Date: 2026-08-26

## Context

Feedback content packets are written immutably before the isolated abuse and
eligibility control plane commits a reservation. A crash or failed commit can
therefore leave a valid packet Blob that was never accepted. Enumerating all
packet Blobs during hourly or daily materialisation would count those orphans.
Reading committed control rows instead is not durable enough: those rows are
pseudonymous personal data and must expire shortly after cooldown or review
eligibility ends, while reporting windows and feedback packets live longer.

The durable reporting selector must prove acceptance without retaining a
reporter, control-plane join key, request trace, or user content.

## Decision

Add `FeedbackCommittedAcceptanceEvidenceSchema` as an additive, closed
contract. Its complete business shape is:

- `packetId`: canonical lowercase UUIDv4;
- `packetKind`: `bug` or `review`;
- `acceptedAt`: canonical millisecond-precision UTC copied from the validated
  immutable packet by a trusted server worker.

The schema's standard exact `type` and `version` fields identify the contract.
It uses strict PII enforcement, exact identity, recursive unknown-field
rejection, and has an empty PII audit.

The contract deliberately cannot express a state key, reservation,
idempotency or attempt value, pseudonym, subject/account/session identifier,
request/network metadata, narrative, ciphertext, pixels, Blob URL/path, or
content hash. It is not an HTTP intake contract and cannot prove its own
provenance. Consumers must create it only after an atomic control transition,
through a least-privilege delivery worker that independently locates and
validates the immutable packet. Report processors select only evidence-backed
packets and fail closed on missing, malformed, duplicate, or mismatched
evidence. They never use a scan-all-packets fallback.

The short-lived pseudonymous delivery-outbox entity belongs to the isolated
control-plane entity contract, not this durable schema. That separation keeps
control delivery possible without allowing its join keys into retained
evidence or reports.

## Consequences

- A packet Blob written before a failed control commit remains excluded from
  aggregates and public honesty metrics.
- Accepted packets remain reportable after pseudonymous cooldown/eligibility
  state is hard-deleted.
- Evidence can share the packet's retention horizon without retaining a
  reporter or a control-plane join key.
- Crash-safe delivery, conditional writes, immutable replay comparison,
  control-plane transactions, retention, and least-privilege identities remain
  host/storage responsibilities; this package validates only the JSON shape.
- Deployments without the evidence pipeline must keep feedback reporting and
  public honesty disabled rather than infer acceptance from packet presence.

## Alternatives considered

- Enumerate packet Blobs: rejected because pre-commit orphan packets are
  structurally valid and indistinguishable at that boundary.
- Retain committed pseudonymous control rows for the reporting horizon:
  rejected because it violates data-minimisation and deletion requirements.
- Put reservation or idempotency identifiers in durable evidence: rejected
  because it creates an unnecessary long-lived correlation surface.
- Write evidence before the control commit: rejected because it merely moves
  the orphan race to the evidence store.

## Related decisions

- [ADR-0006: Privacy-Safe Feedback Contract Boundaries](./adr-0006-privacy-safe-feedback-contract-boundaries.md)
- [Feedback contract design](../design/feedback-contracts.md)
